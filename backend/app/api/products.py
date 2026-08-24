from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session
from backend.app.database.session import SessionLocal
from backend.app.schemas.product import ProductCreate, ProductResponse, ProductFilter, ProductUpdate
from backend.app.services.product_service import create_product, create_products_bulk, get_products, get_products_by_seller, update_product_by_seller, soft_delete_product_by_seller
from backend.app.api.auth import get_current_user
from backend.app.models.user import User
from uuid import UUID
from backend.app.services.product_image_service import upload_product_image
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
    try:
        return create_product(db, current_user.id, product)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

@router.post("/images")
async def upload_my_product_image(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    role = str(current_user.role or "").upper()
    if role not in {"VENDEDOR", "SELLER", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Tu cuenta no esta habilitada para vender.")
    content = await image.read()
    try:
        image_url = upload_product_image(current_user.id, content, image.content_type or "")
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error))
    return {"image_url": image_url}

@router.post("/bulk", response_model=list[ProductResponse])
def create_products_in_bulk(
    products: list[ProductCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = str(current_user.role or "").upper()
    if role not in {"VENDEDOR", "SELLER", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Tu cuenta no esta habilitada para vender.")
    if not products:
        raise HTTPException(status_code=400, detail="La planilla no contiene productos.")
    if len(products) > 500:
        raise HTTPException(status_code=400, detail="Se permiten hasta 500 productos por carga.")

    try:
        return create_products_bulk(db, current_user.id, products)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="No se pudo completar la carga masiva.")


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
    try:
        updated_product = update_product_by_seller(
            db,
            product_id,
            current_user.id,
            product,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    if not updated_product:
        raise HTTPException(
            status_code=404,
            detail="Producto no encontrado.",
        )

    return updated_product

@router.delete("/{product_id}")
def delete_my_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    deleted_product = soft_delete_product_by_seller(
        db,
        product_id,
        current_user.id,
    )

    if not deleted_product:
        raise HTTPException(
            status_code=404,
            detail="Producto no encontrado.",
        )

    return {
        "ok": True,
        "product_id": str(product_id),
    }
