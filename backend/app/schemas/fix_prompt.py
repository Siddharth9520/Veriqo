"""Schemas for developer Fix Prompt Export."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class FixPromptEvidenceReference(BaseModel):
    """Reference to evidence relevant to the defect fix prompt."""

    path: str
    source: str
    exists: bool
    note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FixPromptEnvironmentContext(BaseModel):
    """Context regarding the target application and execution run."""

    target_app_name: str
    target_app_url: str
    test_run_id: int
    test_run_status: str
    journey_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class FixPromptVerificationContext(BaseModel):
    """Context regarding BlindReplay independent verification."""

    replays_count: int
    latest_outcome: Optional[str] = None
    is_verified: bool = False
    verification_notes: str

    model_config = ConfigDict(from_attributes=True)


class FixPromptResponse(BaseModel):
    """Structured response for Fix Prompt Export, including full copyable text."""

    defect_id: int
    prompt_text: str = Field(
        ...,
        description="Complete, copyable developer-ready prompt formatted in Markdown",
    )
    title: str
    severity: str
    status: str
    description: str
    reproduction_steps: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    environment_context: Optional[FixPromptEnvironmentContext] = None
    verification_context: FixPromptVerificationContext
    evidence_references: List[FixPromptEvidenceReference] = []
    developer_tasks: List[str] = []
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
