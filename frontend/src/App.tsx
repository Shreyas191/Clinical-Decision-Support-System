import { useState } from 'react'
import { useCDSS } from './hooks/useCDSS'
import QueryInput from './components/QueryInput'
import AgentTracePanel from './components/AgentTracePanel'
import ResponsePanel from './components/ResponsePanel'
import HistoryPanel from './components/HistoryPanel'
import PatientSelector from './components/PatientSelector'
import AdminPanel from './components/AdminPanel'
import { clearToken, type AuthUser } from './auth'

interface Props {
  user: AuthUser
  onLogout: () => void
}

export default function App({ user, onLogout }: Props) {
  const { result, history, loading, error, query, newSession } = useCDSS()
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [showAdmin, setShowAdmin] = useState(false)

  const handleQuery = (queryText: string) => {
    query(queryText, selectedPatientId ?? undefined)
  }

  const handleLogout = () => {
    clearToken()
    newSession()
    onLogout()
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
      <header className="bg-white border-b border-zinc-200 px-6 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-zinc-800 tracking-tight">Clinical Decision Support</h1>
            <p className="text-xs text-zinc-400 mt-0.5">For clinician reference only</p>
          </div>
          <div className="flex items-center gap-3">
            {user.is_admin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition"
              >
                Users
              </button>
            )}
            {user.picture && (
              <img
                src={user.picture}
                alt={user.name}
                className="h-7 w-7 rounded-full border border-zinc-200"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="text-xs text-zinc-500 hidden sm:block">{user.name}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <PatientSelector
          selectedPatientId={selectedPatientId}
          onSelect={setSelectedPatientId}
        />

        <QueryInput
          onSubmit={handleQuery}
          loading={loading}
        />

        {error && (
          <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {loading && (
          <div className="rounded-lg border border-zinc-100 bg-white p-5 space-y-3 animate-pulse">
            <div className="h-2.5 bg-zinc-100 rounded w-1/4" />
            <div className="h-2.5 bg-zinc-100 rounded w-full" />
            <div className="h-2.5 bg-zinc-100 rounded w-5/6" />
            <div className="h-2.5 bg-zinc-100 rounded w-3/4" />
          </div>
        )}

        {result && !loading && (
          <>
            <AgentTracePanel traces={result.traces} />
            <ResponsePanel response={result.response} />
          </>
        )}

        <HistoryPanel history={history} />
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-xs text-zinc-300 text-center">
          Clinical decision support only. Not a substitute for clinical judgement.
        </p>
      </footer>
    </div>
  )
}
