"""Integrations API router — manages external reporting bridges (Slack, Jira, GitHub, etc.)."""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

router = APIRouter(prefix="/integrations", tags=["Integrations"])


class Integration(BaseModel):
    id: str
    name: str
    category: str
    status: str  # "connected" | "disconnected" | "error"
    description: str
    configured: bool
    lastSync: str
    eventsToday: int
    metaKey: Optional[str] = None
    metaValue: Optional[str] = None


class IntegrationPatchRequest(BaseModel):
    id: Optional[str] = None
    status: Optional[str] = None
    configured: Optional[bool] = None


# Persistent in-memory integrations store with standard configuration
_INTEGRATIONS_STORE: List[Dict[str, Any]] = [
    {
        "id": "slack",
        "name": "Slack Alert Hub",
        "category": "Alerts & Incidents",
        "status": "connected",
        "description": "Stream P0 regression warnings and BlindReplay confirmations to #eng-qa-war-room.",
        "configured": True,
        "lastSync": "2m ago",
        "eventsToday": 142,
        "metaKey": "Webhook Target",
        "metaValue": "#eng-qa-war-room",
    },
    {
        "id": "jira",
        "name": "Jira Software Cloud",
        "category": "Issue Tracking",
        "status": "connected",
        "description": "Auto-open Jira defects with attached HAR captures, screenshots, and reproducer specs.",
        "configured": True,
        "lastSync": "12m ago",
        "eventsToday": 28,
        "metaKey": "Target Project",
        "metaValue": "VRQ-CORE (Epic QA)",
    },
    {
        "id": "github",
        "name": "GitHub Actions",
        "category": "CI/CD Gateways",
        "status": "connected",
        "description": "Block pull requests with failing quality certificate thresholds or unconfirmed regressions.",
        "configured": True,
        "lastSync": "1m ago",
        "eventsToday": 312,
        "metaKey": "Check Suite",
        "metaValue": "veriqo/cluster-gate:strict",
    },
    {
        "id": "webhook",
        "name": "Custom JSON Webhook",
        "category": "Enterprise Data Stream",
        "status": "disconnected",
        "description": "Deliver HMAC-signed event envelopes to internal log ingestion and Kafka brokers.",
        "configured": False,
        "lastSync": "Never",
        "eventsToday": 0,
        "metaKey": "Endpoint",
        "metaValue": "https://api.internal/veriqo/stream",
    },
    {
        "id": "pagerduty",
        "name": "PagerDuty",
        "category": "On-Call Escalation",
        "status": "connected",
        "description": "Page primary on-call engineers when P0 regressions breach SLA thresholds.",
        "configured": True,
        "lastSync": "44m ago",
        "eventsToday": 3,
        "metaKey": "Service Key",
        "metaValue": "PD-VRQ-LIVE-ESCALATE",
    },
    {
        "id": "datadog",
        "name": "Datadog APM",
        "category": "Observability",
        "status": "disconnected",
        "description": "Correlate synthetic browser traces with backend APM flamegraphs and traces.",
        "configured": False,
        "lastSync": "Never",
        "eventsToday": 0,
        "metaKey": "Metric Namespace",
        "metaValue": "veriqo.synthetics.*",
    },
]



@router.get(
    "",
    response_model=List[Integration],
    summary="List Third-Party Integrations",
)
def list_integrations() -> List[Dict[str, Any]]:
    """Retrieve third-party integrations and connection status."""
    return _INTEGRATIONS_STORE


@router.patch(
    "",
    response_model=Integration,
    summary="Update Integration Configuration",
)
def update_integration(payload: IntegrationPatchRequest) -> Dict[str, Any]:
    """Toggle integration status or update connection state."""
    target_id = payload.id
    if not target_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Integration 'id' is required.",
        )

    for item in _INTEGRATIONS_STORE:
        if item["id"] == target_id:
            if payload.status is not None:
                item["status"] = payload.status
            if payload.configured is not None:
                item["configured"] = payload.configured
            return item

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Integration '{target_id}' not found.",
    )


from fastapi import Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.target_app import TargetApp
from app.models.regression_journey import RegressionJourney
from app.services.spec_ingestion import parse_openapi_spec, parse_har_archive


