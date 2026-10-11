"""Automated tests for QA Certificate models, schemas, and API endpoints."""

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.defect import Defect
from app.models.replay_attempt import ReplayAttempt
from app.models.target_app import TargetApp
from app.models.test_run import TestRun


def test_create_certificate_success_default_scope(
    client: TestClient, db_session: Session
):
    """Verifies generating a certificate with default scope includes all terminal runs for target app."""
    # 1. Register target app
    app = TargetApp(name="Store App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    # 2. Add terminal runs
    run_1 = TestRun(
        target_app_id=app.id,
        status="passed",
        action_results=[
            {"action_type": "navigate", "status": "passed"},
            {"action_type": "assert_text_visible", "status": "passed"},
        ],
    )
    run_2 = TestRun(
        target_app_id=app.id,
        status="passed",
        action_results=[
            {"action_type": "click", "status": "passed"},
            {"action_type": "assert_element_visible", "status": "passed"},
        ],
    )
    db_session.add_all([run_1, run_2])
    db_session.commit()

    # Create expected evidence completion files
    from pathlib import Path
    from app.core.config import settings

    evidence_root = Path(settings.EVIDENCE_DIR)
    dir_1 = evidence_root / f"run_{run_1.id}"
    dir_1.mkdir(parents=True, exist_ok=True)
    (dir_1 / "completion.png").write_bytes(b"png_data_1")

    dir_2 = evidence_root / f"run_{run_2.id}"
    dir_2.mkdir(parents=True, exist_ok=True)
    (dir_2 / "completion.png").write_bytes(b"png_data_2")

    # 3. Request certificate with default scope (no run IDs specified)
    resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    assert resp.status_code == 201
    data = resp.json()

    assert data["target_app_id"] == app.id
    assert data["certificate_id"].startswith("cert_")
    assert data["status"] == "ISSUED"
    assert data["score"] == 100
    assert data["grade"] == "A"
    assert "tamper_hash" in data
    assert len(data["tamper_hash"]) == 64
    assert data["certificate_data"]["evaluation_scope"]["eligible_runs_count"] == 2
    assert data["certificate_data"]["evaluation_scope"]["test_run_ids"] == [run_1.id, run_2.id]



def test_create_certificate_success_explicit_scope(
    client: TestClient, db_session: Session
):
    """Verifies that providing explicit run IDs scopes evaluation strictly to those runs."""
    app = TargetApp(name="Scoped App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run_1 = TestRun(
        target_app_id=app.id,
        status="passed",
        action_results=[{"action_type": "navigate", "status": "passed"}],
    )
    run_2 = TestRun(
        target_app_id=app.id,
        status="failed",
        action_results=[{"action_type": "navigate", "status": "failed"}],
    )
    db_session.add_all([run_1, run_2])
    db_session.commit()

    # Scope only to run_1
    resp = client.post(
        f"/api/v1/target-apps/{app.id}/certificates",
        json={"test_run_ids": [run_1.id]},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["certificate_data"]["evaluation_scope"]["eligible_runs_count"] == 1
    assert data["certificate_data"]["evaluation_scope"]["test_run_ids"] == [run_1.id]


def test_create_certificate_cross_app_run_id_rejected_400(
    client: TestClient, db_session: Session
):
    """Verifies that requesting a run ID belonging to another app returns HTTP 400."""
    app_1 = TargetApp(name="App One", url="http://127.0.0.1:8001")
    app_2 = TargetApp(name="App Two", url="http://127.0.0.1:8002")
    db_session.add_all([app_1, app_2])
    db_session.commit()

    run_2 = TestRun(target_app_id=app_2.id, status="passed")
    db_session.add(run_2)
    db_session.commit()

    resp = client.post(
        f"/api/v1/target-apps/{app_1.id}/certificates",
        json={"test_run_ids": [run_2.id]},
    )
    assert resp.status_code == 400
    assert "does not belong to target application" in resp.json()["detail"]


def test_create_certificate_duplicate_run_ids_rejected_422(
    client: TestClient, db_session: Session
):
    """Verifies that duplicate run IDs in request payload return HTTP 422."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    resp = client.post(
        f"/api/v1/target-apps/{app.id}/certificates",
        json={"test_run_ids": [run.id, run.id]},
    )
    assert resp.status_code == 422
    assert "Duplicate test run IDs" in resp.json()["detail"]


def test_create_certificate_non_terminal_run_rejected_422(
    client: TestClient, db_session: Session
):
    """Verifies that requesting evaluation of a running or pending test run returns HTTP 422."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="running")
    db_session.add(run)
    db_session.commit()

    resp = client.post(
        f"/api/v1/target-apps/{app.id}/certificates",
        json={"test_run_ids": [run.id]},
    )
    assert resp.status_code == 422
    assert "non-terminal status" in resp.json()["detail"]


def test_create_certificate_missing_target_app_404(client: TestClient):
    """Verifies that requesting a certificate for a non-existent app returns HTTP 404."""
    resp = client.post("/api/v1/target-apps/99999/certificates")
    assert resp.status_code == 404


def test_create_certificate_missing_run_id_404(
    client: TestClient, db_session: Session
):
    """Verifies that requesting a non-existent run ID returns HTTP 404."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    resp = client.post(
        f"/api/v1/target-apps/{app.id}/certificates",
        json={"test_run_ids": [99999]},
    )
    assert resp.status_code == 404


def test_list_and_get_certificates(
    client: TestClient, db_session: Session
):
    """Verifies listing certificates for an app and retrieving by string ID or numeric ID."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    create_resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    assert create_resp.status_code == 201
    cert_data = create_resp.json()
    cert_id = cert_data["certificate_id"]
    db_id = cert_data["id"]

    # List certificates
    list_resp = client.get(f"/api/v1/target-apps/{app.id}/certificates")
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["certificate_id"] == cert_id

    # Get by string certificate_id
    get_str_resp = client.get(f"/api/v1/certificates/{cert_id}")
    assert get_str_resp.status_code == 200
    assert get_str_resp.json()["certificate_id"] == cert_id

    # Get by numeric database ID must be rejected with 404 (internal integer IDs do not expose records)
    get_num_resp = client.get(f"/api/v1/certificates/{db_id}")
    assert get_num_resp.status_code == 404

    # Get non-existent certificate
    not_found_resp = client.get("/api/v1/certificates/cert_does_not_exist")
    assert not_found_resp.status_code == 404


def test_verify_certificate_database_backed_match(
    client: TestClient, db_session: Session
):
    """Verifies that database-backed verification matches stored records and reports system_matched=True, issuer_verified=False."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    create_resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    cert_data = create_resp.json()
    cert_id = cert_data["certificate_id"]
    payload = cert_data["certificate_data"]

    # Verify with both certificate_id and payload
    verify_resp = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_id": cert_id, "certificate_data": payload},
    )
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()

    assert v_data["verification_mode"] == "database_backed"
    assert v_data["math_valid"] is True
    assert v_data["checksum_valid"] is True
    assert v_data["system_matched"] is True
    assert v_data["issuer_verified"] is False
    assert v_data["certificate_id"] == cert_id


def test_verify_certificate_database_backed_by_id_only(
    client: TestClient, db_session: Session
):
    """Verifies database lookup by certificate_id alone without submitting certificate_data."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    create_resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    cert_id = create_resp.json()["certificate_id"]

    verify_resp = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_id": cert_id},
    )
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()

    assert v_data["verification_mode"] == "database_backed"
    assert v_data["system_matched"] is True
    assert v_data["issuer_verified"] is False


def test_verify_certificate_database_backed_tampered_payload(
    client: TestClient, db_session: Session
):
    """Verifies that submitting a modified payload against an authentic certificate_id reports system_matched=False."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    create_resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    cert_id = create_resp.json()["certificate_id"]
    tampered_payload = dict(create_resp.json()["certificate_data"])
    # Modify score
    tampered_payload["score_summary"]["score"] = 40

    verify_resp = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_id": cert_id, "certificate_data": tampered_payload},
    )
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()

    assert v_data["verification_mode"] == "database_backed"
    assert v_data["system_matched"] is False
    assert v_data["issuer_verified"] is False


def test_verify_certificate_self_contained_mode(
    client: TestClient, db_session: Session
):
    """Verifies self-contained mode recalculates math and checksum without database matching."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    create_resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    payload = create_resp.json()["certificate_data"]

    # Verify by submitting certificate_data with explicit mode="self_contained"
    verify_resp = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_data": payload, "mode": "self_contained"},
    )
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()


    assert v_data["verification_mode"] == "self_contained"
    assert v_data["math_valid"] is True
    assert v_data["checksum_valid"] is True
    assert v_data["system_matched"] is False
    assert v_data["issuer_verified"] is False


