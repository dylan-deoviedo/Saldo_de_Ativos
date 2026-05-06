@echo off
cd /d "%~dp0"
echo API em todas as interfaces (LAN: http://SEU-IP:8000)
.venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload
