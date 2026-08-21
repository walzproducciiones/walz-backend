"""Crea o actualiza cuentas de prueba identificables para WalZ One.

Las contrasenas se generan una sola vez y se guardan en un archivo local
excluido de Git. Nunca se imprimen hashes ni credenciales de usuarios reales.
"""

from __future__ import annotations

import os
import secrets
import string
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = PROJECT_ROOT / ".env"
CREDENTIALS_FILE = PROJECT_ROOT / "cuentas_prueba_walz.local.txt"


def load_local_env() -> None:
    if not ENV_FILE.exists():
        return
    for raw_line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


def generate_password() -> str:
    alphabet = string.ascii_letters + string.digits
    return "Walz-" + "".join(secrets.choice(alphabet) for _ in range(12))


def read_or_create_credentials(accounts: list[dict[str, str]]) -> dict[str, str]:
    credentials: dict[str, str] = {}
    if CREDENTIALS_FILE.exists():
        for raw_line in CREDENTIALS_FILE.read_text(encoding="utf-8-sig").splitlines():
            if "=" not in raw_line or raw_line.lstrip().startswith("#"):
                continue
            email, password = raw_line.split("=", 1)
            if email.strip() and password.strip():
                credentials[email.strip().lower()] = password.strip()

    for account in accounts:
        credentials.setdefault(account["email"], generate_password())

    lines = [
        "# CUENTAS DE PRUEBA DE WALZ ONE",
        "# Archivo local: no compartir, no subir a GitHub.",
        "# Formato: correo=contrasena",
        "",
    ]
    lines.extend(f"{account['email']}={credentials[account['email']]}" for account in accounts)
    CREDENTIALS_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return credentials


def main() -> None:
    load_local_env()

    # Importar todos los modelos relacionados antes de consultar usuarios evita
    # relaciones incompletas de SQLAlchemy al ejecutar este archivo por separado.
    from backend.app.models import (  # noqa: F401
        banner,
        email_change_token,
        order,
        password_reset_token,
        product,
        seller_application,
        store,
        user,
    )
    from backend.app.database.session import DATABASE_URL, SessionLocal
    from backend.app.models.user import User
    from backend.app.security.password import hash_password

    accounts = [
        {
            "email": "prueba-admin@walzone.com.ar",
            "first_name": "Administracion",
            "last_name": "WalZ Prueba",
            "phone": "1111111111",
            "role": "ADMIN",
        },
        {
            "email": "prueba-comprador@walzone.com.ar",
            "first_name": "Comprador",
            "last_name": "WalZ Prueba",
            "phone": "2222222222",
            "role": "COMPRADOR",
        },
        {
            "email": "prueba-vendedor@walzone.com.ar",
            "first_name": "Vendedor",
            "last_name": "WalZ Prueba",
            "phone": "3333333333",
            "role": "VENDEDOR",
        },
        {
            "email": "prueba-farmacia@walzone.com.ar",
            "first_name": "Farmacia",
            "last_name": "WalZ Prueba",
            "phone": "4444444444",
            "role": "VENDEDOR",
        },
    ]

    credentials = read_or_create_credentials(accounts)
    db = SessionLocal()
    created = 0
    updated = 0
    try:
        for data in accounts:
            account = db.query(User).filter(User.email == data["email"]).first()
            if account is None:
                account = User(email=data["email"])
                db.add(account)
                created += 1
            else:
                updated += 1

            account.first_name = data["first_name"]
            account.last_name = data["last_name"]
            account.phone = data["phone"]
            account.role = data["role"]
            account.password_hash = hash_password(credentials[data["email"]])
            account.is_active = True
            account.email_verified = True
            account.terms_accepted_at = datetime.now(timezone.utc)
            account.terms_version = "2026-08-15-v1"

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    database_kind = "SQLite local" if str(DATABASE_URL).startswith("sqlite") else "base configurada en .env"
    print("Cuentas de prueba preparadas correctamente.")
    print(f"Base utilizada: {database_kind}.")
    print(f"Creadas: {created}. Actualizadas: {updated}.")
    print(f"Credenciales guardadas en: {CREDENTIALS_FILE}")


if __name__ == "__main__":
    main()
