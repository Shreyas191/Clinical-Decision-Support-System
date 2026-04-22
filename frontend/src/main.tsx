import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import LoginPage from './components/LoginPage'
import PendingPage from './components/PendingPage'
import { getUser, setToken, clearToken, type AuthUser } from './auth'
import './index.css'

function Root() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenFromUrl = params.get('token')
    if (tokenFromUrl) {
      setToken(tokenFromUrl)
      window.history.replaceState({}, '', window.location.pathname)
    }
    setUser(getUser() ?? null)
  }, [])

  if (user === undefined) return null

  const handleLogout = () => {
    clearToken()
    setUser(null)
  }

  if (!user) {
    return <LoginPage onAuth={u => setUser(u)} />
  }

  if (user.status === 'pending') {
    return (
      <PendingPage
        user={user}
        onApproved={u => setUser(u)}
        onLogout={handleLogout}
      />
    )
  }

  return <App user={user} onLogout={handleLogout} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
