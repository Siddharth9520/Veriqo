"""Defects management endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.defect import Defect
from app.models.test_run import TestRun
from app.schemas.defect import DefectCreate, DefectRead, DefectUpdate
from app.schemas.fix_prompt import FixPromptResponse
from app.schemas.show_me import ShowMeResponse
from app.services.show_me import generate_fix_prompt_export, generate_show_me_report

router = APIRouter(prefix="/defects", tags=["Defects"])


@router.post(
    "",
    response_model=DefectRead,
    status_code=status.HTTP_201_CREATED,
    summary="Record a Defect",
)
def create_defect(
    payload: DefectCreate,
    db: Session = Depends(get_db),
) -> Defect:
    """Record a new defect associated with a test run."""
    test_run = db.query(TestRun).filter(TestRun.id == payload.test_run_id).first()
    if not test_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test run with ID {payload.test_run_id} does not exist.",
        )

    title_clean = payload.title.strip()
    if not title_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Defect title cannot be empty.",
        )

    defect = Defect(
        test_run_id=test_run.id,
        title=title_clean,
        description=payload.description.strip(),
        severity=payload.severity,
        status=payload.status,
        reproduction_steps=payload.reproduction_steps,
        expected_behavior=payload.expected_behavior,
    )
    db.add(defect)
    db.commit()
    db.refresh(defect)
    return defect


@router.get(
    "",
    response_model=List[DefectRead],
    summary="List Recorded Defects",
)
def list_defects(
    test_run_id: Optional[int] = Query(None, description="Filter by test run ID"),
    db: Session = Depends(get_db),
) -> List[Defect]:
    """Retrieve all recorded defects."""
    query = db.query(Defect)
    if test_run_id is not None:
        query = query.filter(Defect.test_run_id == test_run_id)
    return query.order_by(Defect.id.desc()).all()


@router.get(
    "/{defect_id}",
    response_model=DefectRead,
    summary="Get Defect by ID",
)
def get_defect(
    defect_id: int,
    db: Session = Depends(get_db),
) -> Defect:
    """Retrieve details of a specific defect."""
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Defect with ID {defect_id} not found.",
        )
    return defect


@router.patch(
    "/{defect_id}",
    response_model=DefectRead,
    summary="Update Mutable Defect Fields",
)
def update_defect(
    defect_id: int,
    payload: DefectUpdate,
    db: Session = Depends(get_db),
) -> Defect:
    """Partially updates a defect's mutable fields.

    Permitted fields: severity, status, description, reproduction_steps,
    expected_behavior.

    Immutable fields (id, test_run_id, title) cannot be changed.
    Unknown fields are rejected with HTTP 422.

    status='VERIFIED' cannot be set via this endpoint; it is set exclusively
    by BlindReplay when a replay outcome is CONFIRMED.

    An empty request body is valid and returns the unchanged defect.
    """
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Defect with ID {defect_id} not found.",
        )

    # Apply only the fields that were explicitly provided (exclude_unset=True)
    update_data = payload.model_dump(exclude_unset=True)

    if defect.status == "VERIFIED" and "status" in update_data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot alter status of an independently VERIFIED defect.",
        )

    # Enum values arrive as DefectSeverity/DefectStatus objects; persist their .value
    for field, value in update_data.items():
        setattr(defect, field, value.value if hasattr(value, "value") else value)

    if update_data:
        db.add(defect)
        db.commit()
        db.refresh(defect)

    return defect


@router.get(
    "/{defect_id}/show-me",
    response_model=ShowMeResponse,
    summary="Show Me Mode - Defect Evidence & Diagnosis",
)
def get_defect_show_me(
    defect_id: int,
    db: Session = Depends(get_db),
) -> ShowMeResponse:
    """Explains a reported defect using actual stored evidence and replay outcomes.

    Presents defect details, execution run, logs, verified/missing screenshots,
    BlindReplay results, and diagnostic guidance.
    Strictly read-only: does not rerun tests or mutate database records.
    Redacts sensitive authentication tokens, passwords, and private keys.
    """
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Defect with ID {defect_id} not found.",
        )
    return generate_show_me_report(defect=defect, db=db)


@router.get(
    "/{defect_id}/fix-prompt",
    response_model=FixPromptResponse,
    summary="Fix Prompt Export - Developer Ready Prompt",
)
def get_defect_fix_prompt(
    defect_id: int,
    db: Session = Depends(get_db),
) -> FixPromptResponse:
    """Generates a structured, developer-ready fix prompt for a defect.

    Includes verified facts, reproduction steps, evidence references, BlindReplay
    trust boundary context, and copyable Markdown.
    Strictly read-only: does not modify application source code or database records.
    Redacts sensitive credentials and tokens.
    """
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Defect with ID {defect_id} not found.",
        )
    return generate_fix_prompt_export(defect=defect, db=db)
