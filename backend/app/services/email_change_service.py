import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from backend.app.models.email_change_token import EmailChangeToken
from backend.app.models.user import User

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def create_email_change_token(db: Session, user: User, new_email: str) -> str:
    now = datetime.now(timezone.utc)
    db.query(EmailChangeToken).filter(EmailChangeToken.user_id == user.id, EmailChangeToken.is_used.is_(False)).update({"is_used": True, "used_at": now}, synchronize_session=False)
    token = secrets.token_urlsafe(48)
    db.add(EmailChangeToken(user_id=user.id, new_email=new_email, token_hash=_hash_token(token), expires_at=now + timedelta(minutes=30)))
    db.commit()
    return token

def confirm_email_change(db: Session, token: str) -> str | None:
    now = datetime.now(timezone.utc)
    record = db.query(EmailChangeToken).filter(EmailChangeToken.token_hash == _hash_token(token)).first()
    if not record or record.is_used:
        return None
    expires = record.expires_at
    if expires.tzinfo is None: expires = expires.replace(tzinfo=timezone.utc)
    if expires <= now:
        record.is_used = True; record.used_at = now; db.commit(); return None
    if db.query(User).filter(User.email == record.new_email, User.id != record.user_id).first():
        record.is_used = True; record.used_at = now; db.commit(); return None
    user = db.query(User).filter(User.id == record.user_id, User.is_active.is_(True)).first()
    if not user: return None
    user.email = record.new_email
    db.query(EmailChangeToken).filter(EmailChangeToken.user_id == user.id, EmailChangeToken.is_used.is_(False)).update({"is_used": True, "used_at": now}, synchronize_session=False)
    db.commit()
    return user.email