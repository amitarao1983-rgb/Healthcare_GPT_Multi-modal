import React, { useState, useEffect, useRef } from 'react'
import { getConfig, chat } from './api'
import './App.css'

const MAX_IMAGE_EDGE = 1568
const JPEG_QUALITY = 0.82

function isLikelyImage(file) {
  if (file.type && file.type.startsWith('image/')) return true
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '')
}

/** Resize/compress large phone photos so vision requests succeed on hosted backends. */
function fileToImagePayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const dataUrl = reader.result
      const img = new Image()
      img.onerror = () => {
        // Fallback: send original base64 if canvas decode fails (e.g. some HEIC)
        const base64 = String(dataUrl).split(',')[1] || ''
        const mime = file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg'
        resolve({ data: base64, mime, preview: dataUrl })
      }
      img.onload = () => {
        let { width, height } = img
        const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height, 1))
        width = Math.max(1, Math.round(width * scale))
        height = Math.max(1, Math.round(height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const outMime = 'image/jpeg'
        const outUrl = canvas.toDataURL(outMime, JPEG_QUALITY)
        const base64 = outUrl.split(',')[1] || ''
        resolve({ data: base64, mime: outMime, preview: outUrl })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState({ temperature: 0.6, max_tokens: 2048, model: 'gpt-4o' })
  const [showSettings, setShowSettings] = useState(false)
  const [images, setImages] = useState([])
  const [imagesPreview, setImagesPreview] = useState([])
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    getConfig()
      .then((c) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => {})
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    setVoiceSupported(typeof SpeechRec === 'function')
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = (input || '').trim()
    const filesToSend = [...images]
    if (!text && filesToSend.length === 0) return
    setError(null)

    const userContent =
      text ||
      (filesToSend.length
        ? 'Please analyze these health image(s). Describe what you see (e.g. scan, x-ray, dermatology) and provide educational observations. Remind me this is not a medical diagnosis.'
        : '')

    const previewUrls = [...imagesPreview]
    const newUserMessage = {
      role: 'user',
      content: userContent,
      previews: previewUrls,
    }
    setMessages((prev) => [...prev, newUserMessage])
    setInput('')
    setImages([])
    setImagesPreview([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    setLoading(true)

    let imagePayloads = []
    try {
      if (filesToSend.length) {
        imagePayloads = await Promise.all(filesToSend.map((f) => fileToImagePayload(f)))
        imagePayloads = imagePayloads.filter((p) => p.data)
      }
    } catch (e) {
      setError('Failed to read image(s). Try JPG or PNG under 10 MB.')
      setLoading(false)
      return
    }

    const allMessages = [...messages, { role: 'user', content: userContent }].map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    }))

    try {
      const res = await chat({
        messages: allMessages,
        config: {
          temperature: config.temperature,
          max_tokens: imagePayloads.length ? Math.max(config.max_tokens, 1500) : config.max_tokens,
          model: config.model || 'gpt-4o',
        },
        images: imagePayloads.length
          ? imagePayloads.map(({ data, mime }) => ({ data, mime }))
          : undefined,
      })
      setMessages((prev) => [...prev, { role: 'assistant', content: res.message }])
    } catch (e) {
      setError(e.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVoice = () => {
    if (!voiceSupported || listening) return
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (typeof Recognition !== 'function') {
      setError('Voice input is not supported in this browser.')
      return
    }
    try {
      const rec = new Recognition()
      rec.continuous = false
      rec.interimResults = false
      rec.lang = 'en-US'
      rec.onstart = () => setListening(true)
      rec.onend = () => setListening(false)
      rec.onerror = () => setListening(false)
      rec.onresult = (e) => {
        const t = e.results[0][0].transcript
        setInput((prev) => (prev ? `${prev} ${t}` : t))
      }
      rec.start()
    } catch (e) {
      setError(e.message || 'Voice input failed to start.')
      setListening(false)
    }
  }

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || [])
    const valid = files.filter(isLikelyImage)
    if (!valid.length) {
      setError('Please choose image files (JPG, PNG, WebP, or GIF).')
      return
    }
    if (valid.length > 4) {
      setError('You can upload up to 4 images at a time.')
    }
    const limited = valid.slice(0, 4)
    setImages((prev) => [...prev, ...limited].slice(0, 4))
    limited.forEach((f) => {
      const reader = new FileReader()
      reader.onload = () => setImagesPreview((p) => [...p, reader.result].slice(0, 4))
      reader.readAsDataURL(f)
    })
  }

  const removeImage = (i) => {
    setImages((prev) => prev.filter((_, j) => j !== i))
    setImagesPreview((prev) => prev.filter((_, j) => j !== i))
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Healthcare GPT</h1>
        <p className="tagline">Medicine · Clinical research · Healthcare management · Medicolegal · Nursing</p>
        <button type="button" className="btn-icon" onClick={() => setShowSettings(!showSettings)} title="Settings">
          ⚙
        </button>
      </header>

      {showSettings && (
        <div className="settings-panel">
          <label>
            Temperature
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={config.temperature}
              onChange={(e) => setConfig((c) => ({ ...c, temperature: +e.target.value }))}
            />
            <span>{config.temperature}</span>
          </label>
          <label>
            Max tokens
            <input
              type="number"
              min="256"
              max="4096"
              step="256"
              value={config.max_tokens}
              onChange={(e) => setConfig((c) => ({ ...c, max_tokens: +e.target.value || 2048 }))}
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))}
            />
          </label>
        </div>
      )}

      <main className="main">
        <div className="messages">
          {messages.length === 0 && (
            <div className="welcome">
              <p>Ask anything about healthcare: medicine, clinical research, healthcare management, medicolegal law, nursing.</p>
              <p>Upload health images (scans, x-rays, dermatology) with the Images button, then Send.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`message message--${m.role}`}>
              <span className="message-role">{m.role === 'user' ? 'You' : 'Healthcare GPT'}</span>
              {m.previews && m.previews.length > 0 && (
                <div className="message-images">
                  {m.previews.map((src, j) => (
                    <img key={j} src={src} alt={`Attached ${j + 1}`} />
                  ))}
                </div>
              )}
              <div className="message-content">{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="message message--assistant">
              <span className="message-role">Healthcare GPT</span>
              <div className="message-content typing">Analyzing…</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <div className="error">{error}</div>}

        <div className="input-area">
          {imagesPreview.length > 0 && (
            <div className="image-previews">
              {imagesPreview.map((src, i) => (
                <div key={i} className="image-preview">
                  <img src={src} alt={`Upload ${i + 1}`} />
                  <button type="button" className="remove-image" onClick={() => removeImage(i)} aria-label="Remove">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="input-row">
            <label className="upload-btn">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/*"
                multiple
                onChange={onFileChange}
              />
              📷 Images
            </label>
            {voiceSupported && (
              <button
                type="button"
                className={`btn-icon voice ${listening ? 'listening' : ''}`}
                onClick={handleVoice}
                disabled={listening}
                title="Voice input"
              >
                🎤
              </button>
            )}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Ask about an image or type a healthcare question…"
              rows={2}
              disabled={loading}
            />
            <button type="button" className="btn-send" onClick={sendMessage} disabled={loading}>
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
