/**
 * Frontend only calls the backend. API key is never used or visible here.
 *
 * When served by the FastAPI backend (integrated mode), the frontend and
 * backend share the same origin, so we call `/config`, `/chat`, etc. directly.
 * In dev, you can point VITE_API_URL to http://127.0.0.1:8000 if needed.
 */
const API_BASE = import.meta.env.VITE_API_URL || '';

function formatErrorDetail(detail, fallback) {
  if (!detail) return fallback || 'Request failed';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'string' ? d : d.msg || d.detail || JSON.stringify(d)))
      .join('; ');
  }
  if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return String(detail);
}

export async function getConfig() {
  const r = await fetch(`${API_BASE}/config`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function chat({ messages, config, imageBase64List }) {
  const body = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    config: config || undefined,
    image_base64_list: imageBase64List && imageBase64List.length ? imageBase64List : undefined,
  };
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatErrorDetail(err.detail, res.statusText || 'Request failed'));
  }
  return res.json();
}

export async function health() {
  const r = await fetch(`${API_BASE}/health`);
  return r.ok ? r.json() : null;
}
