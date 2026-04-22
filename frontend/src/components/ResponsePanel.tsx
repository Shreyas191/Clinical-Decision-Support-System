import type { FinalResponse } from '../types'

interface Props {
  response: FinalResponse
}

const EVIDENCE_STYLES = {
  A: { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200',  label: 'A — Strong (RCT evidence)' },
  B: { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-200',  label: 'B — Moderate evidence' },
  C: { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200',  label: 'C — Expert opinion' },
}

export default function ResponsePanel({ response }: Props) {
  const ev = EVIDENCE_STYLES[response.evidence_level] ?? EVIDENCE_STYLES.C

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-0">

      {/* Escalation warning */}
      {response.escalate_flag && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 flex items-start gap-2">
          <svg className="h-4 w-4 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-red-700">
            <span className="font-semibold">Human review recommended.</span>{' '}
            {response.safety_note ?? 'This case may benefit from specialist consultation.'}
          </p>
        </div>
      )}

      {/* Recommendation */}
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
          Clinical decision support summary
        </h3>
        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {response.recommendation}
        </p>
      </div>

      {/* Safety flags */}
      {response.safety_flags?.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Safety flags
          </h3>
          <div className="space-y-1.5">
            {response.safety_flags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                <svg className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-red-700">{flag}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Citations */}
      {response.citations?.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Sources
          </h3>
          <ol className="space-y-1">
            {response.citations.map((cite, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-600">
                <span className="text-slate-400 tabular-nums shrink-0">{i + 1}.</span>
                <span>{cite}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Evidence level */}
      <div className="px-4 py-3 border-t border-slate-100">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border ${ev.bg} ${ev.text} ${ev.border}`}>
          <span className="font-bold">Level {response.evidence_level}</span>
          <span className="opacity-70">—</span>
          <span>{ev.label.split(' — ')[1]}</span>
        </span>
      </div>

      {/* Disclaimer — always visible, cannot be hidden */}
      <div className="px-4 py-3 border-t border-teal-100 bg-teal-50">
        <p className="text-xs text-teal-700 leading-relaxed">
          <span className="font-semibold">Disclaimer: </span>
          {response.disclaimer}
        </p>
      </div>
    </div>
  )
}
