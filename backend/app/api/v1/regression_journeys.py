"""Regression journey management and re-execution endpoints."""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.regression_journey import RegressionJourney
from app.models.target_app import TargetApp
from app.models.test_run import TestRun
from app.schemas.journey import JourneyDefinition
from app.schemas.regression_journey import (
    RegressionJourneyCreate,
    RegressionJourneyRead,
)
from app.schemas.test_run import TestRunRead
from app.services.browser import execute_browser_journey

router = APIRouter(prefix="/regression-journeys", tags=["Regression Journeys"])


@router.post(
    "",
    response_model=RegressionJourneyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Save Passed Test Run as Regression Baseline",
)
def create_regression_journey(
    payload: RegressionJourneyCreate,
    db: Session = Depends(get_db),
) -> RegressionJourney:
    """Saves a verified, passing test run's journey definition as a regression baseline.

    Explicitly refuses to save failed, timed_out, or unexecuted runs.
    """
    baseline_run = db.query(TestRun).filter(TestRun.id == payload.baseline_test_run_id).first()
    if not baseline_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Baseline test run with ID {payload.baseline_test_run_id} not found.",
        )

    # Strictly verify that baseline run genuinely passed
    if baseline_run.status != "passed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot save regression baseline: Test run {baseline_run.id} has status "
                f"'{baseline_run.status}'. Only test runs with status 'passed' can be saved as baselines."
            ),
        )

    if not baseline_run.journey_definition:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Baseline test run {baseline_run.id} does not contain a valid journey definition.",
        )

    regression_journey = RegressionJourney(
        target_app_id=baseline_run.target_app_id,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        journey_definition=baseline_run.journey_definition,
        baseline_test_run_id=baseline_run.id,
    )
    db.add(regression_journey)
    db.commit()
    db.refresh(regression_journey)
    return regression_journey


@router.get(
    "",
    response_model=List[RegressionJourneyRead],
    summary="List Regression Journeys",
)
def list_regression_journeys(
    target_app_id: Optional[int] = Query(None, description="Filter by target app ID"),
    db: Session = Depends(get_db),
) -> List[RegressionJourney]:
    """List all saved regression journeys."""
    query = db.query(RegressionJourney)
    if target_app_id is not None:
        query = query.filter(RegressionJourney.target_app_id == target_app_id)
    return query.order_by(RegressionJourney.id.desc()).all()


@router.get(
    "/{journey_id}",
    response_model=RegressionJourneyRead,
    summary="Get Regression Journey by ID",
)
def get_regression_journey(
    journey_id: int,
    db: Session = Depends(get_db),
) -> RegressionJourney:
    """Retrieve details of a specific saved regression journey."""
    journey = db.query(RegressionJourney).filter(RegressionJourney.id == journey_id).first()
    if not journey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Regression journey with ID {journey_id} not found.",
        )
    return journey


@router.post(
    "/{journey_id}/execute",
    response_model=TestRunRead,
    status_code=status.HTTP_201_CREATED,
    summary="Re-execute Regression Journey",
)
async def execute_regression_journey(
    journey_id: int,
    db: Session = Depends(get_db),
) -> TestRun:
    """Re-executes a saved regression journey through Playwright and records a new TestRun."""
    regression_journey = db.query(RegressionJourney).filter(RegressionJourney.id == journey_id).first()
    if not regression_journey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Regression journey with ID {journey_id} not found.",
        )

    target_app = db.query(TargetApp).filter(TargetApp.id == regression_journey.target_app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application {regression_journey.target_app_id} no longer exists.",
        )

    # Validate and parse saved journey definition
    parsed_journey = JourneyDefinition.model_validate(regression_journey.journey_definition)

    # Create new independent TestRun record linked to this regression journey
    test_run = TestRun(
        target_app_id=target_app.id,
        status="running",
        journey_definition=regression_journey.journey_definition,
        regression_journey_id=regression_journey.id,
        started_at=datetime.now(timezone.utc),
    )
    db.add(test_run)
    db.commit()
    db.refresh(test_run)

    # Execute journey in fresh browser context
    report = await execute_browser_journey(
        journey=parsed_journey,
        target_app_url=target_app.url,
        test_run_id=test_run.id,
    )

    # Update new test run with actual results
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
