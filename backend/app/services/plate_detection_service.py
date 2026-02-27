import re
import cv2
import numpy as np
import easyocr
from ultralytics import YOLO


class PlateDetectionService:
    """
    Service layer for license plate detection and OCR.
    Loads models once and exposes a clean process() method.
    """

    def __init__(self):
        # Load models only once
        self.model = YOLO("yolov8n.pt")
        self.reader = easyocr.Reader(['en'], gpu=False)

        # Adjust regex for your country if needed
        self.plate_pattern = r'^[A-Z0-9-]{5,12}$'

    def process(self, image_bytes: bytes):
        """
        Accepts image bytes (from FastAPI upload)
        Returns detected plate and confidence
        """

        # Convert bytes to OpenCV image
        np_arr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Invalid image file")

        # For now: run OCR directly on full image
        # (You can later crop using YOLO bounding boxes)
        ocr_results = self.reader.readtext(image)

        best_plate = None
        best_conf = 0.0

        for bbox, text, conf in ocr_results:
            text = text.upper().replace(" ", "").strip()

            if re.match(self.plate_pattern, text):
                if conf > best_conf:
                    best_conf = conf
                    best_plate = text

        if not best_plate:
            return {
                "plate_text": None,
                "confidence": 0.0,
                "valid": False
            }

        return {
            "plate_text": best_plate,
            "confidence": float(best_conf),
            "valid": True
        }