"""Tests for the local demo fixture."""

import urllib.request
import pytest

from app.demo_fixture import create_demo_server, run_demo_fixture


def test_demo_fixture_refuses_external_binding():
    """Safety test: fixture must strictly reject non-loopback addresses."""
    with pytest.raises(ValueError) as exc:
        create_demo_server(host="0.0.0.0", port=8080)
    assert "Security Violation" in str(exc.value)

    with pytest.raises(ValueError) as exc:
        create_demo_server(host="192.168.1.50", port=8080)
    assert "Security Violation" in str(exc.value)


def test_demo_fixture_endpoints():
    """Verify healthy and buggy endpoints serve predictable DOM selectors and content."""
    with run_demo_fixture(port=0) as base_url:
        # 1. Healthy home
        with urllib.request.urlopen(f"{base_url}/") as resp:
            assert resp.status == 200
            body = resp.read().decode("utf-8")
            assert 'id="welcome-heading"' in body
            assert "Veriqo Demo Target Store" in body
            assert 'id="nav-healthy"' in body
            assert 'id="nav-buggy"' in body

        # 2. Healthy order flow
        with urllib.request.urlopen(f"{base_url}/order") as resp:
            assert resp.status == 200
            body = resp.read().decode("utf-8")
            assert 'id="email-input"' in body
            assert 'id="submit-order-btn"' in body
            assert 'id="order-status"' in body
            assert "Order Confirmed: #1001" in body

        # 3. Buggy order flow
        with urllib.request.urlopen(f"{base_url}/buggy-order") as resp:
            assert resp.status == 200
            body = resp.read().decode("utf-8")
            assert 'id="email-input"' in body
            assert 'id="submit-order-btn"' in body
            assert 'id="order-status"' in body
            assert 'id="error-badge"' in body
            assert "Internal Server Error: 500" in body


@pytest.mark.anyio
async def test_real_browser_smoke_against_demo_fixture():
    """Performs a real Playwright browser smoke test against the demo fixture for healthy and failing scenarios."""
    from app.schemas.journey import (
        AssertTextVisibleAction,
        ClickAction,
        FillAction,
        JourneyDefinition,
        NavigateAction,
    )
    from app.services.browser import execute_browser_journey

    with run_demo_fixture(port=0) as base_url:
        # 1. Healthy flow passing test
        healthy_journey = JourneyDefinition(
            name="Demo Healthy Flow",
            actions=[
                NavigateAction(url="/order"),
                FillAction(selector="#email-input", value="smoke@veriqo.local"),
                ClickAction(selector="#submit-order-btn"),
                AssertTextVisibleAction(text="Order Confirmed: #1001"),
            ],
        )
        report_pass = await execute_browser_journey(
            target_app_url=base_url,
            journey=healthy_journey,
            test_run_id=9901,
        )
        assert report_pass.status == "passed"
        assert report_pass.error_message is None
        assert len(report_pass.evidence_paths) >= 1

        # 2. Buggy flow known assertion failure test
        buggy_journey = JourneyDefinition(
            name="Demo Buggy Flow",
            actions=[
                NavigateAction(url="/buggy-order"),
                FillAction(selector="#email-input", value="smoke@veriqo.local"),
                ClickAction(selector="#submit-order-btn"),
                AssertTextVisibleAction(text="Order Confirmed: #1001"),
            ],
        )
        report_fail = await execute_browser_journey(
            target_app_url=base_url,
            journey=buggy_journey,
            test_run_id=9902,
        )
        assert report_fail.status == "failed"
        assert report_fail.error_message is not None
        assert "assertion failed" in report_fail.error_message.lower()
        assert len(report_fail.evidence_paths) >= 1
