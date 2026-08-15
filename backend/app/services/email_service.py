import os
import requests
import json

# Configuración desde variables de entorno
MAILTRAP_API_TOKEN = os.getenv("MAILTRAP_PASSWORD")  # Usamos la misma variable que ya tienes
# Si prefieres una variable separada, puedes crear MAILTRAP_API_TOKEN en tu .env

def send_verification_email(email_to: str, token: str):
    base_url = "http://127.0.0.1:8000"
    verification_link = f"{base_url}/auth/verify-email?token={token}"
    
    url = "https://send.api.mailtrap.io/api/send"
    
    payload = {
        "from": {
            "email": "hello@demomailtrap.co",  # Dominio de prueba gratuito de Mailtrap
            "name": "WalZ One"
        },
        "to": [
            {
                "email": email_to
            }
        ],
        "subject": "Verifica tu correo en WalZ One",
        "html": f"""
            <h1>Bienvenido a WalZ One</h1>
            <p>Haz clic en el siguiente enlace para verificar tu correo:</p>
            <a href="{verification_link}">Verificar correo</a>
            <br><br>
            <p>Si no solicitaste esta cuenta, ignora este mensaje.</p>
        """,
        "category": "Verificacion de correo"
    }

    headers = {
        "Authorization": f"Bearer {MAILTRAP_API_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            print(f"✅ Correo enviado exitosamente a {email_to}")
            print(f"📬 Puedes ver el correo en: https://mailtrap.io/sending/email_logs")
        else:
            print(f"❌ Error enviando correo a {email_to}: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error de conexión al enviar correo a {email_to}: {e}")

def _get_resend_sender() -> str:
    configured_sender = os.getenv("RESEND_FROM_EMAIL") or os.getenv("RESEND_DOMAIN") or "onboarding@resend.dev"
    configured_sender = configured_sender.strip()
    if "<" in configured_sender and ">" in configured_sender:
        return configured_sender
    if "@" in configured_sender:
        return f"WalZ One <{configured_sender}>"
    return f"WalZ One <no-reply@{configured_sender}>"


def send_password_reset_email(email_to: str, token: str):
    api_key = os.getenv("RESEND_API_KEY")
    if not api_key:
        raise RuntimeError("RESEND_API_KEY no esta configurada.")

    base_url = os.getenv("WALZ_PUBLIC_URL", "http://127.0.0.1:8000").rstrip("/")
    reset_link = f"{base_url}/?reset_token={token}"
    payload = {
        "from": _get_resend_sender(),
        "to": [email_to],
        "subject": "Restablece tu contrasena en WalZ One",
        "html": f"""
            <h1>Restablecer contrasena</h1>
            <p>Recibimos una solicitud para cambiar tu contrasena.</p>
            <p><a href="{reset_link}">Crear una nueva contrasena</a></p>
            <p>El enlace vence en 30 minutos y puede utilizarse una sola vez.</p>
            <p>Si no solicitaste este cambio, ignora este mensaje.</p>
        """,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "WalZ-One/1.0",
    }
    response = requests.post(
        "https://api.resend.com/emails",
        json=payload,
        headers=headers,
        timeout=15,
    )
    if not 200 <= response.status_code < 300:
        raise RuntimeError(f"Resend respondio {response.status_code}: {response.text}")
    print(f"Correo de recuperacion enviado mediante Resend a {email_to}")
    return True