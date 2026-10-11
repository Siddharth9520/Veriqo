"""Defect Pydantic schemas."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator


class DefectSeverity(str, Enum):
    """Allowed severity values, matching the scoring policy penalty schedule."""

    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class DefectStatus(str, Enum):
    """Statuses an external caller may set.

    VERIFIED is intentionally excluded: only a BlindReplay with outcome
    CONFIRMED may promote a defect to VERIFIED (see api/v1/replays.py).
    """

    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    CLOSED = "CLOSED"
    WONT_FIX = "WONT_FIX"


class DefectBase(BaseModel):
    """Base schema for defects."""

    test_run_id: int
    title: str
    description: str
    severity: str = "MEDIUM"
    status: str = "OPEN"
    reproduction_steps: Optional[str] = None
    expected_behavior: Optional[str] = None


class DefectCreate(DefectBase):
    """Schema for recording a new defect."""
    pass


class DefectUpdate(BaseModel):
    """Partial-update schema for PATCH /defects/{defect_id}.

    Only the fields listed here may be changed after creation.
    Immutable fields (id, test_run_id, title, created_at) are not present.
    Unknown fields are rejected (extra='forbid').
    """

    severity: Optional[DefectSeverity] = None
    status: Optional[DefectStatus] = None
    description: Optional[str] = None
    reproduction_steps: Optional[str] = None
    expected_behavior: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

    @field_validator("severity", "status")
    @classmethod
    def non_nullable_enums(cls, v):
        """Rejects explicit null for non-nullable enum fields."""
        if v is None:
            raise ValueError("Field cannot be null.")
        return v

    @field_validator("description")
    @classmethod
    def description_not_blank(cls, v: Optional[str]) -> Optional[str]:
        """Rejects an explicitly submitted null or empty description."""
        if v is None:
            raise ValueError("description cannot be null.")
        if not v.strip():
            raise ValueError("description cannot be an empty string.")
        return v


class DefectRead(DefectBase):
    """Schema for reading defect details."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
