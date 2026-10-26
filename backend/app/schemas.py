import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ServiceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    duration_minutes: int
    price_idr: int


class SlotOut(BaseModel):
    starts_at: datetime  # UTC
    local_time: str      # "HH:MM" in the business time zone


class SlotsOut(BaseModel):
    service_id: uuid.UUID
    date: date
    timezone: str
    duration_minutes: int
    slots: list[SlotOut]
    