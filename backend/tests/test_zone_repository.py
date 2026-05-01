from app.repositories.zone_repository import ZoneRepository


def test_zone_repository_crud(seed_data):
    seed_data["zone"](
        zone_id="Z99",
        zone_name="Edge Zone",
        base_hourly_rate=700,
        peak_multiplier=1.1,
        max_duration_minutes=120,
        overstay_multiplier=1.8,
    )

    rows = ZoneRepository.list_all()
    assert any(row["zone_id"] == "Z99" for row in rows)

    fetched = ZoneRepository.get_by_id("Z99")
    assert fetched["zone_name"] == "Edge Zone"

    class ZonePayload:
        zone_name = "Updated Zone"
        base_hourly_rate = 750
        peak_start = "09:00"
        peak_end = "17:00"
        peak_multiplier = 1.2
        max_duration_minutes = 180
        overstay_multiplier = 2.0

    ZoneRepository.update("Z99", ZonePayload)
    updated = ZoneRepository.get_by_id("Z99")
    assert updated["zone_name"] == "Updated Zone"
    assert updated["base_hourly_rate"] == 750

    ZoneRepository.delete("Z99")
    assert ZoneRepository.get_by_id("Z99") is None
