#!/bin/bash

echo "Iniciando instalación de dependencias..."
pip install -r requirements.txt

echo "Aplicando migraciones de base de datos..."
alembic upgrade head

echo "Iniciando el servidor..."
uvicorn backend.app.main:app --host 0.0.0.0 --port 10000