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
