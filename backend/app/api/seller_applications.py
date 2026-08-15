from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user, require_admin_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.seller_application import (
    SellerApplicationAdminResponse,
    SellerApplicationCreate,
    SellerApplicationResponse,
    SellerApplicationReview,
)
from backend.app.services.seller_application_service import (
    get_application_by_user,
    list_seller_applications_for_admin,
    review_seller_application,
    submit_seller_application,
)


router = APIRouter(prefix="/seller-applications", tags=["Seller applications"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/mine", response_model=SellerApplicationResponse | None)
def get_my_seller_application(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_application_by_user(db, current_user.id)


@router.post("/mine", response_model=SellerApplicationResponse, status_code=201)
def create_my_seller_application(
    data: SellerApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    application, error = submit_seller_application(db, current_user, data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return application


@router.get("/admin", response_model=list[SellerApplicationAdminResponse])
def get_seller_applications_for_admin(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return list_seller_applications_for_admin(db)


@router.patch("/admin/{application_id}", response_model=SellerApplicationResponse)
def review_application_as_admin(
    application_id: UUID,
    data: SellerApplicationReview,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    application = review_seller_application(db, application_id, admin.id, data)
    if not application:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    return application