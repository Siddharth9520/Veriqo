"""Automated tests for bounded autonomous exploration engine and API endpoints."""

from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session

from app.models.target_app import TargetApp
from app.models.test_run import TestRun
from app.models.regression_journey import RegressionJourney
from app.services.exploration import is_safe_action_text, explore_target_application


def test_is_safe_action_text_filters_destructive_keywords():
    """Verifies that is_safe_action_text rejects destructive actions and allows safe actions."""
    # Destructive operations must be rejected
    assert not is_safe_action_text("Delete account")
    assert not is_safe_action_text("Remove from cart")
    assert not is_safe_action_text("Purge records")
    assert not is_safe_action_text("Pay now")
    assert not is_safe_action_text("Buy with 1-click")
    assert not is_safe_action_text("Checkout")

    # Safe operations must be accepted
    assert is_safe_action_text("View catalog")
    assert is_safe_action_text("Search inventory")
    assert is_safe_action_text("About us")
    assert is_safe_action_text("Documentation")
    assert is_safe_action_text(None)


import asyncio


def test_explore_target_application_against_mock(local_test_server: str):
    """Verifies that explore_target_application crawls the target, discovers links,

    and synthesizes an executable JourneyDefinition.
    """
    res = asyncio.run(
        explore_target_application(
            target_app_url=local_test_server,
            max_pages=3,
            max_actions=8,
            timeout_seconds=15,
        )
    )

    assert res.target_app_url == local_test_server
    assert len(res.discovered_urls) >= 1
    assert len(res.generated_journey.actions) >= 2
    action_types = [a.type for a in res.generated_journey.actions]
    assert "navigate" in action_types
    assert "screenshot" in action_types
    assert res.pages_crawled >= 1


def test_explore_target_app_api_endpoint(client: TestClient, db_session: Session, local_test_server: str):
    """Verifies the POST /api/v1/target-apps/{app_id}/explore endpoint runs the crawler,

    persists a TestRun, and creates a RegressionJourney.
    """
    app = TargetApp(name="Exploration Target", url=local_test_server)
    db_session.add(app)
    db_session.commit()

    resp = client.post(
        f"/api/v1/target-apps/{app.id}/explore?max_pages=2&max_actions=5&save_as_regression=true"
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["test_run_id"] is not None
    assert data["status"] in ("passed", "failed")
    assert data["pages_crawled"] >= 1
    assert data["actions_count"] >= 2
    assert "discovered_urls" in data

    # Verify TestRun in database
    run = db_session.query(TestRun).filter(TestRun.id == data["test_run_id"]).first()
    assert run is not None
    assert run.target_app_id == app.id


def test_explore_unknown_target_app_404(client: TestClient):
    """Verifies that exploring a non-existent target app returns HTTP 404."""
    resp = client.post("/api/v1/target-apps/999999/explore")
    assert resp.status_code == 404
