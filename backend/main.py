"""
Healthcare GPT Backend – Multi-turn chat, multimodal (images), configurable.
API key is read from environment only; never exposed to the client.

Serves the built React frontend from ../frontend/dist so one process =
one HTTPS app URL when deployed.
"""
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from config import get_settings
from openai import OpenAI

HEALTHCARE_SYSTEM_PROMPT = """You are Healthcare GPT, a knowledgeable and careful assistant specialized in healthcare domains. You help with:
- Medicine: symptoms, conditions, treatments, drug information (without replacing a doctor)
- Clinical research: study design, terminology, evidence interpretation
- Healthcare management: operations, policy, administration
- Medicolegal and medical law: consent, liability, regulations (informational only)
- Nursing: practice, procedures, patient care

When discussing medical matters, you give informative, evidence-based answers and always recommend consulting qualified healthcare providers for diagnosis and treatment. You can analyze medical images (X-rays, scans, dermatology photos, reports) when provided and describe what you see in non-diagnostic, educational terms. Never state definitive diagnoses from images; suggest follow-up with a clinician."""

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

app = FastAPI(title="Healthcare GPT API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(system|user|assistant)$")
    content: str | list = Field(...)


class ModelConfig(BaseModel):
    temperature: float = Field(default=0.6, ge=0, le=2)
    max_tokens: int = Field(default=2048, ge=1, le=4096)
    model: str = Field(default="gpt-4o")


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    config: Optional[ModelConfig] = None
    image_base64_list: Optional[list[str]] = None


class ChatResponse(BaseModel):
    message: str
    role: str = "assistant"
    usage: Optional[dict] = None


def get_client() -> OpenAI:
    settings = get_settings()
    if not settings.healthcare_api_key:
        raise HTTPException(
            status_code=503,
            detail="Healthcare API key is not configured. Set HEALTHCARE_API_KEY in .env or host secrets.",
        )
    return OpenAI(api_key=settings.healthcare_api_key)


def build_openai_messages(
    messages: list[ChatMessage],
    image_base64_list: Optional[list[str]] = None,
) -> list[dict]:
    out = [{"role": "system", "content": HEALTHCARE_SYSTEM_PROMPT}]
    for m in messages:
        if m.role == "system":
            continue
        if isinstance(m.content, str):
            out.append({"role": m.role, "content": m.content})
        else:
            out.append({"role": m.role, "content": m.content})

    if image_base64_list and out:
        last_user = None
        for i in range(len(out) - 1, -1, -1):
            if out[i]["role"] == "user":
                last_user = out[i]
                break
        if last_user is not None:
            content = last_user["content"]
            if isinstance(content, str):
                content = [{"type": "text", "text": content}]
            elif not isinstance(content, list):
                content = [{"type": "text", "text": str(content)}]
            for b64 in image_base64_list:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                })
            last_user["content"] = content

    return out


@app.get("/health")
def health():
    return {
        "status": "ok",
        "frontend_dist_exists": FRONTEND_DIST.exists(),
        "index_exists": (FRONTEND_DIST / "index.html").is_file(),
    }


@app.get("/config")
def get_config():
    s = get_settings()
    return {
        "temperature": s.default_temperature,
        "max_tokens": s.default_max_tokens,
        "model": s.default_model,
    }


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    settings = get_settings()
    client = get_client()
    config = req.config or ModelConfig(
        temperature=settings.default_temperature,
        max_tokens=settings.default_max_tokens,
        model=settings.default_model,
    )
    openai_messages = build_openai_messages(req.messages, req.image_base64_list)
    try:
        resp = client.chat.completions.create(
            model=config.model,
            messages=openai_messages,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    choice = resp.choices[0] if resp.choices else None
    if not choice:
        raise HTTPException(status_code=502, detail="Empty response from provider")
    usage = None
    if resp.usage:
        usage = {
            "prompt_tokens": resp.usage.prompt_tokens,
            "completion_tokens": resp.usage.completion_tokens,
            "total_tokens": resp.usage.total_tokens,
        }
    return ChatResponse(
        message=choice.message.content or "",
        role="assistant",
        usage=usage,
    )


def _safe_file(path: Path) -> Optional[FileResponse]:
    try:
        resolved = path.resolve()
        if not str(resolved).startswith(str(FRONTEND_DIST.resolve())):
            return None
        if resolved.is_file():
            return FileResponse(resolved)
    except Exception:
        return None
    return None


@app.get("/")
def serve_index():
    index = FRONTEND_DIST / "index.html"
    if not index.is_file():
        raise HTTPException(
            status_code=503,
            detail="Frontend not built. Run npm run build in frontend/, or check Docker image.",
        )
    return FileResponse(index)


@app.get("/{full_path:path}")
def serve_frontend(full_path: str):
    """Serve static assets or SPA index. Registered last so API routes win."""
    if not FRONTEND_DIST.exists():
        raise HTTPException(status_code=404, detail="Frontend missing")
    # Prefer exact file (e.g. assets/index-xxxxx.js)
    file_resp = _safe_file(FRONTEND_DIST / full_path)
    if file_resp is not None:
        return file_resp
    # SPA fallback for client routes
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")
