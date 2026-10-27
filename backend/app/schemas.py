import uuid
from datetime import date, datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field


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
    local_time: str  # "HH:MM" in the business time zone


class SlotsOut(BaseModel):
    service_id: uuid.UUID
    date: date
    timezone: str
    duration_minutes: int
    slots: list[SlotOut]


class AppointmentCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    service_id: uuid.UUID
    starts_at: AwareDatetime
    notes: str = Field(default="", max_length=500)


class AppointmentRescheduleIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: AwareDatetime


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    service_id: uuid.UUID
    starts_at: datetime  # UTC
    ends_at: datetime  # UTC
    status: str
    notes: str
    cancelled_at: datetime | None


class StaffAppointmentCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    customer_id: uuid.UUID
    service_id: uuid.UUID
    starts_at: AwareDatetime
    notes: str = Field(default="", max_length=500)


class StaffAppointmentOut(AppointmentOut):
    customer_id: uuid.UUID
    created_by_id: uuid.UUID


class StaffAppointmentListItem(StaffAppointmentOut):
    customer_email: str
    customer_name: str
    