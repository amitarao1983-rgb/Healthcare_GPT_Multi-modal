import React, { useMemo, useState } from 'react'
import {
  EVAL_CHECKLIST,
  DOMAIN_TAGS,
  averageScores,
  summarizeEvals,
  exportEvalsJson,
  exportEvalsCsv,
} from './evaluation'

const emptyScores = () =>
  Object.fromEntries(EVAL_CHECKLIST.map((c) => [c.id, 3]))

export default function EvalPanel({
  open,
  onClose,
  lastPair,
  model,
  evals,
  onSave,
  onClear,
}) {
  const [scores, setScores] = useState(emptyScores)
  const [domain, setDomain] = useState('Medicine')
  const [notes, setNotes] = useState('')
  const [tab, setTab] = useState('rate') // rate | checklist | history
  const summary = useMemo(() => summarizeEvals(evals), [evals])
  const overall = averageScores(scores)

  if (!open) return null

  const handleSave = () => {
    if (!lastPair?.question || !lastPair?.answer) {
      alert('Ask a question first, then rate the latest Healthcare GPT answer.')
      return
    }
    onSave({
      id: `eval_${Date.now()}`,
      timestamp: new Date().toISOString(),
      domain,
      has_image: Boolean(lastPair.hasImage),
      question: lastPair.question,
      answer: lastPair.answer,
      scores: { ...scores },
      overall,
      notes: notes.trim(),
      model: model || 'gpt-4o',
    })
    setNotes('')
    setScores(emptyScores())
    setTab('history')
  }

  return (
    <div className="eval-overlay" role="dialog" aria-label="Evaluation panel">
      <div className="eval-panel">
        <div className="eval-header">
          <h2>GenAI Evaluation</h2>
          <button type="button" className="btn-icon" onClick={onClose} title="Close">×</button>
        </div>

        <div className="eval-tabs">
          <button type="button" className={tab === 'rate' ? 'active' : ''} onClick={() => setTab('rate')}>
            Rate answer
          </button>
          <button type="button" className={tab === 'checklist' ? 'active' : ''} onClick={() => setTab('checklist')}>
            Checklist
          </button>
          <button type="button" className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
            History ({evals.length})
          </button>
        </div>

        {tab === 'checklist' && (
          <div className="eval-body">
            <p className="eval-intro">
              Use this rubric to judge whether Healthcare GPT outputs are reliable and relevant.
              Score each dimension from 1 (poor) to 5 (excellent). Overall ≥ 4 is a pass for client reporting.
            </p>
            <ul className="checklist">
              {EVAL_CHECKLIST.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.question}</span>
                  <div className="checklist-levels">
                    {item.levels.map((l) => (
                      <span key={l.value}>{l.value}: {l.label}</span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'rate' && (
          <div className="eval-body">
            {!lastPair?.answer ? (
              <p className="eval-intro">Send a healthcare question (or image) in chat, then open this panel to rate the reply.</p>
            ) : (
              <>
                <div className="eval-case">
                  <div><strong>Q:</strong> {lastPair.question}</div>
                  <div className="eval-answer"><strong>A:</strong> {lastPair.answer.slice(0, 500)}{lastPair.answer.length > 500 ? '…' : ''}</div>
                  {lastPair.hasImage && <div className="eval-tag">Includes image</div>}
                </div>

                <label className="eval-field">
                  Domain
                  <select value={domain} onChange={(e) => setDomain(e.target.value)}>
                    {DOMAIN_TAGS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>

                {EVAL_CHECKLIST.map((item) => (
                  <div key={item.id} className="score-row">
                    <div className="score-label">
                      <strong>{item.title}</strong>
                      <span>{item.question}</span>
                    </div>
                    <div className="score-buttons">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={scores[item.id] === n ? 'active' : ''}
                          onClick={() => setScores((s) => ({ ...s, [item.id]: n }))}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <label className="eval-field">
                  Notes / issues found
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. hallucinated finding on image; missing clinician caveat; good nursing guidance…"
                  />
                </label>

                <div className="eval-actions">
                  <span className="overall">Overall: <strong>{overall}</strong> / 5</span>
                  <button type="button" className="btn-send" onClick={handleSave}>Save evaluation</button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="eval-body">
            <div className="eval-summary">
              <div><strong>{summary.count}</strong> cases</div>
              <div>Avg overall: <strong>{summary.avgOverall ?? '—'}</strong></div>
              <div>Pass rate (≥4): <strong>{summary.passRate != null ? `${summary.passRate}%` : '—'}</strong></div>
            </div>

            <div className="eval-actions">
              <button type="button" className="upload-btn" onClick={() => exportEvalsJson(evals)} disabled={!evals.length}>
                Export JSON report
              </button>
              <button type="button" className="upload-btn" onClick={() => exportEvalsCsv(evals)} disabled={!evals.length}>
                Export CSV
              </button>
              <button type="button" className="upload-btn danger" onClick={onClear} disabled={!evals.length}>
                Clear all
              </button>
            </div>

            {!evals.length ? (
              <p className="eval-intro">No saved evaluations yet.</p>
            ) : (
              <ul className="eval-history">
                {[...evals].reverse().map((e) => (
                  <li key={e.id}>
                    <div className="eval-history-top">
                      <strong>{e.domain}</strong>
                      <span>Overall {e.overall}/5</span>
                      <span>{new Date(e.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="eval-history-q">{e.question}</div>
                    {e.notes && <div className="eval-history-notes">Notes: {e.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
