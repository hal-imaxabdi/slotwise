"""Staff/admin endpoints for unavailable periods (closures).

Service functions only flush; this module commits.
"""

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.booking import BookingForbidden
from app.database import get_db
from app.deps import require_staff, require_staff_write
from app.models import User, UserSession
from app.schemas import UnavailablePeriodCreateIn, UnavailablePeriodOut
from app.unavailable import (
    InvalidPeriod,
    PeriodConflictsWithAppointments,
    PeriodNotFound,
    create_period,
    delete_period,
    list_periods,
)

router = APIRouter(prefix="/staff/unavailable-periods", tags=["staff"])

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


@router.get("", response_model=list[UnavailablePeriodOut])
def list_all(
    date_from: date | None = Query(default=None, alias="from"),
    date_to: date | None = Query(default=None, alias="to"),
    limit: int = Query(default=DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(default=0, ge=0),
    _current: tuple[UserSession, User] = Depends(require_staff),
    db: Session = Depends(get_db),
):
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=422, detail="'from' must not be after 'to'")
    return list_periods(
        db, date_from=date_from, date_to=date_to, limit=limit, offset=offset
    )


@router.post("", status_code=201, response_model=UnavailablePeriodOut)
def create(
    body: UnavailablePeriodCreateIn,
    current: tuple[UserSession, User] = Depends(require_staff_write),
    db: Session = Depends(get_db),
):
    _session, user = current
    try:
        period = create_period(
            db,
            user=user,
            starts_at=body.starts_at,
            ends_at=body.ends_at,
            reason=body.reason,
        )
    except BookingForbidden:
        raise HTTPException(status_code=403, detail="Forbidden")
    except InvalidPeriod:
        raise HTTPException(
            status_code=422,
            detail="End must be after start, and both times must be on the 30-minute grid",
        )
    except PeriodConflictsWithAppointments as exc:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{exc.count} active appointment(s) overlap this period; "
                "cancel or reschedule them first"
            ),
        )
    db.commit()
    return period


@router.delete("/{period_id}", status_code=204, response_class=Response)
def remove(
    period_id: uuid.UUID,
    current: tuple[UserSession, User] = Depends(require_staff_write),
    db: Session = Depends(get_db),
):
    _session, user = current
    try:
        delete_period(db, user=user, period_id=period_id)
    except BookingForbidden:
        raise HTTPException(status_code=403, detail="Forbidden")
    except PeriodNotFound:
        raise HTTPException(status_code=404, detail="Unavailable period not found")
    db.commit()
    return Response(status_code=204)
