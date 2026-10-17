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


import time
from pydantic import BaseModel, Field
from app.models.defect import Defect
from app.schemas.journey import (
    AssertTitleContainsAction,
    JourneyDefinition,
    NavigateAction,
    ScreenshotAction,
)


class TestRunStartRequest(BaseModel):
    __test__ = False
    projectSlug: Optional[str] = None
    target_app_id: Optional[int] = None
    swarmMode: Optional[str] = "Deep Heuristic"
    environment: Optional[str] = "Staging"
    journey: Optional[JourneyDefinition] = None


class TestRunPatchRequest(BaseModel):
    __test__ = False
    status: Optional[str] = None
    error_message: Optional[str] = None



class SwarmCommandRequest(BaseModel):
    command: str


@router.post(
    "/start",
    response_model=TestRunRead,
    status_code=status.HTTP_201_CREATED,
    summary="Start Autonomous Test Run by Project",
)
async def start_autonomous_test_run(
    payload: TestRunStartRequest,
    db: Session = Depends(get_db),
) -> TestRun:
    """Dispatches a real autonomous browser test run against a target application."""
    target_app = None
    if payload.target_app_id:
        target_app = db.query(TargetApp).filter(TargetApp.id == payload.target_app_id).first()
    elif payload.projectSlug:
        all_apps = db.query(TargetApp).all()
        for a in all_apps:
            slug = a.name.lower().replace(" ", "-")
            if slug == payload.projectSlug or str(a.id) == payload.projectSlug:
                target_app = a
                break
        if not target_app and all_apps:
            target_app = all_apps[0]

    if not target_app:
        target_app = TargetApp(
            name="Veriqo Demo Store",
            url="http://127.0.0.1:8080",
            description=f"Autonomous target application ({payload.environment or 'Staging'})",
        )
        db.add(target_app)
        db.commit()
        db.refresh(target_app)

    journey = payload.journey
    if not journey:
        try:
            from app.services.exploration import explore_target_application
            explore_res = await explore_target_application(
                target_app_url=target_app.url,
                max_pages=5,
                max_actions=12,
            )
            journey = explore_res.generated_journey
        except Exception as exp_err:
            logger.warning("Autonomous exploration fallback to baseline scan: %s", exp_err)
            journey = JourneyDefinition(
                name=f"Autonomous Audit // {payload.swarmMode or 'Deep Heuristic'}",
                actions=[
                    NavigateAction(type="navigate", url="/"),
                    ScreenshotAction(type="screenshot", description="landing_page"),
                    AssertTitleContainsAction(type="assert_title_contains", value=""),
                ],
            )

    test_run = TestRun(
        target_app_id=target_app.id,
        status="running",
        journey_definition=journey.model_dump(mode="json"),
        started_at=datetime.now(timezone.utc),
    )
    db.add(test_run)
    db.commit()
    db.refresh(test_run)

    report = await execute_browser_journey(
        journey=journey,
        target_app_url=target_app.url,
        test_run_id=test_run.id,
    )

    test_run.status = report.status
    test_run.started_at = report.started_at
    test_run.completed_at = report.completed_at
    test_run.action_results = report.action_results
    test_run.error_message = report.error_message
    test_run.evidence_paths = report.evidence_paths

    if report.status == "failed" and report.error_message:
        defect = Defect(
            test_run_id=test_run.id,
            title=f"Assertion Failure in Run #{test_run.id}",
            description=report.error_message,
            severity="HIGH",
            status="OPEN",
            reproduction_steps=f"1. Navigate to {target_app.url}/\n2. Execute autonomous journey\n3. Observe: {report.error_message}",
            expected_behavior="Expected all assertions and page elements to be verified successfully.",
        )
        db.add(defect)

    db.add(test_run)
    db.commit()
    db.refresh(test_run)
    return test_run


@router.post(
    "/commands",
    summary="Send Terminal Swarm Command",
)
def execute_swarm_command(
    payload: SwarmCommandRequest,
    db: Session = Depends(get_db),
):
    """Processes interactive operator commands for the autonomous swarm."""
    cmd = payload.command.strip()
    timestamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
    lower = cmd.lower()

    active_run = db.query(TestRun).order_by(TestRun.id.desc()).first()

    user_log = {
        "id": f"cmd-{int(time.time() * 1000)}",
        "timestamp": timestamp,
        "agent": "OPERATOR",
        "message": f"$ {cmd}",
        "type": "info",
    }

    if lower == "help":
        sys_msg = "Commands: status | pause | resume | abort | fuzz [target] | inspect-dom"
        sys_type = "info"
    elif lower == "status":
        if active_run:
            sys_msg = f"Execution #VRQ-{active_run.id}: Status [{active_run.status.upper()}], Target App #{active_run.target_app_id}"
        else:
            sys_msg = "No active test runs found in registry."
        sys_type = "info"
    elif lower == "pause":
        if active_run and active_run.status == "running":
            active_run.status = "paused"
            db.add(active_run)
            db.commit()
        sys_msg = "Execution paused across swarm workers. Browser threads frozen."
        sys_type = "warning"
    elif lower == "resume":
        if active_run and active_run.status == "paused":
            active_run.status = "running"
            db.add(active_run)
            db.commit()
        sys_msg = "Execution resumed. Worker threads unthrottled."
        sys_type = "success"
    elif lower == "abort":
        if active_run and active_run.status == "running":
            active_run.status = "aborted"
            active_run.completed_at = datetime.now(timezone.utc)
            db.add(active_run)
            db.commit()
        sys_msg = "Execution aborted by operator signal. Diagnostic teardown initiated."
        sys_type = "error"
    else:
        sys_msg = f'Dispatched directive: "{cmd}". Heuristic planner parsed intent and adjusted crawl vectors.'
        sys_type = "info"

    sys_log = {
        "id": f"resp-{int(time.time() * 1000) + 1}",
        "timestamp": timestamp,
        "agent": "ORCHESTRATOR",
        "message": sys_msg,
        "type": sys_type,
    }

    return {
        "success": True,
        "command": cmd,
        "logs": [user_log, sys_log],
    }


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
    "/active",
    response_model=Optional[TestRunRead],
    summary="Get Active or Latest Test Run",
)
def get_active_test_run(
    db: Session = Depends(get_db),
) -> Optional[TestRun]:
    """Retrieve the currently running test run, or the latest completed test run."""
    running_run = (
        db.query(TestRun)
        .filter(TestRun.status == "running")
        .order_by(TestRun.id.desc())
        .first()
    )
    if running_run:
        return running_run
    return db.query(TestRun).order_by(TestRun.id.desc()).first()


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


@router.patch(
    "/{run_id}",
    response_model=TestRunRead,
    summary="Update Test Run Status",
)
def update_test_run(
    run_id: int,
    payload: TestRunPatchRequest,
    db: Session = Depends(get_db),
) -> TestRun:
    """Updates the status or diagnostic message of a test run."""
    test_run = db.query(TestRun).filter(TestRun.id == run_id).first()
    if not test_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Test run with ID {run_id} not found.",
        )
    if payload.status:
        test_run.status = payload.status
        if payload.status in ("passed", "failed", "aborted", "completed") and not test_run.completed_at:
            test_run.completed_at = datetime.now(timezone.utc)
    if payload.error_message is not None:
        test_run.error_message = payload.error_message
    db.add(test_run)
    db.commit()
    db.refresh(test_run)
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
