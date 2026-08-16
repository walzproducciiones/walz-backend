from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.auth import get_current_user
from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.order import CheckoutCreate, DeliveryPlanUpdate, OrderCreate, OrderResponse, OrderStatusUpdate, PickupStatusUpdate
from backend.app.services.order_service import (
    cancel_order_by_buyer,
    confirm_pickup_handover_by_seller,
    create_order,
    create_orders_by_seller,
    get_order_by_id,
    get_orders_by_buyer,
    get_orders_received_by_seller,
    schedule_delivery_by_seller,
    update_order_status_by_seller,
    update_pickup_status_by_buyer,
)


router = APIRouter(prefix="/orders", tags=["Orders"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/", response_model=OrderResponse)
def create_new_order(
    order: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_order, error = create_order(db, current_user.id, order)

    if error:
        raise HTTPException(status_code=400, detail=error)

    return new_order


@router.get("/", response_model=List[OrderResponse])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_orders_by_buyer(db, current_user.id)


@router.get("/{order_id}", response_model=OrderResponse)
def get_my_order_detail(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = get_order_by_id(db, order_id, current_user.id)

    if not order:
        raise HTTPException(
            status_code=404,
            detail="Order not found"
        )

    return order

@router.patch("/{order_id}/cancel", response_model=OrderResponse)
def cancel_my_order(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order, error = cancel_order_by_buyer(
        db,
        order_id,
        current_user.id,
    )

    if error == "not_found":
        raise HTTPException(
            status_code=404,
            detail="Pedido no encontrado.",
        )

    if error:
        raise HTTPException(
            status_code=400,
            detail=error,
        )

    return order

@router.get("/seller/received")
def get_received_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_orders_received_by_seller(db, current_user.id)

@router.post("/checkout", response_model=List[OrderResponse])
def create_checkout_orders(
    order: CheckoutCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_orders, error = create_orders_by_seller(
        db,
        current_user.id,
        order,
    )

    if error:
        raise HTTPException(status_code=400, detail=error)

    return new_orders

@router.patch("/seller/{order_id}/status")
def update_received_order_status(
    order_id: UUID,
    status_update: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result, error = update_order_status_by_seller(
        db,
        order_id,
        current_user.id,
        status_update.status,
    )

    if error == "not_found":
        raise HTTPException(
            status_code=404,
            detail="Pedido no encontrado.",
        )

    if error:
        raise HTTPException(status_code=400, detail=error)

    return result


@router.patch("/{order_id}/pickup", response_model=OrderResponse)
def update_my_pickup(
    order_id: UUID,
    update: PickupStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result, error = update_pickup_status_by_buyer(db, order_id, current_user.id, update.action)
    if error == "not_found":
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@router.patch("/seller/{order_id}/pickup-handover")
def confirm_pickup_handover(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result, error = confirm_pickup_handover_by_seller(db, order_id, current_user.id)
    if error == "not_found":
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result

@router.patch("/seller/{order_id}/delivery-plan")
def save_delivery_plan(
    order_id: UUID,
    plan: DeliveryPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result, error = schedule_delivery_by_seller(
        db, order_id, current_user.id, plan
    )
    if error == "not_found":
        raise HTTPException(status_code=404, detail="Pedido no encontrado.")
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result
