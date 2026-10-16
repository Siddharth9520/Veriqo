"""Logs API router — terminal execution telemetry log stream."""

from datetime import datetime, timezone
import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter(prefix="/logs", tags=["Terminal Logs"])


class TerminalLog(BaseModel):
    id: str
    timestamp: str
    agent: str
    message: str
    type: str  # "info" | "warning" | "error" | "success"


class TerminalLogCreate(BaseModel):
    agent: Optional[str] = "OPERATOR"
    message: str
    type: Optional[str] = "info"


_LOGS_STORE: List[Dict[str, Any]] = [
    {
        "id": "log-seed-1",
        "timestamp": "10:14:02",
        "agent": "CLUSTER_INIT",
        "message": "Autonomous cluster initialized. 4 swarm workers online with Chromium Headless engine.",
        "type": "info",
    },
    {
        "id": "log-seed-2",
        "timestamp": "10:14:08",
        "agent": "ORCHESTRATOR",
        "message": "Heuristic exploration planner synchronized with local target registry.",
        "type": "success",
    },
]


@router.get(
    "",
    response_model=List[TerminalLog],
    summary="List Terminal Execution Logs",
)
def get_logs() -> List[Dict[str, Any]]:
    """Retrieve execution log telemetry from the active cluster."""
    return _LOGS_STORE


@router.post(
    "",
    response_model=TerminalLog,
    status_code=status.HTTP_201_CREATED,
    summary="Append Terminal Log Message",
)
def add_log(payload: TerminalLogCreate) -> Dict[str, Any]:
    """Append a new log message to the terminal telemetry stream."""
    timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    entry = {
        "id": f"log-{int(time.time() * 1000)}",
        "timestamp": timestamp,
        "agent": payload.agent or "OPERATOR",
        "message": payload.message,
        "type": payload.type or "info",
    }
    _LOGS_STORE.append(entry)
    # Keep last 500 logs
    if len(_LOGS_STORE) > 500:
        _LOGS_STORE.pop(0)
    return entry
