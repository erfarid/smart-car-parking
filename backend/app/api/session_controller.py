from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import SessionCreate, SessionClose
from app.services.session_service import SessionService
from app.services.reporting_service import ReportingService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/")
def list_sessions(date_from: str = Query(None), date_to: str = Query(None)):
    try:
        rows = ReportingService.sessions_by_date_range(date_from, date_to)
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_session(data: SessionCreate):
    try:
        return SessionService.create_session(data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{session_id}/close")
def close_session(session_id: str, data: SessionClose):
    try:
        return SessionService.close_session(session_id, data)
    except ValueError as e:
        msg = str(e)
        code = 404 if "not found" in msg.lower() else 400
        raise HTTPException(status_code=code, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))