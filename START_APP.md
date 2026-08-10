# How to open Healthcare GPT

**You need two terminals (or run the script below).**

## Option 1: Two terminals

**Terminal 1 – Backend** (run as two separate lines, or use semicolon):
```powershell
cd "c:\Users\LENOVO\Desktop\Healthcare_GPT (Multi-modal)\backend"
uvicorn main:app --reload --port 8000
```
Leave this running.

**Terminal 2 – Frontend** (same: two lines or semicolon):
```powershell
cd "c:\Users\LENOVO\Desktop\Healthcare_GPT (Multi-modal)\frontend"
npm run dev
```
Your browser should open to **http://localhost:5173**

---

## Option 2: One-click script

Double-click **Start_Healthcare_GPT.bat** in this folder. It starts the backend and frontend in two windows and then opens your browser.

---

## If the page is blank

- Wait a few seconds after starting the frontend.
- Manually open: **http://localhost:5173**
- Make sure the backend is running (Terminal 1 shows "Uvicorn running on http://127.0.0.1:8000").

## Add your API key

Edit **backend\.env** and set:
```
HEALTHCARE_API_KEY=sk-your-openai-key-here
```
Without this, the chat will show an error when you send a message (the app itself will still open).
