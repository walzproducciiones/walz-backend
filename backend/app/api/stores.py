from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user, require_admin_user
from backend.app.database.session import SessionLocal
from backend.app.models.seller_application import SellerApplication
from backend.app.models.user import User
from backend.app.schemas.store import (
    StoreAdminSellerDetailResponse,
    StoreAdminStatusUpdate,
    StoreProfileUpdate,
    StoreResponse,
    StoreSellerStatusUpdate,
)
from backend.app.services.store_service import (
    change_store_status_by_admin,
    change_store_status_by_seller,
    get_active_stores,
    get_all_stores,
    get_store_by_owner,
    get_store_by_slug,
    save_store_profile,
)
from backend.app.services.product_image_service import upload_store_logo


router = APIRouter(prefix="/stores", tags=["Stores"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def require_store_manager(current_user: User = Depends(get_current_user)):
    role = str(current_user.role or "").upper()
    if role not in {"VENDEDOR", "SELLER", "ADMIN"}:
        raise HTTPException(
            status_code=403,
            detail="Se requiere una cuenta vendedora.",
        )
    return current_user


def require_seller_user(current_user: User = Depends(get_current_user)):
    role = str(current_user.role or "").upper()

    if role not in {"VENDEDOR", "SELLER"}:
        raise HTTPException(
            status_code=403,
            detail="Se requiere una cuenta vendedora.",
        )

    return current_user



@router.get("/mine", response_model=StoreResponse | None)
def get_my_store(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_store_manager),
):
    return get_store_by_owner(db, current_user.id)


@router.post("/logo")
async def upload_my_store_logo(
    image: UploadFile = File(...),
    current_user: User = Depends(require_store_manager),
):
    content = await image.read()
    try:
        logo_url = upload_store_logo(current_user.id, content, image.content_type or "")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))
    return {"logo_url": logo_url}


@router.put("/mine", response_model=StoreResponse)
def update_my_store(
    data: StoreProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_store_manager),
):
    try:
        return save_store_profile(db, current_user.id, data)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))



@router.patch("/mine/status", response_model=StoreResponse)
def update_my_store_status(
    data: StoreSellerStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_seller_user),
):
    try:
        return change_store_status_by_seller(
            db,
            current_user.id,
            data.status,
            data.reason,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )



@router.get("/admin", response_model=list[StoreResponse])
def get_admin_stores(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return get_all_stores(db)


@router.get("/admin/seller/{seller_id}", response_model=StoreAdminSellerDetailResponse)
def get_admin_seller_detail(
    seller_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    store = get_store_by_owner(db, seller_id)

    if not store:
        raise HTTPException(
            status_code=404,
            detail="Tienda del vendedor no encontrada.",
        )

    seller = db.query(User).filter(User.id == seller_id).first()

    if not seller:
        raise HTTPException(
            status_code=404,
            detail="Cuenta vendedora no encontrada.",
        )

    application = (
        db.query(SellerApplication)
        .filter(SellerApplication.user_id == seller_id)
        .first()
    )

    return {
        "store": store,
        "seller": seller,
        "application": application,
    }

@router.patch("/admin/{store_id}/status", response_model=StoreResponse)
def update_store_status_admin(
    store_id: UUID,
    data: StoreAdminStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    try:
        return change_store_status_by_admin(
            db,
            store_id,
            data.status,
            data.reason,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )



@router.get("/public", response_model=list[StoreResponse])
def get_public_stores(db: Session = Depends(get_db)):
    return get_active_stores(db)


@router.get("/slug/{slug}", response_model=StoreResponse)
def get_public_store_by_slug(slug: str, db: Session = Depends(get_db)):
    store = get_store_by_slug(db, str(slug or "").strip().lower())
    if not store or not store.is_active:
        raise HTTPException(status_code=404, detail="Tienda no encontrada.")
    return store


@router.get("/seller/{seller_id}", response_model=StoreResponse)
def get_public_store(seller_id: UUID, db: Session = Depends(get_db)):
    store = get_store_by_owner(db, seller_id)
    if not store or not store.is_active:
        raise HTTPException(status_code=404, detail="Tienda no encontrada.")
    return store