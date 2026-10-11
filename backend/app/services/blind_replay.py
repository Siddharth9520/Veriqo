import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
from pathlib import Path
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

from app.core.config import settings
from app.services.browser import resolve_safe_target_url

logger = logging.getLogger(__name__)


@dataclass
class ReplayExecutionReport:
    """Outcome and evidence report from an independent BlindReplay attempt."""

    outcome: str  # CONFIRMED, NOT_REPRODUCED, INCONCLUSIVE, FAILED, TIMED_OUT
    started_at: datetime
    completed_at: datetime
    execution_log: List[Dict[str, Any]]
    evidence_paths: List[str]
    error_message: Optional[str]


def parse_instruction_step(instruction_text: str) -> Dict[str, Any]:
    """Parses a single human-readable instruction into a semantic intent.

    Uses only user-visible text and semantic actions, without selectors or scripts.
    """
    clean = instruction_text.strip()
    # Strip leading step numbers like '1.', 'Step 1:', '-', '*'
    clean = re.sub(r"^(?:step\s*\d+[:.]?|\d+[.:)]|-|\*)\s*", "", clean, flags=re.IGNORECASE).strip()

    # Extract quoted text if present
    quoted = re.findall(r"['\"]([^'\"]+)['\"]", clean)

    # 1. Navigation intent
    nav_match = re.search(r"(?:navigate\s+to|go\s+to|open|visit|browse\s+to)\s+([^\s,;]+)", clean, re.IGNORECASE)
    if nav_match:
        url_target = quoted[0] if quoted else nav_match.group(1)
        return {"intent": "navigate", "target": url_target, "raw": instruction_text}

    # 2. Click intent
    if re.search(r"\b(?:click|press|tap|select)\b", clean, re.IGNORECASE):
        target = quoted[0] if quoted else re.sub(r"\b(?:click|press|tap|select|button|link|on)\b", "", clean, flags=re.IGNORECASE).strip()
        return {"intent": "click", "target": target, "raw": instruction_text}

    # 3. Fill / Type intent
    if re.search(r"\b(?:fill|type|enter|input)\b", clean, re.IGNORECASE):
        # Look for fill 'field' with 'value' or type 'value' into 'field'
        if len(quoted) >= 2:
            return {"intent": "fill", "target": quoted[0], "value": quoted[1], "raw": instruction_text}
        elif len(quoted) == 1:
            val = quoted[0]
            # Try to identify field from unquoted part
            field = re.sub(r"\b(?:fill|type|enter|input|into|with|in)\b", "", clean, flags=re.IGNORECASE)
            field = field.replace(f"'{val}'", "").replace(f'"{val}"', "").strip()
            return {"intent": "fill", "target": field or "input", "value": val, "raw": instruction_text}
        else:
            return {"intent": "fill", "target": "input", "value": clean, "raw": instruction_text}

    # 4. Verify / Assert intent
    if re.search(r"\b(?:verify|check|assert|expect|see)\b", clean, re.IGNORECASE):
        target = quoted[0] if quoted else clean
        return {"intent": "assert", "target": target, "raw": instruction_text}

    # Fallback to ambiguous / generic instruction
    return {"intent": "ambiguous", "target": clean, "raw": instruction_text}


def evaluate_expected_condition(
    expected_behavior: str,
    page_text: str,
) -> Tuple[bool, bool, str]:
    """Evaluates whether the expected behavior holds or is demonstrably violated.

    Returns:
        (is_violated, is_ambiguous, reason)
    """
    clean_expected = expected_behavior.strip()
    quoted = re.findall(r"['\"]([^'\"]+)['\"]", clean_expected)

    # Check for negative assertion (e.g. "error should not appear", "no error")
    is_negative = bool(re.search(r"\b(?:should\s+not|must\s+not|never|no\s+error)\b", clean_expected, re.IGNORECASE))

    if quoted:
        target_text = quoted[0]
    else:
        # If no quotes, strip common assertion lead-ins
        target_text = re.sub(
            r"^(?:expected|should\s+be|must\s+be|verify\s+that|assert\s+that|text)\s*",
            "",
            clean_expected,
            flags=re.IGNORECASE,
        ).strip()

    if not target_text:
        return False, True, "Expected behavior description is empty or ambiguous."

    target_present = target_text.lower() in page_text.lower()

    if is_negative:
        # Negative condition: if target text is present, it is violated!
        if target_present:
            return True, False, f"Expected '{target_text}' not to appear, but it was found on the page."
        else:
            return False, False, f"Expected '{target_text}' not to appear, and it was absent."
    else:
        # Positive condition: if target text is absent, it is violated!
        if not target_present:
            return True, False, f"Expected text '{target_text}' was not found on the page."
        else:
            return False, False, f"Expected text '{target_text}' was successfully found on the page."


