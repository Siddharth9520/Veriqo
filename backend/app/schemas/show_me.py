"""Schemas for Show Me Mode diagnostic reporting."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class EvidenceArtifactRead(BaseModel):
    """Represents a single evidence artifact referenced by a run or replay."""

    path: str
    source: str = Field(
        ...,
        description="Source of the artifact: 'initial_test_run' or 'blind_replay'",
    )
    exists: bool = Field(
        ...,
        description="Whether the artifact actually exists on storage disk",
    )
    file_size_bytes: Optional[int] = None
    download_url: Optional[str] = None
    note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EvidenceSummaryRead(BaseModel):
    """Summary of all observed evidence for a defect and its execution context."""

    status: str = Field(
        ...,
        description="'COMPLETE', 'PARTIAL', 'MISSING', or 'NONE_RECORDED'",
    )
    total_artifacts: int
    verified_count: int
    missing_count: int
    artifacts: List[EvidenceArtifactRead] = []
    execution_logs: List[Dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)


class BlindReplayAttemptSummary(BaseModel):
    """Summary of an individual BlindReplay verification attempt."""

    replay_id: int
    status: str
    outcome: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    evidence_count: int = 0
    error_message: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class BlindReplaySummaryRead(BaseModel):
    """Structured BlindReplay context for a defect."""

    replays_count: int
    latest_outcome: Optional[str] = None
    is_verified: bool = False
    attempts: List[BlindReplayAttemptSummary] = []

    model_config = ConfigDict(from_attributes=True)


class TestRunContextRead(BaseModel):
    """Context of the initial test run where the defect was encountered."""

    id: int
    target_app_id: int
    target_app_name: str
    target_app_url: str
    status: str
    journey_name: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DiagnosticExplanationRead(BaseModel):
    """Heuristic / explanatory diagnostic context clearly separated from proof."""

    summary: str
    confidence: str = Field(
        ...,
        description="'HIGH' (confirmed replay), 'MEDIUM' (run failure with evidence), or 'LOW'",
    )
    is_ai_generated: bool = False
    disclaimer: str = (
        "Diagnostic explanations provide contextual guidance and do not constitute "
        "cryptographic or replay proof."
    )

    model_config = ConfigDict(from_attributes=True)


class ShowMeResponse(BaseModel):
    """Complete Show Me Mode diagnostic response for a defect."""

    defect_id: int
    title: str
    severity: str
    status: str
    description: str
    reproduction_steps: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    created_at: datetime
    test_run: Optional[TestRunContextRead] = None
    evidence: EvidenceSummaryRead
    blind_replay: Optional[BlindReplaySummaryRead] = None
    explanation: DiagnosticExplanationRead

    model_config = ConfigDict(from_attributes=True)
