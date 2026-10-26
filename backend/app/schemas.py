import uuid
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

class LoginIn(BaseModel):
    email: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str


class AuthOut(BaseModel):
    user: UserOut
    csrf_token: str

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
    