def test_verify_certificate_empty_request_rejected_422(client: TestClient):
    """Verifies that sending an empty verification request returns HTTP 422."""
    resp = client.post("/api/v1/certificates/verify", json={})
    assert resp.status_code == 422


def test_certificate_contains_mandatory_limitations(
    client: TestClient, db_session: Session
):
    """Verifies that all issued certificates include the explicit scope and identity limitations."""
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    create_resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    assert create_resp.status_code == 201
    limitations = create_resp.json()["certificate_data"]["limitations"]

    assert len(limitations) >= 4
    all_text = " ".join(limitations).lower()
    assert "bug-free" in all_text
    assert "issuer identity" in all_text
    assert "numerical score bands" in all_text


def test_verify_certificate_database_backed_corrupt_payload_coexistence(
    client: TestClient, db_session: Session
):
    """Verifies that system_matched=True and math_valid=False can coexist when a submitted payload matches a stored but mathematically invalid record."""
    from app.models.certificate import Certificate
    from app.services.scoring import SCORING_POLICY_VERSION, compute_integrity_hash

    app = TargetApp(name="Corrupt App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    # Create a genuinely invalid certificate payload:
    # 1 passed run with 2 passed assertions recalculates to score=100, grade="A",
    # but the payload claims score=20, grade="F".
    corrupt_payload = {
        "certificate_id": "cert_corrupt_fixture_999",
        "status": "ISSUED",
        "scoring_policy_version": SCORING_POLICY_VERSION,
        "issued_at": "2026-10-11T12:00:00.000000Z",
        "target_app": {
            "id": app.id,
            "name": app.name,
            "url": app.url,
        },
        "evaluation_scope": {
            "test_run_ids": [1],
            "eligible_runs_count": 1,
            "passed_runs_count": 1,
            "failed_runs_count": 0,
            "timed_out_runs_count": 0,
            "journey_pass_rate": 1.0,
            "total_actions_evaluated": 2,
            "total_assertions_evaluated": 2,
            "passed_assertions_count": 2,
            "failed_assertions_count": 0,
            "assertion_pass_rate": 1.0,
            "runs": [
                {
                    "run_id": 1,
                    "status": "passed",
                    "actions_evaluated": 2,
                    "assertions_evaluated": 2,
                    "assertions_passed": 2,
                    "assertions_failed": 0,
                }
            ],
        },
        "findings": [],
        "evidence_audit": {
            "total_expected_artifacts": 1,
            "verified_artifacts_count": 1,
            "missing_artifacts_count": 0,
            "missing_artifact_paths": [],
            "audit_deduction": 0.0,
        },
        "score_summary": {
            "score": 20,
            "grade": "F",
            "base_score": 100.0,
            "raw_score": 100.0,
            "penalties": {
                "verified_defects_deduction": 0.0,
                "unverified_defects_deduction": 0.0,
                "audit_deduction": 0.0,
            },
            "caps_applied": [],
        },
        "limitations": [
            "This certificate reflects ONLY the results of the specific automated journeys and assertions executed during the evaluated test runs.",
            "This certificate does NOT certify that the application is bug-free, error-free, secure, or compliant with requirements outside the executed journeys.",
            "Grades (A, B, C, D, F) represent pure numerical score bands and do not independently certify overall software quality or release readiness.",
            "The tamper_hash is an unkeyed SHA-256 integrity checksum against accidental payload modification. It does NOT prove issuer identity or non-repudiation.",
        ],
    }
    # Compute the integrity hash matching this corrupt payload
    corrupt_hash = compute_integrity_hash(corrupt_payload)
    corrupt_payload["tamper_hash"] = corrupt_hash

    # Save to database
    stored_cert = Certificate(
        certificate_id="cert_corrupt_fixture_999",
        target_app_id=app.id,
        status="ISSUED",
        score=20,
        grade="F",
        tamper_hash=corrupt_hash,
        certificate_data=corrupt_payload,
    )
    db_session.add(stored_cert)
    db_session.commit()

    # Now verify this certificate via API
    resp = client.post(
        "/api/v1/certificates/verify",
        json={
            "certificate_id": "cert_corrupt_fixture_999",
            "certificate_data": corrupt_payload,
        },
    )
    assert resp.status_code == 200
    v_data = resp.json()

    # Independent field verification:
    # 1. system_matched is True because submitted payload and hash match the stored DB record.
    assert v_data["system_matched"] is True
    # 2. math_valid is False because recalculation discovered mathematical inconsistency.
    assert v_data["math_valid"] is False
    # 3. checksum_valid is True because tamper_hash matches canonical hash of the corrupt payload.
    assert v_data["checksum_valid"] is True
    # 4. issuer_verified is False (unkeyed hash cannot prove identity).
    assert v_data["issuer_verified"] is False
    # 5. Error reports mathematical inconsistency.
    assert v_data["error"] is not None


def test_cascade_deletion_target_app_removes_certificates(
    client: TestClient, db_session: Session
):
    """Verifies that deleting a TargetApp cascades and removes its associated Certificate records."""
    from app.models.certificate import Certificate

    app = TargetApp(name="App To Cascade Delete", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    create_resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    assert create_resp.status_code == 201
    cert_id = create_resp.json()["certificate_id"]

    # Verify certificate exists in database
    cert_in_db = (
        db_session.query(Certificate)
        .filter(Certificate.certificate_id == cert_id)
        .first()
    )
    assert cert_in_db is not None
    assert cert_in_db.target_app_id == app.id

    # Delete target application
    db_session.delete(app)
    db_session.commit()

    # Verify associated certificate row was deleted
    cert_after_delete = (
        db_session.query(Certificate)
        .filter(Certificate.certificate_id == cert_id)
        .first()
    )
    assert cert_after_delete is None

    # Verify GET by public certificate_id returns 404
    get_resp = client.get(f"/api/v1/certificates/{cert_id}")
    assert get_resp.status_code == 404


def test_create_certificate_end_to_end_with_defects_and_blind_replay(
    client: TestClient, db_session: Session
):
    """End-to-end integration test: verifies certificate issuance across multiple runs,
    recorded defects, and BlindReplay verification, confirming findings deduplication,
    provenance, penalties, and caps."""
    from pathlib import Path
    from app.core.config import settings

    # 1. Target application
    app = TargetApp(name="Production Portal", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    # 2. Test runs: Run 1 passes (1 assert passed); Run 2 fails (1 assert failed)
    run_1 = TestRun(
        target_app_id=app.id,
        status="passed",
        action_results=[
            {"action_type": "navigate", "status": "passed"},
            {"action_type": "assert_text_visible", "status": "passed"},
        ],
    )
    run_2 = TestRun(
        target_app_id=app.id,
        status="failed",
        action_results=[
            {"action_type": "click", "status": "passed"},
            {"action_type": "assert_element_visible", "status": "failed"},
        ],
    )
    db_session.add_all([run_1, run_2])
    db_session.commit()

    # 3. Create expected evidence completion files
    evidence_root = Path(settings.EVIDENCE_DIR)
    dir_1 = evidence_root / f"run_{run_1.id}"
    dir_1.mkdir(parents=True, exist_ok=True)
    (dir_1 / "completion.png").write_bytes(b"completion_data_1")

    dir_2 = evidence_root / f"run_{run_2.id}"
    dir_2.mkdir(parents=True, exist_ok=True)
    (dir_2 / "failure_step_1.png").write_bytes(b"failure_step_1_data")

    # 4. Record 2 defects that are duplicates of each other
    defect_1 = Defect(
        test_run_id=run_2.id,
        title="Checkout button fails to submit order",
        description="Clicking checkout triggers 500 error",
        severity="HIGH",
        status="OPEN",
        reproduction_steps="1. Click checkout\n2. Submit",
        expected_behavior="Order Confirmed",
    )
    defect_2 = Defect(
        test_run_id=run_2.id,
        title="  checkout button FAILS to submit order  ",
        description="Another report of checkout error",
        severity="HIGH",
        status="OPEN",
        reproduction_steps="1. click checkout \n 2. submit",
        expected_behavior="Order Confirmed",
    )
    db_session.add_all([defect_1, defect_2])
    db_session.commit()

    # 5. Add a BlindReplay attempt confirming defect_1
    replay = ReplayAttempt(
        defect_id=defect_1.id,
        target_url=app.url,
        reproduction_instructions="1. Click checkout\n2. Submit",
        expected_behavior="Order Confirmed",
        status="COMPLETED",
        outcome="CONFIRMED",
        evidence_paths=[],
    )
    db_session.add(replay)
    db_session.commit()
    replay.evidence_paths = [f"replay_{replay.id}/screenshot.png"]
    db_session.commit()

    # Create replay evidence file
    replay_dir = evidence_root / f"replay_{replay.id}"
    replay_dir.mkdir(parents=True, exist_ok=True)
    (replay_dir / "screenshot.png").write_bytes(b"replay_screenshot_data")

    # 6. Issue certificate via API
    resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    assert resp.status_code == 201
    data = resp.json()

    cert_id = data["certificate_id"]
    cert_data = data["certificate_data"]

    # Verify runs and assertions accounting
    # 2 runs: 1 passed (50% journey pass rate)
    # 2 assertions: 1 passed (50% assertion pass rate)
    # Base score: (50.0 * 0.5) + (50.0 * 0.5) = 50.0
    assert cert_data["evaluation_scope"]["eligible_runs_count"] == 2
    assert cert_data["evaluation_scope"]["passed_runs_count"] == 1
    assert cert_data["evaluation_scope"]["failed_runs_count"] == 1
    assert cert_data["evaluation_scope"]["total_assertions_evaluated"] == 2
    assert cert_data["evaluation_scope"]["passed_assertions_count"] == 1

    # Verify findings deduplication and verification status
    findings = cert_data["findings"]
    assert len(findings) == 1
    f = findings[0]
    assert set(f["source_defect_ids"]) == {defect_1.id, defect_2.id}
    assert f["is_verified"] is True
    assert f["severity"] == "HIGH"
    assert f["penalty_applied"] == 20.0
    assert len(f["replay_history"]) == 1
    assert f["replay_history"][0]["outcome"] == "CONFIRMED"

    # Raw score: 50.0 base - 20.0 defect penalty = 30.0
    # Verified High cap: 65 (30 <= 65, so score remains 30)
    assert data["score"] == 30
    assert data["grade"] == "F"

    # 7. Verification API in both modes
    v_db = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_id": cert_id, "certificate_data": cert_data},
    )
    assert v_db.status_code == 200
    assert v_db.json()["system_matched"] is True
    assert v_db.json()["math_valid"] is True
    assert v_db.json()["checksum_valid"] is True
    assert v_db.json()["issuer_verified"] is False

    v_self = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_data": cert_data, "mode": "self_contained"},
    )
    assert v_self.status_code == 200
    assert v_self.json()["system_matched"] is False
    assert v_self.json()["math_valid"] is True
    assert v_self.json()["checksum_valid"] is True
    assert v_self.json()["issuer_verified"] is False


def test_certificate_untested_lifecycle(
    client: TestClient, db_session: Session
):
    """Verifies that an application with zero runs issues an UNTESTED certificate,
    persisting and retrieving with score=None, grade=None, and validating cleanly in both modes."""
    app = TargetApp(name="New Empty App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    # 1. Issue certificate for app with no test runs
    resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    assert resp.status_code == 201
    data = resp.json()

    cert_id = data["certificate_id"]
    assert data["status"] == "UNTESTED"
    assert data["score"] is None
    assert data["grade"] is None
    assert len(data["tamper_hash"]) == 64
    assert data["certificate_data"]["evaluation_scope"]["eligible_runs_count"] == 0

    # 2. Retrieve via GET /certificates/{cert_id}
    get_resp = client.get(f"/api/v1/certificates/{cert_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "UNTESTED"
    assert get_resp.json()["score"] is None
    assert get_resp.json()["grade"] is None

    # 3. Database-backed verification with payload
    v_db = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_id": cert_id, "certificate_data": data["certificate_data"]},
    )
    assert v_db.status_code == 200
    assert v_db.json()["system_matched"] is True
    assert v_db.json()["math_valid"] is True
    assert v_db.json()["checksum_valid"] is True
    assert v_db.json()["issuer_verified"] is False

    # 4. Database-backed verification by ID only
    v_id = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_id": cert_id},
    )
    assert v_id.status_code == 200
    assert v_id.json()["system_matched"] is True
    assert v_id.json()["math_valid"] is True
    assert v_id.json()["checksum_valid"] is True
    assert v_id.json()["issuer_verified"] is False

    # 5. Self-contained verification
    v_self = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_data": data["certificate_data"], "mode": "self_contained"},
    )
    assert v_self.status_code == 200
    assert v_self.json()["system_matched"] is False
    assert v_self.json()["math_valid"] is True
    assert v_self.json()["checksum_valid"] is True
    assert v_self.json()["issuer_verified"] is False


