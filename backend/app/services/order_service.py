from uuid import UUID

from sqlalchemy.orm import Session, selectinload

from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.schemas.order import OrderCreate


def create_order(db: Session, buyer_id: UUID, order_data: OrderCreate):
    total = 0.0
    order_items = []

    for item in order_data.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()

        if not product:
            return None, f"Product {item.product_id} not found"

        if product.stock < item.quantity:
            return None, f"Not enough stock for {product.name}"

        total += product.price * item.quantity
        order_items.append({
            "product": product,
            "quantity": item.quantity,
            "price_at_purchase": product.price
        })

    new_order = Order(
        buyer_id=buyer_id,
        total_amount=total,
        shipping_address=order_data.shipping_address
    )

    db.add(new_order)
    db.flush()

    for item_data in order_items:
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=item_data["product"].id,
            quantity=item_data["quantity"],
            price_at_purchase=item_data["price_at_purchase"]
        )

        db.add(order_item)
        item_data["product"].stock -= item_data["quantity"]

    db.commit()
    db.refresh(new_order)

    return new_order, None


def get_orders_by_buyer(db: Session, buyer_id: UUID):
    return (
        db.query(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product)
        )
        .filter(Order.buyer_id == buyer_id)
        .order_by(Order.created_at.desc())
        .all()
    )


def get_order_by_id(db: Session, order_id: UUID, buyer_id: UUID):
    return (
        db.query(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product)
        )
        .filter(
            Order.id == order_id,
            Order.buyer_id == buyer_id
        )
        .first()
    )
