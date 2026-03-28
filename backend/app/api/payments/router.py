from fastapi import APIRouter

from .monitoring import router as monitoring_router
from .notices import router as notices_router
from .transactions import router as transactions_router

router = APIRouter(prefix="/payments", tags=["payments"])
router.include_router(transactions_router)
router.include_router(notices_router)
router.include_router(monitoring_router)
