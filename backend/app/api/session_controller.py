from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import SessionClose, SessionCreate
from app.services.reporting_service import ReportingService
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/")
def list_sessions(
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    user_id: Optional[str] = Query(default=None),
    role: str = Query(default="user"),
    plate_number: Optional[str] = Query(default=None),
):
    try:
        rows = ReportingService.sessions_by_date_range(date_from, date_to, user_id, role, plate_number)
        return [SessionService.enrich_session_for_display(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/quote")
def get_session_quote(
    session_id: str,
    user_id: Optional[str] = Query(default=None),
    role: str = Query(default="user"),
):
    try:
        return SessionService.quote_active_session(session_id, user_id, role)
    except ValueError as e:
        msg = str(e)
        lowered = msg.lower()
        if "own" in lowered:
            code = 403
        elif "not found" in lowered:
            code = 404
        else:
            code = 400
        raise HTTPException(status_code=code, detail=msg)


@router.post("/")
def create_session(data: SessionCreate):
    try:
        return SessionService.create_session(data)
    except ValueError as e:
        message = str(e)
        lowered = message.lower()
        status = 403 if ("linked to your account" in lowered or "admin cannot start" in lowered) else 404 if "not found" in lowered else 400
        raise HTTPException(status_code=status, detail=message)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{session_id}/close")
def close_session(session_id: str, data: SessionClose):
    try:
        return SessionService.close_session(session_id, data)
    except ValueError as e:
        msg = str(e)
        lowered = msg.lower()
        if "admin" in lowered:
            code = 403
        elif "not found" in lowered:
            code = 404
        else:
            code = 400
        raise HTTPException(status_code=code, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