def test_verify_certificate_database_backed_corrupted_record_by_id_only(
    client: TestClient, db_session: Session
):
    """Verifies that verifying a certificate by public ID alone detects an internally corrupted database record,
    reporting system_matched=True alongside math_valid=False and issuer_verified=False."""
    import copy
    from sqlalchemy.orm.attributes import flag_modified
    from app.models.certificate import Certificate

    app = TargetApp(name="App For DB Corruption", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="passed")
    db_session.add(run)
    db_session.commit()

    # Issue authentic certificate
    resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    assert resp.status_code == 201
    cert_id = resp.json()["certificate_id"]

    # Directly corrupt the stored DB record's score
    stored_cert = (
        db_session.query(Certificate)
        .filter(Certificate.certificate_id == cert_id)
        .first()
    )
    assert stored_cert is not None
    # Deepcopy and modify
    corrupt_data = copy.deepcopy(stored_cert.certificate_data)
    corrupt_data["score_summary"]["score"] = 15
    stored_cert.certificate_data = corrupt_data
    flag_modified(stored_cert, "certificate_data")
    db_session.commit()

    # Verify by certificate_id alone
    v_resp = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_id": cert_id},
    )
    assert v_resp.status_code == 200
    v_data = v_resp.json()

    # Record was found in DB -> system_matched=True
    assert v_data["system_matched"] is True
    # Mathematical recalculation detected corruption -> math_valid=False
    assert v_data["math_valid"] is False
    # issuer_verified remains False
    assert v_data["issuer_verified"] is False
    assert v_data["error"] is not None


