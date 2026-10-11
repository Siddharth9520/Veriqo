"""Test run execution and management endpoints."""

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.target_app import TargetApp
from app.models.test_run import TestRun
from app.schemas.test_run import TestRunCreate, TestRunRead
from app.services.browser import execute_browser_journey

router = APIRouter(prefix="/test-runs", tags=["Test Runs"])


@router.post(
    "",
    response_model=TestRunRead,
    status_code=status.HTTP_201_CREATED,
    summary="Start and Execute Test Run",
)
async def create_and_execute_test_run(
    payload: TestRunCreate,
    db: Session = Depends(get_db),
) -> TestRun:
    """Create a new test run record and execute the provided browser journey."""
    target_app = db.query(TargetApp).filter(TargetApp.id == payload.target_app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application with ID {payload.target_app_id} does not exist.",
        )

    # Initialize test run in DB with running status
    test_run = TestRun(
        target_app_id=target_app.id,
        status="running",
        journey_definition=payload.journey.model_dump(mode="json"),
        started_at=datetime.now(timezone.utc),
    )
    db.add(test_run)
    db.commit()
    db.refresh(test_run)

    # Execute browser journey through Playwright
    report = await execute_browser_journey(
        journey=payload.journey,
        target_app_url=target_app.url,
        test_run_id=test_run.id,
    )

    # Persist final execution outcome
    test_run.status = report.status
    test_run.started_at = report.started_at
    test_run.completed_at = report.completed_at
    test_run.action_results = report.action_results
    test_run.error_message = report.error_message
    test_run.evidence_paths = report.evidence_paths

    db.add(test_run)
    db.commit()
    db.refresh(test_run)

    return test_run


@router.get(
    "",
    response_model=List[TestRunRead],
    summary="List Test Runs",
)
def list_test_runs(
    target_app_id: Optional[int] = Query(None, description="Filter by target app ID"),
    db: Session = Depends(get_db),
) -> List[TestRun]:
    """Retrieve test run history."""
    query = db.query(TestRun)
    if target_app_id is not None:
        query = query.filter(TestRun.target_app_id == target_app_id)
    return query.order_by(TestRun.id.desc()).all()


@router.get(
    "/{run_id}",
    response_model=TestRunRead,
    summary="Get Test Run by ID",
)
def get_test_run(
    run_id: int,
    db: Session = Depends(get_db),
) -> TestRun:
    """Retrieve full details of a specific test run."""
    test_run = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not test_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test run with ID {run_id} not found.",
        )
    return test_run


@router.get(
    "/{run_id}/evidence",
    summary="List Evidence Files for Test Run",
)
def list_run_evidence(
    run_id: int,
    db: Session = Depends(get_db),
):
    """List paths and names of captured screenshots for a test run."""
    test_run = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not test_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test run with ID {run_id} not found.",
        )
    return {
        "test_run_id": test_run.id,
        "evidence_files": test_run.evidence_paths or [],
    }


@router.get(
    "/{run_id}/evidence/{filename:path}",
    summary="Download Evidence Screenshot",
)
def download_run_evidence(
    run_id: int,
    filename: str,
    db: Session = Depends(get_db),
):
    """Safely retrieves a screenshot file, blocking arbitrary path traversal."""
    test_run = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not test_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test run with ID {run_id} not found.",
        )

    evidence_root = Path(settings.EVIDENCE_DIR).resolve()
    run_dir = (evidence_root / f"run_{run_id}").resolve()
    target_path = (run_dir / filename).resolve()

    # Prevent directory traversal attacks
    if not target_path.is_relative_to(run_dir):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Path traversal is not permitted.",
        )

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence file '{filename}' not found for run {run_id}.",
        )

    return FileResponse(path=str(target_path), media_type="image/png")
