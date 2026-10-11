"""Health and readiness schemas."""

from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Schema for basic process health response."""

    status: Literal["ok"] = "ok"
    version: str
    timestamp: datetime = Field(description="Current UTC timestamp of the health check")


class ReadinessResponse(BaseModel):
    """Schema for service readiness response including database status."""

    status: Literal["ready", "unavailable"]
    database: Literal["connected", "disconnected"]
    timestamp: datetime = Field(description="Current UTC timestamp of the readiness check")
