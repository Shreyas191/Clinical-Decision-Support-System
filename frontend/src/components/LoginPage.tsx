import { useState } from 'react'
import axios from 'axios'
import { setToken, type AuthUser } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface Props {
  onAuth: (user: AuthUser) => void
}

type Mode = 'signin' | 'signup'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908C16.658 14.233 17.64 11.925 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginPage({ onAuth }: Props) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError('')
    setName('')
    setEmail('')
    setPassword('')
    setConfirm('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login'
      const payload = mode === 'signup'
        ? { name, email, password }
        : { email, password }

      const { data } = await axios.post<{ token: string; user: AuthUser }>(
        `${API_URL}${endpoint}`,
        payload,
      )
      setToken(data.token)
      onAuth(data.user)
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.detail ?? err.message
        : 'Something went wrong'
      setError(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-zinc-800 tracking-tight">Clinical Decision Support</h1>
          <p className="text-sm text-zinc-400 mt-1">Evidence-based support for clinicians</p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          {/* Tab toggle */}
          <div className="flex border-b border-zinc-100">
            {(['signin', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-3 text-sm font-medium transition ${
                  mode === m
                    ? 'text-zinc-800 border-b-2 border-blue-600 -mb-px'
                    : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                {m === 'signin' ? 'Sign in' : 'Sign up'}
              </button>
            ))}
          </div>

          <div className="px-6 py-6 space-y-4">
            {/* Google button */}
            <a
              href={`${API_URL}/auth/google`}
              className="flex items-center justify-center gap-3 w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
            >
              <GoogleIcon />
              Continue with Google
            </a>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-100" />
              <span className="text-xs text-zinc-400">or</span>
              <div className="flex-1 h-px bg-zinc-100" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Full name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    placeholder="Dr. Jane Smith"
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@hospital.org"
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
                />
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-800 placeholder-zinc-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-50 transition"
                  />
                </div>
              )}

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                  </span>
                ) : (
                  mode === 'signup' ? 'Create account' : 'Sign in'
                )}
              </button>
            </form>

            <p className="text-xs text-zinc-400 text-center leading-relaxed">
              For clinical decision support only. Not a substitute for clinical judgement.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
