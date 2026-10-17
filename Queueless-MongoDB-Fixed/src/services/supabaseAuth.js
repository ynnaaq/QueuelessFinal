import { supabase } from '../lib/supabase'

// Register a new Supabase authentication identity
export async function signUpWithSupabase(email, password) {
  const normalizedEmail = email.trim().toLowerCase()

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

// Verify email confirmation OTP
export async function verifySupabaseOtp(email, code) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: String(code).trim(),
    type: 'email'
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

// Resend the signup verification email
export async function resendSupabaseOtp(email) {
  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase()
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

// Sign in with email and password
export async function signInWithSupabase(email, password) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

// Sign out
export async function signOutWithSupabase() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw new Error(error.message)
  }

  return { success: true }
}

// Send Supabase's password recovery LINK (not an Express OTP).
export async function sendPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase()

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    // The page uses this marker to show the new-password form
    // after the user opens the emailed recovery link.
    redirectTo: `${window.location.origin}${window.location.pathname}?auth=recovery`
  })

  if (error) throw new Error(error.message)

  return {
    message: 'If the email belongs to a Supabase account, a password reset link will be sent. Check your inbox and spam folder.'
  }
}

// Call only after Supabase has established a recovery session.
export async function updateSupabasePassword(password) {
  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(error.message)
  return data
}
