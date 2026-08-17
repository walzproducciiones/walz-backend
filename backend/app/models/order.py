import uuid
import enum

from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    ForeignKey,
    UUID,
    Enum,
    DateTime,
    Date,
)

from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.app.database.session import Base


class OrderStatus(str, enum.Enum):

    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class Order(Base):

    __tablename__ = "orders"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    buyer_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    total_amount = Column(
        Float,
        nullable=False
    )

    status = Column(
        Enum(OrderStatus),
        default=OrderStatus.PENDING
    )

    shipping_address = Column(
        String(500),
        nullable=True
    )

    pickup_status = Column(String(30), nullable=True)
    pickup_ready_at = Column(DateTime(timezone=True), nullable=True)
    pickup_buyer_going_at = Column(DateTime(timezone=True), nullable=True)
    pickup_buyer_arrived_at = Column(DateTime(timezone=True), nullable=True)
    pickup_seller_handed_at = Column(DateTime(timezone=True), nullable=True)
    pickup_buyer_received_at = Column(DateTime(timezone=True), nullable=True)

    delivery_plan_status = Column(String(30), nullable=True)
    delivery_buyer_requested_date = Column(Date, nullable=True)
    delivery_buyer_requested_window = Column(String(60), nullable=True)
    delivery_transport_type = Column(String(30), nullable=True)
    delivery_estimated_date = Column(Date, nullable=True)
    delivery_time_window = Column(String(60), nullable=True)
    delivery_scheduled_at = Column(DateTime(timezone=True), nullable=True)
    courier_name = Column(String(120), nullable=True)
    courier_phone = Column(String(40), nullable=True)
    courier_photo_url = Column(String(500), nullable=True)
    courier_vehicle = Column(String(120), nullable=True)
    carrier_company = Column(String(120), nullable=True)
    delivery_tracking_code = Column(String(120), nullable=True)
    courier_assigned_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at = Column(
        DateTime(timezone=True),
        onupdate=func.now()
    )

    buyer = relationship(
        "User",
        back_populates="orders"
    )

    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan"
    )

    def _seller_account(self):
        for item in self.items or []:
            product = getattr(item, "product", None)
            seller = getattr(product, "seller", None) if product else None
            if seller:
                return seller
        return None

    @property
    def seller_id(self):
        seller = self._seller_account()
        return getattr(seller, "id", None)

    @property
    def seller_display_name(self):
        seller = self._seller_account()
        if not seller:
            return None
        full_name = f"{getattr(seller, 'first_name', '')} {getattr(seller, 'last_name', '')}".strip()
        return full_name or getattr(seller, "email", None)

    @property
    def seller_account_email(self):
        seller = self._seller_account()
        return getattr(seller, "email", None) if seller else None


class OrderItem(Base):

    __tablename__ = "order_items"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    order_id = Column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False
    )

    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id"),
        nullable=False
    )

    quantity = Column(
        Integer,
        nullable=False,
        default=1
    )

    price_at_purchase = Column(
        Float,
        nullable=False
    )

    order = relationship(
        "Order",
        back_populates="items"
    )

    product = relationship(
        "Product"
    )
