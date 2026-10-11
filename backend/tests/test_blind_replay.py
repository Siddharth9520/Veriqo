"""Automated tests for BlindReplay implementation."""

from unittest.mock import patch
from fastapi.testclient import TestClient
import pytest


def test_blind_replay_confirmed_when_expected_behavior_violated(
    client: TestClient, local_test_server: str
):
    """Verifies that a defect is marked CONFIRMED when expected behavior is demonstrably violated."""
    # 1. Register target app
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Buggy Target App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    # 2. Record initial test run
    run_resp = client.post(
        "/api/v1/test-runs",
        json={
            "target_app_id": target_app_id,
            "journey": {
                "name": "Cart Journey",
                "actions": [{"type": "navigate", "url": "/buggy-page"}],
            },
        },
    )
    test_run_id = run_resp.json()["id"]

    # 3. Create defect with human reproduction steps and expected behavior
    defect_resp = client.post(
        "/api/v1/defects",
        json={
            "test_run_id": test_run_id,
            "title": "500 Error when submitting order",
            "description": "Submitting order returns internal 500 error instead of confirmation",
            "severity": "HIGH",
            "status": "OPEN",
            "reproduction_steps": (
                "1. Navigate to /buggy-page\n"
                "2. Fill 'Email' with 'user@example.com'\n"
                "3. Click 'Submit Order'"
            ),
            "expected_behavior": "Expected 'Order Confirmed: Thank you!' to be visible",
        },
    )
    assert defect_resp.status_code == 201
    defect_id = defect_resp.json()["id"]

    # 4. Initiate BlindReplay
    replay_resp = client.post(f"/api/v1/defects/{defect_id}/replay")
    assert replay_resp.status_code == 201
    replay_data = replay_resp.json()

    # 5. Verify outcome is CONFIRMED with evidence
    assert replay_data["outcome"] == "CONFIRMED"
    assert replay_data["status"] == "COMPLETED"
    assert replay_data["evidence_paths"] is not None
    assert len(replay_data["evidence_paths"]) >= 1
    assert "confirmed.png" in replay_data["evidence_paths"][0]

    # Verify defect status was promoted to VERIFIED upon independent confirmation
    updated_defect = client.get(f"/api/v1/defects/{defect_id}").json()
    assert updated_defect["status"] == "VERIFIED"

    # 6. Retrieve replay and evidence
    replay_id = replay_data["id"]
    get_rep = client.get(f"/api/v1/replays/{replay_id}")
    assert get_rep.status_code == 200
    assert get_rep.json()["outcome"] == "CONFIRMED"

    evidence_resp = client.get(f"/api/v1/replays/{replay_id}/evidence")
    assert evidence_resp.status_code == 200
    assert len(evidence_resp.json()["evidence_files"]) >= 1

    download_resp = client.get(
        f"/api/v1/replays/{replay_id}/evidence/confirmed.png"
    )
    assert download_resp.status_code == 200
    assert download_resp.headers["content-type"] == "image/png"


def test_blind_replay_not_reproduced(
    client: TestClient, local_test_server: str
):
    """Verifies that when expected behavior actually holds, outcome is NOT_REPRODUCED without invalidating defect."""
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Working Target App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    run_resp = client.post(
        "/api/v1/test-runs",
        json={
            "target_app_id": target_app_id,
            "journey": {
                "name": "Check working page",
                "actions": [{"type": "navigate", "url": "/working-page"}],
            },
        },
    )
    test_run_id = run_resp.json()["id"]

    defect_resp = client.post(
        "/api/v1/defects",
        json={
            "test_run_id": test_run_id,
            "title": "Intermittent submission failure",
            "description": "Reported that checkout intermittently fails",
            "severity": "MEDIUM",
            "status": "OPEN",
            "reproduction_steps": (
                "1. Navigate to /working-page\n"
                "2. Click 'Submit Order'"
            ),
            "expected_behavior": "Expected 'Order Confirmed: Thank you!' to be visible",
        },
    )
    defect_id = defect_resp.json()["id"]

    # Initiate BlindReplay
    replay_resp = client.post(f"/api/v1/defects/{defect_id}/replay")
    assert replay_resp.status_code == 201
    replay_data = replay_resp.json()

    # The working page succeeded in showing confirmation, so it was NOT reproduced
    assert replay_data["outcome"] == "NOT_REPRODUCED"
    assert replay_data["status"] == "COMPLETED"

    # Defect must remain OPEN (NOT proved invalid)
    updated_defect = client.get(f"/api/v1/defects/{defect_id}").json()
    assert updated_defect["status"] == "OPEN"


