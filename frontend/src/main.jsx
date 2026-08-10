import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', color: '#f5f8fc', background: '#0b1f33', minHeight: '100vh' }}>
          <h2 style={{ color: '#ffb4b4' }}>App error</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{String(this.state.error?.message || this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:2rem;color:#fff;background:#0b1f33;">Error: root element not found.</p>'
} else {
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    )
  } catch (err) {
    rootEl.innerHTML = `
      <div style="padding:2rem;background:#0b1f33;color:#f5f8fc;font-family:system-ui;min-height:100vh;">
        <h2 style="color:#ffb4b4;">Something went wrong</h2>
        <pre>${String(err.message || err)}</pre>
      </div>
    `
  }
}
