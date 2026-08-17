import os
import uuid

import requests


MAX_PRODUCT_IMAGE_BYTES = 1_500_000


def upload_product_image(seller_id, content: bytes, content_type: str) -> str:
    if content_type != "image/webp":
        raise ValueError("WalZ solo recibe la imagen optimizada en formato WebP.")
    if not content or len(content) > MAX_PRODUCT_IMAGE_BYTES:
        raise ValueError("La imagen optimizada no puede superar 1,5 MB.")

    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    bucket = os.getenv("SUPABASE_PRODUCT_IMAGES_BUCKET", "product-images").strip()
    if not supabase_url or not service_key:
        raise RuntimeError("El almacenamiento de imagenes todavia no esta configurado.")

    object_path = f"sellers/{seller_id}/{uuid.uuid4().hex}.webp"
    response = requests.post(
        f"{supabase_url}/storage/v1/object/{bucket}/{object_path}",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "image/webp",
            "x-upsert": "false",
        },
        data=content,
        timeout=30,
    )
    if response.status_code not in {200, 201}:
        raise RuntimeError("Supabase no pudo guardar la imagen.")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"

def upload_store_logo(seller_id, content: bytes, content_type: str) -> str:
    if content_type != "image/webp":
        raise ValueError("WalZ solo recibe el logo optimizado en formato WebP.")
    if not content or len(content) > 1_000_000:
        raise ValueError("El logo optimizado no puede superar 1 MB.")

    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    bucket = os.getenv("SUPABASE_PRODUCT_IMAGES_BUCKET", "product-images").strip()
    if not supabase_url or not service_key:
        raise RuntimeError("El almacenamiento de imagenes todavia no esta configurado.")

    object_path = f"store-logos/{seller_id}/{uuid.uuid4().hex}.webp"
    response = requests.post(
        f"{supabase_url}/storage/v1/object/{bucket}/{object_path}",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "image/webp",
            "x-upsert": "false",
        },
        data=content,
        timeout=30,
    )
    if response.status_code not in {200, 201}:
        raise RuntimeError("Supabase no pudo guardar el logo.")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"

def upload_delivery_person_photo(seller_id, order_id, content: bytes, content_type: str) -> str:
    if content_type != "image/webp":
        raise ValueError("WalZ solo recibe la foto optimizada en formato WebP.")
    if not content or len(content) > 1_000_000:
        raise ValueError("La foto optimizada no puede superar 1 MB.")
    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    bucket = os.getenv("SUPABASE_PRODUCT_IMAGES_BUCKET", "product-images").strip()
    if not supabase_url or not service_key:
        raise RuntimeError("El almacenamiento de imagenes todavia no esta configurado.")
    object_path = f"delivery-people/{seller_id}/{order_id}/{uuid.uuid4().hex}.webp"
    response = requests.post(
        f"{supabase_url}/storage/v1/object/{bucket}/{object_path}",
        headers={"Authorization": f"Bearer {service_key}", "apikey": service_key, "Content-Type": "image/webp", "x-upsert": "false"},
        data=content, timeout=30,
    )
    if response.status_code not in {200, 201}:
        raise RuntimeError("Supabase no pudo guardar la foto del responsable.")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"


def upload_banner_image(user_id, content: bytes, content_type: str) -> str:
    if content_type != "image/webp":
        raise ValueError("WalZ solo recibe el banner optimizado en formato WebP.")
    if not content or len(content) > 1_500_000:
        raise ValueError("El banner optimizado no puede superar 1,5 MB.")

    supabase_url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    bucket = os.getenv("SUPABASE_PRODUCT_IMAGES_BUCKET", "product-images").strip()
    if not supabase_url or not service_key:
        raise RuntimeError("El almacenamiento de imagenes todavia no esta configurado.")

    object_path = f"banners/{user_id}/{uuid.uuid4().hex}.webp"
    response = requests.post(
        f"{supabase_url}/storage/v1/object/{bucket}/{object_path}",
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "image/webp",
            "x-upsert": "false",
        },
        data=content,
        timeout=30,
    )
    if response.status_code not in {200, 201}:
        raise RuntimeError("Supabase no pudo guardar el banner.")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{object_path}"
