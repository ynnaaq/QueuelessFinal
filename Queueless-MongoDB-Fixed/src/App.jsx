import { useEffect, useState } from 'react'
import AppRoutes from './view/routes/routes.jsx'
import {
  clearStoredSession,
  getCurrentUser,
  getStoredSession,
  signOut,
  storeSession,
} from './services/auth.js'
import './App.css'

const TAB_ID_KEY = 'queueless-tab-id'
const TAB_CHANNEL = 'queueless-session-tabs'

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random()}`

// Used only to compare sessions across tabs without broadcasting a bearer
// token through BroadcastChannel.
const sessionFingerprint = (token) => {
  let hash = 2166136261

  for (const character of token) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  }

  return (hash >>> 0).toString(36)
}

const getTabId = () => {
  try {
    const existing = sessionStorage.getItem(TAB_ID_KEY)

    if (existing) return existing

    const tabId = newId()
    sessionStorage.setItem(TAB_ID_KEY, tabId)
    return tabId
  } catch {
    return newId()
  }
}

const replaceTabId = () => {
  try {
    sessionStorage.setItem(TAB_ID_KEY, newId())
  } catch {
    // The session is already unavailable when browser storage is blocked.
  }
}

export default function App() {
  const [session, setSession] = useState(() => getStoredSession())
  const [checkingSession, setCheckingSession] = useState(
    () => Boolean(getStoredSession()?.token)
  )
  const [tabRevision, setTabRevision] = useState(0)

  // A duplicated browser tab receives a copy of sessionStorage, including the
  // authentication token. Detect that case before restoring the token so the
  // duplicate can sign in independently without sharing a server session.
  useEffect(() => {
    const savedSession = getStoredSession()

    if (!savedSession?.token) {
      setSession(null)
      setCheckingSession(false)
      return
    }

    let cancelled = false
    let duplicate = false
    let verifyTimer
    const tabId = getTabId()
    const instanceId = newId()
    const fingerprint = sessionFingerprint(savedSession.token)
    const channel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(TAB_CHANNEL)

    const restoreSession = () => {
      if (cancelled || duplicate) return

      setCheckingSession(true)

      getCurrentUser(savedSession.token)
        .then(({ user }) => {
          if (cancelled || duplicate) return

          // Make sure this tab did not replace the token while the request
          // was running.
          const latestSession = getStoredSession()

          if (
            !latestSession?.token ||
            latestSession.token !== savedSession.token
          ) {
            return
          }

          setSession({
            ...latestSession,
            user,
          })
        })
        .catch(() => {
          if (cancelled || duplicate) return

          const latestSession = getStoredSession()

          // Only remove the token that actually failed.
          if (latestSession?.token === savedSession.token) {
            clearStoredSession()
            setSession(null)
          }
        })
        .finally(() => {
          if (!cancelled && !duplicate) {
            setCheckingSession(false)
          }
        })
    }

    if (!channel) {
      restoreSession()
    } else {
      channel.onmessage = ({ data }) => {
        if (data?.tabId !== tabId) return

        if (
          data.type === 'session-tab-check' &&
          data.instanceId !== instanceId &&
          data.fingerprint === fingerprint
        ) {
          channel.postMessage({
            type: 'session-tab-present',
            tabId,
            fingerprint,
            targetInstanceId: data.instanceId,
          })
        }

        if (
          data.type === 'session-tab-present' &&
          data.targetInstanceId === instanceId &&
          data.fingerprint === fingerprint
        ) {
          duplicate = true
          clearTimeout(verifyTimer)
          clearStoredSession()
          replaceTabId()
          setSession(null)
          setCheckingSession(false)
          setTabRevision((revision) => revision + 1)
        }
      }

      channel.postMessage({
        type: 'session-tab-check',
        tabId,
        fingerprint,
        instanceId,
      })

      verifyTimer = window.setTimeout(restoreSession, 150)
    }

    return () => {
      cancelled = true
      clearTimeout(verifyTimer)
      channel?.close()
    }
  }, [tabRevision])

  const onLogin = (nextSession) => {
    storeSession(nextSession)
    setSession(nextSession)
    setCheckingSession(false)
    setTabRevision((revision) => revision + 1)
  }

  const onLogout = async () => {
    const currentToken = session?.token

    // Clear browser state immediately.
    clearStoredSession()
    setSession(null)
    setCheckingSession(false)
    setTabRevision((revision) => revision + 1)

    if (currentToken) {
      try {
        await signOut(currentToken)
      } catch {
        // User is already logged out locally,
        // so a server/network error should not block logout.
      }
    }
  }

  return (
    <AppRoutes
      session={session}
      checkingSession={checkingSession}
      onLogin={onLogin}
      onLogout={onLogout}
    />
  )
}
