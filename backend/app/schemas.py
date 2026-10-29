import uuid
from datetime import date, datetime
from typing import Annotated

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    StrictStr,
    StringConstraints,
)


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


class StaffCustomerOut(BaseModel):
    """Minimal customer record for the staff booking picker."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str


PeriodReason = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]


class UnavailablePeriodCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: AwareDatetime
    ends_at: AwareDatetime
    reason: PeriodReason


class UnavailablePeriodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    starts_at: datetime  # UTC
    ends_at: datetime  # UTC
    reason: str
    created_by_id: uuid.UUID


# Admin service management. Exact ranges are enforced in app/admin_services.py;
# the max_length caps here only bound the request size.


class AdminServiceCreateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: StrictStr = Field(max_length=200)
    description: StrictStr = Field(default="", max_length=4000)
    duration_minutes: StrictInt
    price_idr: StrictInt = 0


class AdminServiceUpdateIn(BaseModel):
    """Partial update. Omitted field = unchanged; explicit null = 422.

    Defaults of None are not validated by Pydantic, so they only mark "unset"
    (dropped by model_dump(exclude_unset=True)).
    """

    model_config = ConfigDict(extra="forbid")

    name: StrictStr = Field(default=None, max_length=200)  # type: ignore[assignment]
    description: StrictStr = Field(default=None, max_length=4000)  # type: ignore[assignment]
    duration_minutes: StrictInt = Field(default=None)  # type: ignore[assignment]
    price_idr: StrictInt = Field(default=None)  # type: ignore[assignment]


class AdminServiceOut(ServiceOut):
    is_active: bool


# Admin business hours. The real limits (grid, overlap, 8 per day) live in
# app/admin_hours.py; max_length here only bounds the request size.


class BusinessIntervalIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    open_minute: StrictInt
    close_minute: StrictInt


class BusinessHoursReplaceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intervals: list[BusinessIntervalIn] = Field(max_length=20)


class BusinessHourOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    weekday: int
    open_minute: int
    close_minute: int
    