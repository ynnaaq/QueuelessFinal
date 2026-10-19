
import { supabase } from '../lib/supabase.js'

// Register student with Supabase Authentication
export async function registerStudent({
  email,
  password,
  name,
  studentId,
}) {
  const normalizedEmail = email.trim().toLowerCase()

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: name,
        student_id: studentId,
      },
    },
  })

  if (error) throw error

  return data
}

// Verify email using six-digit OTP
export async function verifyStudentEmail(email, code) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'signup',
  })

  if (error) throw error

  return data
}

// Sign in
export async function loginWithSupabase(email, password) {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

  if (error) throw error

  return data
}

// Sign out
export async function logoutFromSupabase() {
  const { error } = await supabase.auth.signOut({
    scope: 'local',
  })

  if (error) throw error
}

// Get current session
export async function getSupabaseSession() {
  const { data, error } = await supabase.auth.getSession()

  if (error) throw error

  return data.session
}
