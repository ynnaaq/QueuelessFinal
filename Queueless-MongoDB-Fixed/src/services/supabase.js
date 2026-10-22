
import { supabase } from '../lib/supabase.js'

export async function signUpStudent(email, password, profile) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: profile.name,
        account_id: profile.accountId
      }
    }
  })

  if (error) throw error

  return data
}

export async function verifyStudentOtp(email, code) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'signup'
  })

  if (error) throw error

  return data
}

export async function signInStudent(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  })

  if (error) throw error

  return data
}

export async function resendStudentOtp(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase()
  })

  if (error) throw error
}
