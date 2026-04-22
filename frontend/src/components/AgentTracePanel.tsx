import { useState } from 'react'
import type { AgentTrace } from '../types'

interface Props {
  traces: AgentTrace[]
}

const AGENT_DOT: Record<string, string> = {
  Guidelines: 'bg-blue-400',
  Drug:       'bg-amber-400',
  Patient:    'bg-violet-400',
  Synthesis:  'bg-emerald-400',
}

function TraceRow({ trace }: { trace: AgentTrace }) {
  const [open, setOpen] = useState(false)
  const dot = AGENT_DOT[trace.agent] ?? 'bg-zinc-400'

  return (
    <div className="rounded-md border border-zinc-100 bg-zinc-50 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-zinc-100 transition"
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
        <span className="text-xs font-medium text-zinc-600 min-w-[72px]">{trace.agent}</span>
        {trace.docs_retrieved !== undefined && (
          <span className="text-xs text-zinc-400">{trace.docs_retrieved} docs</span>
        )}
        <span className="ml-auto text-xs text-zinc-400 tabular-nums">{trace.latency_ms} ms</span>
        <svg
          className={`h-3 w-3 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-3 py-2.5">
          <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">
            {trace.output_summary}
          </p>
        </div>
      )}
    </div>
  )
}

export default function AgentTracePanel({ traces }: Props) {
  const [open, setOpen] = useState(false)
  if (!traces.length) return null

  const totalMs = traces.reduce((s, t) => s + t.latency_ms, 0)

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition"
      >
        <span className="text-xs font-medium text-zinc-500">Agent traces</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 tabular-nums">{totalMs} ms</span>
          <svg
            className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-4 py-3 space-y-1.5">
          {traces.map((t, i) => (
            <TraceRow key={i} trace={t} />
          ))}
        </div>
      )}
    </div>
  )
}
