import { useState, useRef, useEffect } from 'react'

interface Props {
  onSubmit: (query: string) => void
  loading: boolean
  onNewSession: () => void
}

const PLACEHOLDER = `Describe the clinical scenario, e.g.

"65-year-old with Type 2 diabetes (HbA1c 8.2%) and hypertension (BP 145/92) on metformin 1000mg BID. What are evidence-based next steps for glycemic and BP management?"`

export default function QueryInput({ onSubmit, loading, onNewSession }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    onSubmit(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="space-y-3">
      {/* Disclaimer banner */}
      <div className="rounded-lg bg-teal-50 border border-teal-200 px-4 py-2.5 text-sm text-teal-800">
        <span className="font-semibold">Clinical decision support only.</span>{' '}
        This tool provides evidence-based information for clinician reference.
        Final clinical decisions rest with the treating clinician.
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER}
          disabled={loading}
          rows={4}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 disabled:opacity-60 transition"
        />
        <span className="absolute bottom-2.5 right-3 text-xs text-slate-400 select-none">
          {text.length > 0 ? `${text.length} chars` : '⌘ Enter to submit'}
        </span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Consulting agents…
            </span>
          ) : (
            'Get clinical support'
          )}
        </button>
        <button
          onClick={onNewSession}
          disabled={loading}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50 transition"
          title="Start a new session"
        >
          New session
        </button>
      </div>
    </div>
  )
}
