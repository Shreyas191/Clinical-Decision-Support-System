import { useState, useRef, useEffect } from 'react'

interface Props {
  onSubmit: (query: string) => void
  loading: boolean
}

const PLACEHOLDER = `Describe the clinical scenario…

e.g. "65-year-old with T2DM and hypertension on metformin. HbA1c 8.2%, BP 145/92. What are evidence-based next steps?"`

export default function QueryInput({ onSubmit, loading }: Props) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    <div className="space-y-2">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER}
          disabled={loading}
          rows={4}
          className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 placeholder-zinc-400 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 disabled:opacity-50 transition"
        />
        {text.length === 0 && (
          <span className="absolute bottom-3 right-3 text-xs text-zinc-300 select-none">
            ⌘ Enter
          </span>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!text.trim() || loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Consulting agents
          </span>
        ) : (
          'Get clinical support'
        )}
      </button>
    </div>
  )
}
