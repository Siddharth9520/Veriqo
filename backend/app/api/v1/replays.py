"""BlindReplay API endpoints."""

from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.defect import Defect
from app.models.replay_attempt import ReplayAttempt
from app.schemas.replay_attempt import ReplayAttemptCreate, ReplayAttemptRead
from app.services.blind_replay import execute_blind_replay

router = APIRouter(tags=["BlindReplay"])


@router.post(
    "/defects/{defect_id}/replay",
    response_model=ReplayAttemptRead,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate Independent BlindReplay",
)
async def initiate_blind_replay(
    defect_id: int,
    payload: Optional[ReplayAttemptCreate] = None,
    db: Session = Depends(get_db),
) -> ReplayAttempt:
    """Independently verifies a reported defect using only target URL, human instructions, and expected behavior.

    Runs in a completely fresh browser context without scripts, selectors, DOM snapshots, or logs from the original run.
    """
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Defect with ID {defect_id} not found.",
        )

    if not defect.test_run or not defect.test_run.target_app:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Defect {defect_id} is not associated with a valid target application.",
        )

    target_url = defect.test_run.target_app.url

    # Resolve instructions & expected behavior (payload overrides or defect fields)
    instructions = (
        payload.reproduction_instructions
        if payload and payload.reproduction_instructions
        else defect.reproduction_steps
    )
    if not instructions or not instructions.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot replay defect: no reproduction instructions provided or found in defect record.",
        )

    expected = (
        payload.expected_behavior
        if payload and payload.expected_behavior
        else (defect.expected_behavior or defect.description)
    )
    if not expected or not expected.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot replay defect: no expected behavior specified.",
        )

    # Create ReplayAttempt record
    replay = ReplayAttempt(
        defect_id=defect.id,
        status="RUNNING",
        target_url=target_url,
        reproduction_instructions=instructions.strip(),
        expected_behavior=expected.strip(),
        started_at=datetime.now(timezone.utc),
    )
    db.add(replay)
    db.commit()
    db.refresh(replay)

    # Execute BlindReplay in fresh browser context
    report = await execute_blind_replay(
        target_app_url=target_url,
        reproduction_instructions=instructions.strip(),
        expected_behavior=expected.strip(),
        replay_id=replay.id,
    )

    # Persist replay results
    replay.status = "COMPLETED" if report.outcome != "FAILED" else "FAILED"
    replay.outcome = report.outcome
    replay.started_at = report.started_at
    replay.completed_at = report.completed_at
    replay.execution_log = report.execution_log
    replay.evidence_paths = report.evidence_paths
    replay.error_message = report.error_message

    # If independently confirmed, update defect status
    if report.outcome == "CONFIRMED":
        defect.status = "VERIFIED"
        db.add(defect)

    db.add(replay)
    db.commit()
    db.refresh(replay)

    return replay


@router.get(
    "/defects/{defect_id}/replays",
    response_model=List[ReplayAttemptRead],
    summary="List Replay Attempts for a Defect",
)
def list_defect_replays(
    defect_id: int,
    db: Session = Depends(get_db),
) -> List[ReplayAttempt]:
    """Retrieve all independent replay attempts for a specific defect."""
    defect = db.query(Defect).filter(Defect.id == defect_id).first()
    if not defect:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Defect with ID {defect_id} not found.",
        )
    return (
        db.query(ReplayAttempt)
        .filter(ReplayAttempt.defect_id == defect_id)
        .order_by(ReplayAttempt.id.desc())
        .all()
    )


@router.get(
    "/replays/{replay_id}",
    response_model=ReplayAttemptRead,
    summary="Get Replay Attempt by ID",
)
def get_replay_attempt(
    replay_id: int,
    db: Session = Depends(get_db),
) -> ReplayAttempt:
    """Retrieve details and outcome of a specific BlindReplay attempt."""
    replay = db.query(ReplayAttempt).filter(ReplayAttempt.id == replay_id).first()
    if not replay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Replay attempt with ID {replay_id} not found.",
        )
    return replay


@router.get(
    "/replays/{replay_id}/evidence",
    summary="List Evidence Files for Replay Attempt",
)
def list_replay_evidence(
    replay_id: int,
    db: Session = Depends(get_db),
):
    """List captured screenshot files for a BlindReplay attempt."""
    replay = db.query(ReplayAttempt).filter(ReplayAttempt.id == replay_id).first()
    if not replay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Replay attempt with ID {replay_id} not found.",
        )
    return {
        "replay_id": replay.id,
        "evidence_files": replay.evidence_paths or [],
    }


@router.get(
    "/replays/{replay_id}/evidence/{filename:path}",
    summary="Download Replay Evidence Screenshot",
)
def download_replay_evidence(
    replay_id: int,
    filename: str,
    db: Session = Depends(get_db),
):
    """Safely retrieves a BlindReplay screenshot, blocking directory traversal."""
    replay = db.query(ReplayAttempt).filter(ReplayAttempt.id == replay_id).first()
    if not replay:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Replay attempt with ID {replay_id} not found.",
        )

    evidence_root = Path(settings.EVIDENCE_DIR).resolve()
    replay_dir = (evidence_root / f"replay_{replay_id}").resolve()
    target_path = (replay_dir / filename).resolve()

    if not target_path.is_relative_to(replay_dir):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Path traversal is not permitted.",
        )

    if not target_path.exists() or not target_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Evidence file '{filename}' not found for replay {replay_id}.",
        )

    return FileResponse(path=str(target_path), media_type="image/png")
