"""Certificate SQLAlchemy model."""

from datetime import datetime
from typing import TYPE_CHECKING, Any, Dict, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.target_app import TargetApp


class Certificate(Base):
    """Represents a persisted deterministic QA Certificate."""

    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    certificate_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    target_app_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("target_apps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="ISSUED",
        nullable=False,
    )
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    grade: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    tamper_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    certificate_data: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)

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
        back_populates="certificates",
    )
