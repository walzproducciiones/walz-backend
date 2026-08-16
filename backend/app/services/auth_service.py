from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.app.models.user import User
from backend.app.schemas.user import UserCreate
from backend.app.security.password import hash_password
from backend.app.services.email_service import send_verification_email
from backend.app.security.jwt import create_access_token


def register_user(
    db: Session,
    user_data: UserCreate
):
    if not user_data.accepted_terms:
        return None, "Debes aceptar las reglas, terminos y condiciones para crear la cuenta."

    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )

    if existing_user:
        return None, "Email already registered"

    hashed_pw = hash_password(user_data.password)

    new_user = User(
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        password_hash=hashed_pw,
        role="COMPRADOR",
        terms_accepted_at=datetime.now(timezone.utc),
        terms_version="2026-08-15-v1"
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    verification_token = create_access_token(
        {
            "sub": str(new_user.id),
            "email": new_user.email
        }
    )

    try:
        send_verification_email(
            new_user.email,
            verification_token
        )
    except Exception as e:
        print(f"⚠️ Error enviando email de verificación: {e}")

    return new_user, None