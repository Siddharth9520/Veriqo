"""Target applications management endpoints."""

from typing import List
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.target_app import TargetApp
from app.schemas.target_app import TargetAppCreate, TargetAppRead

router = APIRouter(prefix="/target-apps", tags=["Target Apps"])


def validate_app_url(url: str) -> None:
    """Validate that the target URL has a valid HTTP/HTTPS scheme and network location."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL must be a valid HTTP or HTTPS address with a host.",
        )


@router.post(
    "",
    response_model=TargetAppRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register Target Application",
)
def create_target_app(
    payload: TargetAppCreate,
    db: Session = Depends(get_db),
) -> TargetApp:
    """Register a new web application under test."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Application name cannot be empty or whitespace.",
        )

    validate_app_url(payload.url)

    target_app = TargetApp(
        name=name_clean,
        url=payload.url.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(target_app)
    db.commit()
    db.refresh(target_app)
    return target_app


@router.get(
    "",
    response_model=List[TargetAppRead],
    summary="List Registered Applications",
)
def list_target_apps(
    db: Session = Depends(get_db),
) -> List[TargetApp]:
    """Retrieve all registered target applications."""
    return db.query(TargetApp).order_by(TargetApp.id.desc()).all()


@router.get(
    "/{app_id}",
    response_model=TargetAppRead,
    summary="Get Target Application by ID",
)
def get_target_app(
    app_id: int,
    db: Session = Depends(get_db),
) -> TargetApp:
    """Retrieve details for a specific registered target application."""
    target_app = db.query(TargetApp).filter(TargetApp.id == app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application with ID {app_id} not found.",
        )
    return target_app


from datetime import datetime, timezone
from fastapi import Query
from pydantic import BaseModel
from app.models.test_run import TestRun
from app.models.regression_journey import RegressionJourney
from app.services.exploration import explore_target_application
from app.services.browser import execute_browser_journey


class ExploreAppResponse(BaseModel):
    test_run_id: int
    status: str
    discovered_urls: List[str]
    pages_crawled: int
    actions_count: int
    duration_ms: float
    regression_journey_id: int | None = None
    generated_journey: dict


@router.post(
    "/{app_id}/explore",
    response_model=ExploreAppResponse,
    summary="Run Autonomous Exploration & Synthesize Journey",
)
async def explore_target_app(
    app_id: int,
    max_pages: int = Query(5, ge=1, le=20),
    max_actions: int = Query(12, ge=1, le=30),
    save_as_regression: bool = Query(True),
    db: Session = Depends(get_db),
) -> ExploreAppResponse:
    """Autonomously explores the target application, crawls same-origin links,

    synthesizes a non-destructive test journey, executes it with Playwright, and optionally
    persists it to the regression suite.
    """
    target_app = db.query(TargetApp).filter(TargetApp.id == app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application with ID {app_id} not found.",
        )

    # 1. Run autonomous crawler
    exploration_res = await explore_target_application(
        target_app_url=target_app.url,
        max_pages=max_pages,
        max_actions=max_actions,
    )

    # 2. Persist test run record
    test_run = TestRun(
        target_app_id=target_app.id,
        status="running",
        journey_definition=exploration_res.generated_journey.model_dump(mode="json"),
        started_at=datetime.now(timezone.utc),
    )
    db.add(test_run)
    db.commit()
    db.refresh(test_run)

    # 3. Execute the synthesized journey with Playwright
    report = await execute_browser_journey(
        journey=exploration_res.generated_journey,
        target_app_url=target_app.url,
        test_run_id=test_run.id,
    )

    test_run.status = report.status
    test_run.started_at = report.started_at
    test_run.completed_at = report.completed_at
    test_run.action_results = report.action_results
    test_run.error_message = report.error_message
    test_run.evidence_paths = report.evidence_paths
    db.add(test_run)

    # 4. Save to regression library if requested
    regression_id = None
    if save_as_regression and report.status == "passed":
        reg = RegressionJourney(
            target_app_id=target_app.id,
            name=f"Autonomous: {target_app.name} ({len(exploration_res.generated_journey.actions)} actions)",
            journey_definition=exploration_res.generated_journey.model_dump(mode="json"),
        )
        db.add(reg)
        db.commit()
        db.refresh(reg)
        regression_id = reg.id
    else:
        db.commit()

    return ExploreAppResponse(
        test_run_id=test_run.id,
        status=test_run.status,
        discovered_urls=exploration_res.discovered_urls,
        pages_crawled=exploration_res.pages_crawled,
        actions_count=len(exploration_res.generated_journey.actions),
        duration_ms=exploration_res.duration_ms,
        regression_journey_id=regression_id,
        generated_journey=exploration_res.generated_journey.model_dump(mode="json"),
    )

