"""Tests for PATCH /api/v1/defects/{defect_id} -- controlled defect update API.

Covers:
- Successful partial update of each permitted field (severity, status,
  description, reproduction_steps, expected_behavior).
- Multiple fields updated together.
- Empty body (no-op) -- returns 200 with unchanged defect.
- Invalid severity and status values -- 422.
- Attempt to set status="VERIFIED" via API -- 422 (reserved for BlindReplay).
- Attempt to modify immutable fields (title, test_run_id) -- 422.
- Attempt to submit unknown/extra fields -- 422.
- Unknown defect ID -- 404.
- Persistence verified via subsequent GET.
- Regression guard: existing BlindReplay VERIFIED promotion is unaffected.
"""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import patch

from app.models.defect import Defect
from app.models.target_app import TargetApp
from app.models.test_run import TestRun


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _make_defect(db_session: Session, status: str = "OPEN", severity: str = "MEDIUM") -> Defect:
    """Creates a minimal target app + run + defect and returns the Defect."""
    app = TargetApp(name="Test App", url="http://127.0.0.1:9000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    defect = Defect(
        test_run_id=run.id,
        title="Login fails on empty password",
        description="Clicking submit with empty password crashes the server.",
        severity=severity,
        status=status,
        reproduction_steps="1. Navigate to /login\n2. Leave password blank\n3. Click Submit",
        expected_behavior="Expected validation error message to appear.",
    )
    db_session.add(defect)
    db_session.commit()
    return defect


# ---------------------------------------------------------------------------
# Individual-field updates
# ---------------------------------------------------------------------------

def test_patch_defect_severity(client: TestClient, db_session: Session):
    """Verifies that severity can be updated to any valid value."""
    defect = _make_defect(db_session, severity="LOW")

    resp = client.patch(
        f"/api/v1/defects/{defect.id}",
        json={"severity": "CRITICAL"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["severity"] == "CRITICAL"
    assert data["title"] == defect.title
    assert data["test_run_id"] == defect.test_run_id


def test_patch_defect_status_open_to_in_progress(client: TestClient, db_session: Session):
    """Verifies status can be changed from OPEN to IN_PROGRESS."""
    defect = _make_defect(db_session, status="OPEN")
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"status": "IN_PROGRESS"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "IN_PROGRESS"


def test_patch_defect_status_to_closed(client: TestClient, db_session: Session):
    """Verifies status can be changed to CLOSED."""
    defect = _make_defect(db_session, status="OPEN")
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"status": "CLOSED"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "CLOSED"


def test_patch_defect_status_to_wont_fix(client: TestClient, db_session: Session):
    """Verifies status can be changed to WONT_FIX."""
    defect = _make_defect(db_session, status="OPEN")
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"status": "WONT_FIX"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "WONT_FIX"


def test_patch_defect_description(client: TestClient, db_session: Session):
    """Verifies description can be updated."""
    defect = _make_defect(db_session)
    new_desc = "Updated: Server returns 500 instead of validation error."
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"description": new_desc})
    assert resp.status_code == 200
    assert resp.json()["description"] == new_desc


def test_patch_defect_reproduction_steps(client: TestClient, db_session: Session):
    """Verifies reproduction_steps can be updated."""
    defect = _make_defect(db_session)
    new_steps = "1. Navigate to /login\n2. Enter wrong password\n3. Click Submit"
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"reproduction_steps": new_steps})
    assert resp.status_code == 200
    assert resp.json()["reproduction_steps"] == new_steps


def test_patch_defect_expected_behavior(client: TestClient, db_session: Session):
    """Verifies expected_behavior can be updated."""
    defect = _make_defect(db_session)
    new_expected = "Expected 'Invalid password' validation message."
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"expected_behavior": new_expected})
    assert resp.status_code == 200
    assert resp.json()["expected_behavior"] == new_expected


# ---------------------------------------------------------------------------
# Multiple fields updated together
# ---------------------------------------------------------------------------

def test_patch_defect_multiple_fields(client: TestClient, db_session: Session):
    """Verifies that multiple permitted fields can be updated in a single request."""
    defect = _make_defect(db_session, severity="LOW", status="OPEN")
    resp = client.patch(
        f"/api/v1/defects/{defect.id}",
        json={
            "severity": "HIGH",
            "status": "IN_PROGRESS",
            "description": "Expanded: also fails on whitespace-only password.",
            "expected_behavior": "Expected 'Password is required' error.",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["severity"] == "HIGH"
    assert data["status"] == "IN_PROGRESS"
    assert data["description"] == "Expanded: also fails on whitespace-only password."
    assert data["expected_behavior"] == "Expected 'Password is required' error."
    assert data["title"] == defect.title
    assert data["reproduction_steps"] == defect.reproduction_steps


# ---------------------------------------------------------------------------
# Empty body (no-op)
# ---------------------------------------------------------------------------

def test_patch_defect_empty_body_is_noop(client: TestClient, db_session: Session):
    """Verifies that an empty PATCH body returns 200 with the unchanged defect."""
    defect = _make_defect(db_session, severity="MEDIUM", status="OPEN")
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["severity"] == "MEDIUM"
    assert data["status"] == "OPEN"
    assert data["title"] == defect.title
    assert data["description"] == defect.description


# ---------------------------------------------------------------------------
# Validation -- invalid field values
# ---------------------------------------------------------------------------

def test_patch_defect_invalid_severity_422(client: TestClient, db_session: Session):
    """Verifies that an unrecognised severity string returns HTTP 422."""
    defect = _make_defect(db_session)
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"severity": "BLOCKER"})
    assert resp.status_code == 422


