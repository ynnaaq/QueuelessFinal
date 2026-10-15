const SESSION_KEY = 'queueless-session'

export function getMySchedule(token) {
  return portalApi(
    '/api/schedules/me',
    token
  )
}

export function saveMySchedule(
  token,
  shifts
) {
  return portalApi(
    '/api/schedules/me',
    token,
    {
      method: 'PUT',
      body: JSON.stringify({
        shifts,
      }),
    }
  )
}

const api = async (path, options = {}) => {
  let response

  try {
    response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  } catch {
    throw new Error(
      'Cannot connect to the server. Please try again when the server is available.'
    )
  }

  const text = await response.text()

  let data = {}

  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(
      'The server returned an invalid response. Please try again in a moment.'
    )
  }

  if (!response.ok) {
    const fallback =
      response.status >= 500
        ? 'The server is unavailable right now. Please try again in a moment.'
        : `Request failed (${response.status}). Please check your details and try again.`

    throw new Error(data.message || fallback)
  }

  return data
}

export const portalApi = (
  path,
  token,
  options = {}
) =>
  api(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  })

export const getPortalState = (token) =>
  portalApi('/api/portal/state', token)


// ======================================================
// SESSION STORAGE
// Each browser tab now has its own authentication session
// ======================================================

export function getStoredSession() {
  try {
    const saved =
      sessionStorage.getItem(SESSION_KEY)

    return saved
      ? JSON.parse(saved)
      : null
  } catch {
    return null
  }
}

export function storeSession(session) {
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify(session)
    )
  } catch {
    // Ignore storage error
  }
}

export function clearStoredSession() {
  sessionStorage.removeItem(SESSION_KEY)
}


// ======================================================
// AUTH API
// ======================================================

export async function getCurrentUser(token) {
  return api('/api/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function login(email, password) {
  return api('/api/auth/login', {
    method: 'POST',

    body: JSON.stringify({
      email,
      password,
    }),
  })
}

export async function register(account) {
  return api('/api/auth/register', {
    method: 'POST',

    body: JSON.stringify({
      ...account,

      name:
        account.name?.trim(),

      email:
        account.email
          ?.trim()
          .toLowerCase(),

      accountId:
        account.accountId?.trim(),
    }),
  })
}

export async function apiSignOut(token) {
  return api('/api/auth/logout', {
    method: 'POST',

    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

export async function signOut(token) {
  if (!token) {
    return {
      success: true,
    }
  }

  return apiSignOut(token)
}
