from sqlalchemy.orm import Session
from app.models.order import Order, OrderItem, OrderStatus
from app.models.product import Product
from app.schemas.order import OrderCreate
from uuid import UUID

def create_order(db: Session, buyer_id: UUID, order_data: OrderCreate):
    # 1. Calcular total y verificar stock
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
    
    # 2. Crear la orden
    new_order = Order(
        buyer_id=buyer_id,
        total_amount=total,
        shipping_address=order_data.shipping_address
    )
    db.add(new_order)
    db.flush()  # Para obtener el ID de la orden
    
    # 3. Crear los items y descontar stock
    for item_data in order_items:
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=item_data["product"].id,
            quantity=item_data["quantity"],
            price_at_purchase=item_data["price_at_purchase"]
        )
        db.add(order_item)
        
        # Descontar stock
        item_data["product"].stock -= item_data["quantity"]
    
    db.commit()
    db.refresh(new_order)
    return new_order, None