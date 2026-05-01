from datetime import datetime, timedelta


def test_session_endpoints(client, seed_data):
    user = seed_data["user"](name="Driver", email="driver-api@example.com")
    admin = seed_data["user"](name="Admin 2", email="admin2@example.com", role="admin")
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

    list_sessions = client.get(f"/sessions/?user_id={user['user_id']}&role=user")
    assert list_sessions.status_code == 200
    assert list_sessions.json()[0]["session_id"] == "api-active"

    quote = client.get(f"/sessions/api-active/quote?user_id={user['user_id']}&role=user")
    assert quote.status_code == 200
    assert quote.json()["estimated_final_fee"] >= 50

    forbidden_quote = client.get("/sessions/api-active/quote?user_id=wrong&role=user")
    assert forbidden_quote.status_code == 403
    assert client.get("/sessions/missing/quote?role=admin").status_code == 404

    new_session = client.post(
        "/sessions/",
        json={
            "plate_number": "API-222",
            "zone_id": "D02",
            "user_id": user["user_id"],
            "user_role": "user",
        },
    )
    assert new_session.status_code == 200
    new_session_id = new_session.json()["session_id"]

    duplicate_session = client.post(
        "/sessions/",
        json={
            "plate_number": "API-222",
            "zone_id": "D02",
            "user_id": user["user_id"],
            "user_role": "user",
        },
    )
    assert duplicate_session.status_code == 400

    admin_forbidden_create = client.post(
        "/sessions/",
        json={
            "plate_number": "API-222",
            "zone_id": "D01",
            "user_id": admin["user_id"],
            "user_role": "admin",
        },
    )
    assert admin_forbidden_create.status_code == 403

    user_close = client.put(f"/sessions/{new_session_id}/close", json={"user_role": "user"})
    assert user_close.status_code == 403
    admin_close = client.put(f"/sessions/{new_session_id}/close", json={"user_role": "admin"})
    assert admin_close.status_code == 200
    assert admin_close.json()["status"] == "unpaid"
    assert client.put("/sessions/missing/close", json={"user_role": "admin"}).status_code == 404
