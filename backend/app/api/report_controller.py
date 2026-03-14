from fastapi import APIRouter, HTTPException
from app.services.reporting_service import ReportingService

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/revenue-by-zone")
def revenue_by_zone():
    try:
        rows = ReportingService.revenue_by_zone()
        return [{"zone_id": r["zone_id"], "revenue": r["revenue"]} for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/revenue-summary")
def revenue_summary():
    try:
        return ReportingService.revenue_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))