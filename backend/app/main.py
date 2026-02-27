from fastapi import FastAPI
from app.api.session_controller import router as session_router
from app.api.zone_controller import router as zone_router
from app.api.report_controller import router as report_router

app = FastAPI(title="Smart Parking System - Layered Backend")

app.include_router(session_router)
app.include_router(zone_router)
app.include_router(report_router)

@app.get("/health")
def health():
    return {"status": "ok"}