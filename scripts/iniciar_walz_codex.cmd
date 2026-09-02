@echo off
setlocal
cd /d "%~dp0.."

if not exist "venv-codex\Scripts\python.exe" (
    echo No se encontro el entorno venv-codex.
    echo Pedi a Codex que vuelva a prepararlo.
    pause
    exit /b 1
)

echo Iniciando WalZ One en http://127.0.0.1:8000
echo Para detenerlo, presiona Ctrl+C.
"venv-codex\Scripts\python.exe" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

pause
