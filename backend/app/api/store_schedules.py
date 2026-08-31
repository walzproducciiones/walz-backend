from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.store_schedule import (
    StoreScheduleResponse,
    StoreScheduleStatusResponse,
    StoreScheduleUpdate,
)
from backend.app.services.store_schedule_service import (
    get_store_schedule_by_owner,
    get_store_schedule_status,
    save_store_schedule,
)
from backend.app.services.store_service import get_store_by_owner


router = APIRouter(
    prefix="/store-schedules",
    tags=["Store schedules"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def require_schedule_store_manager(
    current_user: User = Depends(get_current_user),
):
    role = str(current_user.role or "").upper()

    if role not in {"VENDEDOR", "SELLER"}:
        raise HTTPException(
            status_code=403,
            detail="Se requiere una cuenta vendedora.",
        )

    return current_user


@router.get(
    "/mine",
    response_model=StoreScheduleResponse,
)
def get_my_store_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_schedule_store_manager
    ),
):
    try:
        return get_store_schedule_by_owner(
            db,
            current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )


@router.get(
    "/mine/status",
    response_model=StoreScheduleStatusResponse,
)
def get_my_store_schedule_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_schedule_store_manager
    ),
):
    store = get_store_by_owner(
        db,
        current_user.id,
    )

    if not store:
        raise HTTPException(
            status_code=404,
            detail="Tienda no encontrada.",
        )

    return get_store_schedule_status(
        db,
        store,
    )


@router.put(
    "/mine",
    response_model=StoreScheduleResponse,
)
def update_my_store_schedule(
    data: StoreScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_schedule_store_manager
    ),
):
    try:
        return save_store_schedule(
            db,
            current_user.id,
            data,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.get(
    "/seller/{seller_id}/status",
    response_model=StoreScheduleStatusResponse,
)
def get_public_store_schedule_status(
    seller_id: UUID,
    db: Session = Depends(get_db),
):
    store = get_store_by_owner(
        db,
        seller_id,
    )

    if not store or not store.is_active:
        raise HTTPException(
            status_code=404,
            detail="Tienda no encontrada.",
        )

    return get_store_schedule_status(
        db,
        store,
    )


@router.get(
    "/seller/{seller_id}",
    response_model=StoreScheduleResponse,
)
def get_public_store_schedule(
    seller_id: UUID,
    db: Session = Depends(get_db),
):
    store = get_store_by_owner(db, seller_id)

    if not store or not store.is_active:
        raise HTTPException(
            status_code=404,
            detail="Tienda no encontrada.",
        )

    return get_store_schedule_by_owner(
        db,
        seller_id,
    )
