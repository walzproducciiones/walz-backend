from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user, require_admin_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.banner import (
    BannerCreate,
    BannerProposalCreate,
    BannerResponse,
    BannerReviewUpdate,
    BannerUpdate,
)
from backend.app.services.product_image_service import upload_banner_image

from backend.app.services.banner_service import (
    create_banner,
    create_banner_proposal,
    get_active_banners,
    get_all_banners,
    get_banner_proposals_by_seller,
    review_banner_proposal,
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
def list_active_banners(
    placement: Optional[
        Literal[
            "CENTRAL_MARKETPLACE",
            "SELLER_SPONSORED",
            "BOTTOM_BAR",
        ]
    ] = "CENTRAL_MARKETPLACE",
    db: Session = Depends(get_db),
):
    return get_active_banners(
        db,
        placement=placement,
    )


@router.get("/admin", response_model=list[BannerResponse])
def list_all_banners(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return get_all_banners(db)


@router.post("/images")
async def upload_new_banner_image(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    try:
        content = await image.read()
        image_url = upload_banner_image(current_user.id, content, image.content_type or "")
        return {"image_url": image_url}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))


@router.post("/proposals", response_model=BannerResponse, status_code=201)
def submit_banner_proposal(
    data: BannerProposalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proposal, error = create_banner_proposal(db, current_user.id, data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return proposal


@router.get("/proposals/mine", response_model=list[BannerResponse])
def list_my_banner_proposals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_banner_proposals_by_seller(db, current_user.id)


@router.patch("/{banner_id}/review", response_model=BannerResponse)
def review_existing_banner_proposal(
    banner_id: UUID,
    data: BannerReviewUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        banner = review_banner_proposal(
            db,
            banner_id,
            admin.id,
            data.status,
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    if not banner:
        raise HTTPException(status_code=404, detail="Propuesta no encontrada.")
    return banner


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
