from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user, require_admin_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.payment import (
    BuyerStorePaymentMethodsResponse,
    PaymentCreateRequest,
    PaymentResponse,
    PaymentSellerStatusUpdate,
    StorePaymentMethodsResponse,
    StorePaymentMethodsUpdate,
)
from backend.app.services.payment_service import (
    create_payment_for_order,
    get_payment_configuration,
    get_payments_by_buyer,
    get_payments_by_seller,
    get_payments_for_admin,
    get_store_payment_methods_by_owner,
    get_store_payment_methods_for_buyer,
    report_payment_by_buyer,
    review_payment_by_seller,
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


def require_payment_buyer(
    current_user: User = Depends(get_current_user),
):
    role = str(
        current_user.role or ""
    ).strip().upper()

    if role != "COMPRADOR":
        raise HTTPException(
            status_code=403,
            detail="Se requiere una cuenta compradora.",
        )

    return current_user


def require_payment_seller(
    current_user: User = Depends(get_current_user),
):
    role = str(
        current_user.role or ""
    ).strip().upper()

    if role not in {"VENDEDOR", "SELLER"}:
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


# ============================================================
# PAYMENT - COMPRADOR
# ============================================================

@router.get(
    "/stores/{store_id}/methods",
    response_model=BuyerStorePaymentMethodsResponse,
)
def get_buyer_store_payment_methods(
    store_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_payment_buyer
    ),
):
    try:
        return get_store_payment_methods_for_buyer(
            db,
            store_id,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )


@router.post(
    "/orders/{order_id}",
    response_model=PaymentResponse,
)
def create_my_order_payment(
    order_id: UUID,
    data: PaymentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_payment_buyer
    ),
):
    try:
        return create_payment_for_order(
            db,
            order_id,
            current_user.id,
            data.method,
        )

    except ValueError as error:
        message = str(error)

        if message == "Pedido no encontrado.":
            raise HTTPException(
                status_code=404,
                detail=message,
            )

        raise HTTPException(
            status_code=400,
            detail=message,
        )


@router.get(
    "/mine",
    response_model=list[PaymentResponse],
)
def get_my_payments(
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_payment_buyer
    ),
):
    return get_payments_by_buyer(
        db,
        current_user.id,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/{payment_id}/report",
    response_model=PaymentResponse,
)
def report_my_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_payment_buyer
    ),
):
    try:
        return report_payment_by_buyer(
            db,
            payment_id,
            current_user.id,
        )
    except ValueError as error:
        message = str(error)

        if message == "Pago no encontrado.":
            raise HTTPException(
                status_code=404,
                detail=message,
            )

        raise HTTPException(
            status_code=400,
            detail=message,
        )


# ============================================================
# PAYMENT - VENDEDOR
# ============================================================

@router.get(
    "/seller/mine",
    response_model=list[PaymentResponse],
)
def get_seller_payments(
    limit: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_payment_seller
    ),
):
    return get_payments_by_seller(
        db,
        current_user.id,
        limit=limit,
        offset=offset,
    )


@router.patch(
    "/seller/{payment_id}/status",
    response_model=PaymentResponse,
)
def review_seller_payment(
    payment_id: UUID,
    data: PaymentSellerStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_payment_seller
    ),
):
    try:
        return review_payment_by_seller(
            db,
            payment_id,
            current_user.id,
            data.status,
        )
    except ValueError as error:
        message = str(error)

        if message == "Pago no encontrado.":
            raise HTTPException(
                status_code=404,
                detail=message,
            )

        raise HTTPException(
            status_code=400,
            detail=message,
        )


# ============================================================
# PAYMENT - WALZ CENTRAL
# SOLO LECTURA
# ============================================================

@router.get(
    "/admin",
    response_model=list[PaymentResponse],
)
def get_admin_payments(
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
):
    return get_payments_for_admin(
        db,
        limit=limit,
        offset=offset,
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
