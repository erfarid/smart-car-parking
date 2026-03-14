from fastapi import APIRouter, HTTPException
from app.models.schemas import ZoneCreate
from app.services.zone_service import ZoneService

router = APIRouter(prefix="/zones", tags=["zones"])


@router.get("/")
def list_zones():
    rows = ZoneService.list_zones()
    return [dict(r) for r in rows]


@router.get("/{zone_id}")
def get_zone(zone_id: str):
    try:
        zone = ZoneService.get_zone(zone_id)
        return dict(zone)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/")
def create_zone(zone: ZoneCreate):
    try:
        ZoneService.create_zone(zone)
        return {"message": "Zone created"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{zone_id}")
def update_zone(zone_id: str, zone: ZoneCreate):
    try:
        ZoneService.update_zone(zone_id, zone)
        return {"message": "Zone updated"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{zone_id}")
def delete_zone(zone_id: str):
    try:
        ZoneService.delete_zone(zone_id)
        return {"message": "Zone deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
