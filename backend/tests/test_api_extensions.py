"""Unit and integration tests for extended API endpoints."""

import pytest
from fastapi.testclient import TestClient

from app.models.defect import Defect
from app.models.target_app import TargetApp
from app.models.test_run import TestRun


def test_projects_endpoints(client: TestClient, db_session):
    # Register project
    resp = client.post(
        "/api/v1/projects",
        json={
            "name": "Live Apex Store",
            "domain": "https://store.apex.local",
            "environment": "Staging",
            "swarmMode": "Deep Heuristic",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Live Apex Store"
    assert data["slug"] == "live-apex-store"
    assert data["health"] == "healthy"
    project_id = data["id"]

    # List projects
    list_resp = client.get("/api/v1/projects")
    assert list_resp.status_code == 200
    projects = list_resp.json()
    assert len(projects) >= 1
    assert any(p["slug"] == "live-apex-store" for p in projects)

    # Get single project by slug and id
    slug_resp = client.get("/api/v1/projects/live-apex-store")
    assert slug_resp.status_code == 200
    assert slug_resp.json()["name"] == "Live Apex Store"

    id_resp = client.get(f"/api/v1/projects/{project_id}")
    assert id_resp.status_code == 200
    assert id_resp.json()["id"] == project_id


def test_test_runs_active_and_commands(client: TestClient, db_session):
    # Register target app
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Command App", "url": "https://example.com"},
    )
    app_id = app_resp.json()["id"]

    # Active run should be null or latest
    active_resp = client.get("/api/v1/test-runs/active")
    assert active_resp.status_code == 200

    # Test swarm commands
    cmd_help = client.post("/api/v1/test-runs/commands", json={"command": "help"})
    assert cmd_help.status_code == 200
    assert cmd_help.json()["success"] is True
    assert len(cmd_help.json()["logs"]) == 2

    cmd_status = client.post("/api/v1/test-runs/commands", json={"command": "status"})
    assert cmd_status.status_code == 200

    cmd_custom = client.post(
        "/api/v1/test-runs/commands", json={"command": "fuzz button#checkout"}
    )
    assert cmd_custom.status_code == 200
    assert "button#checkout" in cmd_custom.json()["logs"][1]["message"]


def test_certificates_root_endpoints(client: TestClient, db_session):
    # Register app
    app_resp = client.post(
        "/api/v1/target-apps",
        json={"name": "Cert Target", "url": "https://cert-target.local"},
    )
    app_id = app_resp.json()["id"]

    # Generate certificate at root
    cert_resp = client.post(
        "/api/v1/certificates",
        json={"app_id": app_id},
    )
    assert cert_resp.status_code == 201
    cert_data = cert_resp.json()
    assert cert_data["target_app_id"] == app_id
    assert "certificate_id" in cert_data

    # List certificates at root
    list_resp = client.get(f"/api/v1/certificates?app_id={app_id}")
    assert list_resp.status_code == 200
    certs = list_resp.json()
    assert len(certs) >= 1
    assert certs[0]["certificate_id"] == cert_data["certificate_id"]


def test_bug_reports_endpoints(client: TestClient, db_session):
    # Create target app and test run directly
    app = TargetApp(name="Buggy App", url="https://buggy.local")
    db_session.add(app)
    db_session.commit()

    run = TestRun(target_app_id=app.id, status="failed", error_message="Order 500 error")
    db_session.add(run)
    db_session.commit()

    defect = Defect(
        test_run_id=run.id,
        title="Double Click Race Condition",
        description="Duplicate charge triggered on fast double click",
        severity="CRITICAL",
        status="OPEN",
        reproduction_steps="1. Click checkout rapidly",
        expected_behavior="Order placed once",
    )
    db_session.add(defect)
    db_session.commit()

    # List bug reports
    reports_resp = client.get("/api/v1/bug-reports")
    assert reports_resp.status_code == 200
    reports = reports_resp.json()
    assert len(reports) >= 1
    assert any("Double Click" in r["title"] for r in reports)

    # Get single bug report
    single_resp = client.get(f"/api/v1/bug-reports/{defect.id}")
    assert single_resp.status_code == 200
    assert single_resp.json()["title"] == "Double Click Race Condition"

    # Pin bug report
    pin_resp = client.post(f"/api/v1/bug-reports/{defect.id}")
    assert pin_resp.status_code == 200
    assert pin_resp.json()["status"] == "INVESTIGATING"

    # Show Me Mode
    show_resp = client.get(f"/api/v1/bug-reports/{defect.id}/show-me")
    assert show_resp.status_code == 200
    assert show_resp.json()["defect_id"] == defect.id

    # Fix prompt
    fix_resp = client.get(f"/api/v1/bug-reports/{defect.id}/fix-prompt")
    assert fix_resp.status_code == 200
    assert fix_resp.json()["defect_id"] == defect.id
    assert len(fix_resp.json()["prompt_text"]) > 20


def test_analytics_endpoints(client: TestClient, db_session):
    resp = client.get("/api/v1/analytics")
    assert resp.status_code == 200
    data = resp.json()
    assert "passRate" in data
    assert "totalAssertions" in data
    assert "severityBreakdown" in data
    assert len(data["severityBreakdown"]) == 3
    assert "projectCoverage" in data


def test_integrations_endpoints(client: TestClient):
    list_resp = client.get("/api/v1/integrations")
    assert list_resp.status_code == 200
    integrations = list_resp.json()
    assert len(integrations) >= 5

    patch_resp = client.patch(
        "/api/v1/integrations",
        json={"id": "slack", "status": "connected", "configured": True},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["id"] == "slack"


def test_logs_endpoints(client: TestClient):
    get_resp = client.get("/api/v1/logs")
    assert get_resp.status_code == 200
    logs = get_resp.json()
    assert len(logs) >= 2

    post_resp = client.post(
        "/api/v1/logs",
        json={"agent": "TESTER", "message": "Custom unit test trace", "type": "info"},
    )
    assert post_resp.status_code == 201
    assert post_resp.json()["agent"] == "TESTER"


def test_test_library_endpoints(client: TestClient, db_session):
    list_resp = client.get("/api/v1/test-library")
    assert list_resp.status_code == 200
    tests = list_resp.json()
    assert len(tests) >= 1

    create_resp = client.post(
        "/api/v1/test-library",
        json={
            "name": "Custom Idempotency Assertion",
            "description": "Custom verified test scenario",
            "category": "E2E Concurrency",
            "assertions": 12,
        },
    )
    assert create_resp.status_code == 201
    assert create_resp.json()["name"] == "Custom Idempotency Assertion"