def test_verify_certificate_unsupported_policy_version_rejected(client: TestClient):
    """Verifies that submitting a certificate with an unsupported scoring_policy_version
    is rejected with math_valid=False, checksum_valid=False, and informative error."""
    invalid_payload = {
        "certificate_id": "cert_future_version",
        "scoring_policy_version": "99.0.0",
        "status": "ISSUED",
        "tamper_hash": "a" * 64,
        "score_summary": {"score": 100, "grade": "A"},
    }

    resp = client.post(
        "/api/v1/certificates/verify",
        json={"certificate_data": invalid_payload, "mode": "self_contained"},
    )
    assert resp.status_code == 200
    v_data = resp.json()

    assert v_data["math_valid"] is False
    assert v_data["checksum_valid"] is False
    assert v_data["system_matched"] is False
    assert v_data["issuer_verified"] is False
    assert "Unsupported scoring policy version '99.0.0'" in v_data["error"]


def test_certificate_missing_evidence_deduction(
    client: TestClient, db_session: Session
):
    """Verifies that an absent evidence artifact results in the expected 5-point deduction
    during API certificate issuance."""
    from pathlib import Path
    from app.core.config import settings

    app = TargetApp(name="App With Missing Evidence", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    # Run passes with 1 assertion
    run = TestRun(
        target_app_id=app.id,
        status="passed",
        action_results=[
            {"action_type": "navigate", "status": "passed"},
            {"action_type": "assert_text_visible", "status": "passed"},
        ],
    )
    db_session.add(run)
    db_session.commit()

    # Ensure completion file for this run does NOT exist on disk
    evidence_root = Path(settings.EVIDENCE_DIR)
    completion_file = evidence_root / f"run_{run.id}" / "completion.png"
    if completion_file.exists():
        completion_file.unlink()

    # Issue certificate
    resp = client.post(f"/api/v1/target-apps/{app.id}/certificates")
    assert resp.status_code == 201
    data = resp.json()

    cert_data = data["certificate_data"]
    # Evidence audit detected 1 expected artifact (run_completion) and 1 missing artifact
    assert cert_data["evidence_audit"]["expected_artifacts_count"] == 1
    assert cert_data["evidence_audit"]["missing_artifacts_count"] == 1
    assert cert_data["evidence_audit"]["audit_deduction"] == 5.0
    assert cert_data["score_summary"]["penalties"]["audit_deduction"] == 5.0

    # Base score is 100.0, minus 5.0 audit deduction -> score is 95 (Grade A)
    assert data["score"] == 95
    assert data["grade"] == "A"

