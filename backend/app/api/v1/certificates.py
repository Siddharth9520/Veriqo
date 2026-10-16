"""QA Certificates API endpoints."""

from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.certificate import Certificate
from app.models.defect import Defect
from app.models.target_app import TargetApp
from app.models.test_run import TestRun
from app.schemas.certificate import (
    CertificateCreateRequest,
    CertificateRead,
    CertificateVerifyRequest,
    CertificateVerifyResponse,
)
from app.services.scoring import (
    generate_certificate_payload,
    serialize_deterministic,
    verify_certificate_self_contained,
)

router = APIRouter(tags=["Certificates"])


class CertificateCreateRootRequest(BaseModel):
    app_id: int
    test_run_ids: Optional[List[int]] = None


@router.get(
    "/certificates",
    response_model=List[CertificateRead],
    summary="List Certificates",
)
def list_all_certificates(
    app_id: Optional[int] = Query(None, description="Optional target app ID filter"),
    db: Session = Depends(get_db),
) -> List[Certificate]:
    """Retrieve certificates across all apps or for a specific app."""
    query = db.query(Certificate)
    if app_id is not None:
        query = query.filter(Certificate.target_app_id == app_id)
    return query.order_by(Certificate.id.desc()).all()


@router.post(
    "/certificates",
    response_model=CertificateRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate QA Certificate (Root)",
)
def create_certificate_root(
    payload: CertificateCreateRootRequest,
    db: Session = Depends(get_db),
) -> Certificate:
    """Generate and persist a QA Certificate using root payload with app_id."""
    sub_payload = (
        CertificateCreateRequest(test_run_ids=payload.test_run_ids)
        if payload.test_run_ids
        else None
    )
    return create_certificate(app_id=payload.app_id, payload=sub_payload, db=db)



@router.post(
    "/target-apps/{app_id}/certificates",
    response_model=CertificateRead,
    status_code=status.HTTP_201_CREATED,
    summary="Generate QA Certificate for Target Application",
)
def create_certificate(
    app_id: int,
    payload: Optional[CertificateCreateRequest] = None,
    db: Session = Depends(get_db),
) -> Certificate:
    """Generates and persists a deterministic QA Certificate for a target application.

    Validates that:
    - Target application exists.
    - All requested run IDs belong strictly to the target application (cross-app returns 400).
    - No duplicate run IDs were provided (returns 422).
    - All requested runs are in terminal status ('passed', 'failed', 'timed_out') (returns 422).
    - If no run IDs are provided, evaluates all terminal runs for the app in chronological order.
    """
    target_app = db.query(TargetApp).filter(TargetApp.id == app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application with ID {app_id} does not exist.",
        )

    runs: List[TestRun] = []

    if payload and payload.test_run_ids:
        # Check duplicate run IDs
        if len(payload.test_run_ids) != len(set(payload.test_run_ids)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Duplicate test run IDs provided in evaluation scope.",
            )

        for run_id in payload.test_run_ids:
            run = db.query(TestRun).filter(TestRun.id == run_id).first()
            if not run:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Test run with ID {run_id} not found.",
                )
            if run.target_app_id != target_app.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Test run {run_id} does not belong to target application {target_app.id}.",
                )
            if (run.status or "").lower() not in ("passed", "failed", "timed_out"):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Test run {run_id} is in non-terminal status '{run.status}' and cannot be evaluated.",
                )
            runs.append(run)
    else:
        # Default scope: all eligible terminal runs for target app in chronological order
        runs = (
            db.query(TestRun)
            .filter(
                TestRun.target_app_id == target_app.id,
                func.lower(TestRun.status).in_(["passed", "failed", "timed_out"]),
            )
            .order_by(TestRun.id.asc())
            .all()
        )

    # Fetch defects for evaluated runs
    run_ids = [r.id for r in runs]
    defects: List[Defect] = []
    if run_ids:
        defects = db.query(Defect).filter(Defect.test_run_id.in_(run_ids)).all()

    # Generate certificate payload
    cert_uuid = f"cert_{uuid.uuid4().hex[:12]}"
    cert_payload = generate_certificate_payload(
        target_app=target_app,
        runs=runs,
        defects=defects,
        certificate_id=cert_uuid,
    )

    cert = Certificate(
        certificate_id=cert_uuid,
        target_app_id=target_app.id,
        status=cert_payload["status"],
        score=cert_payload["score_summary"]["score"],
        grade=cert_payload["score_summary"]["grade"],
        tamper_hash=cert_payload["tamper_hash"],
        certificate_data=cert_payload,
    )
    db.add(cert)
    db.commit()
    db.refresh(cert)

    return cert


