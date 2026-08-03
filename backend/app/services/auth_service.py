from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate
from app.security.password import hash_password
from app.services.email_service import send_verification_email  # <-- IMPORTADO
from app.security.jwt import create_access_token

def register_user(db: Session, user_data: UserCreate):
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        return None, "Email already registered"

    hashed_pw = hash_password(user_data.password)
    new_user = User(
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        phone=user_data.phone,
        password_hash=hashed_pw,
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generar token de verificación y enviar correo
    verification_token = create_access_token({"sub": str(new_user.id), "email": new_user.email})
    send_verification_email(new_user.email, verification_token)  # <-- ENVIAR CORREO

    return new_user, None