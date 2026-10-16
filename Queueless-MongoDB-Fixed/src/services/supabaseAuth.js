
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
