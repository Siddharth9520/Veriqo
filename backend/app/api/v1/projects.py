"""Projects API router — maps TargetApp records to frontend-compatible Project representations."""

from datetime import datetime
import re
from typing import List, Optional
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.defect import Defect
from app.models.target_app import TargetApp
from app.models.test_run import TestRun

router = APIRouter(prefix="/projects", tags=["Projects"])


class CoverageMatrixItem(BaseModel):
    name: str
    percentage: int


class ProjectResponse(BaseModel):
    id: str
    name: str
    slug: str
    domain: str
    environment: str = "Staging"
    health: str = "healthy"
    healthLabel: str = "Healthy"
    lastExecution: str = "Ready"
    duration: str = "Autonomous"
    passRate: int = 100
    openDefects: int = 0
    openDefectsLabel: str = "0 Bugs"
    testCount: int = 1
    swarmMode: str = "Deep Heuristic"
    icon: str = "dns"
    coverageMatrix: List[CoverageMatrixItem] = []


class ProjectCreateRequest(BaseModel):
    name: str
    domain: str
    environment: Optional[str] = "Staging"
    swarmMode: Optional[str] = "Deep Heuristic"


def map_target_app_to_project(
    app: TargetApp,
    runs: List[TestRun],
    defects: List[Defect],
) -> ProjectResponse:
    app_runs = [r for r in runs if r.target_app_id == app.id]
    run_ids = {r.id for r in app_runs}
    app_defects = [d for d in defects if d.test_run_id in run_ids]

    passed_runs = len([r for r in app_runs if r.status == "passed"])
    pass_rate = round((passed_runs / len(app_runs)) * 100) if app_runs else 100

    open_defects = len([d for d in app_defects if d.status not in ("RESOLVED", "CLOSED")])

    parsed = urlparse(app.url)
    domain = parsed.netloc or app.url.replace("https://", "").replace("http://", "").split("/")[0]

    slug = re.sub(r"[^a-z0-9]+", "-", app.name.lower()).strip("-") or f"app-{app.id}"

    last_run = app_runs[0] if app_runs else None
    if last_run:
        last_exec = (
            last_run.completed_at.strftime("%H:%M:%S UTC")
            if last_run.completed_at
            else "In-Flight"
        )
    else:
        last_exec = "Ready"

    health = "critical_regression" if open_defects > 0 else "healthy"
    health_label = f"{open_defects} Regressions Detected" if open_defects > 0 else "Healthy"

    return ProjectResponse(
        id=str(app.id),
        name=app.name,
        slug=slug,
        domain=domain,
        environment="Staging",
        health=health,
        healthLabel=health_label,
        lastExecution=last_exec,
        duration="Autonomous",
        passRate=pass_rate,
        openDefects=open_defects,
        openDefectsLabel=f"{open_defects} Bugs",
        testCount=max(len(app_runs), 1),
        swarmMode="Deep Heuristic",
        icon="dns",
        coverageMatrix=[
            CoverageMatrixItem(name="Core Landing & Nav", percentage=pass_rate),
            CoverageMatrixItem(name="Autonomous Route Discovery", percentage=pass_rate),
        ],
    )


@router.get(
    "",
    response_model=List[ProjectResponse],
    summary="List Projects with Telemetry",
)
def list_projects(
    db: Session = Depends(get_db),
) -> List[ProjectResponse]:
    """Retrieve all target apps formatted as rich Project records with live telemetry."""
    apps = db.query(TargetApp).order_by(TargetApp.id.desc()).all()
    runs = db.query(TestRun).order_by(TestRun.id.desc()).all()
    defects = db.query(Defect).order_by(Defect.id.desc()).all()

    return [map_target_app_to_project(app, runs, defects) for app in apps]


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register Project",
)
def create_project(
    payload: ProjectCreateRequest,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Registers a new project into the target apps registry."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Project name cannot be empty.",
        )

    target_url = payload.domain.strip()
    if not target_url.startswith("http://") and not target_url.startswith("https://"):
        target_url = f"https://{target_url}"

    parsed = urlparse(target_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Domain must resolve to a valid HTTP or HTTPS location.",
        )

    app = TargetApp(
        name=name_clean,
        url=target_url,
        description=f"Environment: {payload.environment or 'Staging'} | Swarm: {payload.swarmMode or 'Deep Heuristic'}",
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    return map_target_app_to_project(app, [], [])


@router.get(
    "/{slug_or_id}",
    response_model=ProjectResponse,
    summary="Get Project by Slug or ID",
)
def get_project(
    slug_or_id: str,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """Retrieve a single project by numeric ID or URL-friendly slug."""
    apps = db.query(TargetApp).all()
    runs = db.query(TestRun).order_by(TestRun.id.desc()).all()
    defects = db.query(Defect).order_by(Defect.id.desc()).all()

    target_app = None
    for a in apps:
        slug = re.sub(r"[^a-z0-9]+", "-", a.name.lower()).strip("-")
        if slug == slug_or_id or str(a.id) == slug_or_id:
            target_app = a
            break

    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{slug_or_id}' not found.",
        )

    return map_target_app_to_project(target_app, runs, defects)
