from sqlalchemy import Boolean, Index, Integer, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Service(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """CHECK constraints (duration, price) live in migration 0001.

    Name uniqueness is case-insensitive: unique index on lower(name), migration 0003.
    """

    __tablename__ = "services"
    __table_args__ = (Index("uq_services_name_lower", text("lower(name)"), unique=True),)

    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    duration_minutes: Mapped[int] = mapped_column(SmallInteger)
    price_idr: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    