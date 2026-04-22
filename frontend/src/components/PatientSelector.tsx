import { useState, useEffect } from 'react'
import axios from 'axios'
import type { PatientSummary, PatientRecord } from '../types'
import { authHeader } from '../auth'

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
      .get<PatientSummary[]>(`${API_URL}/ehr/patients`, { headers: authHeader() })
      .then(r => setPatients(r.data))
      .catch(() => setPatients([]))
      .finally(() => setLoadingList(false))
  }, [])

  useEffect(() => {
    if (!selectedPatientId) { setRecord(null); return }
    setLoadingRecord(true)
    axios
      .get<PatientRecord>(`${API_URL}/ehr/patients/${selectedPatientId}`, { headers: authHeader() })
      .then(r => setRecord(r.data))
      .catch(() => setRecord(null))
      .finally(() => setLoadingRecord(false))
  }, [selectedPatientId])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSelect(e.target.value || null)
    setExpanded(false)
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3">
        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
          Patient context
        </label>
        {loadingList ? (
          <div className="h-9 rounded-md bg-zinc-100 animate-pulse" />
        ) : (
          <select
            value={selectedPatientId ?? ''}
            onChange={handleChange}
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
          >
            <option value="">No patient selected, use vector search</option>
            {patients.map(p => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.name} · {p.age}{p.gender === 'Male' ? 'M' : 'F'} · {p.chief_complaint.slice(0, 60)}{p.chief_complaint.length > 60 ? '...' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedPatientId && (
        <div className="border-t border-zinc-100 px-4 py-3">
          {loadingRecord ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-2.5 bg-zinc-100 rounded w-1/3" />
              <div className="h-2.5 bg-zinc-100 rounded w-2/3" />
            </div>
          ) : record ? (
            <div className="space-y-3">
              {/* Name row */}
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-medium text-zinc-800">{record.name}</span>
                  <span className="ml-2 text-xs text-zinc-400">
                    {record.age} y/o {record.gender} · {record.patient_id}
                  </span>
                </div>
                <button
                  onClick={() => setExpanded(v => !v)}
                  className="text-xs text-blue-500 hover:text-blue-700 transition shrink-0 ml-3"
                >
                  {expanded ? 'Less' : 'More'}
                </button>
              </div>

              <p className="text-xs text-zinc-500 italic">{record.chief_complaint}</p>

              {/* Conditions */}
              <div>
                <p className="text-xs text-zinc-400 mb-1">Conditions</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.active_conditions.map((c, i) => (
                    <span key={i} className="rounded-md bg-red-50 border border-red-100 px-2 py-0.5 text-xs text-red-600">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Medications */}
              <div>
                <p className="text-xs text-zinc-400 mb-1">Medications</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.current_medications.map((m, i) => (
                    <span key={i} className="rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600">
                      {m.name} {m.dose}
                    </span>
                  ))}
                </div>
              </div>

              {/* Allergies */}
              {record.allergies.length > 0 && record.allergies[0] !== 'NKDA' && (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Allergies</p>
                  <div className="flex flex-wrap gap-1.5">
                    {record.allergies.map((a, i) => (
                      <span key={i} className="rounded-md bg-amber-50 border border-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Expanded: labs + visits */}
              {expanded && (
                <>
                  <div>
                    <p className="text-xs text-zinc-400 mb-1.5">Recent labs</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      {Object.entries(record.recent_labs).map(([k, v]) => (
                        <div key={k} className="flex items-baseline gap-1.5 text-xs">
                          <span className="text-zinc-400 shrink-0">{k}</span>
                          <span className="text-zinc-700 font-medium truncate">
                            {String(v.value)}{v.unit ? ' ' + v.unit : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-zinc-400 mb-1.5">Visit history</p>
                    <div className="space-y-2">
                      {record.visit_history.map((v, i) => (
                        <div key={i} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                          <p className="text-xs font-medium text-zinc-500">{v.date} · {v.type}</p>
                          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{v.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">Failed to load patient record.</p>
          )}
        </div>
      )}
    </div>
  )
}
