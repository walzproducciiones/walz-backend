from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import SessionLocal
from backend.app.schemas.order import OrderCreate, OrderResponse
from backend.app.services.order_service import create_order
from backend.app.api.auth import get_current_user
from backend.app.models.user import User

router = APIRouter(prefix="/orders", tags=["Orders"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=OrderResponse)
def create_new_order(
    order: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_order, error = create_order(db, current_user.id, order)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return new_order