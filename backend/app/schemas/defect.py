"""Defect Pydantic schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class DefectBase(BaseModel):
    """Base schema for defects."""

    test_run_id: int
    title: str
    description: str
    severity: str = "MEDIUM"
    status: str = "OPEN"
    reproduction_steps: Optional[str] = None


class DefectCreate(DefectBase):
    """Schema for recording a new defect."""
    pass


class DefectRead(DefectBase):
    """Schema for reading defect details."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