def test_blind_replay_inconclusive_on_ambiguous_instructions(
    client: TestClient, local_test_server: str
):
    """Verifies that ambiguous instructions result in INCONCLUSIVE."""
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Ambiguous Target App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    run_resp = client.post(
        "/api/v1/test-runs",
        json={
            "target_app_id": target_app_id,
            "journey": {
                "name": "Init run",
                "actions": [{"type": "navigate", "url": "/"}],
            },
        },
    )
    test_run_id = run_resp.json()["id"]

    defect_resp = client.post(
        "/api/v1/defects",
        json={
            "test_run_id": test_run_id,
            "title": "Ambiguous defect",
            "description": "Vague instruction set",
            "reproduction_steps": (
                "1. Navigate to /\n"
                "2. Click 'Non-Existent Mystery Element That Has Never Existed'"
            ),
            "expected_behavior": "Expected 'Something'",
        },
    )
    defect_id = defect_resp.json()["id"]

    replay_resp = client.post(f"/api/v1/defects/{defect_id}/replay")
    assert replay_resp.status_code == 201
    replay_data = replay_resp.json()

    assert replay_data["outcome"] == "INCONCLUSIVE"
    assert "ambiguous" in replay_data["error_message"].lower()


def test_blind_replay_cross_origin_blocked(
    client: TestClient, local_test_server: str
):
    """Verifies that navigation to unauthorized origins during replay fails with security error."""
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Origin Guard App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    run_resp = client.post(
        "/api/v1/test-runs",
        json={
            "target_app_id": target_app_id,
            "journey": {
                "name": "Init run",
                "actions": [{"type": "navigate", "url": "/"}],
            },
        },
    )
    test_run_id = run_resp.json()["id"]

    defect_resp = client.post(
        "/api/v1/defects",
        json={
            "test_run_id": test_run_id,
            "title": "Cross origin escape defect",
            "description": "Escapes origin",
            "reproduction_steps": "Navigate to https://disallowed-external-site.org",
            "expected_behavior": "Expected 'Safe'",
        },
    )
    defect_id = defect_resp.json()["id"]

    replay_resp = client.post(f"/api/v1/defects/{defect_id}/replay")
    assert replay_resp.status_code == 201
    replay_data = replay_resp.json()

    assert replay_data["outcome"] == "FAILED"
    assert "disallowed" in replay_data["error_message"].lower()


def test_blind_replay_evidence_path_traversal_blocked(client: TestClient):
    """Verifies path traversal protection on replay evidence download."""
    resp = client.get("/api/v1/replays/1/evidence/../../etc/shadow")
    assert resp.status_code in (403, 404)


def test_blind_replay_infrastructure_error_not_marked_confirmed(
    client: TestClient, local_test_server: str
):
    """Verifies that an infrastructure failure results in FAILED and never marks defect as CONFIRMED."""
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Crash App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    run_resp = client.post(
        "/api/v1/test-runs",
        json={
            "target_app_id": target_app_id,
            "journey": {
                "name": "Init run",
                "actions": [{"type": "navigate", "url": "/"}],
            },
        },
    )
    test_run_id = run_resp.json()["id"]

    defect_resp = client.post(
        "/api/v1/defects",
        json={
            "test_run_id": test_run_id,
            "title": "Infra crash test defect",
            "description": "Will crash during replay execution",
            "reproduction_steps": "1. Navigate to /",
            "expected_behavior": "Expected 'Page Title'",
        },
    )
    defect_id = defect_resp.json()["id"]

    with patch(
        "app.services.blind_replay.async_playwright",
        side_effect=RuntimeError("Simulated Playwright browser process crash"),
    ):
        replay_resp = client.post(f"/api/v1/defects/{defect_id}/replay")
        assert replay_resp.status_code == 201
        replay_data = replay_resp.json()

        assert replay_data["outcome"] == "FAILED"
        assert replay_data["status"] == "FAILED"
        assert "Simulated Playwright browser process crash" in replay_data["error_message"]

    # Defect must NOT be verified on an infrastructure error
    updated_defect = client.get(f"/api/v1/defects/{defect_id}").json()
    assert updated_defect["status"] == "OPEN"


def test_blind_replay_independence_contract():
    """Inspects execute_blind_replay to verify strict independence contract.

    Assures it only receives target_app_url, reproduction_instructions, expected_behavior, and replay_id.
    """
    import inspect
    from app.services.blind_replay import execute_blind_replay

    sig = inspect.signature(execute_blind_replay)
    param_names = list(sig.parameters.keys())

    # Strictly isolated inputs
    assert param_names == [
        "target_app_url",
        "reproduction_instructions",
        "expected_behavior",
        "replay_id",
    ]
    # Verify no original scripts, selectors, DOM snapshots, or logs can be passed
    for forbidden in ["journey", "actions", "selectors", "dom_snapshot", "logs", "session"]:
        assert forbidden not in param_names


