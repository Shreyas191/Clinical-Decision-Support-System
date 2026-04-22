import { useState, useEffect } from 'react'
import axios from 'axios'
import type { PatientSummary, PatientRecord } from '../types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Props {
  selectedPatientId: string | null
  onSelect: (patientId: string | null) => void
}

export default function PatientSelector({ selectedPatientId, onSelect }: Props) {
  const [patients, setPatients] = useState<PatientSummary[]>([])
  const [record, setRecord] = useState<PatientRecord | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    axios
      .get<PatientSummary[]>(`${API_URL}/ehr/patients`)
      .then(r => setPatients(r.data))
      .catch(() => setPatients([]))
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    if (!selectedPatientId) {
      setRecord(null)
      return
    }
    setLoadingRecord(true)
    axios
      .get<PatientRecord>(`${API_URL}/ehr/patients/${selectedPatientId}`)
      .then(r => setRecord(r.data))
      .catch(() => setRecord(null))
      .finally(() => setLoadingRecord(false))
  }, [selectedPatientId])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    onSelect(val || null)
    setExpanded(false)
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      {/* Header row */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold uppercase tracking-wide text-indigo-600 mb-1.5">
            EHR Patient Context
          </label>
          {loadingList ? (
            <div className="h-9 rounded-lg bg-indigo-100 animate-pulse" />
          ) : (
            <select
              value={selectedPatientId ?? ''}
              onChange={handleChange}
              className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
            >
              <option value="">No patient selected — use vector search</option>
              {patients.map(p => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.patient_id} · {p.name} ({p.age}
                  {p.gender === 'Male' ? 'M' : 'F'}) — {p.chief_complaint.slice(0, 55)}
                  {p.chief_complaint.length > 55 ? '…' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
        {selectedPatientId && record && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2 mt-5"
          >
            {expanded ? 'Hide details' : 'Show details'}
          </button>
        )}
      </div>

      {/* Patient summary card */}
      {selectedPatientId && (
        <div className="border-t border-indigo-200 bg-white px-4 py-3">
          {loadingRecord ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ) : record ? (
            <div className="space-y-3">
              {/* Name + chief complaint */}
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {record.name}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {record.age} y/o {record.gender} · {record.patient_id}
                  </span>
                </p>
                <p className="text-xs text-slate-600 mt-0.5 italic">{record.chief_complaint}</p>
              </div>

              {/* Conditions */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                  Active conditions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {record.active_conditions.map((c, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Medications */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                  Current medications
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {record.current_medications.map((m, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700"
                    >
                      {m.name} {m.dose} {m.frequency}
                    </span>
                  ))}
                </div>
              </div>

              {/* Allergies */}
              {record.allergies.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                    Allergies
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {record.allergies.map((a, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Expanded: labs + visit history */}
              {expanded && (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                      Recent labs
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {Object.entries(record.recent_labs).map(([k, v]) => (
                        <div key={k} className="flex items-baseline gap-1 text-xs">
                          <span className="text-slate-500 shrink-0">{k}:</span>
                          <span className="text-slate-800 font-medium truncate">
                            {String(v.value)} {v.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                      Visit history
                    </p>
                    <div className="space-y-2">
                      {record.visit_history.map((v, i) => (
                        <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <p className="text-xs font-medium text-slate-600">
                            {v.date} · {v.type}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{v.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Failed to load patient record.</p>
          )}
        </div>
      )}
    </div>
  )
}
