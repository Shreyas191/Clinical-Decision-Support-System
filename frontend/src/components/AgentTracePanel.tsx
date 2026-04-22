import { useState } from 'react'
import type { AgentTrace } from '../types'

interface Props {
  traces: AgentTrace[]
}

const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Guidelines: { bg: 'bg-teal-50',   text: 'text-teal-800',   border: 'border-teal-200' },
  Drug:       { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200' },
  Patient:    { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  Synthesis:  { bg: 'bg-blue-50',   text: 'text-blue-800',   border: 'border-blue-200' },
}

const AGENT_ICONS: Record<string, string> = {
  Guidelines: '📋',
  Drug:       '💊',
  Patient:    '🏥',
  Synthesis:  '🔬',
}

function TraceRow({ trace }: { trace: AgentTrace }) {
  const [open, setOpen] = useState(false)
  const colors = AGENT_COLORS[trace.agent] ?? AGENT_COLORS.Synthesis

  return (
    <div
      className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:brightness-95 transition"
      >
        <span className="text-base" style={{ fontSize: 16 }}>
          {AGENT_ICONS[trace.agent] ?? '🤖'}
        </span>
        <span className={`text-xs font-semibold ${colors.text} min-w-[80px]`}>
          {trace.agent}
        </span>
        {trace.docs_retrieved !== undefined && (
          <span className="text-xs text-slate-500">
            {trace.docs_retrieved} docs
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {trace.latency_ms}ms
        </span>
        <svg
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-current border-opacity-10 px-3 py-2.5">
          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            {trace.output_summary}
          </p>
        </div>
      )}
    </div>
  )
}

export default function AgentTracePanel({ traces }: Props) {
  const [panelOpen, setPanelOpen] = useState(false)

  if (!traces.length) return null

  const totalMs = traces.reduce((s, t) => s + t.latency_ms, 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Panel toggle */}
      <button
        onClick={() => setPanelOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Agent traces</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {traces.length} agents
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 tabular-nums">{totalMs}ms total</span>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform ${panelOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {panelOpen && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-2">
          {traces.map((t, i) => (
            <TraceRow key={i} trace={t} />
          ))}
        </div>
      )}
    </div>
  )
}