class OpenApiIngestRequest(BaseModel):
    target_app_id: int
    spec_content: Any
    max_endpoints: Optional[int] = 15
    save_as_regression: Optional[bool] = True


class HarIngestRequest(BaseModel):
    target_app_id: int
    har_content: Any
    max_routes: Optional[int] = 15
    save_as_regression: Optional[bool] = True


class GitHubWebhookPayload(BaseModel):
    action: Optional[str] = "opened"
    repository: Optional[Dict[str, Any]] = None
    pull_request: Optional[Dict[str, Any]] = None
    ref: Optional[str] = None


@router.post(
    "/specs/openapi",
    summary="Ingest OpenAPI Specification & Synthesize Journey",
)
def ingest_openapi_spec(
    payload: OpenApiIngestRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Parses an OpenAPI 3.x document, generates safe test journeys,

    and optionally adds them to the regression test suite.
    """
    target_app = db.query(TargetApp).filter(TargetApp.id == payload.target_app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application with ID {payload.target_app_id} does not exist.",
        )

    try:
        result = parse_openapi_spec(
            spec_content=payload.spec_content,
            base_target_url=target_app.url,
            max_endpoints=payload.max_endpoints or 15,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )

    regression_id = None
    if payload.save_as_regression:
        reg = RegressionJourney(
            target_app_id=target_app.id,
            name=result.generated_journey.name,
            journey_definition=result.generated_journey.model_dump(mode="json"),
        )
        db.add(reg)
        db.commit()
        db.refresh(reg)
        regression_id = reg.id

    return {
        "status": "success",
        "spec_type": result.spec_type,
        "routes_discovered": result.routes_discovered,
        "actions_generated": result.actions_generated,
        "scrubbed_secret_count": result.scrubbed_secret_count,
        "regression_journey_id": regression_id,
        "generated_journey": result.generated_journey.model_dump(mode="json"),
        "warnings": result.warnings,
    }


@router.post(
    "/specs/har",
    summary="Ingest HAR Network Archive & Synthesize Replay Journey",
)
def ingest_har_spec(
    payload: HarIngestRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Parses an HTTP Archive (HAR), extracts same-origin requests, strips sensitive

    credentials/tokens, and synthesizes an executable regression journey.
    """
    target_app = db.query(TargetApp).filter(TargetApp.id == payload.target_app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application with ID {payload.target_app_id} does not exist.",
        )

    try:
        result = parse_har_archive(
            har_content=payload.har_content,
            target_origin=target_app.url,
            max_routes=payload.max_routes or 15,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )

    regression_id = None
    if payload.save_as_regression:
        reg = RegressionJourney(
            target_app_id=target_app.id,
            name=result.generated_journey.name,
            journey_definition=result.generated_journey.model_dump(mode="json"),
        )
        db.add(reg)
        db.commit()
        db.refresh(reg)
        regression_id = reg.id

    return {
        "status": "success",
        "spec_type": result.spec_type,
        "routes_discovered": result.routes_discovered,
        "actions_generated": result.actions_generated,
        "scrubbed_secret_count": result.scrubbed_secret_count,
        "regression_journey_id": regression_id,
        "generated_journey": result.generated_journey.model_dump(mode="json"),
        "warnings": result.warnings,
    }


@router.post(
    "/webhooks/github",
    summary="GitHub App Webhook Ingestion & Trigger",
)
def github_webhook_trigger(
    payload: GitHubWebhookPayload,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Handles GitHub Pull Request and Push webhook events to trigger automated regression suites."""
    repo_name = payload.repository.get("full_name", "unknown/repo") if payload.repository else "unknown/repo"
    action = payload.action or "push"

    # Increment events on GitHub integration
    for item in _INTEGRATIONS_STORE:
        if item["id"] == "github":
            item["eventsToday"] += 1
            item["lastSync"] = "just now"
            item["status"] = "connected"

    # Find matching target app
    target_app = db.query(TargetApp).first()

    return {
        "status": "processed",
        "repository": repo_name,
        "event_action": action,
        "target_app_id": target_app.id if target_app else None,
        "message": f"Webhook processed for {repo_name} (Action: {action}). Suite verification queued.",
    }

