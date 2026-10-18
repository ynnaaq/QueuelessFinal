
import { useEffect, useRef, useState } from 'react'
import AppRoutes from './view/routes/routes.jsx'
import { supabase } from './lib/supabase.js'
import './App.css'

// ======================================================
// GET USER ROLE FROM SUPABASE
// ======================================================

async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(
      `Failed to load user role: ${error.message}`
    )
  }

  if (!data?.role) {
    throw new Error(
      'No Queueless role is assigned to this account.'
    )
  }

  return data.role
}

// ======================================================
// CONVERT SUPABASE SESSION FOR QUEUELESS
// ======================================================

async function formatSession(authSession) {
  if (!authSession?.user || !authSession?.access_token) {
    return null
  }

  const role = await getUserRole(authSession.user.id)
  const metadata = authSession.user.user_metadata || {}

  return {
    token: authSession.access_token,
    access_token: authSession.access_token,
    refresh_token: authSession.refresh_token,
    expires_at: authSession.expires_at,

    user: {
      id: authSession.user.id,
      email: authSession.user.email,
      name:
        metadata.full_name ||
        authSession.user.email,
      role,
      accountId: metadata.student_id || '',
      department: metadata.course || '',
      yearLevel: metadata.year_level || '',
      semester: metadata.semester || '',
      avatar: metadata.avatar || '',
      emailVerified:
        Boolean(authSession.user.email_confirmed_at),
    },
  }
}

// ======================================================
// MAIN QUEUELESS APP
// ======================================================

export default function App() {
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const revisionRef = useRef(0)

  // ====================================================
  // RESTORE SUPABASE SESSION
  // ====================================================

  useEffect(() => {
    let active = true

    const loadSession = async (authSession) => {
      const revision = ++revisionRef.current

      setCheckingSession(true)

      try {
        const nextSession = await formatSession(authSession)

        if (!active || revision !== revisionRef.current) {
          return
        }

        setSession(nextSession)
      } catch (error) {
        if (!active || revision !== revisionRef.current) {
          return
        }

        console.error('Queueless session error:', error)
        setSession(null)
      } finally {
        if (active && revision === revisionRef.current) {
          setCheckingSession(false)
        }
      }
    }

    // Listen for login, logout and token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, authSession) => {
        // Perform role queries outside the auth callback.
        setTimeout(() => {
          if (active) {
            void loadSession(authSession)
          }
        }, 0)
      }
    )

    const restoreSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!active) return

      if (error) {
        console.error('Supabase session error:', error)
        setCheckingSession(false)
        return
      }

      await loadSession(data.session)
    }

    void restoreSession()

    return () => {
      active = false
      revisionRef.current += 1
      subscription.unsubscribe()
    }
  }, [])

  // ====================================================
  // LOGIN
  // ====================================================

  const onLogin = async (result) => {
    const authSession =
      result?.session?.access_token
        ? result.session
        : result?.access_token
          ? result
          : null

    if (!authSession) {
      console.error(
        'Supabase login did not return a valid session.'
      )
      return
    }

    const revision = ++revisionRef.current
    setCheckingSession(true)

    try {
      const nextSession = await formatSession(authSession)

      if (revision !== revisionRef.current) return

      setSession(nextSession)
    } catch (error) {
      if (revision !== revisionRef.current) return

      console.error('Queueless login error:', error)
      setSession(null)
    } finally {
      if (revision === revisionRef.current) {
        setCheckingSession(false)
      }
    }
  }

  // ====================================================
  // LOGOUT
  // ====================================================

  const onLogout = async () => {
    revisionRef.current += 1

    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Supabase logout error:', error)
      throw error
    }

    setSession(null)
    setCheckingSession(false)
  }

  // ====================================================
  // RENDER APPLICATION ROUTES
  // ====================================================

  return (
    <AppRoutes
      session={session}
      checkingSession={checkingSession}
      onLogin={onLogin}
      onLogout={onLogout}
    />
  )
}
