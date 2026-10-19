import { useEffect, useState } from 'react'
import AppRoutes from './view/routes/routes.jsx'
import {
  apiSignOut,
  clearStoredSession,
  getCurrentUser,
  getStoredSession,
  storeSession,
} from './services/auth.js'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true
    const restore = async () => {
      const saved = getStoredSession()
      if (!saved?.token) {
        if (active) setCheckingSession(false)
        return
      }

      try {
        // A stopped API server must not leave the whole UI blank forever.
        const { user } = await Promise.race([
          getCurrentUser(saved.token),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Session check timed out.')), 5000)),
        ])
        const next = { token: saved.token, user }
        storeSession(next)
        if (active) setSession(next)
      } catch {
        clearStoredSession()
      } finally {
        if (active) setCheckingSession(false)
      }
    }
    void restore()
    return () => { active = false }
  }, [])

  const onLogin = (nextSession) => {
    if (!nextSession?.token || !nextSession?.user) return
    storeSession(nextSession)
    setSession(nextSession)
    setCheckingSession(false)
  }

  const onLogout = async () => {
    try {
      if (session?.token) await apiSignOut(session.token)
    } finally {
      clearStoredSession()
      setSession(null)
      setCheckingSession(false)
    }
  }

  const onRoleChanged = async () => {
    if (!session?.token) throw new Error('Your session has expired. Please sign in again.')
    const { user } = await getCurrentUser(session.token)
    const next = { ...session, user }
    storeSession(next)
    setSession(next)
  }

  return <AppRoutes session={session} checkingSession={checkingSession} onLogin={onLogin} onLogout={onLogout} onRoleChanged={onRoleChanged} />
}
