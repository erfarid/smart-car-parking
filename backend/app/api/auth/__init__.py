from .router import router

# Import route modules so their decorators register endpoints on the shared router.
from . import accounts, staff  # noqa: F401

__all__ = ["router"]
