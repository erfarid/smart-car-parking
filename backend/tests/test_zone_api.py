def test_zone_endpoints(client):
    listed = client.get("/zones/")
    assert listed.status_code == 200
    assert any(zone["zone_id"] == "D01" for zone in listed.json())

    created = client.post(
        "/zones/",
        json={
            "zone_id": "A55",
            "zone_name": "API Zone",
            "base_hourly_rate": 550,
            "peak_start": "08:00",
            "peak_end": "18:00",
            "peak_multiplier": 1.2,
            "max_duration_minutes": 120,
            "overstay_multiplier": 1.5,
        },
    )
    assert created.status_code == 200

    fetched = client.get("/zones/A55")
    assert fetched.status_code == 200
    assert fetched.json()["zone_name"] == "API Zone"

    updated = client.put(
        "/zones/A55",
        json={
            "zone_id": "A55",
            "zone_name": "API Zone Updated",
            "base_hourly_rate": 650,
            "peak_start": "09:00",
            "peak_end": "17:00",
            "peak_multiplier": 1.1,
            "max_duration_minutes": 180,
            "overstay_multiplier": 2.0,
        },
    )
    assert updated.status_code == 200

    deleted = client.delete("/zones/A55")
    assert deleted.status_code == 200
    assert client.get("/zones/A55").status_code == 404

    invalid = client.post(
        "/zones/",
        json={
            "zone_id": "BAD",
            "zone_name": "Bad",
            "base_hourly_rate": 0,
            "peak_start": "08:00",
            "peak_end": "18:00",
            "peak_multiplier": 1.2,
        },
    )
    assert invalid.status_code == 422
