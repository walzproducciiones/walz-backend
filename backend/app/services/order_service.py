from collections import defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from backend.app.models.order import Order, OrderItem, OrderStatus
from backend.app.models.payment import Payment, PaymentStatus
from backend.app.models.product import Product
from backend.app.models.store import Store
from backend.app.services.product_service import get_effective_product_price
from backend.app.schemas.order import CheckoutCreate, DeliveryPlanDecision, DeliveryPlanUpdate, DeliveryResponsibleUpdate
from backend.app.services.order_status_service import can_transition_order_status


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


def _cancel_open_payments_for_order(
    db: Session,
    order_id: UUID,
):
    payments = (
        db.query(Payment)
        .filter(
            Payment.order_id == order_id,
            Payment.status.in_({
                PaymentStatus.PENDING,
                PaymentStatus.REPORTED,
            }),
        )
        .with_for_update()
        .all()
    )

    if not payments:
        return

    cancelled_at = datetime.now(timezone.utc)

    for payment in payments:
        payment.status = PaymentStatus.CANCELLED

        if not payment.cancelled_at:
            payment.cancelled_at = cancelled_at


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

        _cancel_open_payments_for_order(
            db,
            order.id,
        )

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
            "updated_at": order.updated_at,
            "shipping_address": order.shipping_address,
            "pickup_status": order.pickup_status,
            "pickup_ready_at": order.pickup_ready_at,
            "pickup_buyer_going_at": order.pickup_buyer_going_at,
            "pickup_buyer_arrived_at": order.pickup_buyer_arrived_at,
            "pickup_seller_handed_at": order.pickup_seller_handed_at,
            "pickup_buyer_received_at": order.pickup_buyer_received_at,
            "delivery_plan_status": order.delivery_plan_status,
            "delivery_buyer_requested_date": order.delivery_buyer_requested_date,
            "delivery_buyer_requested_window": order.delivery_buyer_requested_window,
            "delivery_transport_type": order.delivery_transport_type,
            "delivery_estimated_date": order.delivery_estimated_date,
            "delivery_time_window": order.delivery_time_window,
            "delivery_scheduled_at": order.delivery_scheduled_at,
            "courier_name": order.courier_name,
            "courier_phone": order.courier_phone,
            "courier_photo_url": order.courier_photo_url,
            "courier_vehicle": order.courier_vehicle,
            "carrier_company": order.carrier_company,
            "delivery_tracking_code": order.delivery_tracking_code,
            "courier_assigned_at": order.courier_assigned_at,
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
    order_data: CheckoutCreate,
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
            price_money = Decimal(
                str(price)
            ).quantize(
                Decimal("0.01")
            )

            items_by_seller[product.seller_id].append({
                "product": product,
                "quantity": quantity,
                "price_at_purchase": float(price_money),
                "price_money": price_money,
            })

        delivery_by_seller = {}
        for choice in order_data.deliveries:
            if choice.seller_id in delivery_by_seller:
                db.rollback()
                return None, "Hay una modalidad de entrega repetida para una tienda."
            delivery_by_seller[choice.seller_id] = choice

        seller_ids = list(items_by_seller.keys())
        seller_id_set = set(seller_ids)

        stores = (
            db.query(Store)
            .filter(Store.owner_id.in_(seller_ids))
            .all()
        )

        stores_by_owner = {
            store.owner_id: store
            for store in stores
        }

        missing_store_sellers = [
            seller_id
            for seller_id in seller_ids
            if seller_id not in stores_by_owner
        ]

        if missing_store_sellers:
            db.rollback()
            return (
                None,
                "Uno de los vendedores no tiene una tienda "
                "configurada para recibir pedidos.",
            )

        extra_delivery_sellers = (
            set(delivery_by_seller.keys())
            - seller_id_set
        )

        if extra_delivery_sellers:
            db.rollback()
            return (
                None,
                "Hay una modalidad de entrega para una tienda "
                "que no pertenece al carrito.",
            )

        for seller_id in seller_ids:
            choice = delivery_by_seller.get(seller_id)
            if not choice:
                db.rollback()
                return None, "Selecciona una forma de entrega para cada tienda."
            store = stores_by_owner[seller_id]
            delivery_allowed = bool(
                store.delivery_enabled
            )
            pickup_allowed = bool(
                store.pickup_enabled
            )
            if choice.method == "delivery" and not delivery_allowed:
                db.rollback()
                return None, "Una tienda no ofrece envio a domicilio."
            if choice.method == "pickup" and not pickup_allowed:
                db.rollback()
                return None, "Una tienda no ofrece retiro en el local."
            if choice.method == "delivery":
                tomorrow_argentina = datetime.now(timezone(timedelta(hours=-3))).date() + timedelta(days=1)
                if not choice.requested_date or not choice.requested_time_window:
                    db.rollback()
                    return None, "Selecciona fecha y franja horaria para cada envio."
                if choice.requested_date < tomorrow_argentina:
                    db.rollback()
                    return None, "La fecha preferida debe ser desde manana en adelante."

        created_order_ids = []

        for seller_id, seller_items in items_by_seller.items():
            items_subtotal = sum(
                (
                    item["price_money"]
                    * item["quantity"]
                    for item in seller_items
                ),
                Decimal("0.00"),
            ).quantize(
                Decimal("0.01")
            )

            # V1: todavia no existe precio de envio
            # ni descuento global del pedido.
            shipping_amount = Decimal("0.00")
            discount_amount = Decimal("0.00")

            payable_amount = (
                items_subtotal
                + shipping_amount
                - discount_amount
            ).quantize(
                Decimal("0.01")
            )

            delivery_choice = delivery_by_seller[
                seller_id
            ]

            store = stores_by_owner[seller_id]

            new_order = Order(
                buyer_id=buyer_id,

                # Compatibilidad con el campo historico.
                total_amount=float(payable_amount),

                # Snapshot financiero/comercial nuevo.
                store_id=store.id,
                fulfillment_method=delivery_choice.method,
                payment_required=True,
                items_subtotal=items_subtotal,
                shipping_amount=shipping_amount,
                discount_amount=discount_amount,
                payable_amount=payable_amount,
                currency="ARS",

                shipping_address=delivery_choice.shipping_address,

                delivery_plan_status=(
                    "requested"
                    if delivery_choice.method == "delivery"
                    else None
                ),

                delivery_buyer_requested_date=(
                    delivery_choice.requested_date
                    if delivery_choice.method == "delivery"
                    else None
                ),

                delivery_buyer_requested_window=(
                    delivery_choice.requested_time_window
                    if delivery_choice.method == "delivery"
                    else None
                ),
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
        is_pickup = "metodo: retiro en el local" in str(order.shipping_address or "").lower()

        # Los medios que requieren aviso del comprador deben estar
        # verificados por el vendedor antes de despachar.
        if new_status == OrderStatus.SHIPPED:
            payment = (
                db.query(Payment)
                .filter(Payment.order_id == order.id)
                .order_by(Payment.created_at.desc())
                .with_for_update()
                .first()
            )

            if bool(getattr(order, "payment_required", False)) and not payment:
                db.rollback()
                return (
                    None,
                    "Este pedido requiere un pago registrado antes de poder despacharse.",
                )

            if not is_pickup and payment:
                payment_method = str(
                    payment.method or ""
                ).strip().upper()

                if payment_method in {
                    "BANK_TRANSFER",
                    "CUENTA_DNI",
                }:
                    payment_status = payment.status

                    if not isinstance(
                        payment_status,
                        PaymentStatus,
                    ):
                        try:
                            payment_status = PaymentStatus(
                                str(payment_status or "")
                                .strip()
                                .lower()
                            )
                        except ValueError:
                            db.rollback()
                            return (
                                None,
                                "El estado del pago no es valido.",
                            )

                    if payment_status != PaymentStatus.APPROVED:
                        db.rollback()
                        return (
                            None,
                            "Debes verificar y aprobar el pago "
                            "antes de despachar este pedido.",
                        )

        if (
            not is_pickup
            and new_status == OrderStatus.SHIPPED
            and not (order.delivery_transport_type and order.delivery_estimated_date and order.delivery_time_window)
        ):
            db.rollback()
            return None, "Primero debes informar la fecha, la franja horaria y el medio de envio."
        if (
            not is_pickup
            and new_status == OrderStatus.SHIPPED
            and order.delivery_plan_status != "coordinated"
        ):
            db.rollback()
            return None, "El comprador debe aceptar la propuesta antes de realizar el envio."

        if not is_pickup and new_status == OrderStatus.SHIPPED:
            if order.delivery_transport_type == "correo":
                responsible_complete = bool(order.carrier_company and order.delivery_tracking_code)
            else:
                responsible_complete = bool(order.courier_name and order.courier_phone and order.courier_photo_url and order.courier_vehicle)
            if not responsible_complete:
                db.rollback()
                return None, "Completa la identificacion del responsable del envio antes de despacharlo."

        if is_pickup and new_status == OrderStatus.DELIVERED:
            db.rollback()
            return None, "En un retiro, el comprador tambien debe confirmar la recepcion."

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

        if (
            new_status == OrderStatus.CANCELLED
            and current_status != OrderStatus.CANCELLED
        ):
            _cancel_open_payments_for_order(
                db,
                order.id,
            )

        order.status = new_status
        if is_pickup and new_status == OrderStatus.SHIPPED:
            order.pickup_status = "ready"
            if not order.pickup_ready_at:
                order.pickup_ready_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "id": str(order.id),
            "status": order.status.value,
        }, None

    except SQLAlchemyError:
        db.rollback()
        raise


