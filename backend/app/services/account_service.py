from sqlalchemy.orm import Session
from backend.app.models.banner import Banner
from backend.app.models.order import Order, OrderItem, OrderStatus
from backend.app.models.product import Product
from backend.app.models.store import Store
from backend.app.models.user import User

ACTIVE_ORDER_STATUSES = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.SHIPPED]

def close_user_account(db: Session, user: User):
    if str(user.role or "").upper() == "ADMIN":
        return False, "La cuenta administradora principal no puede cerrarse desde esta pantalla."
    active_purchases = db.query(Order).filter(Order.buyer_id == user.id, Order.status.in_(ACTIVE_ORDER_STATUSES)).count()
    active_sales = (db.query(Order).join(OrderItem, OrderItem.order_id == Order.id).join(Product, Product.id == OrderItem.product_id).filter(Product.seller_id == user.id, Order.status.in_(ACTIVE_ORDER_STATUSES)).distinct().count())
    if active_purchases or active_sales:
        return False, f"No puedes cerrar la cuenta: hay {active_purchases} compra(s) y {active_sales} venta(s) todavia en proceso."
    try:
        db.query(Product).filter(Product.seller_id == user.id).update({"is_active": False}, synchronize_session=False)
        db.query(Store).filter(Store.owner_id == user.id).update({"is_active": False}, synchronize_session=False)
        db.query(Banner).filter(Banner.seller_id == user.id).update({"is_active": False}, synchronize_session=False)
        user.is_active = False
        db.commit()
        return True, None
    except Exception:
        db.rollback()
        raise