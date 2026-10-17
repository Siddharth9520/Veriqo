"""Bounded Autonomous Exploration & Journey Synthesis Engine.

Explores registered target web applications using Playwright to:
1. Discover same-origin links, navigation menus, and visible interactive forms.
2. Identify safe, non-destructive workflows (catalog browsing, searching, tab navigation).
3. Synthesize typed, validated JourneyDefinitions with explicit assertions and screenshots.
4. Enforce strict depth, page count, action count, and timeout bounds.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
import logging
import re
import time
from typing import Any, Dict, List, Optional, Set
from urllib.parse import urljoin, urlparse

from playwright.async_api import async_playwright

from app.core.config import settings
from app.schemas.journey import (
    ActionType,
    AssertElementVisibleAction,
    AssertTextVisibleAction,
    AssertTitleContainsAction,
    ClickAction,
    FillAction,
    JourneyAction,
    JourneyDefinition,
    NavigateAction,
    ScreenshotAction,
)
from app.services.browser import resolve_safe_target_url

logger = logging.getLogger(__name__)

# Destructive action blacklists to prevent accidental deletion or checkout execution
DESTRUCTIVE_KEYWORDS = {
    "delete", "remove", "destroy", "drop", "purge", "clear",
    "pay", "charge", "buy", "purchase", "checkout", "order",
    "unsubscribe", "cancel", "logout", "signout", "terminate",
}


@dataclass
class ExplorationResult:
    """Outcome and synthesized journey from an autonomous exploration run."""

    target_app_url: str
    discovered_urls: List[str]
    generated_journey: JourneyDefinition
    exploration_trace: List[Dict[str, Any]]
    pages_crawled: int
    duration_ms: float
    started_at: datetime
    completed_at: datetime


def is_safe_action_text(text: Optional[str]) -> bool:
    """Returns True if the text does not contain destructive keywords."""
    if not text:
        return True
    lower = text.strip().lower()
    for kw in DESTRUCTIVE_KEYWORDS:
        if re.search(r"\b" + re.escape(kw) + r"\b", lower):
            return False
    return True


async def explore_target_application(
    target_app_url: str,
    max_pages: int = 5,
    max_depth: int = 2,
    max_actions: int = 12,
    timeout_seconds: int = 30,
) -> ExplorationResult:
    """Autonomously crawls the target application within safe origin boundaries

    and synthesizes a reproducible, typed JourneyDefinition.
    """
    start_time = time.perf_counter()
    started_at = datetime.now(timezone.utc)
    trace: List[Dict[str, Any]] = []

    # Enforce safe origin
    base_url = resolve_safe_target_url(target_app_url, "/")
    parsed_base = urlparse(base_url)
    target_origin = f"{parsed_base.scheme}://{parsed_base.netloc}"

    visited_urls: Set[str] = set()
    queue: List[Dict[str, Any]] = [{"url": base_url, "depth": 0}]
    discovered_urls: List[str] = [base_url]
    synthesized_actions: List[JourneyAction] = []

    # Initial landing action
    synthesized_actions.append(NavigateAction(type=ActionType.NAVIGATE, url="/"))
    synthesized_actions.append(ScreenshotAction(type=ActionType.SCREENSHOT, description="landing_view"))

    trace.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": "exploration_start",
        "target_origin": target_origin,
        "max_pages": max_pages,
        "max_depth": max_depth,
    })

    browser = None
    context = None
    page = None

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=settings.BROWSER_HEADLESS)
            context = await browser.new_context()
            page = await context.new_page()

            while queue and len(visited_urls) < max_pages and len(synthesized_actions) < max_actions:
                elapsed = time.perf_counter() - start_time
                if elapsed >= timeout_seconds:
                    trace.append({"event": "timeout_reached", "elapsed_s": round(elapsed, 2)})
                    break

                item = queue.pop(0)
                current_url = item["url"]
                current_depth = item["depth"]

                if current_url in visited_urls:
                    continue
                visited_urls.add(current_url)

                try:
                    safe_url = resolve_safe_target_url(base_url, current_url)
                    await page.goto(safe_url, timeout=settings.DEFAULT_NAVIGATION_TIMEOUT_MS, wait_until="domcontentloaded")
                except Exception as nav_err:
                    trace.append({
                        "event": "navigation_skipped",
                        "url": current_url,
                        "reason": str(nav_err),
                    })
                    continue

                page_title = await page.title()
                if page_title:
                    # Add assertion for page title if meaningful
                    clean_title = page_title.strip()
                    if clean_title and len(clean_title) < 50:
                        synthesized_actions.append(
                            AssertTitleContainsAction(type=ActionType.ASSERT_TITLE_CONTAINS, value=clean_title)
                        )

                # Scan for prominent heading
                try:
                    h1_elem = page.locator("h1").first
                    if await h1_elem.is_visible(timeout=1000):
                        h1_text = (await h1_elem.inner_text()).strip()
                        if h1_text and len(h1_text) < 60:
                            synthesized_actions.append(
                                AssertTextVisibleAction(type=ActionType.ASSERT_TEXT_VISIBLE, text=h1_text[:40])
                            )
                except Exception:
                    pass

                # Scan interactive same-origin links
                try:
                    links = await page.locator("a[href]").all()
                    for link in links[:15]:
                        href = await link.get_attribute("href")
                        if not href:
                            continue
                        clean_href = href.strip()
                        if clean_href.startswith("#") or clean_href.startswith("javascript:") or clean_href.startswith("mailto:"):
                            continue

                        full_link = urljoin(safe_url, clean_href)
                        parsed_link = urlparse(full_link)
                        link_origin = f"{parsed_link.scheme}://{parsed_link.netloc}"

                        if link_origin == target_origin:
                            link_text = (await link.inner_text()).strip()
                            if is_safe_action_text(link_text):
                                if full_link not in visited_urls and full_link not in discovered_urls:
                                    discovered_urls.append(full_link)
                                    if current_depth + 1 <= max_depth and len(queue) < max_pages * 2:
                                        queue.append({"url": full_link, "depth": current_depth + 1})

                                # If we need more actions, create a navigate action to this relative path
                                rel_path = parsed_link.path or "/"
                                if parsed_link.query:
                                    rel_path += f"?{parsed_link.query}"

                                if len(synthesized_actions) < max_actions and not any(
                                    getattr(a, "url", None) == rel_path for a in synthesized_actions if a.type == ActionType.NAVIGATE
                                ):
                                    synthesized_actions.append(NavigateAction(type=ActionType.NAVIGATE, url=rel_path))
                                    synthesized_actions.append(
                                        ScreenshotAction(type=ActionType.SCREENSHOT, description=f"nav_{rel_path.replace('/', '_').strip('_') or 'root'}")
                                    )
                except Exception as link_err:
                    logger.debug("Error scanning links: %s", link_err)

                # Scan safe interactive forms/inputs
                try:
                    inputs = await page.locator("input[type='text'], input[type='search'], input[type='email']").all()
                    for inp in inputs[:2]:
                        if len(synthesized_actions) >= max_actions:
                            break
                        input_id = await inp.get_attribute("id")
                        input_name = await inp.get_attribute("name")
                        selector = f"#{input_id}" if input_id else (f"input[name='{input_name}']" if input_name else None)
                        if selector:
                            synthesized_actions.append(
                                FillAction(type=ActionType.FILL, selector=selector, value="veriqo-audit-test")
                            )
                            synthesized_actions.append(
                                AssertElementVisibleAction(type=ActionType.ASSERT_ELEMENT_VISIBLE, selector=selector)
                            )
                except Exception as form_err:
                    logger.debug("Error scanning form inputs: %s", form_err)

    except Exception as exc:
        logger.error("Exploration encountered error: %s", exc)
        trace.append({"event": "error", "message": str(exc)})
    finally:
        try:
            if page:
                await page.close()
            if context:
                await context.close()
            if browser:
                await browser.close()
        except Exception:
            pass

    completed_at = datetime.now(timezone.utc)
    duration_ms = (time.perf_counter() - start_time) * 1000.0

    journey_name = f"Autonomous Heuristic Journey // {parsed_base.netloc}"
    generated_journey = JourneyDefinition(
        name=journey_name,
        actions=synthesized_actions[:max_actions],
    )

    trace.append({
        "timestamp": completed_at.isoformat(),
        "event": "exploration_complete",
        "actions_generated": len(generated_journey.actions),
        "discovered_urls_count": len(discovered_urls),
        "duration_ms": round(duration_ms, 2),
    })

    return ExplorationResult(
        target_app_url=target_app_url,
        discovered_urls=discovered_urls,
        generated_journey=generated_journey,
        exploration_trace=trace,
        pages_crawled=len(visited_urls),
        duration_ms=round(duration_ms, 2),
        started_at=started_at,
        completed_at=completed_at,
    )