def update_pickup_status_by_buyer(db: Session, order_id: UUID, buyer_id: UUID, action: str):
    try:
        order = db.query(Order).filter(Order.id == order_id, Order.buyer_id == buyer_id).with_for_update().first()
        if not order:
            db.rollback()
            return None, "not_found"
        if "metodo: retiro en el local" not in str(order.shipping_address or "").lower():
            db.rollback()
            return None, "Este pedido no es para retiro en el local."
        current = order.pickup_status
        if action == "buyer_going" and current == "ready":
            order.pickup_status = "buyer_going"
            order.pickup_buyer_going_at = datetime.now(timezone.utc)
        elif action == "buyer_arrived" and current in {"ready", "buyer_going"}:
            order.pickup_status = "buyer_arrived"
            order.pickup_buyer_arrived_at = datetime.now(timezone.utc)
        elif action == "buyer_received" and current == "seller_handed":
            order.pickup_status = "completed"
            order.pickup_buyer_received_at = datetime.now(timezone.utc)
            order.status = OrderStatus.DELIVERED
        else:
            db.rollback()
            return None, "Esa confirmacion no corresponde al momento actual del retiro."
        db.commit()
        return get_order_by_id(db, order.id, buyer_id), None
    except SQLAlchemyError:
        db.rollback()
        raise


