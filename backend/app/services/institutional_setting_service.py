from sqlalchemy.orm import Session

from backend.app.models.institutional_setting import InstitutionalSetting
from backend.app.schemas.institutional_setting import InstitutionalSettingUpdate


def get_institutional_setting(db: Session):
    return (
        db.query(InstitutionalSetting)
        .order_by(InstitutionalSetting.created_at.asc())
        .first()
    )


def save_institutional_setting(
    db: Session,
    data: InstitutionalSettingUpdate,
):
    setting = get_institutional_setting(db)
    values = data.model_dump()

    values["institutional_name"] = values["institutional_name"].strip()
    if len(values["institutional_name"]) < 2:
        raise ValueError("El nombre institucional debe tener al menos 2 caracteres.")

    for optional_field in (
        "description",
        "email",
        "phone",
        "whatsapp",
        "city",
        "address",
        "website_url",
        "instagram_url",
        "facebook_url",
    ):
        value = values.get(optional_field)
        values[optional_field] = str(value).strip() if value else None

    if setting:
        for field, value in values.items():
            setattr(setting, field, value)
    else:
        setting = InstitutionalSetting(**values)
        db.add(setting)

    db.commit()
    db.refresh(setting)
    return setting
