import pytest
from app.services.plate_detection_service import PlateDetectionService

class DummyReader:
    def __init__(self, results):
        self._results = results
    def readtext(self, image):
        return self._results

class DummyCv2:
    IMREAD_COLOR = 1
    def __init__(self, decoded=b"image"):
        self._decoded = decoded
    def imdecode(self, arr, flag):
        return self._decoded

class _Box:
    def __init__(self, x1, y1, x2, y2, conf):
        self.xyxy = [_Tensor([x1,y1,x2,y2])]
        self.conf = [_Scalar(conf)]

class _Tensor:
    def __init__(self, values):
        self._values = values
    def tolist(self):
        return list(self._values)
    def __iter__(self):
        return iter(self._values)

class _Scalar:
    def __init__(self, v):
        self._v = v
    def __float__(self):
        return float(self._v)

class _YoloResult:
    def __init__(self, boxes):
        self.boxes = boxes

class DummyYolo:
    def __init__(self, boxes=None):
        self._boxes = boxes or []
    def __call__(self, image, verbose=False):
        return [_YoloResult(self._boxes)]

class DummyImage:
    def __init__(self, h=480,w=640):
        self.shape=(h,w,3)
    def __getitem__(self,_key):
        return self

_UNSET=object()

def _build_plate_service(ocr_results,yolo_boxes=None,decoded=_UNSET):
    if decoded is _UNSET:
        decoded=DummyImage()

    service=PlateDetectionService.__new__(PlateDetectionService)
    service.cv2=DummyCv2(decoded=decoded)
    service.reader=DummyReader(ocr_results)
    service.model=DummyYolo(boxes=yolo_boxes)
    service.plate_pattern=r"^[A-Z0-9-]{5,12}$"
    return service


def test_plate_detection_with_yolo_crop():
    service=_build_plate_service(
        ocr_results=[
            (None,"abc 123",0.65),
            (None,"A1",0.99),
            (None,"XYZ-999",0.91),
        ],
        yolo_boxes=[_Box(50,100,250,160,0.88)],
    )
    result=service.process(b"image-bytes")
    assert result=={"plate_text":"XYZ-999","confidence":0.91,"valid":True}


def test_plate_detection_falls_back_to_whole_image_when_yolo_finds_nothing():
    service=_build_plate_service(
        ocr_results=[(None,"BUD-2025",0.87)],
        yolo_boxes=[],
    )
    result=service.process(b"image-bytes")
    assert result=={"plate_text":"BUD-2025","confidence":0.87,"valid":True}


def test_plate_detection_returns_invalid_when_no_plate_text():
    service=_build_plate_service(
        ocr_results=[(None,"bad",0.7)],
        yolo_boxes=[],
    )
    assert service.process(b"image")=={
        "plate_text":None,
        "confidence":0.0,
        "valid":False,
    }


def test_plate_detection_raises_on_invalid_image():
    service=_build_plate_service(
        ocr_results=[],
        yolo_boxes=[],
        decoded=None,
    )
    with pytest.raises(ValueError,match="Invalid image file"):
        service.process(b"broken")


def test_yolo_low_confidence_box_is_ignored():
    service=_build_plate_service(
        ocr_results=[(None,"ABC-1234",0.93)],
        yolo_boxes=[_Box(0,0,100,50,0.10)],
    )
    result=service.process(b"image")
    assert result=={"plate_text":"ABC-1234","confidence":0.93,"valid":True}