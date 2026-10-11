"""Pydantic schemas for QA Certificates and verification."""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CertificateCreateRequest(BaseModel):
    """Payload to request QA Certificate generation for a target application."""

    test_run_ids: Optional[List[int]] = Field(
        None,
        description="Optional list of specific test run IDs to include in the evaluation scope. If omitted, all terminal runs for the target app are evaluated.",
    )


class CertificateRead(BaseModel):
    """Schema representing an issued QA Certificate."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    certificate_id: str
    target_app_id: int
    status: str
    score: Optional[int] = None
    grade: Optional[str] = None
    tamper_hash: str
    certificate_data: Dict[str, Any]
    created_at: datetime


class CertificateVerifyRequest(BaseModel):
    """Payload for certificate integrity and database-matching verification."""

    certificate_id: Optional[str] = Field(
        None,
        description="Public certificate ID to verify against stored database records.",
    )
    certificate_data: Optional[Dict[str, Any]] = Field(
        None,
        description="Complete certificate payload for self-contained or database-backed comparison.",
    )
    mode: Optional[str] = Field(
        None,
        description="Optional explicit verification mode: 'database_backed' or 'self_contained'.",
    )



class CertificateVerifyResponse(BaseModel):
    """Verification outcome report."""

    verification_mode: str = Field(
        ...,
        description="'database_backed' when verified against stored database records, or 'self_contained' when calculated from payload alone.",
    )
    math_valid: bool = Field(
        ...,
        description="True if the score, penalties, caps, and grade match the recalculated mathematical formula.",
    )
    checksum_valid: bool = Field(
        ...,
        description="True if the SHA-256 hash computed over the canonical JSON payload matches tamper_hash.",
    )
    system_matched: bool = Field(
        ...,
        description="True if and only if the submitted certificate matches an authentic record stored in the Veriqo database.",
    )
    issuer_verified: bool = Field(
        False,
        description="Always false. Unkeyed SHA-256 checksums do not implement digital signatures or public issuer identity authentication.",
    )
    certificate_id: Optional[str] = None
    issued_at: Optional[str] = None
    summary: str
    error: Optional[str] = None
