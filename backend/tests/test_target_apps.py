"""Tests for Target Application management endpoints."""

from fastapi.testclient import TestClient


def test_create_target_app_success(client: TestClient):
    """Test registering a valid target application."""
    payload = {
        "name": "E-Commerce Store",
        "url": "http://127.0.0.1:8080",
        "description": "Production store for testing",
    }
    response = client.post("/api/v1/target-apps", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "E-Commerce Store"
    assert data["url"] == "http://127.0.0.1:8080"
    assert data["description"] == "Production store for testing"
    assert "id" in data
    assert "created_at" in data


def test_create_target_app_validation_empty_name(client: TestClient):
    """Test that registering an app with an empty name fails with 422."""
    payload = {
        "name": "   ",
        "url": "http://127.0.0.1:8080",
    }
    response = client.post("/api/v1/target-apps", json=payload)
    assert response.status_code == 422
    assert "empty" in response.json()["detail"].lower()


def test_create_target_app_validation_invalid_url(client: TestClient):
    """Test that invalid URL formats and non-HTTP schemes are rejected with 422."""
    payload = {
        "name": "Invalid App",
        "url": "ftp://not-allowed-protocol",
    }
    response = client.post("/api/v1/target-apps", json=payload)
    assert response.status_code == 422

    payload_invalid = {
        "name": "Invalid App 2",
        "url": "just_a_string",
    }
    response2 = client.post("/api/v1/target-apps", json=payload_invalid)
    assert response2.status_code == 422


def test_list_and_get_target_apps(client: TestClient):
    """Test listing target apps and getting a specific app by ID."""
    created = client.post(
        "/api/v1/target-apps",
        json={"name": "App A", "url": "http://127.0.0.1:3000"},
    ).json()

    # List apps
    list_resp = client.get("/api/v1/target-apps")
    assert list_resp.status_code == 200
    apps = list_resp.json()
    assert any(a["id"] == created["id"] for a in apps)

    # Get single app
    get_resp = client.get(f"/api/v1/target-apps/{created['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "App A"

    # Get non-existent app
    not_found = client.get("/api/v1/target-apps/999999")
    assert not_found.status_code == 404
