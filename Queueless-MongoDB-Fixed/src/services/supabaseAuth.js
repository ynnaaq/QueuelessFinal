// Supabase owns passwords, email verification and account recovery.
// Express issues a compatible app-session token after validating Supabase.
import { supabase } from '../lib/supabase.js'

const normalize = (email) => String(email || '').trim().toLowerCase()

async function bridgeSession(accessToken) {
  let response
  try {
    response = await fetch('/api/auth/supabase-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })
  } catch {
    throw new Error('Cannot connect to Queueless right now. Your Supabase session is still available; please try again shortly.')
  }
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || 'Unable to link this account to Queueless.')
  return result
}

export async function signUpWithSupabase(email, password, studentData = {}) {
  const name = [studentData.firstName, studentData.middleName, studentData.lastName]
    .filter(Boolean).join(' ').trim()
  const { error } = await supabase.auth.signUp({
    email: normalize(email),
    password,
    options: {
      data: {
        full_name: name,
        account_id: studentData.studentId,
        department: studentData.course,
        year_level: studentData.yearLevel,
        semester: studentData.semester,
      },
    },
  })
  if (error) throw error
  return { verificationRequired: true, message: 'Check your email for the Supabase six-digit verification code.' }
}

export async function verifySupabaseOtp(email, code) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalize(email), token: String(code).trim(), type: 'signup',
  })
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Verification succeeded but no session was returned.')
  await bridgeSession(data.session.access_token)
  return { message: 'Email verified. You can now sign in.' }
}

export async function resendSupabaseOtp(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: normalize(email) })
  if (error) throw error
  return { message: 'If eligible, a new code was sent by Supabase.' }
}

export async function signInWithSupabase(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalize(email), password,
  })
  if (error) throw error
  if (!data.session?.access_token) throw new Error('Supabase did not return a session.')
  return bridgeSession(data.session.access_token)
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(normalize(email))
  if (error) throw error
  return { message: 'If the account exists, check your email for a recovery code.' }
}

let recoveredEmail = null
export async function verifyPasswordRecoveryOtp(email, code) {
  const { error } = await supabase.auth.verifyOtp({
    email: normalize(email), token: String(code).trim(), type: 'recovery',
  })
  if (error) throw error
  recoveredEmail = normalize(email)
}

export async function updateSupabasePassword(email, _code, password) {
  if (recoveredEmail !== normalize(email)) throw new Error('Verify the recovery code first.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  recoveredEmail = null
  await supabase.auth.signOut({ scope: 'local' })
  return { message: 'Password updated.' }
}

export async function signOutFromSupabase() {
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}
