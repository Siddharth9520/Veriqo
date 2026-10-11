"""Automated tests for real Playwright browser execution and evidence capture."""

from fastapi.testclient import TestClient


def test_real_browser_journey_success(client: TestClient, local_test_server: str):
    """Executes a real Playwright browser journey against local test page and verifies passing result."""
    # 1. Register target app pointing to controlled local server
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Local Test App", "url": local_test_server},
    )
    assert app_resp.status_code == 201
    target_app_id = app_resp.json()["id"]

    # 2. Define a multi-step journey
    journey_payload = {
        "target_app_id": target_app_id,
        "journey": {
            "name": "Full Flow Test",
            "actions": [
                {"type": "navigate", "url": "/"},
                {"type": "assert_text_visible", "text": "Welcome to Veriqo Test App"},
                {"type": "fill", "selector": "#username-input", "value": "qa_tester"},
                {"type": "click", "selector": "#submit-btn"},
                {"type": "assert_text_visible", "text": "Submitted successfully"},
                {"type": "assert_element_visible", "selector": "#result"},
            ],
        },
    }

    # 3. Execute test run
    run_resp = client.post("/api/v1/test-runs", json=journey_payload)
    assert run_resp.status_code == 201
    run_data = run_resp.json()

    # 4. Verify run outcome and evidence
    assert run_data["status"] == "passed"
    assert run_data["error_message"] is None
    assert len(run_data["action_results"]) == 6
    for result in run_data["action_results"]:
        assert result["status"] == "passed"

    assert run_data["evidence_paths"] is not None
    assert len(run_data["evidence_paths"]) >= 1

    run_id = run_data["id"]

    # 5. Verify evidence endpoint metadata and download
    evidence_resp = client.get(f"/api/v1/test-runs/{run_id}/evidence")
    assert evidence_resp.status_code == 200
    files = evidence_resp.json()["evidence_files"]
    assert len(files) >= 1

    completion_file = files[0].split("/")[-1]
    download_resp = client.get(f"/api/v1/test-runs/{run_id}/evidence/{completion_file}")
    assert download_resp.status_code == 200
    assert download_resp.headers["content-type"] == "image/png"
    assert len(download_resp.content) > 0


def test_real_browser_journey_deliberate_assertion_failure(
    client: TestClient, local_test_server: str
):
    """Executes a journey with a deliberately failing assertion, verifying failed status and evidence."""
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Local Failing App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    journey_payload = {
        "target_app_id": target_app_id,
        "journey": {
            "name": "Failing Assertion Test",
            "actions": [
                {"type": "navigate", "url": "/"},
                {
                    "type": "assert_text_visible",
                    "text": "Text That Absolutely Does Not Exist",
                },
            ],
        },
    }

    run_resp = client.post("/api/v1/test-runs", json=journey_payload)
    assert run_resp.status_code == 201
    run_data = run_resp.json()

    assert run_data["status"] in ("failed", "timed_out")
    assert run_data["error_message"] is not None
    assert len(run_data["action_results"]) == 2
    assert run_data["action_results"][0]["status"] == "passed"
    assert run_data["action_results"][1]["status"] == "failed"

    # Verify failure screenshot was captured
    assert len(run_data["evidence_paths"]) >= 1
    assert "failure_step" in run_data["evidence_paths"][0]


def test_browser_journey_cross_origin_blocked(
    client: TestClient, local_test_server: str
):
    """Verify that attempting to navigate outside target origin fails with security error."""
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Origin Guard App", "url": local_test_server},
    )
    target_app_id = app_resp.json()["id"]

    journey_payload = {
        "target_app_id": target_app_id,
        "journey": {
            "name": "Cross Origin Escape",
            "actions": [
                {"type": "navigate", "url": "https://external-disallowed.com"},
            ],
        },
    }

    run_resp = client.post("/api/v1/test-runs", json=journey_payload)
    assert run_resp.status_code == 201
    run_data = run_resp.json()

    assert run_data["status"] == "failed"
    assert "disallowed" in run_data["error_message"].lower()


def test_evidence_download_path_traversal_blocked(client: TestClient):
    """Ensure directory traversal attacks on evidence endpoint are blocked."""
    # Attempting to traverse out using ..
    resp = client.get("/api/v1/test-runs/1/evidence/../../etc/passwd")
    assert resp.status_code in (403, 404)
