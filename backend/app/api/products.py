from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.database.session import SessionLocal
from backend.app.schemas.product import ProductCreate, ProductResponse
from backend.app.services.product_service import create_product, get_products
from backend.app.api.auth import get_current_user
from backend.app.models.user import User
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.database.session import SessionLocal  # <--- CAMBIADO
from backend.app.schemas.product import ProductCreate, ProductResponse  # <--- CAMBIADO
from backend.app.services.product_service import create_product, get_products  # <--- CAMBIADO
from backend.app.api.auth import get_current_user  # <--- CAMBIADO
from backend.app.models.user import User  # <--- CAMBIADO
from uuid import UUID

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
    name: str | None = None,  # <--- CAMBIADO: sin Optional[str], usa str | None
    category: str | None = None,  # <--- CAMBIADO
    min_price: float | None = Query(None, ge=0),  # <--- CAMBIADO
    max_price: float | None = Query(None, ge=0),  # <--- CAMBIADO
    db: Session = Depends(get_db)
):
    filters = ProductFilter(
        name=name,
        category=category,
        min_price=min_price,
        max_price=max_price
    )
    return get_products(db, skip, limit, filters)