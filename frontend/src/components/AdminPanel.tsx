import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { authHeader } from '../auth'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

interface UserRow {
  id: string
  email: string
  name: string
  provider: string
  created_at: string
  status: 'pending' | 'approved' | 'rejected'
  is_admin: number
}

interface Props {
  onClose: () => void
}

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

export default function AdminPanel({ onClose }: Props) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await axios.get<UserRow[]>(`${API_URL}/admin/users`, { headers: authHeader() })
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const act = async (userId: string, action: 'approve' | 'reject' | 'delete') => {
    setActing(userId + action)
    try {
      if (action === 'delete') {
        await axios.delete(`${API_URL}/admin/users/${userId}`, { headers: authHeader() })
      } else {
        await axios.patch(`${API_URL}/admin/users/${userId}/${action}`, {}, { headers: authHeader() })
      }
      await fetchUsers()
    } catch {
      // errors visible in network tab — keep UI clean
    } finally {
      setActing(null)
    }
  }

  const pending = users.filter(u => u.status === 'pending')
  const others  = users.filter(u => u.status !== 'pending')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative h-full w-full max-w-lg bg-white border-l border-zinc-200 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div>
            <p className="text-sm font-semibold text-zinc-800">User management</p>
            {pending.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">{pending.length} pending approval</p>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-zinc-100 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* Pending */}
              {pending.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                    Awaiting approval
                  </p>
                  <div className="space-y-2">
                    {pending.map(u => (
                      <UserCard key={u.id} user={u} acting={acting} onAct={act} />
                    ))}
                  </div>
                </div>
              )}

              {/* All others */}
              {others.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
                    All users
                  </p>
                  <div className="space-y-2">
                    {others.map(u => (
                      <UserCard key={u.id} user={u} acting={acting} onAct={act} />
                    ))}
                  </div>
                </div>
              )}

              {users.length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-8">No users yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function UserCard({
  user,
  acting,
  onAct,
}: {
  user: UserRow
  acting: string | null
  onAct: (id: string, action: 'approve' | 'reject' | 'delete') => void
}) {
  const isActing = (action: string) => acting === user.id + action

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-zinc-700 truncate">{user.name}</p>
            {user.is_admin === 1 && (
              <span className="rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-xs text-blue-600">
                admin
              </span>
            )}
            <span className={`rounded-full border px-1.5 py-0.5 text-xs ${STATUS_STYLES[user.status] ?? ''}`}>
              {user.status}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5 truncate">{user.email}</p>
          <p className="text-xs text-zinc-400">
            {user.provider} · {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>

        {!user.is_admin && (
          <div className="flex items-center gap-1.5 shrink-0">
            {user.status !== 'approved' && (
              <button
                onClick={() => onAct(user.id, 'approve')}
                disabled={!!acting}
                className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition"
              >
                {isActing('approve') ? '...' : 'Approve'}
              </button>
            )}
            {user.status !== 'rejected' && (
              <button
                onClick={() => onAct(user.id, 'reject')}
                disabled={!!acting}
                className="rounded-md bg-red-50 border border-red-100 px-2.5 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-50 transition"
              >
                {isActing('reject') ? '...' : 'Reject'}
              </button>
            )}
            <button
              onClick={() => onAct(user.id, 'delete')}
              disabled={!!acting}
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-100 disabled:opacity-50 transition"
            >
              {isActing('delete') ? '...' : 'Delete'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
