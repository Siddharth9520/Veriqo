"""API v1 master router."""

from fastapi import APIRouter
from app.core.config import settings

api_router = APIRouter()


@api_router.get("/info", summary="API v1 Information")
def get_v1_info():
    """Returns basic service metadata and API version."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
