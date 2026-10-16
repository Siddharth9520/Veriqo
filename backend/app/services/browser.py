"""Browser execution service using Playwright."""

from dataclasses import dataclass
from datetime import datetime, timezone
import logging
from pathlib import Path
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

from playwright.async_api import (
    TimeoutError as PlaywrightTimeoutError,
    async_playwright,
)

from app.core.config import settings
from app.schemas.journey import ActionType, JourneyDefinition

logger = logging.getLogger(__name__)


@dataclass
class JourneyExecutionReport:
    """Outcome and evidence report from a browser journey run."""

    status: str  # "passed", "failed", "timed_out"
    started_at: datetime
    completed_at: datetime
    action_results: List[Dict[str, Any]]
    error_message: Optional[str]
    evidence_paths: List[str]


def resolve_safe_target_url(target_app_url: str, nav_url: str) -> str:
    """Validates that navigation stays within the registered target origin.

    Relative paths are resolved against target_app_url.
    Absolute URLs must share the exact scheme and netloc (origin).
    Dangerous schemes (javascript, file, data, etc.) are strictly disallowed.
    """
    parsed_target = urlparse(target_app_url)
    target_origin = f"{parsed_target.scheme}://{parsed_target.netloc}"

    # Handle relative or empty path
    if not nav_url or nav_url.startswith("/") or not urlparse(nav_url).netloc:
        resolved = urljoin(target_app_url, nav_url)
    else:
        resolved = nav_url

    parsed_resolved = urlparse(resolved)
    resolved_origin = f"{parsed_resolved.scheme}://{parsed_resolved.netloc}"

    if parsed_resolved.scheme not in ("http", "https") or resolved_origin != target_origin:
        raise ValueError(
            f"Security violation: Navigation to '{resolved}' is disallowed. "
            f"Allowed target origin is '{target_origin}' with HTTP or HTTPS scheme."
        )

    return resolved


