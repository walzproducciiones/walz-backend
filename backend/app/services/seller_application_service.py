from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models.seller_application import SellerApplication
from backend.app.models.user import User
from backend.app.schemas.seller_application import (
    SellerApplicationCreate,
    SellerApplicationReview,
)


def get_application_by_user(db: Session, user_id: UUID):
    return (
        db.query(SellerApplication)
        .filter(SellerApplication.user_id == user_id)
        .first()
    )


def submit_seller_application(
    db: Session,
    user: User,
    data: SellerApplicationCreate,
):
    role = str(user.role or "").upper()
    if role in {"VENDEDOR", "SELLER", "ADMIN"}:
        return None, "Esta cuenta ya tiene permisos para vender."

    application = get_application_by_user(db, user.id)
    if application and application.status == "pending":
        return None, "Ya existe una solicitud pendiente."
    if application and application.status == "approved":
        return None, "La solicitud ya fue aprobada."

    values = data.model_dump()
    values["business_name"] = values["business_name"].strip()
    values["city"] = values["city"].strip() if values.get("city") else None
    values["reason"] = values["reason"].strip()

    raw_categories = values.get("business_categories") or []
    normalized_categories = []
    seen_categories = set()

    for raw_category in raw_categories:
        category = " ".join(str(raw_category or "").split())

        if not category:
            continue

        if len(category) > 80:
            return None, "Cada rubro puede tener hasta 80 caracteres."

        key = category.casefold()

        if key in seen_categories:
            continue

        seen_categories.add(key)
        normalized_categories.append(category)

    if not normalized_categories:
        return None, "Selecciona al menos un rubro."

    if len(normalized_categories) > 8:
        return None, "Podes seleccionar hasta 8 rubros."

    values["business_categories"] = normalized_categories

    if application:
        for field, value in values.items():
            setattr(application, field, value)
        application.status = "pending"
        application.admin_note = None
        application.reviewed_by = None
        application.reviewed_at = None
    else:
        application = SellerApplication(user_id=user.id, **values)
        db.add(application)

    db.commit()
    db.refresh(application)
    return application, None


def list_seller_applications_for_admin(db: Session):
    rows = (
        db.query(SellerApplication, User)
        .join(User, User.id == SellerApplication.user_id)
        .order_by(SellerApplication.created_at.desc())
        .all()
    )

    result = []
    for application, user in rows:
        result.append({
            "id": application.id,
            "user_id": application.user_id,
            "business_name": application.business_name,
            "city": application.city,
            "reason": application.reason,
            "business_categories": application.business_categories or [],
            "status": application.status,
            "admin_note": application.admin_note,
            "reviewed_by": application.reviewed_by,
            "reviewed_at": application.reviewed_at,
            "created_at": application.created_at,
            "updated_at": application.updated_at,
            "applicant_email": user.email,
            "applicant_name": f"{user.first_name} {user.last_name}".strip(),
        })
    return result


def review_seller_application(
    db: Session,
    application_id: UUID,
    admin_id: UUID,
    data: SellerApplicationReview,
):
    application = (
        db.query(SellerApplication)
        .filter(SellerApplication.id == application_id)
        .first()
    )
    if not application:
        return None

    application.status = data.status
    application.admin_note = data.admin_note.strip() if data.admin_note else None
    application.reviewed_by = admin_id
    application.reviewed_at = datetime.now(timezone.utc)

    if data.status == "approved":
        applicant = db.query(User).filter(User.id == application.user_id).first()
        if applicant and str(applicant.role or "").upper() != "ADMIN":
            applicant.role = "VENDEDOR"

    db.commit()
    db.refresh(application)
    return application