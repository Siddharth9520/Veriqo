"""RegressionJourney Pydantic schemas."""

from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class RegressionJourneyCreate(BaseModel):
    """Schema for saving a passed test run as a regression baseline."""

    name: str = Field(..., min_length=1, max_length=150, description="Name for the regression journey")
    description: Optional[str] = Field(None, max_length=500, description="Optional description")
    baseline_test_run_id: int = Field(..., description="ID of a completed and passed test run")


class RegressionJourneyRead(BaseModel):
    """Schema for reading a regression journey."""

    id: int
    target_app_id: int
    name: str
    description: Optional[str] = None
    baseline_test_run_id: Optional[int] = None
    journey_definition: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