@router.get(
    "/target-apps/{app_id}/certificates",
    response_model=List[CertificateRead],
    summary="List Certificates for Target Application",
)
def list_certificates(
    app_id: int,
    db: Session = Depends(get_db),
) -> List[Certificate]:
    """Retrieves all QA Certificates issued for a target application."""
    target_app = db.query(TargetApp).filter(TargetApp.id == app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application with ID {app_id} does not exist.",
        )
    return (
        db.query(Certificate)
        .filter(Certificate.target_app_id == app_id)
        .order_by(Certificate.id.desc())
        .all()
    )


@router.get(
    "/certificates/{cert_id}",
    response_model=CertificateRead,
    summary="Get Certificate by Public ID",
)
def get_certificate(
    cert_id: str,
    db: Session = Depends(get_db),
) -> Certificate:
    """Retrieves a specific QA Certificate strictly by its public certificate ID."""
    cert = db.query(Certificate).filter(Certificate.certificate_id == cert_id).first()

    if not cert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Certificate '{cert_id}' not found.",
        )
    return cert


@router.post(
    "/certificates/verify",
    response_model=CertificateVerifyResponse,
    summary="Verify Certificate Integrity and Authenticity",
)
def verify_certificate(
    payload: CertificateVerifyRequest,
    db: Session = Depends(get_db),
) -> CertificateVerifyResponse:
    """Verifies certificate integrity, mathematical consistency, and database match.

    Dual-mode verification:
    1. Database-backed: If certificate_id is provided, looks up the record in Veriqo's database.
       system_matched is True if and only if submitted payload and hash match the stored record.
       issuer_verified remains False (unkeyed checksum does not authenticate public identity).
    2. Self-contained: If only certificate_data is provided, recalculates math and verifies SHA-256
       checksum without trusting submitted scores or database records.
    """
    if not payload.certificate_id and not payload.certificate_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Either certificate_id or certificate_data must be provided for verification.",
        )

    # If self_contained mode is explicitly requested or no certificate_id is passed
    if payload.mode == "self_contained" or (not payload.certificate_id and payload.mode != "database_backed"):
        if not payload.certificate_data:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="certificate_data is required for self-contained verification.",
            )
        self_res = verify_certificate_self_contained(payload.certificate_data)
        is_valid = self_res["math_valid"] and self_res["checksum_valid"]
        return CertificateVerifyResponse(
            verification_mode="self_contained",
            math_valid=self_res["math_valid"],
            checksum_valid=self_res["checksum_valid"],
            system_matched=False,
            issuer_verified=False,
            certificate_id=payload.certificate_data.get("certificate_id"),
            issued_at=payload.certificate_data.get("issued_at"),
            summary=(
                "The certificate payload was evaluated in self-contained mode. Math and checksum were verified. This does NOT verify that Veriqo issued this certificate or that the test runs actually occurred."
                if is_valid
                else "Self-contained verification failed due to mathematical or checksum mismatch."
            ),
            error=self_res.get("error"),
        )

    # Database-backed verification mode
    cert_id = payload.certificate_id
    if not cert_id and payload.certificate_data:
        cert_id = payload.certificate_data.get("certificate_id")

    if cert_id:
        stored_cert = (
            db.query(Certificate).filter(Certificate.certificate_id == cert_id).first()
        )

        if payload.certificate_data:
            # Full comparison against submitted payload
            self_res = verify_certificate_self_contained(payload.certificate_data)

            if not stored_cert:
                return CertificateVerifyResponse(
                    verification_mode="database_backed",
                    math_valid=self_res["math_valid"],
                    checksum_valid=self_res["checksum_valid"],
                    system_matched=False,
                    issuer_verified=False,
                    certificate_id=cert_id,
                    summary="Certificate ID not found in Veriqo database.",
                    error=f"Certificate '{cert_id}' was not found in database records.",
                )

            # Compare canonical JSON representations
            bytes_submitted = serialize_deterministic(payload.certificate_data)
            bytes_stored = serialize_deterministic(stored_cert.certificate_data)
            is_matched = (bytes_submitted == bytes_stored)
            hash_matched = (
                payload.certificate_data.get("tamper_hash") == stored_cert.tamper_hash
            )
            system_matched = bool(is_matched and hash_matched)

            summary_parts = []
            if system_matched:
                summary_parts.append("Submitted payload and hash match the stored certificate record in the Veriqo database.")
            else:
                summary_parts.append("Submitted certificate payload or hash does not match the stored database record.")

            if self_res["math_valid"] and self_res["checksum_valid"]:
                summary_parts.append("Independent mathematical and checksum verification passed.")
            else:
                summary_parts.append("Independent mathematical or checksum verification failed.")

            summary_parts.append("Note: issuer_verified is false as unkeyed checksums do not authenticate public issuer identity.")

            error_msg = None
            if not system_matched:
                error_msg = "Submitted payload deviates from stored database record."
            elif not self_res["math_valid"] or not self_res["checksum_valid"]:
                error_msg = self_res.get("error") or "Independent mathematical or checksum verification failed."

            return CertificateVerifyResponse(
                verification_mode="database_backed",
                math_valid=self_res["math_valid"],
                checksum_valid=self_res["checksum_valid"],
                system_matched=system_matched,
                issuer_verified=False,
                certificate_id=stored_cert.certificate_id,
                issued_at=stored_cert.certificate_data.get("issued_at"),
                summary=" ".join(summary_parts),
                error=error_msg,
            )
        else:
            # Verification by certificate_id alone
            if not stored_cert:
                return CertificateVerifyResponse(
                    verification_mode="database_backed",
                    math_valid=False,
                    checksum_valid=False,
                    system_matched=False,
                    issuer_verified=False,
                    certificate_id=cert_id,
                    summary="Certificate ID not found in Veriqo database.",
                    error=f"Certificate '{cert_id}' was not found in database records.",
                )

            self_res = verify_certificate_self_contained(stored_cert.certificate_data)
            summary_parts = ["Certificate record found in Veriqo database."]
            if self_res["math_valid"] and self_res["checksum_valid"]:
                summary_parts.append("Independent mathematical and checksum verification passed.")
            else:
                summary_parts.append("Independent mathematical or checksum verification failed.")
            summary_parts.append("Note: issuer_verified is false as unkeyed checksums do not authenticate public issuer identity.")

            return CertificateVerifyResponse(
                verification_mode="database_backed",
                math_valid=self_res["math_valid"],
                checksum_valid=self_res["checksum_valid"],
                system_matched=True,
                issuer_verified=False,
                certificate_id=stored_cert.certificate_id,
                issued_at=stored_cert.certificate_data.get("issued_at"),
                summary=" ".join(summary_parts),
                error=self_res.get("error"),
            )

    # Self-contained verification mode (no certificate_id provided)
    self_res = verify_certificate_self_contained(payload.certificate_data)  # type: ignore[arg-type]
    is_valid = self_res["math_valid"] and self_res["checksum_valid"]

    return CertificateVerifyResponse(
        verification_mode="self_contained",
        math_valid=self_res["math_valid"],
        checksum_valid=self_res["checksum_valid"],
        system_matched=False,
        issuer_verified=False,
        certificate_id=payload.certificate_data.get("certificate_id"),  # type: ignore[union-attr]
        issued_at=payload.certificate_data.get("issued_at"),  # type: ignore[union-attr]
        summary=(
            "The certificate payload was evaluated in self-contained mode. Math and checksum were verified. This does NOT verify that Veriqo issued this certificate or that the test runs actually occurred."
            if is_valid
            else "Self-contained verification failed due to mathematical or checksum mismatch."
        ),
        error=self_res.get("error"),
    )
