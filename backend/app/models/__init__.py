"""Database models registry."""

from app.models.defect import Defect
from app.models.regression_journey import RegressionJourney
from app.models.target_app import TargetApp
from app.models.test_run import TestRun

__all__ = ["TargetApp", "TestRun", "Defect", "RegressionJourney"]
