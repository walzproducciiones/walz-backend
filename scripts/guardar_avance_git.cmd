@echo off
setlocal
cd /d "%~dp0.."

echo Preparando el avance de WalZ One...

git add -- ^
    .gitignore ^
    backend/app/database/schema_updates.py ^
    backend/app/main.py ^
    backend/app/models/product.py ^
    backend/app/models/conversation.py ^
    backend/app/schemas/product.py ^
    backend/app/schemas/conversation.py ^
    backend/app/services/product_service.py ^
    backend/app/services/conversation_service.py ^
    backend/app/api/conversations.py ^
    frontend/app.js ^
    frontend/index.html ^
    frontend/style.css ^
    docs/architecture/communication ^
    docs/architecture/help ^
    scripts/iniciar_walz_codex.cmd ^
    scripts/guardar_avance_git.cmd

if errorlevel 1 goto error

git diff --cached --check
if errorlevel 1 goto error

git commit -m "feat: agregar conversaciones comerciales internas"
if errorlevel 1 goto error

echo.
echo Avance guardado correctamente en Git.
git log -1 --oneline
echo.
echo Los archivos de imagen y el CSV de Farmacia Federico quedaron fuera.
pause
exit /b 0

:error
echo.
echo No se pudo completar el guardado. Copia el mensaje de esta ventana.
pause
exit /b 1