def test_patch_defect_invalid_status_422(client: TestClient, db_session: Session):
    """Verifies that an unrecognised status string returns HTTP 422."""
    defect = _make_defect(db_session)
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"status": "PENDING_REVIEW"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Trust boundary -- VERIFIED cannot be set via API
# ---------------------------------------------------------------------------

def test_patch_defect_cannot_set_verified_externally(client: TestClient, db_session: Session):
    """Verifies that status="VERIFIED" is rejected with 422.

    VERIFIED is reserved for BlindReplay (replays.py:105). External callers
    must not be able to self-certify a defect as independently confirmed.
    """
    defect = _make_defect(db_session)
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"status": "VERIFIED"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Immutable-field protection
# ---------------------------------------------------------------------------

def test_patch_defect_cannot_change_title(client: TestClient, db_session: Session):
    """Verifies that submitting "title" in the PATCH body returns HTTP 422."""
    defect = _make_defect(db_session)
    resp = client.patch(
        f"/api/v1/defects/{defect.id}",
        json={"title": "Hacker Title Overwrite"},
    )
    assert resp.status_code == 422


def test_patch_defect_cannot_change_test_run_id(client: TestClient, db_session: Session):
    """Verifies that submitting "test_run_id" in the PATCH body returns HTTP 422."""
    defect = _make_defect(db_session)
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"test_run_id": 9999})
    assert resp.status_code == 422


def test_patch_defect_unknown_field_rejected(client: TestClient, db_session: Session):
    """Verifies that submitting an unknown field returns HTTP 422."""
    defect = _make_defect(db_session)
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"non_existent_field": "hacked"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Empty description rejected
# ---------------------------------------------------------------------------

def test_patch_defect_empty_description_rejected(client: TestClient, db_session: Session):
    """Verifies that an explicitly blank description string is rejected with 422."""
    defect = _make_defect(db_session)
    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"description": "   "})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 404 for unknown defect
# ---------------------------------------------------------------------------

def test_patch_defect_unknown_id_returns_404(client: TestClient):
    """Verifies that patching a non-existent defect ID returns HTTP 404."""
    resp = client.patch("/api/v1/defects/99999", json={"severity": "HIGH"})
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Persistence -- verify changes survive a round-trip GET
# ---------------------------------------------------------------------------

def test_patch_defect_changes_persist_after_get(client: TestClient, db_session: Session):
    """Verifies that PATCH changes are durable and readable via GET."""
    defect = _make_defect(db_session, severity="LOW", status="OPEN")

    patch_resp = client.patch(
        f"/api/v1/defects/{defect.id}",
        json={"severity": "HIGH", "status": "IN_PROGRESS"},
    )
    assert patch_resp.status_code == 200

    get_resp = client.get(f"/api/v1/defects/{defect.id}")
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["severity"] == "HIGH"
    assert data["status"] == "IN_PROGRESS"
    assert data["title"] == defect.title
    assert data["test_run_id"] == defect.test_run_id


# ---------------------------------------------------------------------------
# Regression guard -- BlindReplay VERIFIED promotion remains intact
# ---------------------------------------------------------------------------

