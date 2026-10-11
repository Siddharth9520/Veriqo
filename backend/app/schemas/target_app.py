"""TargetApp Pydantic schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, HttpUrl


class TargetAppBase(BaseModel):
    """Base schema for target application under test."""

    name: str
    url: str
    description: Optional[str] = None


class TargetAppCreate(TargetAppBase):
    """Schema for registering a new target application."""
    pass


class TargetAppRead(TargetAppBase):
    """Schema for reading target application details."""

    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
