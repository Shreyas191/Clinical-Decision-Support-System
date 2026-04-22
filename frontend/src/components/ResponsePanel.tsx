import type { FinalResponse } from '../types'

interface Props {
  response: FinalResponse
}

const EVIDENCE_LABEL: Record<string, string> = {
  A: 'Level A · Strong RCT evidence',
  B: 'Level B · Moderate evidence',
  C: 'Level C · Expert opinion',
}

const EVIDENCE_COLORS: Record<string, string> = {
  A: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  B: 'bg-amber-50 text-amber-700 border-amber-200',
  C: 'bg-zinc-100 text-zinc-500 border-zinc-200',
}

export default function ResponsePanel({ response }: Props) {
  const evColor = EVIDENCE_COLORS[response.evidence_level] ?? EVIDENCE_COLORS.C
  const evLabel = EVIDENCE_LABEL[response.evidence_level] ?? 'Level C · Expert opinion'

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden divide-y divide-zinc-100">

      {response.escalate_flag && (
        <div className="bg-red-50 px-4 py-3 flex items-start gap-2.5">
          <div className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-red-200 flex items-center justify-center">
            <span className="block h-1.5 w-1.5 rounded-full bg-red-600" />
          </div>
          <p className="text-sm text-red-700">
            <span className="font-medium">Human review recommended. </span>
            {response.safety_note ?? 'This case may benefit from specialist consultation.'}
          </p>
        </div>
      )}

      <div className="px-4 py-4">
        <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Summary</p>
        <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
          {response.recommendation}
        </p>
      </div>

      {response.safety_flags?.length > 0 && (
        <div className="px-4 py-4">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Safety flags</p>
          <div className="space-y-2">
            {response.safety_flags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md bg-red-50 border border-red-100 px-3 py-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <p className="text-xs text-red-700 leading-relaxed">{flag}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {response.citations?.length > 0 && (
        <div className="px-4 py-4">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">Sources</p>
          <ol className="space-y-1">
            {response.citations.map((cite, i) => (
              <li key={i} className="flex gap-2 text-xs text-zinc-500">
                <span className="text-zinc-300 tabular-nums shrink-0">{i + 1}.</span>
                <span>{cite}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="px-4 py-3 flex items-center justify-between">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${evColor}`}>
          {evLabel}
        </span>
      </div>

      <div className="px-4 py-3 bg-zinc-50">
        <p className="text-xs text-zinc-400 leading-relaxed">
          {response.disclaimer}
        </p>
      </div>
    </div>
  )
}
