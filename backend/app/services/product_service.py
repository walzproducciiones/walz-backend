from sqlalchemy.orm import Session
from sqlalchemy import and_
from backend.app.models.product import Product
from backend.app.schemas.product import ProductCreate, ProductFilter, ProductUpdate
from uuid import UUID

def get_effective_product_price(product: Product) -> float:
    if (
        product.offer_active
        and product.offer_price is not None
        and float(product.offer_price) > 0
        and float(product.offer_price) < float(product.price)
    ):
        return float(product.offer_price)

    return float(product.price)


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

def create_products_bulk(db: Session, seller_id: UUID, products_data: list[ProductCreate]):
    new_products = []
    try:
        for position, product_data in enumerate(products_data, start=1):
            if product_data.offer_active:
                if product_data.offer_price is None:
                    raise ValueError(f"Producto {position}: falta el precio de oferta.")
                if float(product_data.offer_price) >= float(product_data.price):
                    raise ValueError(f"Producto {position}: el precio de oferta debe ser menor que el precio normal.")

            new_product = Product(
                seller_id=seller_id,
                name=product_data.name,
                description=product_data.description,
                price=product_data.price,
                offer_price=product_data.offer_price,
                offer_active=product_data.offer_active,
                stock=product_data.stock,
                category=product_data.category,
                image_url=product_data.image_url,
                is_active=True,
            )
            db.add(new_product)
            new_products.append(new_product)

        db.commit()
        for product in new_products:
            db.refresh(product)
        return new_products
    except Exception:
        db.rollback()
        raise


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

    resulting_price = updates.get("price", product.price)
    resulting_offer_price = updates.get("offer_price", product.offer_price)
    resulting_offer_active = updates.get("offer_active", product.offer_active)

    if resulting_offer_active:
        if resulting_offer_price is None:
            raise ValueError("Ingresa un precio de oferta antes de activarla.")
        if float(resulting_offer_price) >= float(resulting_price):
            raise ValueError("El precio de oferta debe ser menor que el precio normal.")

    for field, value in updates.items():
        if field == "offer_price":
            setattr(product, field, value)
        elif value is not None:
            setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product
