"""ReplayAttempt Pydantic schemas."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ReplayOutcome(str, Enum):
    """Possible outcomes for an independent BlindReplay attempt."""

    CONFIRMED = "CONFIRMED"
    NOT_REPRODUCED = "NOT_REPRODUCED"
    INCONCLUSIVE = "INCONCLUSIVE"
    FAILED = "FAILED"
    TIMED_OUT = "TIMED_OUT"


class ReplayAttemptCreate(BaseModel):
    """Optional overrides when initiating a BlindReplay attempt."""

    reproduction_instructions: Optional[str] = Field(
        None,
        description="Override human-readable reproduction instructions. Defaults to defect.reproduction_steps.",
    )
    expected_behavior: Optional[str] = Field(
        None,
        description="Override expected behavior/assertion. Defaults to defect.expected_behavior or defect.description.",
    )


class ReplayAttemptRead(BaseModel):
    """Schema for reading BlindReplay attempt records."""

    id: int
    defect_id: int
    status: str
    outcome: Optional[str] = None
    target_url: str
    reproduction_instructions: str
    expected_behavior: str
    execution_log: Optional[List[Dict[str, Any]]] = None
    evidence_paths: Optional[List[str]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
