from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.database.session import SessionLocal
from backend.app.schemas.product import ProductCreate, ProductResponse, ProductFilter, ProductUpdate
from backend.app.services.product_service import create_product, get_products, get_products_by_seller, update_product_by_seller
from backend.app.api.auth import get_current_user
from backend.app.models.user import User
from uuid import UUID
import traceback

router = APIRouter(prefix="/products", tags=["Products"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=ProductResponse)
def create_new_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return create_product(db, current_user.id, product)

@router.get("/", response_model=list[ProductResponse])
def list_products(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    name: str | None = Query(None),
    category: str | None = Query(None),
    min_price: float | None = Query(None, ge=0),
    max_price: float | None = Query(None, ge=0),
    db: Session = Depends(get_db),
):
    try:
        filters = ProductFilter(
            name=name,
            category=category,
            min_price=min_price,
            max_price=max_price,
        )
        return get_products(db, skip, limit, filters)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mine", response_model=list[ProductResponse])
def list_my_products(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_products_by_seller(db, current_user.id)

@router.patch("/{product_id}", response_model=ProductResponse)
def update_my_product(
    product_id: UUID,
    product: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated_product = update_product_by_seller(
        db,
        product_id,
        current_user.id,
        product,
    )

    if not updated_product:
        raise HTTPException(
            status_code=404,
            detail="Producto no encontrado.",
        )

    return updated_product
