from backend.app.schemas.product import ProductCreate, ProductResponse, ProductFilter
import traceback
from fastapi import HTTPException

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