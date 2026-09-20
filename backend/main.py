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

When the user uploads medical images (X-rays, CT/MRI scans, ultrasound, dermatology photos, lab report photos, wound photos, etc.):
1. Carefully examine what is visible in the image(s).
2. Describe relevant findings in clear educational language.
3. Suggest possible considerations and what a clinician might look for.
4. Never claim a definitive diagnosis from images alone.
5. Always recommend follow-up with a qualified healthcare professional.
6. If the image is unclear, blurry, or incomplete, say so and ask for a clearer photo if needed.

When discussing medical matters without images, give informative, evidence-based answers and recommend consulting qualified healthcare providers for diagnosis and treatment."""

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
ALLOWED_IMAGE_MIMES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

app = FastAPI(title="Healthcare GPT API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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


class ImagePayload(BaseModel):
    """Base64 image without data-URL prefix, plus MIME type."""
    data: str
    mime: str = "image/jpeg"


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    config: Optional[ModelConfig] = None
    image_base64_list: Optional[list[str]] = None  # legacy: raw base64, assumed jpeg
    images: Optional[list[ImagePayload]] = None


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


def _normalize_mime(mime: str) -> str:
    m = (mime or "image/jpeg").strip().lower()
    if m == "image/jpg":
        m = "image/jpeg"
    if m not in ALLOWED_IMAGE_MIMES:
        m = "image/jpeg"
    return m


def _strip_data_url(raw: str) -> tuple[str, Optional[str]]:
    """Return (base64_data, mime_or_None) from raw base64 or data URL."""
    s = (raw or "").strip()
    if s.startswith("data:") and "," in s:
        header, data = s.split(",", 1)
        mime = None
        if ";" in header:
            mime = header[5:].split(";")[0]
        return data.strip(), mime
    return s, None


def build_openai_messages(
    messages: list[ChatMessage],
    image_base64_list: Optional[list[str]] = None,
    images: Optional[list[ImagePayload]] = None,
) -> list[dict]:
    out = [{"role": "system", "content": HEALTHCARE_SYSTEM_PROMPT}]
    for m in messages:
        if m.role == "system":
            continue
        if isinstance(m.content, str):
            out.append({"role": m.role, "content": m.content})
        else:
            out.append({"role": m.role, "content": m.content})

    payloads: list[tuple[str, str]] = []
    if images:
        for img in images:
            data, mime_from_url = _strip_data_url(img.data)
            if not data:
                continue
            mime = _normalize_mime(mime_from_url or img.mime)
            payloads.append((data, mime))
    elif image_base64_list:
        for raw in image_base64_list:
            data, mime_from_url = _strip_data_url(raw)
            if not data:
                continue
            payloads.append((data, _normalize_mime(mime_from_url or "image/jpeg")))

    if payloads and out:
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
            for data, mime in payloads:
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{mime};base64,{data}",
                        "detail": "high",
                    },
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


@app.get("/debug-key")
def debug_key():
    """Safe check: does not expose the key, only whether it is set."""
    key = (get_settings().healthcare_api_key or "").strip()
    return {"configured": bool(key), "length": len(key)}


EVALS_PATH = Path(__file__).resolve().parent / "data" / "evals.jsonl"


class EvalRecord(BaseModel):
    id: str
    timestamp: str
    domain: str = "Other"
    has_image: bool = False
    question: str
    answer: str
    scores: dict = Field(default_factory=dict)
    overall: Optional[float] = None
    notes: str = ""
    model: str = "gpt-4o"


@app.post("/evals")
def save_eval(record: EvalRecord):
    """Append an evaluation case (for freelancer GenAI reliability reviews)."""
    EVALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with EVALS_PATH.open("a", encoding="utf-8") as f:
        f.write(record.model_dump_json() + "\n")
    return {"status": "saved", "id": record.id}


@app.get("/evals")
def list_evals():
    if not EVALS_PATH.exists():
        return []
    rows = []
    with EVALS_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(EvalRecord.model_validate_json(line).model_dump())
            except Exception:
                continue
    return rows


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        settings = get_settings()
        client = get_client()
        config = req.config or ModelConfig(
            temperature=settings.default_temperature,
            max_tokens=settings.default_max_tokens,
            model=settings.default_model,
        )
        # Vision works best with a multimodal model
        model = config.model or settings.default_model
        if (req.images or req.image_base64_list) and model in ("gpt-3.5-turbo", "gpt-4", "gpt-4-turbo-preview"):
            model = "gpt-4o"

        openai_messages = build_openai_messages(
            req.messages,
            req.image_base64_list,
            req.images,
        )
        resp = client.chat.completions.create(
            model=model,
            messages=openai_messages,
            temperature=config.temperature,
            max_tokens=max(config.max_tokens, 1024) if (req.images or req.image_base64_list) else config.max_tokens,
        )
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
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"{type(e).__name__}: {e}") from e


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
    file_resp = _safe_file(FRONTEND_DIST / full_path)
    if file_resp is not None:
        return file_resp
    index = FRONTEND_DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")
