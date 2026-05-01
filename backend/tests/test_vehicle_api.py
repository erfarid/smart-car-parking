from datetime import datetime, timedelta


def test_vehicle_endpoints(client, seed_data):
    user = seed_data["user"](name="Driver", email="driver-api@example.com")
    seed_data["vehicle"]("API-111", owner_name="Driver", owner_user_id=user["user_id"])
    seed_data["vehicle"]("API-222", owner_name="Driver", owner_user_id=user["user_id"])
    seed_data["session"](
        session_id="api-active",
        plate_number="API-111",
        zone_id="D01",
        entry_timestamp=(datetime.now() - timedelta(minutes=90)).isoformat(),
        status="active",
        user_id=user["user_id"],
    )
    seed_data["session"](
        session_id="api-paid",
        plate_number="API-111",
        zone_id="D01",
        entry_timestamp="2026-01-01T09:00:00",
        exit_timestamp="2026-01-01T10:00:00",
        duration_minutes=60,
        base_fee=600,
        overstay_penalty=0,
        repeat_count=0,
        repeat_penalty=0,
        final_fee=600,
        status="paid",
        user_id=user["user_id"],
    )
    seed_data["payment"](user_id=user["user_id"], session_id="api-paid", amount=600)

    list_user = client.get(f"/vehicles/?user_id={user['user_id']}&role=user")
    assert list_user.status_code == 200
    assert {v["plate_number"] for v in list_user.json()} == {"API-111", "API-222"}

    list_admin = client.get("/vehicles/?role=admin")
    assert list_admin.status_code == 200
    assert len(list_admin.json()) >= 2

    vehicle = client.get(f"/vehicles/API-111?user_id={user['user_id']}&role=user")
    assert vehicle.status_code == 200
    assert vehicle.json()["owner_user_id"] == user["user_id"]

    missing_for_account = client.get(f"/vehicles/API-111?user_id=someone-else&role=user")
    assert missing_for_account.status_code == 404

    details = client.get(f"/vehicles/API-111/details?user_id={user['user_id']}&role=user")
    assert details.status_code == 200
    payload = details.json()
    assert payload["summary"]["total_sessions"] == 2
    assert payload["summary"]["active_sessions"] == 1
    assert payload["summary"]["payment_count"] == 1
    assert payload["owner"]["email"] == user["email"]

    create_vehicle = client.post(
        "/vehicles/",
        json={
            "plate_number": " new-123 ",
            "owner_name": "New Driver",
            "vehicle_type": "car",
            "registration_status": "active",
            "owner_user_id": user["user_id"],
            "requestor_role": "user",
        },
    )
    assert create_vehicle.status_code == 200
    assert create_vehicle.json()["plate_number"] == "NEW-123"

    create_missing_owner = client.post(
        "/vehicles/",
        json={
            "plate_number": "self-1",
            "owner_name": "Self",
            "vehicle_type": "car",
            "registration_status": "active",
            "requestor_role": "user",
        },
    )
    assert create_missing_owner.status_code == 400

    duplicate = client.post(
        "/vehicles/",
        json={
            "plate_number": "API-111",
            "owner_name": "Dup",
            "vehicle_type": "car",
            "registration_status": "active",
            "requestor_role": "admin",
        },
    )
    assert duplicate.status_code == 409

    delete_vehicle = client.delete("/vehicles/NEW-123")
    assert delete_vehicle.status_code == 200
    assert client.delete("/vehicles/NEW-123").status_code == 404
