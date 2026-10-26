from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.routers import auth, catalog

app = FastAPI(title="Slotwise API")
app.include_router(catalog.router)
app.include_router(auth.router)


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
