const TOKEN_KEY = 'cdss_auth_token'

export interface AuthUser {
  sub: string
  email: string
  name: string
  picture: string
  status: 'pending' | 'approved' | 'rejected'
  is_admin: boolean
}

function decodeJWT(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getUser(): AuthUser | null {
  const token = getToken()
  if (!token) return null
  return decodeJWT(token)
}

export function authHeader(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
