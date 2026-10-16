"""Typed schemas for browser journeys and action definitions."""

from enum import Enum
from typing import Annotated, Any, List, Literal, Optional, Union
from pydantic import BaseModel, Field, model_validator



class ActionType(str, Enum):
    """Supported safe browser action types."""

    NAVIGATE = "navigate"
    CLICK = "click"
    FILL = "fill"
    ASSERT_TEXT_VISIBLE = "assert_text_visible"
    ASSERT_ELEMENT_VISIBLE = "assert_element_visible"
    SCREENSHOT = "screenshot"
    ASSERT_TITLE_CONTAINS = "assert_title_contains"


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


class ScreenshotAction(BaseModel):
    """Capture a screenshot at current page state."""

    type: Literal["screenshot"] = "screenshot"
    description: Optional[str] = Field(None, description="Optional screenshot label or description")


class AssertTitleContainsAction(BaseModel):
    """Assert that page title contains expected string."""

    type: Literal["assert_title_contains"] = "assert_title_contains"
    value: str = Field("", description="Sub-string expected in page title")


JourneyAction = Annotated[
    Union[
        NavigateAction,
        ClickAction,
        FillAction,
        AssertTextVisibleAction,
        AssertElementVisibleAction,
        ScreenshotAction,
        AssertTitleContainsAction,
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

    @model_validator(mode="before")


    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Allow journey_name as alias for name
            if "name" not in data and "journey_name" in data:
                data["name"] = data["journey_name"]
            # Normalize actions if action_type was supplied instead of type
            if "actions" in data and isinstance(data["actions"], list):
                norm_actions = []
                for act in data["actions"]:
                    if isinstance(act, dict):
                        act_copy = dict(act)
                        if "type" not in act_copy and "action_type" in act_copy:
                            act_copy["type"] = act_copy["action_type"]
                        norm_actions.append(act_copy)
                    else:
                        norm_actions.append(act)
                data["actions"] = norm_actions
        return data


class ActionExecutionResult(BaseModel):
    """Outcome report for an individual action in a journey."""

    action_index: int
    action_type: str
    status: Literal["passed", "failed"]
    error: Optional[str] = None
    duration_ms: float

