from fastapi import APIRouter, HTTPException, status

from backend.app.services.payment_service import get_payment_configuration


router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/configuration")
def payment_configuration():
    return get_payment_configuration()


@router.post("/create-preference")
def create_preference():
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=(
            "Los pagos online todavia no estan habilitados. "
            "La orden no fue creada ni se desconto stock."
        ),
    )