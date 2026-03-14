from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.repositories.vehicle_repository import VehicleRepository

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


class VehicleCreate(BaseModel):
    plate_number: str
    owner_name: str
    vehicle_type: str = "car"
    registration_status: str = "active"


@router.get("/")
def list_vehicles():
    rows = VehicleRepository.list_all()
    return [dict(r) for r in rows]


@router.get("/{plate_number}")
def get_vehicle(plate_number: str):
    row = VehicleRepository.get_by_plate(plate_number)
    if not row:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return dict(row)


@router.post("/")
def create_vehicle(data: VehicleCreate):
    inserted = VehicleRepository.create(
        data.plate_number, data.owner_name, data.vehicle_type, data.registration_status
    )
    if not inserted:
        raise HTTPException(status_code=409, detail="Vehicle already exists")
    return {"message": "Vehicle registered"}


@router.delete("/{plate_number}")
def delete_vehicle(plate_number: str):
    deleted = VehicleRepository.delete(plate_number)
    if not deleted:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}
