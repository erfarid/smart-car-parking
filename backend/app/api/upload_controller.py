from fastapi import APIRouter, HTTPException, UploadFile, File

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/plate-image")
async def upload_plate_image(file: UploadFile = File(...)):
    try:
        from app.services.plate_detection_service import PlateDetectionService

        image_bytes = await file.read()
        detector = PlateDetectionService()
        result = detector.process(image_bytes)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
