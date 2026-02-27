from fastapi import APIRouter, HTTPException
from app.models.schemas import ZoneCreate
from app.services.zone_service import ZoneService

router = APIRouter(prefix="/zones", tags=["zones"])

@router.get("/")
def list_zones():
    return ZoneService.list_zones()

@router.post("/")
def create_zone(zone: ZoneCreate):
    try:
        ZoneService.create_zone(zone)
        return {"message": "Zone created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))