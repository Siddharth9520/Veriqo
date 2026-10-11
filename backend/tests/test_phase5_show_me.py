"""Tests for Phase 5: Show Me Mode and Fix Prompt Export."""

from datetime import datetime, timezone
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.defect import Defect
from app.models.replay_attempt import ReplayAttempt
from app.models.target_app import TargetApp
from app.models.test_run import TestRun


# ---------------------------------------------------------------------------
# Fixtures / Helpers
# ---------------------------------------------------------------------------

def _create_defect_hierarchy(
    db: Session,
    title: str = "Order total calculation error",
    description: str = "Order total displays $0.00 instead of $25.00",
    severity: str = "HIGH",
    status: str = "OPEN",
    reproduction_steps: str = "1. Add item to cart\n2. Go to checkout",
    expected_behavior: str = "Total should display $25.00",
    run_status: str = "failed",
    evidence_paths: list = None,
    action_results: list = None,
    error_message: str = None,
) -> Defect:
    app = TargetApp(name="Ecommerce Target App", url="http://127.0.0.1:9050")
    db.add(app)
    db.commit()

    run = TestRun(
        target_app_id=app.id,
        status=run_status,
        journey_definition={"journey_name": "Checkout Flow", "actions": []},
        action_results=action_results or [
            {"action_type": "navigate", "status": "passed"},
            {
                "action_type": "assert_text_visible",
                "status": "failed",
                "error_message": "Text '$25.00' not found; observed '$0.00'",
            },
        ],
        evidence_paths=evidence_paths or [],
        error_message=error_message or "Assertion failed: Total did not match",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()

    defect = Defect(
        test_run_id=run.id,
        title=title,
        description=description,
        severity=severity,
        status=status,
        reproduction_steps=reproduction_steps,
        expected_behavior=expected_behavior,
    )
    db.add(defect)
    db.commit()
    return defect


# ---------------------------------------------------------------------------
# 1. Show Me Mode with complete evidence
# ---------------------------------------------------------------------------

def test_show_me_complete_evidence(client: TestClient, db_session: Session, tmp_path):
    """Verifies Show Me Mode when all referenced evidence artifacts physically exist on disk."""
    evidence_dir = Path(settings.EVIDENCE_DIR)
    evidence_dir.mkdir(parents=True, exist_ok=True)

    rel_artifact = "run_complete_test/screenshot.png"
    disk_path = evidence_dir / rel_artifact
    disk_path.parent.mkdir(parents=True, exist_ok=True)
    disk_path.write_bytes(b"\x89PNG\r\n\x1a\nfakeimagebytes")

    try:
        defect = _create_defect_hierarchy(
            db_session,
            evidence_paths=[rel_artifact],
        )

        resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
        assert resp.status_code == 200
        data = resp.json()

        assert data["defect_id"] == defect.id
        assert data["title"] == defect.title
        assert data["severity"] == "HIGH"
        assert data["status"] == "OPEN"
        assert data["test_run"]["id"] == defect.test_run_id
        assert data["test_run"]["journey_name"] == "Checkout Flow"

        evidence = data["evidence"]
        assert evidence["status"] == "COMPLETE"
        assert evidence["total_artifacts"] == 1
        assert evidence["verified_count"] == 1
        assert evidence["missing_count"] == 0
        assert len(evidence["artifacts"]) == 1
        assert evidence["artifacts"][0]["exists"] is True
        assert evidence["artifacts"][0]["file_size_bytes"] > 0
        assert "screenshot.png" in evidence["artifacts"][0]["download_url"]

        assert data["explanation"]["is_ai_generated"] is False
        assert "disclaimer" in data["explanation"]
    finally:
        if disk_path.exists():
            disk_path.unlink()
        if disk_path.parent.exists():
            disk_path.parent.rmdir()


# ---------------------------------------------------------------------------
# 2. Missing and Partial Evidence
# ---------------------------------------------------------------------------

def test_show_me_partial_evidence(client: TestClient, db_session: Session):
    """Verifies Show Me Mode when some evidence files exist and others are missing."""
    evidence_dir = Path(settings.EVIDENCE_DIR)
    evidence_dir.mkdir(parents=True, exist_ok=True)

    present_rel = "run_partial_test/exists.png"
    missing_rel = "run_partial_test/missing.png"

    present_path = evidence_dir / present_rel
    present_path.parent.mkdir(parents=True, exist_ok=True)
    present_path.write_bytes(b"existingbytes")

    try:
        defect = _create_defect_hierarchy(
            db_session,
            evidence_paths=[present_rel, missing_rel],
        )

        resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
        assert resp.status_code == 200
        data = resp.json()

        evidence = data["evidence"]
        assert evidence["status"] == "PARTIAL"
        assert evidence["total_artifacts"] == 2
        assert evidence["verified_count"] == 1
        assert evidence["missing_count"] == 1

        art_map = {a["path"]: a for a in evidence["artifacts"]}
        assert art_map[present_rel]["exists"] is True
        assert art_map[missing_rel]["exists"] is False
        assert "missing" in art_map[missing_rel]["note"].lower()
    finally:
        if present_path.exists():
            present_path.unlink()
        if present_path.parent.exists():
            present_path.parent.rmdir()


def test_show_me_missing_evidence(client: TestClient, db_session: Session):
    """Verifies Show Me Mode when all referenced evidence artifacts are absent from disk."""
    defect = _create_defect_hierarchy(
        db_session,
        evidence_paths=["nonexistent_run/ghost.png"],
    )

    resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
    assert resp.status_code == 200
    evidence = resp.json()["evidence"]

    assert evidence["status"] == "MISSING"
    assert evidence["verified_count"] == 0
    assert evidence["missing_count"] == 1
    assert evidence["artifacts"][0]["exists"] is False


def test_show_me_none_recorded_evidence(client: TestClient, db_session: Session):
    """Verifies Show Me Mode when no evidence paths were recorded."""
    defect = _create_defect_hierarchy(
        db_session,
        evidence_paths=[],
    )

    resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
    assert resp.status_code == 200
    evidence = resp.json()["evidence"]

    assert evidence["status"] == "NONE_RECORDED"
    assert evidence["total_artifacts"] == 0
    assert len(evidence["artifacts"]) == 0


# ---------------------------------------------------------------------------
# 3. Each relevant BlindReplay outcome
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "outcome,is_verified,expected_conf",
    [
        ("CONFIRMED", True, "HIGH"),
        ("NOT_REPRODUCED", False, "MEDIUM"),
        ("INCONCLUSIVE", False, "MEDIUM"),
        ("FAILED", False, "MEDIUM"),
        ("TIMED_OUT", False, "MEDIUM"),
    ],
)
def test_show_me_blind_replay_outcomes(
    client: TestClient,
    db_session: Session,
    outcome: str,
    is_verified: bool,
    expected_conf: str,
):
    """Verifies Show Me Mode correctly reports and contextualizes each BlindReplay outcome."""
    status = "VERIFIED" if is_verified else "OPEN"
    defect = _create_defect_hierarchy(db_session, status=status)

    replay = ReplayAttempt(
        defect_id=defect.id,
        status="COMPLETED" if outcome != "FAILED" else "FAILED",
        outcome=outcome,
        target_url="http://127.0.0.1:9050",
        reproduction_instructions="Replay instructions",
        expected_behavior="Expected total $25.00",
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add(replay)
    db_session.commit()

    resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
    assert resp.status_code == 200
    data = resp.json()

    replay_data = data["blind_replay"]
    assert replay_data["replays_count"] == 1
    assert replay_data["latest_outcome"] == outcome
    assert replay_data["is_verified"] is is_verified
    assert data["explanation"]["confidence"] == expected_conf

    # Check Fix Prompt as well
    fix_resp = client.get(f"/api/v1/defects/{defect.id}/fix-prompt")
    assert fix_resp.status_code == 200
    prompt_data = fix_resp.json()
    assert prompt_data["verification_context"]["latest_outcome"] == outcome
    assert prompt_data["verification_context"]["is_verified"] is is_verified


def test_show_me_no_replays(client: TestClient, db_session: Session):
    """Verifies Show Me and Fix Prompt when no BlindReplay attempts were ever created."""
    defect = _create_defect_hierarchy(db_session)

    resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["blind_replay"]["replays_count"] == 0
    assert data["blind_replay"]["latest_outcome"] is None
    assert data["blind_replay"]["is_verified"] is False

    fix_resp = client.get(f"/api/v1/defects/{defect.id}/fix-prompt")
    assert fix_resp.status_code == 200
    fix_data = fix_resp.json()
    assert fix_data["verification_context"]["replays_count"] == 0
    assert "UNVERIFIED" in fix_data["prompt_text"]


# ---------------------------------------------------------------------------
# 4. Invalid or unknown defect IDs (404)
# ---------------------------------------------------------------------------

def test_show_me_unknown_id_404(client: TestClient):
    """Verifies that querying Show Me Mode for non-existent defect ID returns 404."""
    resp = client.get("/api/v1/defects/999999/show-me")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_fix_prompt_unknown_id_404(client: TestClient):
    """Verifies that querying Fix Prompt Export for non-existent defect ID returns 404."""
    resp = client.get("/api/v1/defects/999999/fix-prompt")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 5. Correct association between defects, runs, and evidence
# ---------------------------------------------------------------------------

def test_show_me_correct_association_isolation(client: TestClient, db_session: Session):
    """Verifies that Show Me Mode strictly isolates context to the requested defect's run and replays."""
    defect_a = _create_defect_hierarchy(
        db_session,
        title="Defect A: Cart empty",
        evidence_paths=["run_a/cart.png"],
    )
    defect_b = _create_defect_hierarchy(
        db_session,
        title="Defect B: Payment 500",
        evidence_paths=["run_b/pay.png"],
    )

    resp_a = client.get(f"/api/v1/defects/{defect_a.id}/show-me")
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["defect_id"] == defect_a.id
    assert data_a["test_run"]["id"] == defect_a.test_run_id
    assert [a["path"] for a in data_a["evidence"]["artifacts"]] == ["run_a/cart.png"]

    resp_b = client.get(f"/api/v1/defects/{defect_b.id}/show-me")
    assert resp_b.status_code == 200
    data_b = resp_b.json()
    assert data_b["defect_id"] == defect_b.id
    assert data_b["test_run"]["id"] == defect_b.test_run_id
    assert [a["path"] for a in data_b["evidence"]["artifacts"]] == ["run_b/pay.png"]


# ---------------------------------------------------------------------------
# 6. Fix prompt completeness and omission of unavailable data
# ---------------------------------------------------------------------------

def test_fix_prompt_completeness_and_omission(client: TestClient, db_session: Session):
    """Verifies Fix Prompt markdown structure, task list, and clear handling of missing optional fields."""
    defect = _create_defect_hierarchy(
        db_session,
        reproduction_steps=None,
        expected_behavior=None,
    )

    resp = client.get(f"/api/v1/defects/{defect.id}/fix-prompt")
    assert resp.status_code == 200
    data = resp.json()

    # Field validations
    assert data["defect_id"] == defect.id
    assert data["title"] == defect.title
    assert data["severity"] == defect.severity
    assert data["reproduction_steps"] is None
    assert data["expected_behavior"] is None
    assert len(data["developer_tasks"]) >= 3

    # Copyable text validations
    text = data["prompt_text"]
    assert f"# Bug Fix Request: {defect.title}" in text
    assert f"- **Defect ID**: #{defect.id}" in text
    assert "[No reproduction steps provided]" in text
    assert "[No expected behavior provided]" in text
    assert "## Developer Instructions" in text
    assert "Investigate the root cause" in text


# ---------------------------------------------------------------------------
# 7. Secret Redaction
# ---------------------------------------------------------------------------

def test_secret_redaction_in_show_me_and_fix_prompt(client: TestClient, db_session: Session):
    """Verifies that secrets (passwords, bearer tokens, api keys, url credentials)
    are scrubbed from Show Me Mode and Fix Prompt Export.
    """
    secret_desc = (
        "Crashed when password: secret_password_123! was submitted with "
        "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    )
    secret_repro = (
        "1. Set api_key=super_secret_api_key_xyz\n"
        "2. Navigate to https://user:secretpass789@secure.target.com/login"
    )

    defect = _create_defect_hierarchy(
        db_session,
        description=secret_desc,
        reproduction_steps=secret_repro,
    )

    # 1. Check Show Me Mode
    show_resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
    assert show_resp.status_code == 200
    show_data = show_resp.json()

    # Raw secrets must NOT appear
    raw_show_text = str(show_data)
    assert "secret_password_123!" not in raw_show_text
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in raw_show_text
    assert "super_secret_api_key_xyz" not in raw_show_text
    assert "secretpass789" not in raw_show_text

    # [REDACTED] tokens must be present
    assert "[REDACTED]" in show_data["description"]
    assert "[REDACTED]" in show_data["reproduction_steps"]

    # 2. Check Fix Prompt Export
    fix_resp = client.get(f"/api/v1/defects/{defect.id}/fix-prompt")
    assert fix_resp.status_code == 200
    fix_data = fix_resp.json()

    raw_fix_text = fix_data["prompt_text"]
    assert "secret_password_123!" not in raw_fix_text
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in raw_fix_text
    assert "super_secret_api_key_xyz" not in raw_fix_text
    assert "secretpass789" not in raw_fix_text
    assert "[REDACTED]" in raw_fix_text


# ---------------------------------------------------------------------------
# 8. No database mutation during viewing or exporting
# ---------------------------------------------------------------------------

def test_no_database_mutation_on_read(client: TestClient, db_session: Session):
    """Verifies that viewing Show Me Mode or exporting a Fix Prompt is strictly read-only."""
    defect = _create_defect_hierarchy(db_session)
    orig_updated_at = defect.updated_at
    orig_status = defect.status
    orig_severity = defect.severity

    # Execute read operations
    r1 = client.get(f"/api/v1/defects/{defect.id}/show-me")
    assert r1.status_code == 200

    r2 = client.get(f"/api/v1/defects/{defect.id}/fix-prompt")
    assert r2.status_code == 200

    # Refresh defect directly from DB
    db_session.refresh(defect)
    assert defect.status == orig_status
    assert defect.severity == orig_severity
    assert defect.updated_at == orig_updated_at

    # Ensure no extra test runs or replays were inserted
    assert db_session.query(ReplayAttempt).filter(ReplayAttempt.defect_id == defect.id).count() == 0


# ---------------------------------------------------------------------------
# 9. Path traversal, absolute paths, and malformed evidence references
# ---------------------------------------------------------------------------

def test_show_me_path_traversal_and_malformed_evidence(client: TestClient, db_session: Session):
    """Verifies that traversal paths, absolute paths, and malformed paths are blocked
    safely without server errors and marked as not existing.
    """
    traversal_path = "../../Windows/System32/drivers/etc/hosts"
    absolute_path = "C:/Windows/notepad.exe"
    malformed_path = "run_1/file_with\x00null.png"

    defect = _create_defect_hierarchy(
        db_session,
        evidence_paths=[traversal_path, absolute_path, malformed_path],
    )

    resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
    assert resp.status_code == 200
    data = resp.json()

    evidence = data["evidence"]
    assert evidence["status"] == "MISSING"
    assert evidence["verified_count"] == 0
    assert evidence["missing_count"] == 3

    for artifact in evidence["artifacts"]:
        assert artifact["exists"] is False
        assert artifact["download_url"] is None

    # Check Fix Prompt as well
    fix_resp = client.get(f"/api/v1/defects/{defect.id}/fix-prompt")
    assert fix_resp.status_code == 200
    fix_data = fix_resp.json()
    for ref in fix_data["evidence_references"]:
        assert ref["exists"] is False


# ---------------------------------------------------------------------------
# 10. Advanced secret redaction: JSON, hyphenated keys, PEM keys
# ---------------------------------------------------------------------------

def test_secret_redaction_json_and_advanced_patterns(client: TestClient, db_session: Session):
    """Verifies that JSON-formatted credentials, hyphenated keys, and PEM private keys
    are completely scrubbed from Show Me Mode and Fix Prompt Export.
    """
    json_block = '{"password": "secret_pass_999", "client_secret": "client_secret_888"}'
    hyphenated_block = "api-key: my_api_key_777 and access-token: my_access_token_666"
    pem_block = "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----"

    defect = _create_defect_hierarchy(
        db_session,
        description=f"Payload: {json_block}\nConfig: {hyphenated_block}",
        reproduction_steps=f"1. Load cert: {pem_block}",
    )

    # Show Me
    show_resp = client.get(f"/api/v1/defects/{defect.id}/show-me")
    assert show_resp.status_code == 200
    show_raw = str(show_resp.json())

    assert "secret_pass_999" not in show_raw
    assert "client_secret_888" not in show_raw
    assert "my_api_key_777" not in show_raw
    assert "my_access_token_666" not in show_raw
    assert "MIIEowIBAAKCAQEA0" not in show_raw

    # Fix Prompt
    fix_resp = client.get(f"/api/v1/defects/{defect.id}/fix-prompt")
    assert fix_resp.status_code == 200
    fix_raw = str(fix_resp.json())

    assert "secret_pass_999" not in fix_raw
    assert "client_secret_888" not in fix_raw
    assert "my_api_key_777" not in fix_raw
    assert "my_access_token_666" not in fix_raw
    assert "MIIEowIBAAKCAQEA0" not in fix_raw

