"""Schemas package registry."""

from app.schemas.defect import DefectBase, DefectCreate, DefectRead
from app.schemas.health import HealthResponse, ReadinessResponse
from app.schemas.journey import (
    ActionExecutionResult,
    ActionType,
    AssertElementVisibleAction,
    AssertTextVisibleAction,
    ClickAction,
    FillAction,
    JourneyAction,
    JourneyDefinition,
    NavigateAction,
)
from app.schemas.regression_journey import (
    RegressionJourneyCreate,
    RegressionJourneyRead,
)
from app.schemas.replay_attempt import (
    ReplayAttemptCreate,
    ReplayAttemptRead,
    ReplayOutcome,
)
from app.schemas.target_app import TargetAppBase, TargetAppCreate, TargetAppRead
from app.schemas.test_run import TestRunBase, TestRunCreate, TestRunRead

__all__ = [
    "HealthResponse",
    "ReadinessResponse",
    "TargetAppBase",
    "TargetAppCreate",
    "TargetAppRead",
    "TestRunBase",
    "TestRunCreate",
    "TestRunRead",
    "DefectBase",
    "DefectCreate",
    "DefectRead",
    "ActionType",
    "NavigateAction",
    "ClickAction",
    "FillAction",
    "AssertTextVisibleAction",
    "AssertElementVisibleAction",
    "JourneyAction",
    "JourneyDefinition",
    "ActionExecutionResult",
    "RegressionJourneyCreate",
    "RegressionJourneyRead",
    "ReplayOutcome",
    "ReplayAttemptCreate",
    "ReplayAttemptRead",
]
