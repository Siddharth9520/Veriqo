"""Main application entry point for Veriqo Backend."""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
from typing import AsyncGenerator

from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import setup_logging
from app.db.session import check_db_connection, init_db
from app.schemas.health import HealthResponse, ReadinessResponse

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    setup_logging()
    logger.info("Starting %s v%s in %s mode", settings.PROJECT_NAME, settings.VERSION, settings.ENVIRONMENT)
    try:
        init_db()
        logger.info("Database initialized successfully.")
    except Exception as exc:
        logger.critical("Database initialization failed during startup: %s", exc)

    yield

    # Shutdown
    logger.info("Shutting down %s...", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="Process Health Check",
    status_code=status.HTTP_200_OK,
)
def get_health() -> HealthResponse:
    """Confirms that the FastAPI process is alive and receiving HTTP requests.

    Does not verify external dependencies such as the database.
    """
    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc),
    )


@app.get(
    "/ready",
    response_model=ReadinessResponse,
    tags=["System"],
    summary="Database Connectivity & Readiness Check",
    responses={
        200: {"model": ReadinessResponse, "description": "Database is reachable and ready."},
        503: {"model": ReadinessResponse, "description": "Database is unreachable or degraded."},
    },
)
def get_ready(response: Response) -> ReadinessResponse:
    """Verifies actual connectivity to the database and reports truthful status.

    Returns HTTP 200 when the database is reachable.
    Returns HTTP 503 when the database check fails.
    """
    is_connected = check_db_connection()
    now = datetime.now(timezone.utc)

    if not is_connected:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ReadinessResponse(
            status="unavailable",
            database="disconnected",
            timestamp=now,
        )

    return ReadinessResponse(
        status="ready",
        database="connected",
        timestamp=now,
    )


# Register API routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)
