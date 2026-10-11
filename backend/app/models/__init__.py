"""Database models registry."""

from app.models.certificate import Certificate
from app.models.defect import Defect
from app.models.regression_journey import RegressionJourney
from app.models.replay_attempt import ReplayAttempt
from app.models.target_app import TargetApp
from app.models.test_run import TestRun

__all__ = [
    "TargetApp",
    "TestRun",
    "Defect",
    "RegressionJourney",
    "ReplayAttempt",
    "Certificate",
]
