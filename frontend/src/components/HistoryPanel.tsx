import type { HistoryTurn } from '../types'

interface Props {
  history: HistoryTurn[]
}

export default function HistoryPanel({ history }: Props) {
  if (!history.length) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-medium text-slate-700">
          Session history
          <span className="ml-2 text-xs text-slate-400">({history.length} {history.length === 1 ? 'query' : 'queries'})</span>
        </h3>
      </div>
      <div className="divide-y divide-slate-50 max-h-60 overflow-y-auto">
        {[...history].reverse().map((turn, i) => (
          <div key={i} className="px-4 py-3">
            <p className="text-xs font-medium text-slate-500 truncate mb-1">{turn.query}</p>
            <p className="text-xs text-slate-400 line-clamp-2">{turn.response}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
