import sys
import os

# Add backend to Python path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from app.api.session_controller import router as session_router  # noqa: E402
from app.api.zone_controller import router as zone_router  # noqa: E402
from app.api.report_controller import router as report_router  # noqa: E402
from app.api.vehicle_controller import router as vehicle_router  # noqa: E402
from app.api.upload_controller import router as upload_router  # noqa: E402

app = FastAPI(title="Smart Parking System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes prefixed with /api for Vercel
app.include_router(session_router, prefix="/api")
app.include_router(zone_router, prefix="/api")
app.include_router(report_router, prefix="/api")
app.include_router(vehicle_router, prefix="/api")
app.include_router(upload_router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}