async def execute_browser_journey(
    journey: JourneyDefinition,
    target_app_url: str,
    test_run_id: int,
) -> JourneyExecutionReport:
    """Executes a typed browser journey in an isolated Playwright browser context."""
    started_at = datetime.now(timezone.utc)
    action_results: List[Dict[str, Any]] = []
    evidence_paths: List[str] = []
    overall_status = "passed"
    final_error: Optional[str] = None

    # Prepare evidence directory
    evidence_dir = Path(settings.EVIDENCE_DIR)
    run_evidence_dir = evidence_dir / f"run_{test_run_id}"
    run_evidence_dir.mkdir(parents=True, exist_ok=True)

    browser = None
    context = None
    page = None

    try:
        async with async_playwright() as playwright:
            try:
                browser = await playwright.chromium.launch(
                    headless=settings.BROWSER_HEADLESS,
                )
            except Exception as launch_exc:
                logger.error("Failed to launch Playwright Chromium: %s", launch_exc)
                completed_at = datetime.now(timezone.utc)
                return JourneyExecutionReport(
                    status="failed",
                    started_at=started_at,
                    completed_at=completed_at,
                    action_results=[],
                    error_message=f"Browser launch error: {str(launch_exc)}",
                    evidence_paths=[],
                )

            context = await browser.new_context()
            page = await context.new_page()

            # Execute actions in sequential order
            for idx, action in enumerate(journey.actions):
                action_start = time.perf_counter()
                action_type = action.type
                action_passed = False
                action_error: Optional[str] = None

                try:
                    if action_type == ActionType.NAVIGATE:
                        resolved_url = resolve_safe_target_url(
                            target_app_url=target_app_url,
                            nav_url=action.url,
                        )
                        await page.goto(
                            resolved_url,
                            timeout=settings.DEFAULT_NAVIGATION_TIMEOUT_MS,
                            wait_until="domcontentloaded",
                        )

                    elif action_type == ActionType.CLICK:
                        locator = page.locator(action.selector)
                        await locator.click(timeout=settings.DEFAULT_ACTION_TIMEOUT_MS)

                    elif action_type == ActionType.FILL:
                        locator = page.locator(action.selector)
                        await locator.fill(
                            action.value,
                            timeout=settings.DEFAULT_ACTION_TIMEOUT_MS,
                        )

                    elif action_type == ActionType.ASSERT_TEXT_VISIBLE:
                        try:
                            if action.selector:
                                locator = page.locator(action.selector)
                                await locator.wait_for(
                                    state="visible",
                                    timeout=settings.DEFAULT_ACTION_TIMEOUT_MS,
                                )
                                content = await locator.inner_text()
                                if action.text not in content:
                                    raise AssertionError(
                                        f"Expected text '{action.text}' not found in selector '{action.selector}'. Content: '{content}'"
                                    )
                            else:
                                locator = page.get_by_text(action.text)
                                await locator.first.wait_for(
                                    state="visible",
                                    timeout=settings.DEFAULT_ACTION_TIMEOUT_MS,
                                )
                        except PlaywrightTimeoutError:
                            target_desc = f"'{action.text}'" + (f" in selector '{action.selector}'" if action.selector else "")
                            raise AssertionError(
                                f"Assertion failed: Expected visible text {target_desc} was not found within {settings.DEFAULT_ACTION_TIMEOUT_MS}ms"
                            )

                    elif action_type == ActionType.ASSERT_ELEMENT_VISIBLE:
                        try:
                            locator = page.locator(action.selector)
                            await locator.wait_for(
                                state="visible",
                                timeout=settings.DEFAULT_ACTION_TIMEOUT_MS,
                            )
                        except PlaywrightTimeoutError:
                            raise AssertionError(
                                f"Assertion failed: Expected element '{action.selector}' was not visible within {settings.DEFAULT_ACTION_TIMEOUT_MS}ms"
                            )

                    elif action_type == ActionType.SCREENSHOT:
                        screenshot_rel = f"run_{test_run_id}/step_{idx}_manual.png"
                        screenshot_full = evidence_dir / screenshot_rel
                        try:
                            await page.screenshot(path=str(screenshot_full))
                            evidence_paths.append(screenshot_rel)
                        except Exception as ss_err:
                            logger.warning("Could not take manual screenshot at step %d: %s", idx, ss_err)


                    elif action_type == ActionType.ASSERT_TITLE_CONTAINS:
                        current_title = await page.title()
                        expected_val = getattr(action, "value", "") or ""
                        if expected_val and expected_val.lower() not in current_title.lower():
                            raise AssertionError(
                                f"Assertion failed: Expected page title to contain '{expected_val}', but got '{current_title}'"
                            )

                    else:
                        raise ValueError(f"Unsupported action type: {action_type}")

                    action_passed = True


                except PlaywrightTimeoutError as timeout_err:
                    action_error = f"Timeout during action {idx} ({action_type}): {str(timeout_err)}"
                    overall_status = "timed_out"
                    final_error = action_error
                except AssertionError as assert_err:
                    action_error = str(assert_err)
                    overall_status = "failed"
                    final_error = action_error
                except Exception as step_exc:
                    action_error = f"Error during action {idx} ({action_type}): {str(step_exc)}"
                    if overall_status != "timed_out":
                        overall_status = "failed"
                    final_error = action_error

                duration_ms = (time.perf_counter() - action_start) * 1000.0
                action_results.append(
                    {
                        "action_index": idx,
                        "action_type": str(action_type),
                        "status": "passed" if action_passed else "failed",
                        "error": action_error,
                        "duration_ms": round(duration_ms, 2),
                    }
                )

                if not action_passed:
                    # Capture screenshot on failure
                    screenshot_rel = f"run_{test_run_id}/failure_step_{idx}.png"
                    screenshot_full = evidence_dir / screenshot_rel
                    try:
                        await page.screenshot(path=str(screenshot_full))
                        evidence_paths.append(screenshot_rel)
                    except Exception as ss_err:
                        logger.warning("Could not take failure screenshot: %s", ss_err)
                    break

            # Capture completion screenshot on pass
            if overall_status == "passed":
                completion_rel = f"run_{test_run_id}/completion.png"
                completion_full = evidence_dir / completion_rel
                try:
                    await page.screenshot(path=str(completion_full))
                    evidence_paths.append(completion_rel)
                except Exception as ss_err:
                    logger.warning("Could not take completion screenshot: %s", ss_err)

    except Exception as general_exc:
        logger.error("Unhandled error during journey execution: %s", general_exc)
        overall_status = "failed"
        final_error = str(general_exc)
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
    return JourneyExecutionReport(
        status=overall_status,
        started_at=started_at,
        completed_at=completed_at,
        action_results=action_results,
        error_message=final_error,
        evidence_paths=evidence_paths,
    )
