"""TargetApp SQLAlchemy model."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.regression_journey import RegressionJourney
    from app.models.test_run import TestRun


class TargetApp(Base):
    """Represents a target web application under test."""

    __tablename__ = "target_apps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

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

    test_runs: Mapped[List["TestRun"]] = relationship(
        "TestRun",
        back_populates="target_app",
        cascade="all, delete-orphan",
    )
    regression_journeys: Mapped[List["RegressionJourney"]] = relationship(
        "RegressionJourney",
        back_populates="target_app",
        cascade="all, delete-orphan",
    )
