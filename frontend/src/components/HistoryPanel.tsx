import type { HistoryTurn } from '../types'

interface Props {
  history: HistoryTurn[]
}

export default function HistoryPanel({ history }: Props) {
  if (!history.length) return null

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
          Session history
          <span className="ml-2 font-normal normal-case">({history.length} {history.length === 1 ? 'query' : 'queries'})</span>
        </p>
      </div>
      <div className="divide-y divide-zinc-50 max-h-56 overflow-y-auto">
        {[...history].reverse().map((turn, i) => (
          <div key={i} className="px-4 py-3">
            <p className="text-xs font-medium text-zinc-600 truncate">{turn.query}</p>
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">{turn.response}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
