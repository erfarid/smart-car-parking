from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.session_controller import router as session_router
from app.api.zone_controller import router as zone_router
from app.api.report_controller import router as report_router
from app.api.vehicle_controller import router as vehicle_router
from app.api.upload_controller import router as upload_router
from app.api.payment_controller import router as payment_router
from app.api.auth_controller import router as auth_router

app = FastAPI(title="Smart Parking System - Layered Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(session_router)
app.include_router(zone_router)
app.include_router(report_router)
app.include_router(vehicle_router)
app.include_router(upload_router)
app.include_router(payment_router)
app.include_router(auth_router)


@app.get("/health")
def health():
    return {"status": "ok"}
