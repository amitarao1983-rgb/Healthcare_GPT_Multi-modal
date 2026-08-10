@echo off
cd /d "%~dp0"
echo Building frontend (if needed)...
cd frontend
call npm run build
cd ..
echo.
echo Starting Healthcare GPT on http://127.0.0.1:8000
echo Leave this window open.
echo.
cd backend
start http://127.0.0.1:8000
python -m uvicorn main:app --reload --port 8000
pause
