import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

const rootEl = document.getElementById('root')
const loadingEl = document.getElementById('loading')
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:2rem;background:#1a2332;color:#e6edf3;min-height:100vh;"><p>Error: root element not found.</p></div>'
} else {
  try {
    if (loadingEl) loadingEl.remove()
    const root = ReactDOM.createRoot(rootEl)
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  } catch (err) {
    rootEl.innerHTML = `
      <div style="padding:2rem;background:#1a2332;color:#e6edf3;font-family:system-ui,sans-serif;max-width:600px;min-height:100vh;">
        <h2 style="color:#fca5a5;">Something went wrong</h2>
        <pre style="background:#0f1419;padding:1rem;border-radius:8px;overflow:auto;font-size:0.85rem;color:#e6edf3;">${String(err.message || err)}</pre>
        <p>Open the app from <strong>http://localhost:5173</strong> (run in terminal: <code>cd frontend && npm run dev</code>).</p>
      </div>
    `
  }
}
