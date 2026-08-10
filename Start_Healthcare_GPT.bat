@echo off
cd /d "%~dp0"
echo Starting Healthcare GPT...
echo.
echo 1. Opening Backend window (leave it open).
start "Healthcare GPT Backend" cmd /k "cd /d ""%~dp0backend"" && echo Backend running at http://127.0.0.1:8000 && echo. && uvicorn main:app --reload --port 8000"
timeout /t 4 /nobreak >nul
echo 2. Opening Frontend window (leave it open).
start "Healthcare GPT Frontend" cmd /k "cd /d ""%~dp0frontend"" && echo Frontend at http://localhost:5173 && echo. && npm run dev"
echo.
echo 3. Waiting 12 seconds for the app to start...
timeout /t 12 /nobreak >nul
echo 4. Opening your browser...
start http://localhost:5173
echo.
echo IMPORTANT: Use the URL http://localhost:5173 in your browser.
echo Do NOT double-click the index.html file - that will show a black screen.
echo.
echo If the page is blank: wait a few seconds and press F5 to refresh.
pause
