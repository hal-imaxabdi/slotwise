"""Load scheduling data from the database and compute free slots for one day."""

import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Appointment, BusinessHour, Service, UnavailablePeriod
from app.slots import OpenInterval, Window, compute_free_starts, local_minute_to_utc

BUSINESS_TZ = ZoneInfo("Asia/Jakarta")


class ServiceNotFound(Exception):
    """The service does not exist or is not active."""


def get_free_slots(
    db: Session,
    service_id: uuid.UUID,
    day: date,
    now: datetime | None = None,
    exclude_appointment_id: uuid.UUID | None = None,
) -> list[datetime]:
    """Free start times for `service_id` on local date `day`.

    `exclude_appointment_id` lets a reschedule ignore the appointment being moved,
    so its own current slot does not count as busy.
    """
    service = db.get(Service, service_id)
    if service is None or not service.is_active:
        raise ServiceNotFound(str(service_id))

    now = now or datetime.now(timezone.utc)
    day_start = local_minute_to_utc(day, 0, BUSINESS_TZ)
    day_end = local_minute_to_utc(day, 1440, BUSINESS_TZ)

    hours = [
        OpenInterval(h.weekday, h.open_minute, h.close_minute)
        for h in db.scalars(select(BusinessHour).where(BusinessHour.weekday == day.weekday()))
    ]

    blocked: list[Window] = [
        Window(p.starts_at, p.ends_at)
        for p in db.scalars(
            select(UnavailablePeriod).where(
                UnavailablePeriod.starts_at < day_end,
                UnavailablePeriod.ends_at > day_start,
            )
        )
    ]

    appointment_query = select(Appointment).where(
        Appointment.status != "cancelled",
        Appointment.starts_at < day_end,
        Appointment.ends_at > day_start,
    )
    if exclude_appointment_id is not None:
        appointment_query = appointment_query.where(Appointment.id != exclude_appointment_id)
    blocked += [Window(a.starts_at, a.ends_at) for a in db.scalars(appointment_query)]

    return compute_free_starts(
        day=day,
        tz=BUSINESS_TZ,
        hours=hours,
        duration_minutes=service.duration_minutes,
        blocked=blocked,
        now=now,
    )
    