def test_blind_replay_cross_origin_redirect_blocked(
    client: TestClient, local_test_server: str
):
    """Verifies that cross-origin HTTP 302 redirects are intercepted and aborted."""
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Redirect App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    run_resp = client.post(
        "/api/v1/test-runs",
        json={
            "target_app_id": target_app_id,
            "journey": {
                "name": "Init run",
                "actions": [{"type": "navigate", "url": "/"}],
            },
        },
    )
    test_run_id = run_resp.json()["id"]

    defect_resp = client.post(
        "/api/v1/defects",
        json={
            "test_run_id": test_run_id,
            "title": "Redirect defect",
            "description": "Attempts redirect to external domain",
            "reproduction_steps": "1. Navigate to /redirect-to-external",
            "expected_behavior": "Expected 'Welcome'",
        },
    )
    defect_id = defect_resp.json()["id"]

    replay_resp = client.post(f"/api/v1/defects/{defect_id}/replay")
    assert replay_resp.status_code == 201
    replay_data = replay_resp.json()

    assert replay_data["outcome"] == "FAILED"
    assert replay_data["status"] == "FAILED"
    # Defect must remain OPEN
    updated_defect = client.get(f"/api/v1/defects/{defect_id}").json()
    assert updated_defect["status"] == "OPEN"


def test_blind_replay_overall_timeout(
    client: TestClient, local_test_server: str
):
    """Verifies that an execution exceeding timeout is marked TIMED_OUT."""
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Timeout App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    run_resp = client.post(
        "/api/v1/test-runs",
        json={
            "target_app_id": target_app_id,
            "journey": {
                "name": "Init run",
                "actions": [{"type": "navigate", "url": "/"}],
            },
        },
    )
    test_run_id = run_resp.json()["id"]

    defect_resp = client.post(
        "/api/v1/defects",
        json={
            "test_run_id": test_run_id,
            "title": "Timeout defect",
            "description": "Hangs on replay",
            "reproduction_steps": "1. Navigate to /",
            "expected_behavior": "Expected 'Page Title'",
        },
    )
    defect_id = defect_resp.json()["id"]

    with patch("app.core.config.settings.DEFAULT_REPLAY_TIMEOUT_SECONDS", 0.01):
        replay_resp = client.post(f"/api/v1/defects/{defect_id}/replay")
        assert replay_resp.status_code == 201
        replay_data = replay_resp.json()

        assert replay_data["outcome"] == "TIMED_OUT"
        assert "exceeded maximum allowed time limit" in replay_data["error_message"].lower()

    # Defect remains OPEN
    updated_defect = client.get(f"/api/v1/defects/{defect_id}").json()
    assert updated_defect["status"] == "OPEN"


def test_blind_replay_sibling_directory_traversal_blocked(
    client: TestClient, db_session
):
    """Verifies that accessing sibling replay evidence directories via traversal is blocked with 403."""
    from fastapi import HTTPException
    from app.api.v1.replays import download_replay_evidence
    from app.models.defect import Defect
    from app.models.replay_attempt import ReplayAttempt
    from app.models.target_app import TargetApp
    from app.models.test_run import TestRun

    # Create test records
    app = TargetApp(name="App", url="http://127.0.0.1:8000")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id)
    db_session.add(run)
    db_session.commit()

    defect = Defect(test_run_id=run.id, title="Defect", description="Desc")
    db_session.add(defect)
    db_session.commit()

    replay = ReplayAttempt(
        defect_id=defect.id,
        target_url="http://127.0.0.1:8000",
        reproduction_instructions="1. Nav",
        expected_behavior="Exp",
    )
    db_session.add(replay)
    db_session.commit()

    # Direct invocation with sibling directory traversal
    with pytest.raises(HTTPException) as exc_info:
        download_replay_evidence(
            replay_id=replay.id,
            filename="../replay_999/screenshot.png",
            db=db_session,
        )
    assert exc_info.value.status_code == 403
    assert "Forbidden" in exc_info.value.detail



def test_blind_replay_runtime_session_isolation(
    client: TestClient, local_test_server: str
):
    """Verifies that BlindReplay does not share cookies or storage from previous sessions."""
    import asyncio
    from playwright.async_api import async_playwright
    from app.services.blind_replay import execute_blind_replay

    async def _run():
        async with async_playwright() as p:
            b1 = await p.chromium.launch(headless=True)
            ctx1 = await b1.new_context()
            await ctx1.add_cookies([
                {"name": "auth_token", "value": "secret_abc_123", "url": local_test_server}
            ])
            p1 = await ctx1.new_page()
            await p1.goto(local_test_server)
            cookies_1 = await ctx1.cookies()
            assert any(c["name"] == "auth_token" for c in cookies_1)
            await b1.close()

        # BlindReplay runs independently
        report = await execute_blind_replay(
            target_app_url=local_test_server,
            reproduction_instructions="1. Navigate to /",
            expected_behavior="Expected 'secret_abc_123' should not appear",
            replay_id=9998,
        )
        assert report.outcome == "NOT_REPRODUCED"

    asyncio.run(_run())

