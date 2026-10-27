"""Staff/admin endpoints. Every route is guarded by a staff role check.

Service functions only flush; this module commits.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.availability import ServiceNotFound
from app.booking import (
    CustomerNotFound,
    SlotNotBookable,
    SlotTaken,
    create_appointment,
)
from app.database import get_db
from app.deps import get_now, require_staff_write
from app.models import User, UserSession
from app.schemas import StaffAppointmentCreateIn, StaffAppointmentOut

router = APIRouter(prefix="/staff", tags=["staff"])


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
