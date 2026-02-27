from fastapi import APIRouter, HTTPException
from app.services.reporting_service import ReportingService

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/revenue-by-zone")
def revenue_by_zone():
    try:
        rows = ReportingService.revenue_by_zone()
        # Convert sqlite3.Row -> dict for clean JSON
        return [{"zone_id": r["zone_id"], "revenue": r["revenue"]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))