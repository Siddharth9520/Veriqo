"""Defects management endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.defect import Defect
from app.models.test_run import TestRun
from app.schemas.defect import DefectCreate, DefectRead

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
