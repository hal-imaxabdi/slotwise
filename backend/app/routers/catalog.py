import uuid
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.availability import BUSINESS_TZ, ServiceNotFound, get_free_slots
from app.database import get_db
from app.models import Service
from app.schemas import ServiceOut, SlotOut, SlotsOut

router = APIRouter(tags=["catalog"])

MAX_DAYS_AHEAD = 90
def get_now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/services", response_model=list[ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return db.scalars(
        select(Service).where(Service.is_active.is_(True)).order_by(Service.name)
    ).all()


@router.get("/services/{service_id}/slots", response_model=SlotsOut)
def list_slots(
    service_id: uuid.UUID,
    day: date = Query(alias="date"),
    db: Session = Depends(get_db),
    now: datetime = Depends(get_now),
):
    
    today = now.astimezone(BUSINESS_TZ).date()
    if day > today + timedelta(days=MAX_DAYS_AHEAD):
        raise HTTPException(422, f"date must be within {MAX_DAYS_AHEAD} days from today")

    try:
        starts = get_free_slots(db, service_id, day, now=now)
    except ServiceNotFound:
        raise HTTPException(404, "Service not found")

    service = db.get(Service, service_id)
    return SlotsOut(
        service_id=service_id,
        date=day,
        timezone=str(BUSINESS_TZ),
        duration_minutes=service.duration_minutes,
        slots=[
            SlotOut(starts_at=s, local_time=s.astimezone(BUSINESS_TZ).strftime("%H:%M"))
            for s in starts
        ],
    )
    