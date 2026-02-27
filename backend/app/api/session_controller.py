from fastapi import APIRouter, HTTPException
from app.models.schemas import SessionCreate, SessionClose
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])

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
        # could be 404 or 400 depending on message; keep simple
        msg = str(e)
        code = 404 if "not found" in msg.lower() else 400
        raise HTTPException(status_code=code, detail=msg)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))