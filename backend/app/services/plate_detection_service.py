import re

class PlateDetectionService:

    YOLO_CONF_THRESHOLD = 0.25  # threshold set kiya
    CROP_PADDING_PX = 4  # padding value rakha

    def __init__(self):
        import cv2
        import easyocr
        from ultralytics import YOLO

        self.cv2 = cv2
        self.model = YOLO("license_plate.pt")  # model load kiya
        self.reader = easyocr.Reader(['en'], gpu=False)  # OCR setup kiya
        self.plate_pattern = r'^[A-Z0-9-]{5,12}$'  # pattern define kiya

    def _detect_plate_regions(self, image):
        boxes = []
        try:
            yolo_results = self.model(image, verbose=False)  # detection chalaya
        except Exception:
            return boxes  # error handle kiya

        for result in yolo_results:
            if not hasattr(result, "boxes") or result.boxes is None:
                continue
            for box in result.boxes:
                conf = float(box.conf[0]) if hasattr(box, "conf") else 0.0
                if conf < self.YOLO_CONF_THRESHOLD:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                boxes.append((x1, y1, x2, y2, conf))  # box add kiya

        boxes.sort(key=lambda b: b[4], reverse=True)  # confidence sort kiya
        return boxes

    def _crop_with_padding(self, image, x1, y1, x2, y2):
        h, w = image.shape[:2]
        pad = self.CROP_PADDING_PX  # padding liya
        x1p = max(0, x1 - pad)
        y1p = max(0, y1 - pad)
        x2p = min(w, x2 + pad)
        y2p = min(h, y2 + pad)

        if x2p <= x1p or y2p <= y1p:
            return None  # invalid crop skip
        return image[y1p:y2p, x1p:x2p]

    def _read_best_plate_from_ocr(self, ocr_results):
        best_plate = None
        best_conf = 0.0

        for bbox, text, conf in ocr_results:
            text = text.upper().replace(" ", "").strip()  # text clean kiya
            if re.match(self.plate_pattern, text):
                if conf > best_conf:
                    best_conf = conf
                    best_plate = text  # best plate select

        return best_plate, best_conf

    def process(self, image_bytes: bytes):
        import numpy as np

        np_arr = np.frombuffer(image_bytes, np.uint8)
        image = self.cv2.imdecode(np_arr, self.cv2.IMREAD_COLOR)  # image decode kiya

        if image is None:
            raise ValueError("Invalid image file")

        plate_boxes = self._detect_plate_regions(image)  # plates detect kiye

        best_plate = None
        best_conf = 0.0

        for x1, y1, x2, y2, _det_conf in plate_boxes:
            crop = self._crop_with_padding(image, x1, y1, x2, y2)  # crop banaya
            if crop is None:
                continue

            ocr_results = self.reader.readtext(crop)  # OCR apply kiya
            plate_text, ocr_conf = self._read_best_plate_from_ocr(ocr_results)

            if plate_text and ocr_conf > best_conf:
                best_plate = plate_text
                best_conf = ocr_conf  # best update kiya

        if not best_plate:
            ocr_results = self.reader.readtext(image)  # fallback OCR run
            best_plate, best_conf = self._read_best_plate_from_ocr(ocr_results)

        if not best_plate:
            return {
                "plate_text": None,
                "confidence": 0.0,
                "valid": False,
            }

        return {
            "plate_text": best_plate,
            "confidence": float(best_conf),
            "valid": True,
        }