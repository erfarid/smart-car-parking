import pytest

from app.models.schemas import ZoneCreate
from app.services.zone_service import ZoneService


def test_zone_service_validation_and_crud(seed_data):
    valid = ZoneCreate(
        zone_id="S01",
        zone_name="Service Zone",
        base_hourly_rate=650,
        peak_start="08:00",
        peak_end="18:00",
        peak_multiplier=1.2,
        max_duration_minutes=240,
        overstay_multiplier=1.6,
    )
    ZoneService.create_zone(valid)
    fetched = ZoneService.get_zone("S01")
    assert fetched["zone_name"] == "Service Zone"
    assert any(row["zone_id"] == "S01" for row in ZoneService.list_zones())

    updated = ZoneCreate(
        zone_id="S01",
        zone_name="Service Zone Updated",
        base_hourly_rate=700,
        peak_start="09:00",
        peak_end="19:00",
        peak_multiplier=1.1,
        max_duration_minutes=180,
        overstay_multiplier=2.0,
    )
    ZoneService.update_zone("S01", updated)
    assert ZoneService.get_zone("S01")["base_hourly_rate"] == 700

    ZoneService.delete_zone("S01")
    with pytest.raises(ValueError, match="Zone not found"):
        ZoneService.get_zone("S01")

    with pytest.raises(ValueError):
        ZoneService.delete_zone("missing")
    with pytest.raises(ValueError):
        ZoneService.update_zone("missing", updated)

    class BadZone:
        base_hourly_rate = 0
        peak_multiplier = 1.5
        max_duration_minutes = 9999
        overstay_multiplier = 0.5

    with pytest.raises(ValueError):
        ZoneService._validate_zone(BadZone)