def test_blind_replay_verified_promotion_unaffected(client: TestClient, db_session: Session):
    """Regression guard: the BlindReplay CONFIRMED -> defect.status=VERIFIED
    pathway (replays.py:104-106) is unchanged by the PATCH endpoint.

    execute_blind_replay is mocked to return a CONFIRMED report so no
    real browser is required.
    """
    from datetime import datetime, timezone
    from app.services.blind_replay import ReplayExecutionReport

    app = TargetApp(name="Regression Guard App", url="http://127.0.0.1:9001")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    defect = Defect(
        test_run_id=run.id,
        title="Checkout crash",
        description="Submitting order crashes the server.",
        severity="HIGH",
        status="OPEN",
        reproduction_steps="1. Navigate to /checkout\n2. Click Submit",
        expected_behavior="Expected 'Order Confirmed: Thank you!' to appear.",
    )
    db_session.add(defect)
    db_session.commit()

    confirmed_report = ReplayExecutionReport(
        outcome="CONFIRMED",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        execution_log=[{"step": "mock"}],
        evidence_paths=["replay_1/confirmed.png"],
        error_message=None,
    )

    with patch(
        "app.api.v1.replays.execute_blind_replay",
        return_value=confirmed_report,
    ):
        replay_resp = client.post(f"/api/v1/defects/{defect.id}/replay")

    assert replay_resp.status_code == 201
    assert replay_resp.json()["outcome"] == "CONFIRMED"

    # BlindReplay must have promoted the defect to VERIFIED
    get_resp = client.get(f"/api/v1/defects/{defect.id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "VERIFIED"

    # Attempting to set VERIFIED via the PATCH endpoint must still be rejected
    patch_resp = client.patch(
        f"/api/v1/defects/{defect.id}",
        json={"status": "VERIFIED"},
    )
    assert patch_resp.status_code == 422


# ---------------------------------------------------------------------------
# Trust boundary -- Protect already-VERIFIED defects from demotion (409)
# ---------------------------------------------------------------------------

def test_patch_verified_defect_status_open_rejected_409(client: TestClient, db_session: Session):
    """Verifies that attempting to demote an already-VERIFIED defect to OPEN
    returns HTTP 409 Conflict and leaves status unchanged as VERIFIED.
    """
    defect = _make_defect(db_session, status="VERIFIED")

    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"status": "OPEN"})
    assert resp.status_code == 409
    assert "cannot alter status" in resp.json()["detail"].lower()

    # Status must remain VERIFIED in database and via GET
    db_session.refresh(defect)
    assert defect.status == "VERIFIED"

    get_resp = client.get(f"/api/v1/defects/{defect.id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "VERIFIED"


def test_patch_verified_defect_status_closed_rejected_409(client: TestClient, db_session: Session):
    """Verifies that attempting to change an already-VERIFIED defect to CLOSED
    returns HTTP 409 Conflict and leaves status unchanged as VERIFIED.
    """
    defect = _make_defect(db_session, status="VERIFIED")

    resp = client.patch(f"/api/v1/defects/{defect.id}", json={"status": "CLOSED"})
    assert resp.status_code == 409
    assert "cannot alter status" in resp.json()["detail"].lower()

    db_session.refresh(defect)
    assert defect.status == "VERIFIED"


def test_patch_verified_defect_other_fields_allowed(client: TestClient, db_session: Session):
    """Verifies that non-status fields (e.g. description) can still be safely
    updated on an already-VERIFIED defect without affecting its VERIFIED status.
    """
    defect = _make_defect(db_session, status="VERIFIED")

    resp = client.patch(
        f"/api/v1/defects/{defect.id}",
        json={"description": "Updated note on independently verified defect."},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "VERIFIED"
    assert data["description"] == "Updated note on independently verified defect."

    db_session.refresh(defect)
    assert defect.status == "VERIFIED"
    assert defect.description == "Updated note on independently verified defect."


# ---------------------------------------------------------------------------
# Explicit-null validation (422 vs 200)
# ---------------------------------------------------------------------------

def test_patch_defect_explicit_null_non_nullable_fields_rejected_422(
    client: TestClient, db_session: Session
):
    """Verifies that explicit null for non-nullable fields (severity, status,
    description) is rejected with HTTP 422 and leaves the DB record unchanged.
    """
    defect = _make_defect(db_session, severity="MEDIUM", status="OPEN")
    original_desc = defect.description

    for field in ["severity", "status", "description"]:
        resp = client.patch(f"/api/v1/defects/{defect.id}", json={field: None})
        assert resp.status_code == 422, f"Expected 422 for {field}=null, got {resp.status_code}"

        # Confirm DB record is untouched
        db_session.refresh(defect)
        assert defect.severity == "MEDIUM"
        assert defect.status == "OPEN"
        assert defect.description == original_desc


def test_patch_defect_explicit_null_nullable_fields_cleared_200(
    client: TestClient, db_session: Session
):
    """Verifies that explicit null for nullable fields (reproduction_steps,
    expected_behavior) successfully clears the values in the database (HTTP 200).
    """
    defect = _make_defect(db_session)
    assert defect.reproduction_steps is not None
    assert defect.expected_behavior is not None

    # Clear reproduction_steps
    resp1 = client.patch(f"/api/v1/defects/{defect.id}", json={"reproduction_steps": None})
    assert resp1.status_code == 200
    assert resp1.json()["reproduction_steps"] is None

    db_session.refresh(defect)
    assert defect.reproduction_steps is None

    # Clear expected_behavior
    resp2 = client.patch(f"/api/v1/defects/{defect.id}", json={"expected_behavior": None})
    assert resp2.status_code == 200
    assert resp2.json()["expected_behavior"] is None

    db_session.refresh(defect)
    assert defect.expected_behavior is None
