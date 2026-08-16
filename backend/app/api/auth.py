from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.app.database.session import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.user import AccountClosureRequest, EmailChangeConfirm, EmailChangeRequest, ForgotPasswordRequest, ResetPasswordRequest, UserCreate, UserLogin, UserResponse
from backend.app.security.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from backend.app.security.password import verify_password
from backend.app.services.email_service import send_email_change_confirmation, send_password_reset_email
from backend.app.services.password_reset_service import create_password_reset_token, reset_password_with_token
from backend.app.services.email_change_service import confirm_email_change, create_email_change_token
from backend.app.services.auth_service import register_user
from backend.app.services.account_service import close_user_account


router = APIRouter(prefix="/auth", tags=["Auth"])


# ============================================================
# DATABASE
# ============================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# REGISTER
# ============================================================

@router.post("/register", response_model=UserResponse)
def register(
    user: UserCreate,
    db: Session = Depends(get_db),
):
    new_user, error = register_user(db, user)

    if error:
        raise HTTPException(
            status_code=400,
            detail=error,
        )

    return new_user


# ============================================================
# PASSWORD RECOVERY
# ============================================================

@router.post("/forgot-password")
def forgot_password(
    request: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    generic_message = "Si el correo esta registrado, recibiras un enlace para crear una nueva contrasena."
    normalized_email = request.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    if user and user.is_active:
        reset_token = create_password_reset_token(db, user)
        try:
            send_password_reset_email(user.email, reset_token)
        except Exception as error:
            print("No se pudo enviar el correo de recuperacion:", error)

    return {"message": generic_message}


@router.post("/reset-password")
def reset_password(
    request: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    if not reset_password_with_token(db, request.token, request.new_password):
        raise HTTPException(status_code=400, detail="El enlace es invalido, ya fue utilizado o vencio.")
    return {"message": "Contrasena actualizada correctamente."}


# ============================================================
# LOGIN
# ============================================================

@router.post("/login")
def login(
    user_credentials: UserLogin,
    db: Session = Depends(get_db),
):
    print("🔐 LOGIN:", user_credentials.email)

    user = (
        db.query(User)
        .filter(User.email == user_credentials.email)
        .first()
    )

    if not user:
        print(
            "❌ LOGIN: usuario NO encontrado:",
            user_credentials.email,
        )
        raise HTTPException(
            status_code=401,
            detail="Credenciales incorrectas",
        )

    print("✅ LOGIN: usuario encontrado:", user.email)

    if not user.is_active:
        print("LOGIN: cuenta desactivada")
        raise HTTPException(
            status_code=403,
            detail="Esta cuenta esta cerrada. Contacta a WalZ si necesitas recuperarla.",
        )

    if not verify_password(
        user_credentials.password,
        user.password_hash,
    ):
        print("❌ LOGIN: contraseña incorrecta")
        raise HTTPException(
            status_code=401,
            detail="Credenciales incorrectas",
        )

    print("✅ LOGIN: contraseña correcta")

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    print("✅ LOGIN: tokens creados")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
    }


# ============================================================
# AUTHORIZATION
# ============================================================

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials

    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid token",
        )

    subject = payload.get("sub")

    if not subject:
        raise HTTPException(
            status_code=401,
            detail="Invalid token subject",
        )

    # El JWT guarda el UUID como string.
    # PostgreSQL/SQLAlchemy espera un objeto UUID.
    try:
        user_id = UUID(subject)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid user ID",
        )

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="Usuario desactivado.",
        )

    return user


def require_admin_user(
    current_user: User = Depends(get_current_user),
):
    if str(current_user.role or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=403,
            detail="Se requiere una cuenta administradora.",
        )

    return current_user


@router.post("/request-email-change")
def request_email_change(
    request: EmailChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    new_email = request.new_email.strip().lower()
    if new_email == str(current_user.email).lower():
        raise HTTPException(status_code=400, detail="El correo nuevo es igual al actual.")
    if not user.is_active:
        print("LOGIN: cuenta desactivada")
        raise HTTPException(
            status_code=403,
            detail="Esta cuenta esta cerrada. Contacta a WalZ si necesitas recuperarla.",
        )

    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contrasena actual es incorrecta.")
    if db.query(User).filter(User.email == new_email).first():
        raise HTTPException(status_code=400, detail="Ese correo ya pertenece a otra cuenta.")
    token = create_email_change_token(db, current_user, new_email)
    try:
        send_email_change_confirmation(new_email, token)
    except Exception as error:
        print("No se pudo enviar la confirmacion de correo:", error)
        raise HTTPException(status_code=503, detail="No pudimos enviar la confirmacion al correo nuevo.")
    return {"message": "Enviamos un enlace de confirmacion al correo nuevo."}

@router.post("/confirm-email-change")
def confirm_new_email(request: EmailChangeConfirm, db: Session = Depends(get_db)):
    new_email = confirm_email_change(db, request.token)
    if not new_email:
        raise HTTPException(status_code=400, detail="El enlace es invalido, ya fue utilizado, vencio o el correo ya esta ocupado.")
    return {"message": "Correo actualizado correctamente.", "email": new_email}

@router.post("/close-account")
def close_account(
    request: AccountClosureRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if request.confirmation.strip().upper() != "CERRAR MI CUENTA":
        raise HTTPException(status_code=400, detail="Escribe exactamente CERRAR MI CUENTA para confirmar.")
    if not user.is_active:
        print("LOGIN: cuenta desactivada")
        raise HTTPException(
            status_code=403,
            detail="Esta cuenta esta cerrada. Contacta a WalZ si necesitas recuperarla.",
        )

    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contrasena actual es incorrecta.")
    closed, error = close_user_account(db, current_user)
    if not closed:
        raise HTTPException(status_code=400, detail=error)
    return {"message": "Cuenta cerrada correctamente."}

@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return current_user

@router.get("/debug/user-exists")
def debug_user_exists(
    email: str,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()

    return {
        "email": email,
        "exists": user is not None,
        "database": "configured"
    }