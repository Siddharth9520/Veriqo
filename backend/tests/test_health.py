"""Tests for health and readiness endpoints."""

from unittest.mock import patch
from fastapi.testclient import TestClient


def test_health_check_returns_ok(client: TestClient):
    """Test that GET /health returns 200 and process status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "timestamp" in data


def test_readiness_check_returns_ready_when_db_healthy(client: TestClient):
    """Test that GET /ready returns 200 and connected status when DB responds."""
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert "timestamp" in data


def test_readiness_check_returns_503_when_db_fails(client: TestClient):
    """Test that GET /ready returns 503 and disconnected status truthfully when DB is down."""
    with patch("app.main.check_db_connection", return_value=False):
        response = client.get("/ready")
        assert response.status_code == 503
        data = response.json()
        assert data["status"] == "unavailable"
        assert data["database"] == "disconnected"
        assert "timestamp" in data


def test_api_v1_info(client: TestClient):
    """Test that GET /api/v1/info returns service metadata."""
    response = client.get("/api/v1/info")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Veriqo"
    assert data["version"] == "0.1.0"
