from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy.orm import Session

from backend.app.database.session import SessionLocal
from backend.app.schemas.user import (
    UserCreate,
    UserResponse,
    UserLogin
)
from backend.app.services.auth_service import register_user
from backend.app.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token
)
from backend.app.security.password import verify_password
from backend.app.models.user import User


router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)


def get_db():
    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


@router.post(
    "/register",
    response_model=UserResponse
)
def register(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    new_user, error = register_user(
        db,
        user
    )

    if error:
        raise HTTPException(
            status_code=400,
            detail=error
        )

    return new_user


@router.post("/login")
def login(
    user_credentials: UserLogin,
    db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .filter(
            User.email == user_credentials.email
        )
        .first()
    )

    if not user:
    print("❌ LOGIN: usuario NO encontrado:", user_credentials.email)
    raise HTTPException(
        status_code=401,
        detail="Usuario no encontrado"
    )

print("✅ LOGIN: usuario encontrado:", user.email)
print("🔐 LOGIN: password_hash existe:", bool(user.password_hash))

if not verify_password(
    user_credentials.password,
    user.password_hash
):
    print("❌ LOGIN: contraseña incorrecta")
    raise HTTPException(
        status_code=401,
        detail="Contraseña incorrecta"
    )

print("✅ LOGIN: contraseña correcta")

    user.last_login = datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role
    }

    access_token = create_access_token(
        token_data
    )

    refresh_token = create_refresh_token(
        token_data
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }


security = HTTPBearer()


security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    token = credentials.credentials

    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid token"
        )

    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload"
        )

    try:
        user_uuid = UUID(user_id)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid user ID"
        )

    user = (
        db.query(User)
        .filter(User.id == user_uuid)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="User inactive"
        )

    return user