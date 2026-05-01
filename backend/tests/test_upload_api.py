def test_upload_plate_image_endpoint(client, monkeypatch):
    class DummyPlateDetector:
        def process(self, image_bytes):
            return {"plate_text": "API-999", "confidence": 0.88, "valid": True}

    monkeypatch.setattr("app.services.plate_detection_service.PlateDetectionService", DummyPlateDetector)
    uploaded = client.post(
        "/upload/plate-image",
        files={"file": ("plate.jpg", b"fake-image", "image/jpeg")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["plate_text"] == "API-999"
