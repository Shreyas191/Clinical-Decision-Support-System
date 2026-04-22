import { useState } from 'react'
import { useCDSS } from './hooks/useCDSS'
import QueryInput from './components/QueryInput'
import AgentTracePanel from './components/AgentTracePanel'
import ResponsePanel from './components/ResponsePanel'
import HistoryPanel from './components/HistoryPanel'
import PatientSelector from './components/PatientSelector'

export default function App() {
  const { result, history, loading, error, query, newSession } = useCDSS()
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)

  const handleQuery = (queryText: string) => {
    query(queryText, selectedPatientId ?? undefined)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-800">CDSS</h1>
            <p className="text-xs text-slate-400">Clinical Decision Support System</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-1 text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
              Groq · Llama 3.3 70B
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-blue-700">
              Gemini embeddings
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Patient selector */}
        <PatientSelector
          selectedPatientId={selectedPatientId}
          onSelect={setSelectedPatientId}
        />

        {/* Query input */}
        <QueryInput
          onSubmit={handleQuery}
          loading={loading}
          onNewSession={newSession}
        />

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">
              <span className="font-semibold">Error: </span>{error}
            </p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-3 animate-pulse">
            <div className="h-3 bg-slate-100 rounded w-1/3" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-5/6" />
            <div className="h-3 bg-slate-100 rounded w-4/6" />
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            <AgentTracePanel traces={result.traces} />
            <ResponsePanel response={result.response} />
          </>
        )}

        {/* History */}
        <HistoryPanel history={history} />
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-slate-400">
          Multi-agent system · LangGraph + Groq + Gemini + ChromaDB · $0/month
        </p>
      </footer>
    </div>
  )
}
