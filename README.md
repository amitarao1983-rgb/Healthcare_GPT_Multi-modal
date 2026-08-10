# Healthcare GPT (Multi-Modal)

Multi-turn chat assistant for healthcare: medicine, clinical research, healthcare management, medicolegal law, nursing. Supports **text**, **voice input**, and **health image uploads** (scans, x-rays, dermatology).

- **API key is server-side only** – set `HEALTHCARE_API_KEY` in the backend `.env`; it is never sent to the browser.
- Configurable **temperature**, **max tokens**, and **model** via the UI or environment.

## Deploy for a public HTTPS link

GitHub only stores code. To open the **live app** in a browser with `https://...`:

1. Open this Deploy link (Render free hosting):  
   https://dashboard.render.com/blueprint/new?repo=https://github.com/amitarao1983-rgb/Healthcare_GPT_Multi-modal
2. Sign in with GitHub if asked.
3. Set the secret **`HEALTHCARE_API_KEY`** to your OpenAI API key.
4. Click **Apply** / **Create**.
5. When the service is Live, use the Render URL, for example:  
   `https://healthcare-gpt.onrender.com`

Local (one server):

```powershell
cd "c:\Users\LENOVO\Desktop\Healthcare_GPT (Multi-modal)\frontend"
npm run build
cd ..\backend
python -m uvicorn main:app --reload --port 8000
```

Then open **http://127.0.0.1:8000**

## Quick start

### 1. Backend (API key lives here only)

**PowerShell** (run each line separately, or use semicolons):
```powershell
cd "c:\Users\LENOVO\Desktop\Healthcare_GPT (Multi-modal)\backend"
copy .env.example .env
# Edit .env and set HEALTHCARE_API_KEY=your_openai_api_key_here
pip install -r requirements.txt
```

Optional in `.env`:

- `DEFAULT_TEMPERATURE=0.6`
- `DEFAULT_MAX_TOKENS=2048`
- `DEFAULT_MODEL=gpt-4o`

### 2. Frontend (build once)

```powershell
cd "c:\Users\LENOVO\Desktop\Healthcare_GPT (Multi-modal)\frontend"
npm install
npm run build
```

This creates the static files in `frontend/dist` that the backend can serve.

### 3. Run the integrated app (one server, one URL)

```powershell
cd "c:\Users\LENOVO\Desktop\Healthcare_GPT (Multi-modal)\backend"
python -m uvicorn main:app --reload --port 8000
```

Then open **http://127.0.0.1:8000** (or http://localhost:8000).  
FastAPI serves both:

- The **API** (`/chat`, `/config`, `/health`)
- The **built React frontend** from `frontend/dist` at `/`

## Features

- **Multi-turn chat** – Full conversation history sent to the API each time.
- **Voice input** – Browser speech-to-text (where supported).
- **Multi-modal** – Upload images (e.g. scans, x-rays, dermatology); they are sent as base64 to the backend and forwarded to the model.
- **Settings** – Temperature, max tokens, and model in the UI; defaults from backend env.
- **Healthcare focus** – System prompt covers medicine, clinical research, healthcare management, medicolegal, nursing; encourages professional follow-up for diagnosis/treatment.

## Security

- The **API key is only in the backend** (`.env` or host secrets). Never put it in frontend code or in repo.
- Keep `.env` out of version control (see `.gitignore`).

## Tech

- **Backend:** FastAPI, OpenAI Python SDK, Pydantic settings. Also serves the built frontend for integrated usage.
- **Frontend:** React, Vite; built once and served as static files by the backend.
