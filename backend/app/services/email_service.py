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

def send_password_reset_email(email_to: str, token: str):
    base_url = "http://127.0.0.1:8000"
    reset_link = f"{base_url}/auth/reset-password?token={token}"
    
    url = "https://send.api.mailtrap.io/api/send"
    
    payload = {
        "from": {
            "email": "hello@demomailtrap.co",
            "name": "WalZ One"
        },
        "to": [
            {
                "email": email_to
            }
        ],
        "subject": "Restablece tu contraseña en WalZ One",
        "html": f"""
            <h1>Restablecer contraseña</h1>
            <p>Haz clic en el siguiente enlace para crear una nueva contraseña:</p>
            <a href="{reset_link}">Restablecer contraseña</a>
            <br><br>
            <p>Si no solicitaste esto, ignora el mensaje.</p>
        """,
        "category": "Restablecimiento de contraseña"
    }

    headers = {
        "Authorization": f"Bearer {MAILTRAP_API_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            print(f"✅ Correo de restablecimiento enviado a {email_to}")
            print(f"📬 Puedes ver el correo en: https://mailtrap.io/sending/email_logs")
        else:
            print(f"❌ Error enviando correo de reseteo a {email_to}: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error de conexión al enviar correo a {email_to}: {e}")