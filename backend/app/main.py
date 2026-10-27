from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.origin import OriginCheckMiddleware
from app.routers import (
    admin_hours,
    admin_services,
    appointments,
    auth,
    catalog,
    staff,
    unavailable,
)

app = FastAPI(title="Slotwise API")
app.add_middleware(OriginCheckMiddleware)
app.include_router(catalog.router)
app.include_router(auth.router)
app.include_router(appointments.router)
app.include_router(staff.router)
app.include_router(unavailable.router)
app.include_router(admin_services.router)
app.include_router(admin_hours.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        # Safe message: no connection strings or internals leak to the client
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok", "database": "reachable"}