def confirm_pickup_handover_by_seller(db: Session, order_id: UUID, seller_id: UUID):
    try:
        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order:
            db.rollback()
            return None, "not_found"
        products = db.query(Product).filter(Product.id.in_([item.product_id for item in order.items])).all()
        if not products or any(product.seller_id != seller_id for product in products):
            db.rollback()
            return None, "not_found"
        if "metodo: retiro en el local" not in str(order.shipping_address or "").lower():
            db.rollback()
            return None, "Este pedido no es para retiro en el local."
        if order.pickup_status != "buyer_arrived":
            db.rollback()
            return None, "El comprador debe indicar que ya esta en el local."
        order.pickup_status = "seller_handed"
        order.pickup_seller_handed_at = datetime.now(timezone.utc)
        db.commit()
        return {"id": str(order.id), "status": order.status.value, "pickup_status": order.pickup_status}, None
    except SQLAlchemyError:
        db.rollback()
        raise

def schedule_delivery_by_seller(
    db: Session,
    order_id: UUID,
    seller_id: UUID,
    plan: DeliveryPlanUpdate,
):
    try:
        order = (
            db.query(Order)
            .filter(Order.id == order_id)
            .with_for_update()
            .first()
        )
        if not order:
            db.rollback()
            return None, "not_found"

        products = db.query(Product).filter(
            Product.id.in_([item.product_id for item in order.items])
        ).all()
        if not products or any(product.seller_id != seller_id for product in products):
            db.rollback()
            return None, "not_found"

        is_pickup = "retiro en el local" in str(order.shipping_address or "").lower()
        if is_pickup:
            db.rollback()
            return None, "Este pedido utiliza retiro en el local y no necesita programar un envio."

        if order.status != OrderStatus.CONFIRMED:
            db.rollback()
            return None, "La programacion se realiza despues de confirmar el pedido y antes de enviarlo."

        today_argentina = datetime.now(
            timezone(timedelta(hours=-3))
        ).date()
        if plan.estimated_date < today_argentina:
            db.rollback()
            return None, "La fecha estimada no puede estar en el pasado."

        order.delivery_transport_type = plan.transport_type
        order.delivery_estimated_date = plan.estimated_date
        order.delivery_time_window = plan.time_window.strip()
        order.delivery_scheduled_at = datetime.now(timezone.utc)
        same_as_requested = (
            order.delivery_buyer_requested_date == plan.estimated_date
            and order.delivery_buyer_requested_window == plan.time_window.strip()
        )
        order.delivery_plan_status = "coordinated" if same_as_requested else "seller_proposed"
        db.commit()

        return {
            "id": str(order.id),
            "delivery_transport_type": order.delivery_transport_type,
            "delivery_estimated_date": order.delivery_estimated_date.isoformat(),
            "delivery_time_window": order.delivery_time_window,
            "delivery_scheduled_at": order.delivery_scheduled_at,
        }, None
    except SQLAlchemyError:
        db.rollback()
        raise


