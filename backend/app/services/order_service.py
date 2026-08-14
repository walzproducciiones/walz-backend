from collections import defaultdict
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from backend.app.models.order import Order, OrderItem, OrderStatus
from backend.app.models.product import Product
from backend.app.services.product_service import get_effective_product_price
from backend.app.schemas.order import OrderCreate
from backend.app.services.order_status_service import can_transition_order_status


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

        seller_ids = {
            product.seller_id
            for product in products
        }

        if len(seller_ids) > 1:
            db.rollback()
            return None, "El carrito contiene productos de distintos vendedores. Usa el checkout agrupado."

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

            price = get_effective_product_price(product)
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

def cancel_order_by_buyer(
    db: Session,
    order_id: UUID,
    buyer_id: UUID,
):
    try:
        order = (
            db.query(Order)
            .filter(
                Order.id == order_id,
                Order.buyer_id == buyer_id,
            )
            .with_for_update()
            .first()
        )

        if not order:
            db.rollback()
            return None, "not_found"

        if order.status != OrderStatus.PENDING:
            db.rollback()
            return None, "Solo se pueden cancelar pedidos pendientes."

        product_ids = [item.product_id for item in order.items]
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

        for item in order.items:
            product = products_by_id.get(item.product_id)
            if product:
                product.stock = max(product.stock or 0, 0) + item.quantity

        order.status = OrderStatus.CANCELLED
        db.commit()

        return get_order_by_id(db, order.id, buyer_id), None

    except SQLAlchemyError:
        db.rollback()
        raise

def get_orders_received_by_seller(db: Session, seller_id: UUID):
    orders = (
        db.query(Order)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .join(Product, Product.id == OrderItem.product_id)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.items).selectinload(OrderItem.product),
        )
        .filter(Product.seller_id == seller_id)
        .distinct()
        .order_by(Order.created_at.desc())
        .all()
    )

    received_orders = []

    for order in orders:
        seller_items = []
        seller_total = 0.0

        for item in order.items:
            if not item.product or item.product.seller_id != seller_id:
                continue

            subtotal = round(
                float(item.price_at_purchase) * item.quantity,
                2,
            )
            seller_total += subtotal

            seller_items.append({
                "id": str(item.id),
                "product_id": str(item.product_id),
                "product_name": item.product.name,
                "quantity": item.quantity,
                "price_at_purchase": float(item.price_at_purchase),
                "subtotal": subtotal,
            })

        received_orders.append({
            "id": str(order.id),
            "status": order.status.value,
            "created_at": order.created_at,
            "shipping_address": order.shipping_address,
            "seller_total": round(seller_total, 2),
            "buyer": {
                "name": f"{order.buyer.first_name} {order.buyer.last_name}",
                "email": order.buyer.email,
                "phone": order.buyer.phone,
            },
            "items": seller_items,
        })

    return received_orders

def create_orders_by_seller(
    db: Session,
    buyer_id: UUID,
    order_data: OrderCreate,
):
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
        items_by_seller = defaultdict(list)

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

            price = get_effective_product_price(product)
            items_by_seller[product.seller_id].append({
                "product": product,
                "quantity": quantity,
                "price_at_purchase": price,
            })

        created_order_ids = []

        for seller_items in items_by_seller.values():
            seller_total = round(
                sum(
                    item["price_at_purchase"] * item["quantity"]
                    for item in seller_items
                ),
                2,
            )
            new_order = Order(
                buyer_id=buyer_id,
                total_amount=seller_total,
                shipping_address=order_data.shipping_address,
            )
            db.add(new_order)
            db.flush()
            created_order_ids.append(new_order.id)

            for item_data in seller_items:
                product = item_data["product"]
                db.add(OrderItem(
                    order_id=new_order.id,
                    product_id=product.id,
                    quantity=item_data["quantity"],
                    price_at_purchase=item_data["price_at_purchase"],
                ))
                product.stock -= item_data["quantity"]

        db.commit()

        created_orders = [
            get_order_by_id(db, order_id, buyer_id)
            for order_id in created_order_ids
        ]
        return created_orders, None

    except SQLAlchemyError:
        db.rollback()
        raise

def update_order_status_by_seller(
    db: Session,
    order_id: UUID,
    seller_id: UUID,
    requested_status: str,
):
    try:
        try:
            new_status = OrderStatus(requested_status.lower())
        except (ValueError, AttributeError):
            return None, "Estado de pedido no valido."

        order = (
            db.query(Order)
            .filter(Order.id == order_id)
            .with_for_update()
            .first()
        )

        if not order:
            db.rollback()
            return None, "not_found"

        product_ids = [item.product_id for item in order.items]
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

        if (
            len(products_by_id) != len(set(product_ids))
            or any(
                product.seller_id != seller_id
                for product in products
            )
        ):
            db.rollback()
            return None, "not_found"

        current_status = order.status

        if not can_transition_order_status(current_status, new_status):
            db.rollback()
            return (
                None,
                "No se puede realizar ese cambio desde el estado actual.",
            )

        if (
            new_status == OrderStatus.CANCELLED
            and current_status != OrderStatus.CANCELLED
        ):
            for item in order.items:
                product = products_by_id.get(item.product_id)
                if product:
                    product.stock = max(product.stock or 0, 0) + item.quantity

        order.status = new_status
        db.commit()

        return {
            "id": str(order.id),
            "status": order.status.value,
        }, None

    except SQLAlchemyError:
        db.rollback()
        raise
