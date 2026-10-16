from fastapi import APIRouter
from app.api.v1.analytics import router as analytics_router
from app.api.v1.bug_reports import router as bug_reports_router
from app.api.v1.certificates import router as certificates_router
from app.api.v1.defects import router as defects_router
from app.api.v1.integrations import router as integrations_router
from app.api.v1.logs import router as logs_router
from app.api.v1.projects import router as projects_router
from app.api.v1.regression_journeys import router as regression_router
from app.api.v1.replays import router as replays_router
from app.api.v1.target_apps import router as target_apps_router
from app.api.v1.test_library import router as test_library_router
from app.api.v1.test_runs import router as test_runs_router
from app.core.config import settings

api_router = APIRouter()

# Core Domain Routers
api_router.include_router(target_apps_router)
api_router.include_router(projects_router)
api_router.include_router(test_runs_router)
api_router.include_router(regression_router)
api_router.include_router(test_library_router)
api_router.include_router(defects_router)
api_router.include_router(bug_reports_router)
api_router.include_router(replays_router)
api_router.include_router(certificates_router)
api_router.include_router(analytics_router)
api_router.include_router(integrations_router)
api_router.include_router(logs_router)




@api_router.get("/info", summary="API v1 Information")
def get_v1_info():
    """Returns basic service metadata and API version."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }
