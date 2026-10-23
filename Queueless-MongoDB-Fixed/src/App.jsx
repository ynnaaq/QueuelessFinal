import { useEffect, useState } from 'react'
import AppRoutes from './view/routes/routes.jsx'
import {
  apiSignOut,
  clearStoredSession,
  getCurrentUser,
  getStoredSession,
  portalApi,
  storeSession,
} from './services/auth.js'
import { signOutFromSupabase } from './services/supabaseAuth.js'
import './App.css'
import './portalTheme.css'

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
      } catch (error) {
        // A network outage, Render cold start, or a transient 5xx response is
        // not evidence that the user signed out.  Keep the last known session
        // so a refresh does not turn an availability incident into data loss.
        // Only a definite authentication rejection invalidates it locally.
        if (/^Your session has expired\./i.test(error?.message || '')) {
          clearStoredSession()
        } else if (active) {
          setSession(saved)
        }
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
      // Clear the identity-provider session too. A failed network request must
      // not keep a usable local Supabase token after an explicit logout.
      try { await signOutFromSupabase() } catch { /* local app logout still succeeds */ }
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

  const onSwitchRole = async (role) => {
    if (!session?.token) throw new Error('Your session has expired. Please sign in again.')
    const { user } = await portalApi('/api/auth/switch-role', session.token, {
      method: 'POST', body: JSON.stringify({ role }),
    })
    const next = { ...session, user }
    storeSession(next)
    setSession(next)
  }

  return <AppRoutes session={session} checkingSession={checkingSession} onLogin={onLogin} onLogout={onLogout} onRoleChanged={onRoleChanged} onSwitchRole={onSwitchRole} />
}
