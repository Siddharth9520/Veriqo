"""Tests for typed journey definitions and origin security validation."""

import pytest
from pydantic import ValidationError

from app.schemas.journey import (
    AssertElementVisibleAction,
    AssertTextVisibleAction,
    ClickAction,
    FillAction,
    JourneyDefinition,
    NavigateAction,
)
from app.services.browser import resolve_safe_target_url


def test_valid_journey_definition():
    """Verify that a properly structured journey passes validation."""
    journey = JourneyDefinition(
        name="Checkout Flow",
        description="Verify end-to-end checkout flow",
        actions=[
            NavigateAction(url="/cart"),
            AssertTextVisibleAction(text="Your Cart"),
            FillAction(selector="#promo-code", value="DISCOUNT10"),
            ClickAction(selector="#apply-btn"),
            AssertElementVisibleAction(selector=".discount-applied"),
        ],
    )
    assert journey.name == "Checkout Flow"
    assert len(journey.actions) == 5
    assert journey.actions[0].type == "navigate"
    assert journey.actions[1].type == "assert_text_visible"


def test_invalid_journey_empty_actions():
    """Journey must have at least one action."""
    with pytest.raises(ValidationError):
        JourneyDefinition(name="Empty", actions=[])


def test_invalid_journey_action_missing_fields():
    """Actions must have all required fields."""
    with pytest.raises(ValidationError):
        ClickAction()  # Missing selector

    with pytest.raises(ValidationError):
        FillAction(selector="#input")  # Missing value


def test_safe_url_origin_validation():
    """Verify origin boundary enforcement."""
    target_origin = "http://127.0.0.1:8080"

    # Valid relative paths
    assert resolve_safe_target_url(target_origin, "/") == "http://127.0.0.1:8080/"
    assert resolve_safe_target_url(target_origin, "/cart") == "http://127.0.0.1:8080/cart"

    # Valid matching absolute URL
    assert (
        resolve_safe_target_url(target_origin, "http://127.0.0.1:8080/checkout")
        == "http://127.0.0.1:8080/checkout"
    )

    # Disallowed cross-origin URL
    with pytest.raises(ValueError) as exc_info:
        resolve_safe_target_url(target_origin, "https://malicious.example.com/evil")
    assert "disallowed" in str(exc_info.value).lower()
