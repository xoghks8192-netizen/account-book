export const AUTH_KEY = 'household-budget-user'

export function saveSession(session) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session))
}

export function loadSession() {
  const raw = localStorage.getItem(AUTH_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(AUTH_KEY)
}
