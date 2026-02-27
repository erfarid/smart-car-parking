from pydantic import BaseModel
from typing import Optional

class ZoneCreate(BaseModel):
    zone_id: str
    zone_name: str
    base_hourly_rate: int
    peak_start: str
    peak_end: str
    peak_multiplier: float
    max_duration_minutes: int = 240
    overstay_multiplier: float = 2.0


class SessionCreate(BaseModel):
    plate_number: str
    zone_id: str
    entry_timestamp: Optional[str] = None


class SessionClose(BaseModel):
    exit_timestamp: Optional[str] = None