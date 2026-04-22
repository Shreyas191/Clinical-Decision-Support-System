import { useState } from 'react'
import axios from 'axios'
import { getToken, setToken, clearToken, type AuthUser } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Props {
  user: AuthUser
  onApproved: (user: AuthUser) => void
  onLogout: () => void
}

export default function PendingPage({ user, onApproved, onLogout }: Props) {
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState('')

  const checkStatus = async () => {
    setChecking(true)
    setMessage('')
    try {
      const { data } = await axios.get<{ token: string; user: AuthUser }>(
        `${API_URL}/auth/refresh`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      )
      setToken(data.token)
      if (data.user.status === 'approved') {
        onApproved(data.user)
      } else {
        setMessage('Your account is still pending approval.')
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 403) {
        setMessage('Account access has been denied. Contact your administrator.')
      } else {
        setMessage('Could not reach the server. Try again shortly.')
      }
    } finally {
      setChecking(false)
    }
  }

  const handleLogout = () => {
    clearToken()
    onLogout()
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm px-8 py-8 space-y-5 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-semibold text-zinc-800">Account pending approval</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Hi {user.name.split(' ')[0]}, your request for access to the Clinical Decision Support System is awaiting administrator approval.
            </p>
          </div>

          <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-4 py-3 text-left">
            <p className="text-xs text-zinc-500">Signed in as</p>
            <p className="text-xs font-medium text-zinc-700 mt-0.5">{user.email}</p>
          </div>

          {message && (
            <p className="text-xs text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2">
              {message}
            </p>
          )}

          <div className="space-y-2">
            <button
              onClick={checkStatus}
              disabled={checking}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {checking ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Checking...
                </span>
              ) : 'Check approval status'}
            </button>

            <button
              onClick={handleLogout}
              className="w-full rounded-lg border border-zinc-200 px-4 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
