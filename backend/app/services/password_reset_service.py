import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from backend.app.models.password_reset_token import PasswordResetToken
from backend.app.models.user import User
from backend.app.security.password import hash_password


RESET_TOKEN_MINUTES = 30


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_password_reset_token(db: Session, user: User) -> str:
    now = datetime.now(timezone.utc)
    (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.is_used.is_(False),
        )
        .update({"is_used": True, "used_at": now}, synchronize_session=False)
    )

    plain_token = secrets.token_urlsafe(48)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_token_hash(plain_token),
            expires_at=now + timedelta(minutes=RESET_TOKEN_MINUTES),
        )
    )
    db.commit()
    return plain_token


def reset_password_with_token(db: Session, plain_token: str, new_password: str) -> bool:
    now = datetime.now(timezone.utc)
    reset_token = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == _token_hash(plain_token))
        .first()
    )
    if not reset_token or reset_token.is_used:
        return False

    expires_at = reset_token.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        reset_token.is_used = True
        reset_token.used_at = now
        db.commit()
        return False

    user = db.query(User).filter(User.id == reset_token.user_id, User.is_active.is_(True)).first()
    if not user:
        return False

    user.password_hash = hash_password(new_password)
    (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.is_used.is_(False),
        )
        .update({"is_used": True, "used_at": now}, synchronize_session=False)
    )
    db.commit()
    return True