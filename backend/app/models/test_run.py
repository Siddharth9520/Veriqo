"""TestRun SQLAlchemy model."""

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.defect import Defect
    from app.models.target_app import TargetApp


class TestRun(Base):
    """Represents a test exploration and execution run."""

    __test__ = False

    __tablename__ = "test_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    target_app_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("target_apps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="PENDING",
        nullable=False,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    target_app: Mapped["TargetApp"] = relationship(
        "TargetApp",
        back_populates="test_runs",
    )
    defects: Mapped[List["Defect"]] = relationship(
        "Defect",
        back_populates="test_run",
        cascade="all, delete-orphan",
    )
