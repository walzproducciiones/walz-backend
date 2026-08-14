from sqlalchemy.orm import Session
from sqlalchemy import and_
from backend.app.models.product import Product
from backend.app.schemas.product import ProductCreate, ProductFilter, ProductUpdate
from uuid import UUID

def create_product(db: Session, seller_id: UUID, product_data: ProductCreate):
    new_product = Product(
        seller_id=seller_id,
        name=product_data.name,
        description=product_data.description,
        price=product_data.price,
        stock=product_data.stock,
        category=product_data.category,
        image_url=product_data.image_url
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product

def get_products(db: Session, skip: int = 0, limit: int = 100, filters: ProductFilter = None):
    query = db.query(Product).filter(Product.is_active == True)
    
    if filters:
        if filters.name:
            query = query.filter(Product.name.ilike(f"%{filters.name}%"))
        if filters.category:
            query = query.filter(Product.category == filters.category)
        if filters.min_price is not None:
            query = query.filter(Product.price >= filters.min_price)
        if filters.max_price is not None:
            query = query.filter(Product.price <= filters.max_price)
    
    return query.offset(skip).limit(limit).all()

def get_product(db: Session, product_id: UUID):
    return db.query(Product).filter(Product.id == product_id).first()

def get_products_by_seller(db: Session, seller_id: UUID):
    return db.query(Product).filter(Product.seller_id == seller_id).all()

def update_product_by_seller(
    db: Session,
    product_id: UUID,
    seller_id: UUID,
    product_data: ProductUpdate,
):
    product = (
        db.query(Product)
        .filter(
            Product.id == product_id,
            Product.seller_id == seller_id,
        )
        .first()
    )

    if not product:
        return None

    updates = product_data.model_dump(exclude_unset=True)

    for field, value in updates.items():
        if value is not None:
            setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product
