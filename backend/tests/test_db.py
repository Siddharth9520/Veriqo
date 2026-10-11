"""Tests for foundational database models and session handling."""

from sqlalchemy.orm import Session
from app.models.defect import Defect
from app.models.target_app import TargetApp
from app.models.test_run import TestRun
from app.db.session import check_db_connection


def test_real_db_connectivity_check():
    """Verify that check_db_connection returns True against configured engine."""
    assert check_db_connection() is True


def test_create_target_app_and_test_run(db_session: Session):
    """Test creating a TargetApp, an associated TestRun, and Defect."""
    target_app = TargetApp(
        name="Sample Web App",
        url="https://example.com",
        description="Demo application under test",
    )
    db_session.add(target_app)
    db_session.flush()

    assert target_app.id is not None
    assert target_app.created_at is not None

    test_run = TestRun(
        target_app_id=target_app.id,
        status="RUNNING",
    )
    db_session.add(test_run)
    db_session.flush()

    assert test_run.id is not None
    assert test_run.target_app_id == target_app.id

    defect = Defect(
        test_run_id=test_run.id,
        title="Button unresponsive on checkout page",
        description="Clicking the checkout button triggers no network event.",
        severity="HIGH",
        status="OPEN",
        reproduction_steps="1. Navigate to /cart\n2. Click Checkout",
    )
    db_session.add(defect)
    db_session.flush()

    assert defect.id is not None
    assert defect.test_run_id == test_run.id
    assert len(test_run.defects) == 1
    assert test_run.defects[0].title == "Button unresponsive on checkout page"