def decide_delivery_plan_by_buyer(
    db: Session, order_id: UUID, buyer_id: UUID, decision: DeliveryPlanDecision
):
    try:
        order = db.query(Order).filter(
            Order.id == order_id, Order.buyer_id == buyer_id
        ).with_for_update().first()
        if not order:
            db.rollback()
            return None, "not_found"
        if order.delivery_plan_status != "seller_proposed":
            db.rollback()
            return None, "No hay una nueva propuesta pendiente de respuesta."
        if decision.action == "accept":
            order.delivery_plan_status = "coordinated"
        else:
            order.delivery_plan_status = "requested"
            order.delivery_estimated_date = None
            order.delivery_time_window = None
            order.delivery_transport_type = None
            order.delivery_scheduled_at = None
        db.commit()
        return get_order_by_id(db, order.id, buyer_id), None
    except SQLAlchemyError:
        db.rollback()
        raise


def seller_owns_order(db: Session, order_id: UUID, seller_id: UUID) -> bool:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return False
    products = db.query(Product).filter(
        Product.id.in_([item.product_id for item in order.items])
    ).all()
    return bool(products) and all(product.seller_id == seller_id for product in products)


def assign_delivery_responsible_by_seller(
    db: Session, order_id: UUID, seller_id: UUID, data: DeliveryResponsibleUpdate
):
    try:
        order = db.query(Order).filter(Order.id == order_id).with_for_update().first()
        if not order or not seller_owns_order(db, order_id, seller_id):
            db.rollback()
            return None, "not_found"
        if order.status != OrderStatus.CONFIRMED or order.delivery_plan_status != "coordinated":
            db.rollback()
            return None, "Primero debe quedar coordinada la fecha de entrega."
        if "retiro en el local" in str(order.shipping_address or "").lower():
            db.rollback()
            return None, "Este pedido se retira en el local."

        if order.delivery_transport_type == "correo":
            company = str(data.carrier_company or "").strip()
            tracking = str(data.tracking_code or "").strip()
            if not company or not tracking:
                db.rollback()
                return None, "Informa la empresa y el codigo de seguimiento."
            order.carrier_company = company
            order.delivery_tracking_code = tracking
            order.courier_name = None
            order.courier_phone = None
            order.courier_photo_url = None
            order.courier_vehicle = None
        else:
            name = str(data.courier_name or "").strip()
            phone = str(data.courier_phone or "").strip()
            photo = str(data.courier_photo_url or "").strip()
            vehicle = str(data.courier_vehicle or "").strip()
            if not name or not phone or not photo or not vehicle:
                db.rollback()
                return None, "Completa nombre, telefono, vehiculo y foto del responsable."
            order.courier_name = name
            order.courier_phone = phone
            order.courier_photo_url = photo
            order.courier_vehicle = vehicle
            order.carrier_company = None
            order.delivery_tracking_code = None
        order.courier_assigned_at = datetime.now(timezone.utc)
        db.commit()
        return {"id": str(order.id), "assigned": True}, None
    except SQLAlchemyError:
        db.rollback()
        raise



def get_orders_for_admin(db: Session):
    orders = (
        db.query(Order)
        .options(
            selectinload(Order.buyer),
            selectinload(Order.items)
            .selectinload(OrderItem.product)
            .selectinload(Product.seller),
        )
        .order_by(Order.created_at.desc())
        .all()
    )

    seller_ids = {
        order.seller_id
        for order in orders
        if order.seller_id is not None
    }

    stores = (
        db.query(Store)
        .filter(Store.owner_id.in_(seller_ids))
        .all()
        if seller_ids
        else []
    )
    stores_by_owner = {store.owner_id: store for store in stores}

    result = []

    for order in orders:
        buyer = order.buyer
        buyer_name = ' '.join(
            part
            for part in [
                getattr(buyer, 'first_name', None),
                getattr(buyer, 'last_name', None),
            ]
            if part
        ).strip()

        store = stores_by_owner.get(order.seller_id)

        result.append({
            'order': order,
            'buyer': {
                'name': buyer_name or getattr(buyer, 'email', 'Sin nombre'),
                'email': getattr(buyer, 'email', ''),
            },
            'store': (
                {
                    'seller_id': store.owner_id,
                    'name': store.name,
                    'slug': store.slug,
                }
                if store
                else None
            ),
        })

    return result
