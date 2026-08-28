from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.payment import (
    StorePaymentMethodsResponse,
    StorePaymentMethodsUpdate,
)
from backend.app.services.payment_service import (
    get_payment_configuration,
    get_store_payment_methods_by_owner,
    save_store_payment_methods,
)


router = APIRouter(prefix="/payments", tags=["Payments"])


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def require_payment_store_manager(
    current_user: User = Depends(get_current_user),
):
    role = str(current_user.role or "").upper()

    if role not in {"VENDEDOR", "SELLER", "ADMIN"}:
        raise HTTPException(
            status_code=403,
            detail="Se requiere una cuenta vendedora.",
        )

    return current_user


@router.get("/configuration")
def payment_configuration():
    return get_payment_configuration()


@router.get(
    "/methods/mine",
    response_model=StorePaymentMethodsResponse,
)
def get_my_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_payment_store_manager
    ),
):
    try:
        return get_store_payment_methods_by_owner(
            db,
            current_user.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )


@router.put(
    "/methods/mine",
    response_model=StorePaymentMethodsResponse,
)
def update_my_payment_methods(
    data: StorePaymentMethodsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_payment_store_manager
    ),
):
    try:
        return save_store_payment_methods(
            db,
            current_user.id,
            data.methods,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )


@router.post("/create-preference")
def create_preference():
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Los pagos online todavia no estan habilitados. "
            "La orden no fue creada ni se desconto stock."
        ),
    )
