"""Tests for regression journeys saving and re-execution."""

from fastapi.testclient import TestClient


def test_regression_journey_lifecycle(client: TestClient, local_test_server: str):
    """Verify saving a passed journey as regression baseline and re-executing it."""
    # 1. Register target app
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Regression App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    # 2. Run a valid journey that passes
    journey_payload = {
        "target_app_id": target_app_id,
        "journey": {
            "name": "Smoke Test",
            "actions": [
                {"type": "navigate", "url": "/"},
                {"type": "assert_text_visible", "text": "Welcome to Veriqo Test App"},
            ],
        },
    }
    pass_resp = client.post("/api/v1/test-runs", json=journey_payload)
    assert pass_resp.status_code == 201
    passed_run_id = pass_resp.json()["id"]
    assert pass_resp.json()["status"] == "passed"

    # 3. Also run a failing journey to test rejection
    fail_payload = {
        "target_app_id": target_app_id,
        "journey": {
            "name": "Failing Test",
            "actions": [
                {"type": "navigate", "url": "/"},
                {"type": "assert_text_visible", "text": "Missing Text"},
            ],
        },
    }
    fail_resp = client.post("/api/v1/test-runs", json=fail_payload)
    failed_run_id = fail_resp.json()["id"]
    assert fail_resp.json()["status"] in ("failed", "timed_out")

    # 4. Attempt to save failed run as regression baseline -> MUST BE REJECTED
    save_fail = client.post(
        "/api/v1/regression-journeys",
        json={
            "name": "Invalid Baseline",
            "baseline_test_run_id": failed_run_id,
        },
    )
    assert save_fail.status_code == 400
    assert "only test runs with status 'passed'" in save_fail.json()["detail"].lower()

    # 5. Save passed run as regression baseline -> SUCCESS
    save_pass = client.post(
        "/api/v1/regression-journeys",
        json={
            "name": "Homepage Smoke Baseline",
            "description": "Baseline for homepage greeting text",
            "baseline_test_run_id": passed_run_id,
        },
    )
    assert save_pass.status_code == 201
    reg_data = save_pass.json()
    reg_id = reg_data["id"]
    assert reg_data["name"] == "Homepage Smoke Baseline"
    assert reg_data["target_app_id"] == target_app_id
    assert reg_data["baseline_test_run_id"] == passed_run_id

    # 6. List regression journeys
    list_resp = client.get(f"/api/v1/regression-journeys?target_app_id={target_app_id}")
    assert list_resp.status_code == 200
    journeys = list_resp.json()
    assert any(j["id"] == reg_id for j in journeys)

    # 7. Get regression journey by ID
    get_resp = client.get(f"/api/v1/regression-journeys/{reg_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == reg_id

    # 8. Re-execute the regression journey through Playwright
    rerun_resp = client.post(f"/api/v1/regression-journeys/{reg_id}/execute")
    assert rerun_resp.status_code == 201
    rerun_data = rerun_resp.json()

    # Verify a new independent TestRun was recorded and executed
    assert rerun_data["id"] != passed_run_id
    assert rerun_data["status"] == "passed"
    assert rerun_data["regression_journey_id"] == reg_id
    assert len(rerun_data["action_results"]) == 2
    assert rerun_data["action_results"][0]["status"] == "passed"
    assert rerun_data["action_results"][1]["status"] == "passed"
    assert len(rerun_data["evidence_paths"]) >= 1
