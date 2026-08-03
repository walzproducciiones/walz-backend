from sqlalchemy.orm import Session
from app.models.product import Product
from app.schemas.product import ProductCreate
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

def get_products(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Product).filter(Product.is_active == True).offset(skip).limit(limit).all()

def get_product(db: Session, product_id: UUID):
    return db.query(Product).filter(Product.id == product_id).first()

def get_products_by_seller(db: Session, seller_id: UUID):
    return db.query(Product).filter(Product.seller_id == seller_id).all()