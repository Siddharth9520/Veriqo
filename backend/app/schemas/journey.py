"""Typed schemas for browser journeys and action definitions."""

from enum import Enum
from typing import Annotated, List, Literal, Optional, Union
from pydantic import BaseModel, Field


class ActionType(str, Enum):
    """Supported safe browser action types."""

    NAVIGATE = "navigate"
    CLICK = "click"
    FILL = "fill"
    ASSERT_TEXT_VISIBLE = "assert_text_visible"
    ASSERT_ELEMENT_VISIBLE = "assert_element_visible"


class NavigateAction(BaseModel):
    """Navigate to a target URL or relative path."""

    type: Literal["navigate"] = "navigate"
    url: str = Field(..., min_length=1, description="Target URL or relative path")


class ClickAction(BaseModel):
    """Click an element identified by selector."""

    type: Literal["click"] = "click"
    selector: str = Field(..., min_length=1, description="Element selector to click")


class FillAction(BaseModel):
    """Fill text into an input element."""

    type: Literal["fill"] = "fill"
    selector: str = Field(..., min_length=1, description="Element selector to fill")
    value: str = Field(..., description="String value to input")


class AssertTextVisibleAction(BaseModel):
    """Assert that specific text is visible on the page."""

    type: Literal["assert_text_visible"] = "assert_text_visible"
    text: str = Field(..., min_length=1, description="Expected visible text")
    selector: Optional[str] = Field(
        None, description="Optional scoped selector where text should appear"
    )


class AssertElementVisibleAction(BaseModel):
    """Assert that a matching element is visible in the viewport."""

    type: Literal["assert_element_visible"] = "assert_element_visible"
    selector: str = Field(..., min_length=1, description="Element selector that must be visible")


JourneyAction = Annotated[
    Union[
        NavigateAction,
        ClickAction,
        FillAction,
        AssertTextVisibleAction,
        AssertElementVisibleAction,
    ],
    Field(discriminator="type"),
]


class JourneyDefinition(BaseModel):
    """Complete specification of a browser journey."""

    name: Optional[str] = Field(None, max_length=150, description="Journey identifier name")
    description: Optional[str] = Field(None, max_length=500, description="Description of the journey")
    actions: List[JourneyAction] = Field(
        ..., min_length=1, description="Ordered sequence of actions to execute"
    )


class ActionExecutionResult(BaseModel):
    """Outcome report for an individual action in a journey."""

    action_index: int
    action_type: str
    status: Literal["passed", "failed"]
    error: Optional[str] = None
    duration_ms: float
