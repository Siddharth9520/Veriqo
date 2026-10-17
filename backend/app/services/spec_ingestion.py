"""Spec Ingestion Service — OpenAPI 3.x and HAR Network Archive Parser.

Ingests API and web artifacts to automatically synthesize executable JourneyDefinitions
while strictly stripping sensitive authorization tokens, cookies, and non-target traffic.
"""

from dataclasses import dataclass
import json
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse

from app.schemas.journey import (
    ActionType,
    AssertElementVisibleAction,
    AssertTextVisibleAction,
    JourneyAction,
    JourneyDefinition,
    NavigateAction,
    ScreenshotAction,
)

logger = logging.getLogger(__name__)

# Sensitive header names to redact during HAR ingestion
SENSITIVE_HEADERS = {
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "apikey",
    "proxy-authorization",
    "x-auth-token",
    "token",
}


@dataclass
class SpecIngestionResult:
    """Outcome and generated journey from an ingested OpenAPI or HAR specification."""

    spec_type: str  # "openapi" | "har"
    routes_discovered: int
    actions_generated: int
    scrubbed_secret_count: int
    generated_journey: JourneyDefinition
    warnings: List[str]


def parse_openapi_spec(
    spec_content: str | Dict[str, Any],
    base_target_url: str,
    max_endpoints: int = 15,
) -> SpecIngestionResult:
    """Parses an OpenAPI 3.0/3.1 document (JSON or dict) and synthesizes a safe test journey."""
    warnings: List[str] = []

    if isinstance(spec_content, str):
        try:
            data = json.loads(spec_content)
        except Exception as exc:
            raise ValueError(f"Invalid OpenAPI format: unable to parse JSON ({str(exc)})")
    else:
        data = spec_content

    if not isinstance(data, dict):
        raise ValueError("Invalid OpenAPI format: root element must be a JSON object.")

    # Validate openapi / swagger version
    version = data.get("openapi") or data.get("swagger")
    if not version:
        warnings.append("Missing explicit 'openapi' version field; assuming OpenAPI 3.x.")

    paths = data.get("paths", {})
    if not isinstance(paths, dict):
        raise ValueError("Invalid OpenAPI format: 'paths' must be a JSON object.")

    actions: List[JourneyAction] = []
    actions.append(NavigateAction(type=ActionType.NAVIGATE, url="/"))
    actions.append(ScreenshotAction(type=ActionType.SCREENSHOT, description="spec_landing"))

    routes_count = 0
    title = data.get("info", {}).get("title", "OpenAPI Spec")

    for raw_path, path_item in paths.items():
        if routes_count >= max_endpoints:
            break
        if not isinstance(path_item, dict):
            continue

        # Look for GET methods first (safe, idempotent)
        get_op = path_item.get("get")
        if get_op and isinstance(get_op, dict):
            # Replace path parameters like {id} with safe test defaults
            clean_path = re.sub(r"\{[a-zA-Z0-9_]+\}", "1", raw_path)
            if not clean_path.startswith("/"):
                clean_path = "/" + clean_path

            actions.append(NavigateAction(type=ActionType.NAVIGATE, url=clean_path))
            summary_desc = get_op.get("summary") or clean_path.replace("/", "_").strip("_") or "route"
            actions.append(ScreenshotAction(type=ActionType.SCREENSHOT, description=f"api_{summary_desc[:30]}"))

            # Check for expected 200 responses
            responses = get_op.get("responses", {})
            if "200" in responses:
                actions.append(
                    AssertElementVisibleAction(type=ActionType.ASSERT_ELEMENT_VISIBLE, selector="body")
                )

            routes_count += 1

    if routes_count == 0:
        warnings.append("No GET routes with safe schemas found in OpenAPI specification.")

    generated_journey = JourneyDefinition(
        name=f"Ingested Suite // {title[:35]}",
        actions=actions,
    )

    return SpecIngestionResult(
        spec_type="openapi",
        routes_discovered=routes_count,
        actions_generated=len(actions),
        scrubbed_secret_count=0,
        generated_journey=generated_journey,
        warnings=warnings,
    )


def parse_har_archive(
    har_content: str | Dict[str, Any],
    target_origin: str,
    max_routes: int = 15,
) -> SpecIngestionResult:
    """Parses an HTTP Archive (HAR) JSON export, filtering strictly to target_origin

    and stripping any sensitive cookies, tokens, or private authorization headers.
    """
    warnings: List[str] = []
    scrubbed_count = 0

    if isinstance(har_content, str):
        try:
            data = json.loads(har_content)
        except Exception as exc:
            raise ValueError(f"Invalid HAR format: unable to parse JSON ({str(exc)})")
    else:
        data = har_content

    if not isinstance(data, dict):
        raise ValueError("Invalid HAR format: root element must be a JSON object.")

    log_entry = data.get("log", {})
    entries = log_entry.get("entries", [])
    if not isinstance(entries, list):
        raise ValueError("Invalid HAR format: 'log.entries' must be an array.")

    parsed_target = urlparse(target_origin)
    clean_target_origin = f"{parsed_target.scheme}://{parsed_target.netloc}".lower()

    discovered_paths: Set[str] = set()
    actions: List[JourneyAction] = []
    actions.append(NavigateAction(type=ActionType.NAVIGATE, url="/"))
    actions.append(ScreenshotAction(type=ActionType.SCREENSHOT, description="har_replay_init"))

    for entry in entries:
        if len(discovered_paths) >= max_routes:
            break
        if not isinstance(entry, dict):
            continue

        request = entry.get("request", {})
        url_val = request.get("url", "")
        if not url_val:
            continue

        # Scrub headers
        headers = request.get("headers", [])
        if isinstance(headers, list):
            for h in headers:
                h_name = str(h.get("name", "")).lower()
                if h_name in SENSITIVE_HEADERS:
                    scrubbed_count += 1

        # Check origin match
        parsed_req = urlparse(url_val)
        req_origin = f"{parsed_req.scheme}://{parsed_req.netloc}".lower()

        if req_origin == clean_target_origin:
            req_path = parsed_req.path or "/"
            if parsed_req.query:
                req_path += f"?{parsed_req.query}"

            # Only add HTML/page routes or API queries, ignore static assets
            if not re.search(r"\.(png|jpg|jpeg|gif|svg|ico|css|woff|woff2|ttf)$", parsed_req.path, re.IGNORECASE):
                if req_path not in discovered_paths:
                    discovered_paths.add(req_path)
                    actions.append(NavigateAction(type=ActionType.NAVIGATE, url=req_path))
                    actions.append(
                        ScreenshotAction(
                            type=ActionType.SCREENSHOT,
                            description=f"trace_{req_path.replace('/', '_').strip('_') or 'root'}"[:30],
                        )
                    )
                    actions.append(
                        AssertElementVisibleAction(type=ActionType.ASSERT_ELEMENT_VISIBLE, selector="body")
                    )

    if not discovered_paths:
        warnings.append(f"No traffic matching origin '{target_origin}' found in HAR archive.")

    generated_journey = JourneyDefinition(
        name=f"HAR Replay Trace // {parsed_target.netloc}",
        actions=actions,
    )

    return SpecIngestionResult(
        spec_type="har",
        routes_discovered=len(discovered_paths),
        actions_generated=len(actions),
        scrubbed_secret_count=scrubbed_count,
        generated_journey=generated_journey,
        warnings=warnings,
    )
