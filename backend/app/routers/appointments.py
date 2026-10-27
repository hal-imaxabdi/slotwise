"""Appointment endpoints for the signed-in user.

The customer always comes from the session, never from the request body.
Service functions only flush; this module commits.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.availability import ServiceNotFound
from app.booking import SlotNotBookable, SlotTaken, create_appointment
from app.database import get_db
from app.deps import get_current_session, get_now, require_csrf
from app.models import Appointment, User, UserSession
from app.schemas import AppointmentCreateIn, AppointmentOut

router = APIRouter(prefix="/appointments", tags=["appointments"])

MAX_LIST = 200


@router.post("", status_code=201, response_model=AppointmentOut)
def create(
    body: AppointmentCreateIn,
    current: tuple[UserSession, User] = Depends(require_csrf),
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
        )
    except ServiceNotFound:
        raise HTTPException(status_code=404, detail="Service not found")
    except SlotTaken:
        raise HTTPException(status_code=409, detail="That time slot is no longer available")
    except SlotNotBookable:
        raise HTTPException(status_code=422, detail="That time is not bookable")
    db.commit()
    return appointment


@router.get("", response_model=list[AppointmentOut])
def list_mine(
    current: tuple[UserSession, User] = Depends(get_current_session),
    db: Session = Depends(get_db),
):
    _session, user = current
    return db.scalars(
        select(Appointment)
        .where(Appointment.customer_id == user.id)
        .order_by(Appointment.starts_at.desc())
        .limit(MAX_LIST)
    ).all()
    