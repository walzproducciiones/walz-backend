from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.database.session import SessionLocal
from backend.app.api.auth import get_current_user
from backend.app.models.user import User
from backend.app.services.order_service import create_order
from backend.app.schemas.order import OrderCreate

router = APIRouter(prefix="/payments", tags=["Payments"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/create-preference")
def create_preference(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Crear la orden en la base de datos
    new_order, error = create_order(db, current_user.id, order_data)
    if error:
        raise HTTPException(status_code=400, detail=error)
    
    # Devolver un ID de orden simbólico
    return {
        "preference_id": str(new_order.id),
        "init_point": "https://walz-backend-1.onrender.com/order-success"
    }