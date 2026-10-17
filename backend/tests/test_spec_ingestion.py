"""Automated tests for OpenAPI and HAR specification ingestion service and endpoints."""

import json
from fastapi.testclient import TestClient
import pytest
from sqlalchemy.orm import Session

from app.models.target_app import TargetApp
from app.models.regression_journey import RegressionJourney
from app.services.spec_ingestion import parse_openapi_spec, parse_har_archive


def test_parse_openapi_spec_valid():
    """Verifies parsing a standard OpenAPI 3.1 spec into a valid JourneyDefinition."""
    spec = {
        "openapi": "3.1.0",
        "info": {"title": "Acme Storefront API", "version": "1.0.0"},
        "paths": {
            "/catalog": {
                "get": {
                    "summary": "List Products",
                    "responses": {"200": {"description": "Success"}},
                }
            },
            "/products/{id}": {
                "get": {
                    "summary": "Get Product Details",
                    "responses": {"200": {"description": "Found"}},
                }
            },
        },
    }

    res = parse_openapi_spec(spec, base_target_url="http://127.0.0.1:8080")
    assert res.spec_type == "openapi"
    assert res.routes_discovered == 2
    assert res.actions_generated >= 4  # landing + screenshot + /catalog + /products/1
    action_types = [a.type for a in res.generated_journey.actions]
    assert "navigate" in action_types
    assert "screenshot" in action_types


def test_parse_openapi_spec_invalid_json():
    """Verifies that invalid or malformed OpenAPI input raises ValueError."""
    with pytest.raises(ValueError, match="Invalid OpenAPI format"):
        parse_openapi_spec("{invalid json", base_target_url="http://127.0.0.1:8080")

    with pytest.raises(ValueError, match="must be a JSON object"):
        parse_openapi_spec(["not", "an", "object"], base_target_url="http://127.0.0.1:8080")


def test_parse_har_archive_strips_sensitive_headers():
    """Verifies that HAR ingestion strips Authorization and Cookie headers and filters to target origin."""
    har = {
        "log": {
            "entries": [
                {
                    "request": {
                        "url": "http://127.0.0.1:8080/cart",
                        "headers": [
                            {"name": "Host", "value": "127.0.0.1:8080"},
                            {"name": "Authorization", "value": "Bearer secret_jwt_token_123"},
                            {"name": "Cookie", "value": "session=abcde"},
                        ],
                    }
                },
                {
                    "request": {
                        "url": "https://external.tracking.com/pixel",
                        "headers": [],
                    }
                },
            ]
        }
    }

    res = parse_har_archive(har, target_origin="http://127.0.0.1:8080")
    assert res.spec_type == "har"
    assert res.routes_discovered == 1
    assert res.scrubbed_secret_count == 2
    urls = [getattr(a, "url", None) for a in res.generated_journey.actions]
    assert "/cart" in urls
    assert not any("external.tracking.com" in str(u) for u in urls)


def test_openapi_ingest_api_endpoint(client: TestClient, db_session: Session):
    """Verifies the POST /api/v1/integrations/specs/openapi endpoint saves a regression journey."""
    app = TargetApp(name="Test Target Ingest", url="http://127.0.0.1:8080")
    db_session.add(app)
    db_session.commit()

    spec = {
        "openapi": "3.1.0",
        "info": {"title": "Checkout API", "version": "1.0.0"},
        "paths": {
            "/order/status": {
                "get": {"summary": "Order Status", "responses": {"200": {}}}
            }
        },
    }

    resp = client.post(
        "/api/v1/integrations/specs/openapi",
        json={
            "target_app_id": app.id,
            "spec_content": spec,
            "save_as_regression": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["routes_discovered"] == 1
    assert data["regression_journey_id"] is not None

    reg = db_session.query(RegressionJourney).filter(RegressionJourney.id == data["regression_journey_id"]).first()
    assert reg is not None
    assert reg.target_app_id == app.id


def test_har_ingest_api_endpoint(client: TestClient, db_session: Session):
    """Verifies the POST /api/v1/integrations/specs/har endpoint saves a regression journey."""
    app = TargetApp(name="Test Target HAR", url="http://127.0.0.1:8080")
    db_session.add(app)
    db_session.commit()

    har = {
        "log": {
            "entries": [
                {
                    "request": {
                        "url": "http://127.0.0.1:8080/checkout/step1",
                        "headers": [{"name": "Cookie", "value": "test=123"}],
                    }
                }
            ]
        }
    }

    resp = client.post(
        "/api/v1/integrations/specs/har",
        json={
            "target_app_id": app.id,
            "har_content": har,
            "save_as_regression": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["scrubbed_secret_count"] == 1


def test_github_webhook_endpoint(client: TestClient):
    """Verifies the POST /api/v1/integrations/webhooks/github endpoint processes PR payloads."""
    resp = client.post(
        "/api/v1/integrations/webhooks/github",
        json={
            "action": "opened",
            "repository": {"full_name": "acmeflow/web-checkout"},
            "pull_request": {"number": 42},
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "processed"
    assert data["repository"] == "acmeflow/web-checkout"
