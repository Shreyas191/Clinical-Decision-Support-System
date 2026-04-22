export interface AgentTrace {
  agent: 'Guidelines' | 'Drug' | 'Patient' | 'Synthesis'
  latency_ms: number
  docs_retrieved?: number
  output_summary: string
}

export interface FinalResponse {
  recommendation: string
  citations: string[]
  evidence_level: 'A' | 'B' | 'C'
  safety_flags: string[]
  disclaimer: string
  escalate_flag: boolean
  safety_note?: string
}

export interface QueryResponse {
  response: FinalResponse
  traces: AgentTrace[]
  session_id: string
  blocked?: boolean
  error?: string
}

export interface HistoryTurn {
  query: string
  response: string
}

export interface PatientSummary {
  patient_id: string
  name: string
  age: number
  gender: string
  chief_complaint: string
}

export interface Medication {
  name: string
  dose: string
  frequency: string
}

export interface LabValue {
  value: number | string
  unit: string
}

export interface VisitRecord {
  date: string
  type: string
  notes: string
}

export interface PatientRecord extends PatientSummary {
  active_conditions: string[]
  current_medications: Medication[]
  recent_labs: Record<string, LabValue>
  allergies: string[]
  visit_history: VisitRecord[]
}
