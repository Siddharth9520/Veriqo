from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict
from app.schemas.journey import JourneyDefinition


class TestRunBase(BaseModel):
    """Base schema for test run."""

    __test__ = False
    target_app_id: int


class TestRunCreate(TestRunBase):
    """Schema for initiating a new test run with a journey definition."""

    __test__ = False
    journey: JourneyDefinition


class TestRunRead(TestRunBase):
    """Schema for reading test run details."""

    __test__ = False
    id: int
    status: str
    journey_definition: Optional[Dict[str, Any]] = None
    action_results: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None
    evidence_paths: Optional[List[str]] = None
    regression_journey_id: Optional[int] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