async def execute_blind_replay(
    target_app_url: str,
    reproduction_instructions: str,
    expected_behavior: str,
    replay_id: int,
) -> ReplayExecutionReport:
    """Independently replays human reproduction instructions in a fresh browser context."""
    started_at = datetime.now(timezone.utc)
    execution_log: List[Dict[str, Any]] = []
    evidence_paths: List[str] = []

    evidence_dir = Path(settings.EVIDENCE_DIR)
    replay_evidence_dir = evidence_dir / f"replay_{replay_id}"
    replay_evidence_dir.mkdir(parents=True, exist_ok=True)

    browser = None
    context = None
    page = None

    # Parse instructions line by line
    instruction_lines = [
        line.strip()
        for line in reproduction_instructions.strip().splitlines()
        if line.strip()
    ]

    if not instruction_lines:
        return ReplayExecutionReport(
            outcome="INCONCLUSIVE",
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            execution_log=[],
            evidence_paths=[],
            error_message="Replay was inconclusive: no valid reproduction instructions provided.",
        )

    parsed_target = urlparse(target_app_url)
    target_origin = f"{parsed_target.scheme}://{parsed_target.netloc}"

    try:
        async with async_playwright() as playwright:
            try:
                browser = await playwright.chromium.launch(
                    headless=settings.BROWSER_HEADLESS,
                )
            except Exception as launch_exc:
                logger.error("Failed to launch browser for BlindReplay: %s", launch_exc)
                return ReplayExecutionReport(
                    outcome="FAILED",
                    started_at=started_at,
                    completed_at=datetime.now(timezone.utc),
                    execution_log=[],
                    evidence_paths=[],
                    error_message=f"Browser launch error: {str(launch_exc)}",
                )

            # Strictly fresh, independent browser context
            context = await browser.new_context()

            # Guard against cross-origin navigation and redirects
            async def intercept_navigation_routes(route):
                req = route.request
                if req.is_navigation_request():
                    parsed_req = urlparse(req.url)
                    req_origin = f"{parsed_req.scheme}://{parsed_req.netloc}"
                    if parsed_req.scheme in ("http", "https") and req_origin != target_origin:
                        logger.warning(
                            "Cross-origin navigation/redirect blocked: %s", req.url
                        )
                        await route.abort("blockedbyclient")
                        return
                await route.continue_()

            await context.route("**/*", intercept_navigation_routes)

            page = await context.new_page()

            # Execute instructions sequentially with bounded total timeout
            had_ambiguity = False
            step_failed = False

            try:
                async with asyncio.timeout(settings.DEFAULT_REPLAY_TIMEOUT_SECONDS):
                    for idx, raw_instruction in enumerate(instruction_lines):
                        step_start = time.perf_counter()
                        parsed = parse_instruction_step(raw_instruction)
                        intent = parsed["intent"]
                        target = parsed["target"]
                        step_log = {
                            "step_index": idx,
                            "instruction": raw_instruction,
                            "intent": intent,
                            "status": "passed",
                            "details": None,
                        }

                        try:
                            if intent == "navigate":
                                nav_url = resolve_safe_target_url(target_app_url, target)
                                await page.goto(
                                    nav_url,
                                    timeout=settings.DEFAULT_NAVIGATION_TIMEOUT_MS,
                                    wait_until="domcontentloaded",
                                )
                                # Check if page redirected outside target origin
                                if page.url and page.url != "about:blank":
                                    curr_orig = f"{urlparse(page.url).scheme}://{urlparse(page.url).netloc}"
                                    if curr_orig != target_origin:
                                        raise ValueError(
                                            f"Cross-origin redirect violation: navigated to '{curr_orig}', outside target origin '{target_origin}'."
                                        )
                                step_log["details"] = f"Navigated to {nav_url}"

                            elif intent == "click":
                                # Try user-visible text / role locators without original selectors
                                clicked = False
                                # 1. Role button
                                btn = page.get_by_role("button", name=target)
                                if await btn.count() > 0 and await btn.first.is_visible():
                                    await btn.first.click(timeout=settings.DEFAULT_ACTION_TIMEOUT_MS)
                                    clicked = True
                                # 2. Role link
                                if not clicked:
                                    link = page.get_by_role("link", name=target)
                                    if await link.count() > 0 and await link.first.is_visible():
                                        await link.first.click(timeout=settings.DEFAULT_ACTION_TIMEOUT_MS)
                                        clicked = True
                                # 3. By visible text
                                if not clicked:
                                    elem = page.get_by_text(target, exact=False)
                                    if await elem.count() > 0 and await elem.first.is_visible():
                                        await elem.first.click(timeout=settings.DEFAULT_ACTION_TIMEOUT_MS)
                                        clicked = True

                                if not clicked:
                                    step_log["status"] = "ambiguous"
                                    step_log["details"] = f"Could not find clickable element with text '{target}'"
                                    had_ambiguity = True
                                else:
                                    step_log["details"] = f"Clicked element '{target}'"

                            elif intent == "fill":
                                val = parsed.get("value", "")
                                filled = False
                                # Try by label
                                input_elem = page.get_by_label(target)
                                if await input_elem.count() > 0 and await input_elem.first.is_visible():
                                    await input_elem.first.fill(val, timeout=settings.DEFAULT_ACTION_TIMEOUT_MS)
                                    filled = True
                                # Try by placeholder
                                if not filled:
                                    input_elem = page.get_by_placeholder(target)
                                    if await input_elem.count() > 0 and await input_elem.first.is_visible():
                                        await input_elem.first.fill(val, timeout=settings.DEFAULT_ACTION_TIMEOUT_MS)
                                        filled = True
                                # Try visible input
                                if not filled:
                                    input_elem = page.locator("input:visible").first
                                    if await input_elem.count() > 0:
                                        await input_elem.fill(val, timeout=settings.DEFAULT_ACTION_TIMEOUT_MS)
                                        filled = True

                                if not filled:
                                    step_log["status"] = "ambiguous"
                                    step_log["details"] = f"Could not find input field for '{target}'"
                                    had_ambiguity = True
                                else:
                                    step_log["details"] = f"Filled field '{target}' with value"

                            elif intent == "assert":
                                txt_elem = page.get_by_text(target, exact=False)
                                is_visible = await txt_elem.count() > 0 and await txt_elem.first.is_visible()
                                step_log["details"] = f"Checked text '{target}': visible={is_visible}"

                            else:
                                step_log["status"] = "ambiguous"
                                step_log["details"] = f"Ambiguous instruction: '{raw_instruction}'"
                                had_ambiguity = True

                        except PlaywrightTimeoutError as timeout_err:
                            step_log["status"] = "timed_out"
                            step_log["details"] = str(timeout_err)
                            step_failed = True
                            break
                        except Exception as step_exc:
                            step_log["status"] = "failed"
                            step_log["details"] = str(step_exc)
                            step_failed = True
                            break
                        finally:
                            duration_ms = (time.perf_counter() - step_start) * 1000.0
                            step_log["duration_ms"] = round(duration_ms, 2)
                            execution_log.append(step_log)

            except (TimeoutError, asyncio.TimeoutError):
                step_failed = True
                final_outcome = "TIMED_OUT"
                err_msg = f"BlindReplay exceeded maximum allowed time limit ({settings.DEFAULT_REPLAY_TIMEOUT_SECONDS}s)."

            # Determine final outcome
            if step_failed:
                if 'final_outcome' not in locals():
                    last_step = execution_log[-1] if execution_log else {}
                    if last_step.get("status") == "timed_out":
                        final_outcome = "TIMED_OUT"
                        err_msg = last_step.get("details")
                    else:
                        final_outcome = "FAILED"
                        err_msg = last_step.get("details")
            elif had_ambiguity:
                # Ambiguous reproduction instructions
                final_outcome = "INCONCLUSIVE"
                err_msg = "Replay was inconclusive: one or more instructions were ambiguous or could not be mapped to page elements."
            else:
                # Evaluate final page state against expected behavior
                page_content = await page.inner_text("body")
                is_violated, is_ambiguous, reason = evaluate_expected_condition(
                    expected_behavior=expected_behavior,
                    page_text=page_content,
                )

                if is_ambiguous:
                    final_outcome = "INCONCLUSIVE"
                    err_msg = reason
                elif is_violated:
                    final_outcome = "CONFIRMED"
                    err_msg = None
                else:
                    final_outcome = "NOT_REPRODUCED"
                    err_msg = None

            # Capture screenshot evidence
            screenshot_rel = f"replay_{replay_id}/{final_outcome.lower()}.png"
            screenshot_full = evidence_dir / screenshot_rel
            try:
                await page.screenshot(path=str(screenshot_full))
                evidence_paths.append(screenshot_rel)
            except Exception as ss_err:
                logger.warning("Could not take replay screenshot: %s", ss_err)

    except Exception as general_exc:
        logger.error("BlindReplay execution failed unexpectedly: %s", general_exc)
        return ReplayExecutionReport(
            outcome="FAILED",
            started_at=started_at,
            completed_at=datetime.now(timezone.utc),
            execution_log=execution_log,
            evidence_paths=evidence_paths,
            error_message=f"Infrastructure error: {str(general_exc)}",
        )
    finally:
        # Guarantee resource cleanup
        try:
            if page:
                await page.close()
        except Exception:
            pass
        try:
            if context:
                await context.close()
        except Exception:
            pass
        try:
            if browser:
                await browser.close()
        except Exception:
            pass

    completed_at = datetime.now(timezone.utc)
    return ReplayExecutionReport(
        outcome=final_outcome,
        started_at=started_at,
        completed_at=completed_at,
        execution_log=execution_log,
        evidence_paths=evidence_paths,
        error_message=err_msg,
    )
