"""Target applications management endpoints."""

from typing import List
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.target_app import TargetApp
from app.schemas.target_app import TargetAppCreate, TargetAppRead

router = APIRouter(prefix="/target-apps", tags=["Target Apps"])


def validate_app_url(url: str) -> None:
    """Validate that the target URL has a valid HTTP/HTTPS scheme and network location."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL must be a valid HTTP or HTTPS address with a host.",
        )


@router.post(
    "",
    response_model=TargetAppRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register Target Application",
)
def create_target_app(
    payload: TargetAppCreate,
    db: Session = Depends(get_db),
) -> TargetApp:
    """Register a new web application under test."""
    name_clean = payload.name.strip()
    if not name_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Application name cannot be empty or whitespace.",
        )

    validate_app_url(payload.url)

    target_app = TargetApp(
        name=name_clean,
        url=payload.url.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(target_app)
    db.commit()
    db.refresh(target_app)
    return target_app


@router.get(
    "",
    response_model=List[TargetAppRead],
    summary="List Registered Applications",
)
def list_target_apps(
    db: Session = Depends(get_db),
) -> List[TargetApp]:
    """Retrieve all registered target applications."""
    return db.query(TargetApp).order_by(TargetApp.id.desc()).all()


@router.get(
    "/{app_id}",
    response_model=TargetAppRead,
    summary="Get Target Application by ID",
)
def get_target_app(
    app_id: int,
    db: Session = Depends(get_db),
) -> TargetApp:
    """Retrieve details for a specific registered target application."""
    target_app = db.query(TargetApp).filter(TargetApp.id == app_id).first()
    if not target_app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Target application with ID {app_id} not found.",
        )
    return target_app
