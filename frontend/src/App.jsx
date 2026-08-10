import React, { useState, useEffect, useRef } from 'react'
import { getConfig, chat } from './api'
import './App.css'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const base64 = dataUrl.split(',')[1]
      resolve(base64 || '')
    }
    reader.onerror = reject
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

  useEffect(() => {
    getConfig()
      .then((c) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => {})
    // Must be a boolean — if we pass the SpeechRecognition constructor to
    // setState, React treats it as an updater and calls it without `new`.
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    setVoiceSupported(typeof SpeechRec === 'function')
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = (input || '').trim()
    if (!text && images.length === 0) return
    setError(null)
    const userContent = text || (images.length ? 'Please describe or analyze these health images (e.g. scans, x-rays, dermatology).' : '')
    const newUserMessage = { role: 'user', content: userContent }
    setMessages((prev) => [...prev, newUserMessage])
    setInput('')
    setImages([])
    setImagesPreview([])
    setLoading(true)

    let imageBase64List = []
    try {
      if (images.length) {
        imageBase64List = await Promise.all(images.map((f) => fileToBase64(f)))
      }
    } catch (e) {
      setError('Failed to read image(s).')
      setLoading(false)
      return
    }

    const allMessages = [...messages, newUserMessage].map((m) => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : m.content,
    }))

    try {
      const res = await chat({
        messages: allMessages,
        config: { temperature: config.temperature, max_tokens: config.max_tokens, model: config.model },
        imageBase64List: imageBase64List.length ? imageBase64List : undefined,
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
    const valid = files.filter((f) => f.type.startsWith('image/'))
    setImages((prev) => [...prev, ...valid])
    valid.forEach((f) => {
      const reader = new FileReader()
      reader.onload = () => setImagesPreview((p) => [...p, reader.result])
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
              <p>You can type, use voice, or upload health images (scans, x-rays, dermatology).</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`message message--${m.role}`}>
              <span className="message-role">{m.role === 'user' ? 'You' : 'Healthcare GPT'}</span>
              <div className="message-content">{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="message message--assistant">
              <span className="message-role">Healthcare GPT</span>
              <div className="message-content typing">Thinking…</div>
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
              <input type="file" accept="image/*" multiple onChange={onFileChange} />
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
              placeholder="Type or speak your healthcare question…"
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
