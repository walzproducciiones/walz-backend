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