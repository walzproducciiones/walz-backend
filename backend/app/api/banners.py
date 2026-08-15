from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.auth import require_admin_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.banner import BannerCreate, BannerResponse, BannerUpdate
from backend.app.services.banner_service import (
    create_banner,
    get_active_banners,
    get_all_banners,
    update_banner,
)


router = APIRouter(prefix="/banners", tags=["Banners"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/active", response_model=list[BannerResponse])
def list_active_banners(db: Session = Depends(get_db)):
    return get_active_banners(db)


@router.get("/admin", response_model=list[BannerResponse])
def list_all_banners(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return get_all_banners(db)


@router.post("/", response_model=BannerResponse, status_code=201)
def create_new_banner(
    data: BannerCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return create_banner(db, admin.id, data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.patch("/{banner_id}", response_model=BannerResponse)
def update_existing_banner(
    banner_id: UUID,
    data: BannerUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        banner = update_banner(db, banner_id, data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    if not banner:
        raise HTTPException(status_code=404, detail="Banner no encontrado.")
    return banner