"""Admin-only business-hours management. Every route requires the admin role.

Service functions only flush; this module commits.
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app.admin_hours import (
    HoursConflictWithAppointments,
    InvalidHours,
    list_hours,
    replace_day,
)
from app.booking import BookingForbidden
from app.database import get_db
from app.deps import get_now, require_admin, require_admin_write
from app.models import User, UserSession
from app.schemas import BusinessHoursReplaceIn, BusinessHourOut

router = APIRouter(prefix="/admin/business-hours", tags=["admin"])


@router.get("", response_model=list[BusinessHourOut])
def list_all(
    _current: tuple[UserSession, User] = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return list_hours(db)


@router.put("/{weekday}", response_model=list[BusinessHourOut])
def replace(
    weekday: Annotated[int, Path(ge=0, le=6)],
    body: BusinessHoursReplaceIn,
    current: tuple[UserSession, User] = Depends(require_admin_write),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    _session, user = current
    try:
        rows = replace_day(
            db,
            user=user,
            weekday=weekday,
            intervals=[(i.open_minute, i.close_minute) for i in body.intervals],
            now=now,
        )
    except BookingForbidden:
        raise HTTPException(status_code=403, detail="Forbidden")
    except InvalidHours as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except HoursConflictWithAppointments as exc:
        raise HTTPException(
            status_code=409,
            detail=(
                f"{exc.count} active appointment(s) would fall outside these hours; "
                "cancel or reschedule them first"
            ),
        )
    db.commit()
    return rows
