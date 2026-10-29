"""Staff/admin endpoints. Every route is guarded by a staff role check.

Service functions only flush; this module commits.
"""

import uuid
from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.availability import BUSINESS_TZ, ServiceNotFound
from app.booking import (
    AppointmentNotActive,
    AppointmentNotFound,
    AppointmentNotStarted,
    BookingForbidden,
    CustomerNotFound,
    SlotNotBookable,
    SlotTaken,
    create_appointment,
    mark_appointment,
)
from app.database import get_db
from app.deps import get_now, require_staff, require_staff_write
from app.models import Appointment, AppointmentStatus, Role, User, UserSession
from app.schemas import (
    StaffAppointmentCreateIn,
    StaffAppointmentListItem,
    StaffAppointmentOut,
    StaffCustomerOut,
)

router = APIRouter(prefix="/staff", tags=["staff"])

DEFAULT_LIMIT = 50
MAX_LIMIT = 200
CUSTOMER_DEFAULT_LIMIT = 20
CUSTOMER_MAX_LIMIT = 50
CUSTOMER_QUERY_MAX_LENGTH = 100


def _local_day_start_utc(day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=BUSINESS_TZ).astimezone(timezone.utc)


def _escape_like(text: str) -> str:
    """Make %, _ and the escape character literal inside a LIKE pattern."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@router.get("/customers", response_model=list[StaffCustomerOut])
def search_customers(
    q: str = Query(default="", max_length=CUSTOMER_QUERY_MAX_LENGTH),
    limit: int = Query(default=CUSTOMER_DEFAULT_LIMIT, ge=1, le=CUSTOMER_MAX_LIMIT),
    _current: tuple[UserSession, User] = Depends(require_staff),
    db: Session = Depends(get_db),
):
    query = select(User).where(User.role == Role.CUSTOMER.value, User.is_active.is_(True))
    term = q.strip()
    if term:
        pattern = f"%{_escape_like(term)}%"
        query = query.where(
            or_(
                User.email.ilike(pattern, escape="\\"),
                User.full_name.ilike(pattern, escape="\\"),
            )
        )
    users = db.scalars(query.order_by(User.full_name, User.email).limit(limit)).all()
    return [StaffCustomerOut.model_validate(user) for user in users]


@router.get("/appointments", response_model=list[StaffAppointmentListItem])
def list_all(
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    status: AppointmentStatus | None = None,
    service_id: uuid.UUID | None = None,
    customer_id: uuid.UUID | None = None,
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    _current: tuple[UserSession, User] = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=422, detail="'from' must not be after 'to'")

    query = select(Appointment, User.email, User.full_name).join(
        User, User.id == Appointment.customer_id
    )
    if date_from is not None:
        query = query.where(Appointment.starts_at >= _local_day_start_utc(date_from))
    if date_to is not None:
        query = query.where(
            Appointment.starts_at < _local_day_start_utc(date_to + timedelta(days=1))
        )
    if status is not None:
        query = query.where(Appointment.status == status.value)
    if service_id is not None:
        query = query.where(Appointment.service_id == service_id)
    if customer_id is not None:
        query = query.where(Appointment.customer_id == customer_id)

    rows = db.execute(
        query.order_by(Appointment.starts_at.desc(), Appointment.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    return [
        StaffAppointmentListItem.model_validate(
            {
                **StaffAppointmentOut.model_validate(appointment).model_dump(),
                "customer_email": email,
                "customer_name": full_name,
            }
        )
        for appointment, email, full_name in rows
    ]


@router.post("/appointments", status_code=201, response_model=StaffAppointmentOut)
def create_for_customer(
    body: StaffAppointmentCreateIn,
    current: tuple[UserSession, User] = Depends(require_staff_write),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    _session, user = current
    try:
        appointment = create_appointment(
            db,
            user=user,
            service_id=body.service_id,
            starts_at=body.starts_at,
            notes=body.notes,
            now=now,
            customer_id=body.customer_id,
        )
    except CustomerNotFound:
        raise HTTPException(status_code=404, detail="Customer not found")
    except ServiceNotFound:
        raise HTTPException(status_code=404, detail="Service not found")
    except SlotTaken:
        raise HTTPException(status_code=409, detail="That time slot is no longer available")
    except SlotNotBookable:
        raise HTTPException(status_code=422, detail="That time is not bookable")
    db.commit()
    return appointment


def _mark(
    db: Session,
    user: User,
    appointment_id: uuid.UUID,
    status: AppointmentStatus,
    now: datetime,
) -> Appointment:
    try:
        appointment = mark_appointment(
            db, user=user, appointment_id=appointment_id, status=status, now=now
        )
    except BookingForbidden:
        raise HTTPException(status_code=403, detail="Forbidden")
    except AppointmentNotFound:
        raise HTTPException(status_code=404, detail="Appointment not found")
    except AppointmentNotActive:
        raise HTTPException(status_code=409, detail="Appointment can no longer be changed")
    except AppointmentNotStarted:
        raise HTTPException(status_code=409, detail="Appointment has not started yet")
    db.commit()
    return appointment


@router.post("/appointments/{appointment_id}/complete", response_model=StaffAppointmentOut)
def complete(
    appointment_id: uuid.UUID,
    current: tuple[UserSession, User] = Depends(require_staff_write),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    _session, user = current
    return _mark(db, user, appointment_id, AppointmentStatus.COMPLETED, now)


@router.post("/appointments/{appointment_id}/no-show", response_model=StaffAppointmentOut)
def no_show(
    appointment_id: uuid.UUID,
    current: tuple[UserSession, User] = Depends(require_staff_write),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    _session, user = current
    return _mark(db, user, appointment_id, AppointmentStatus.NO_SHOW, now)
