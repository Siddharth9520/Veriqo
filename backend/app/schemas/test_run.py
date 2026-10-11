"""TestRun Pydantic schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TestRunBase(BaseModel):
    """Base schema for test run."""

    __test__ = False
    target_app_id: int


class TestRunCreate(TestRunBase):
    """Schema for initiating a new test run."""

    __test__ = False


class TestRunRead(TestRunBase):
    """Schema for reading test run details."""

    __test__ = False
    id: int
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
