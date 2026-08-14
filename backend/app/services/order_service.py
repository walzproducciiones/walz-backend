from collections import defaultdict
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from backend.app.models.order import Order, OrderItem
from backend.app.models.product import Product
from backend.app.schemas.order import OrderCreate


def create_order(db: Session, buyer_id: UUID, order_data: OrderCreate):
    quantities_by_product = defaultdict(int)

    for item in order_data.items:
        quantities_by_product[item.product_id] += item.quantity

    try:
        product_ids = list(quantities_by_product.keys())

        products = (
            db.query(Product)
            .filter(Product.id.in_(product_ids))
            .with_for_update()
            .all()
        )

        products_by_id = {
            product.id: product
            for product in products
        }

        order_items = []
        total = 0.0

        for product_id, quantity in quantities_by_product.items():
            product = products_by_id.get(product_id)

            if not product or not product.is_active:
                db.rollback()
                return None, "El producto solicitado no esta disponible."

            if product.stock is None or product.stock < quantity:
                db.rollback()
                return (
                    None,
                    f"Stock insuficiente para {product.name}. "
                    f"Disponible: {max(product.stock or 0, 0)}.",
                )

            price = float(product.price)
            total += price * quantity

            order_items.append({
                "product": product,
                "quantity": quantity,
                "price_at_purchase": price,
            })

        new_order = Order(
            buyer_id=buyer_id,
            total_amount=round(total, 2),
            shipping_address=order_data.shipping_address,
        )

        db.add(new_order)
        db.flush()

        for item_data in order_items:
            product = item_data["product"]

            db.add(OrderItem(
                order_id=new_order.id,
                product_id=product.id,
                quantity=item_data["quantity"],
                price_at_purchase=item_data["price_at_purchase"],
            ))

            product.stock -= item_data["quantity"]

        db.commit()

        return get_order_by_id(db, new_order.id, buyer_id), None

    except SQLAlchemyError:
        db.rollback()
        raise


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
            Order.buyer_id == buyer_id,
        )
        .first()
    )