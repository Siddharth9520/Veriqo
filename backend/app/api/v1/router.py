from fastapi import APIRouter
from app.api.v1.defects import router as defects_router
from app.api.v1.regression_journeys import router as regression_router
from app.api.v1.replays import router as replays_router
from app.api.v1.target_apps import router as target_apps_router
from app.api.v1.test_runs import router as test_runs_router
from app.core.config import settings

api_router = APIRouter()

api_router.include_router(target_apps_router)
api_router.include_router(test_runs_router)
api_router.include_router(regression_router)
api_router.include_router(defects_router)
api_router.include_router(replays_router)


@api_router.get("/info", summary="API v1 Information")
def get_v1_info():
    """Returns basic service metadata and API version."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
