"""RegressionJourney SQLAlchemy model."""

from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.target_app import TargetApp
    from app.models.test_run import TestRun


class RegressionJourney(Base):
    """Represents a validated browser journey preserved for regression testing."""

    __tablename__ = "regression_journeys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_app_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("target_apps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    journey_definition: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    baseline_test_run_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("test_runs.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    target_app: Mapped["TargetApp"] = relationship(
        "TargetApp",
        back_populates="regression_journeys",
    )
    test_runs: Mapped[List["TestRun"]] = relationship(
        "TestRun",
        back_populates="regression_journey",
        foreign_keys="TestRun.regression_journey_id",
    )
