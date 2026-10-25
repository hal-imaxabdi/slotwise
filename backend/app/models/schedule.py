import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class BusinessHour(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Weekly recurring open interval in business-local time (Asia/Jakarta).
    Overlap exclusion + range CHECKs live in migration 0001."""

    __tablename__ = "business_hours"

    weekday: Mapped[int] = mapped_column(SmallInteger)  # 0=Monday .. 6=Sunday
    open_minute: Mapped[int] = mapped_column(SmallInteger)  # minutes after local midnight
    close_minute: Mapped[int] = mapped_column(SmallInteger)


class UnavailablePeriod(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "unavailable_periods"

    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(String(200), default="", server_default="")
    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))

    __table_args__ = (Index("ix_unavailable_periods_starts_at", "starts_at"),)
    