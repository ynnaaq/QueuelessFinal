
import { supabase } from '../lib/supabase'

// ======================================================
// HELPER — NORMALIZE EMAIL
// ======================================================

const normalizeEmail = (email) =>
  String(email || '').trim().toLowerCase()

// ======================================================
// REGISTER STUDENT USING SUPABASE
// ======================================================

export async function signUpWithSupabase(
  email,
  password,
  studentData = {}
) {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !password) {
    throw new Error('Email and password are required.')
  }

  const {
    firstName = '',
    middleName = '',
    lastName = '',
    studentId = '',
    course = '',
    yearLevel = '',
    semester = ''
  } = studentData

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        middle_name: middleName.trim(),
        last_name: lastName.trim(),
        full_name: [
          firstName,
          middleName,
          lastName
        ].filter(Boolean).join(' ').trim(),
        student_id: studentId.trim(),
        course,
        year_level: yearLevel,
        semester,
        role: 'student'
      }
    }
  })

  if (error) {
    console.error('Supabase signup error:', error)
    throw new Error(error.message)
  }

  return data
}

// ======================================================
// VERIFY STUDENT EMAIL OTP
// ======================================================

export async function verifySupabaseOtp(email, code) {
  const normalizedEmail = normalizeEmail(email)
  const normalizedCode = String(code || '').trim()

  if (!normalizedEmail) {
    throw new Error('Email address is required.')
  }

  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new Error(
      'Please enter a valid six-digit verification code.'
    )
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedCode,
    type: 'email'
  })

  if (error) {
    console.error('Supabase OTP error:', error)
    throw new Error(error.message)
  }

  return data
}

// ======================================================
// RESEND EMAIL VERIFICATION CODE
// ======================================================

export async function resendSupabaseOtp(email) {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    throw new Error('Email address is required.')
  }

  const { data, error } = await supabase.auth.resend({
    type: 'signup',
    email: normalizedEmail
  })

  if (error) {
    console.error('Supabase resend OTP error:', error)
    throw new Error(error.message)
  }

  return data
}

// ======================================================
// SIGN IN USING SUPABASE
// ======================================================

export async function signInWithSupabase(email, password) {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || !password) {
    throw new Error('Enter your email and password.')
  }

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    })

  if (error) {
    console.error('Supabase login error:', error)

    if (error.message === 'Email not confirmed') {
      throw new Error(
        'Verify your email address before signing in.'
      )
    }

    throw new Error(error.message)
  }

  return data
}

// ======================================================
// SIGN OUT
// ======================================================

export async function signOutWithSupabase() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Supabase signout error:', error)
    throw new Error(error.message)
  }

  return { success: true }
}

// ======================================================
// GET CURRENT AUTHENTICATED USER
// ======================================================

export async function getSupabaseUser() {
  const { data, error } = await supabase.auth.getUser()

  if (error) {
    throw new Error(error.message)
  }

  return data.user
}

// ======================================================
// GET CURRENT SESSION
// ======================================================

export async function getSupabaseSession() {
  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  return data.session
}

// ======================================================
// SEND PASSWORD RESET CODE
// ======================================================

export async function sendPasswordReset(email) {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail) {
    throw new Error('Enter your email address.')
  }

  const { error } =
    await supabase.auth.resetPasswordForEmail(
      normalizedEmail
    )

  if (error) {
    console.error('Supabase password reset error:', error)
    throw new Error(error.message)
  }

  return {
    message:
      'If the email belongs to a Supabase account, a password reset code will be sent. Check your inbox and spam folder.'
  }
}

// ======================================================
// VERIFY PASSWORD RESET CODE
// ======================================================

export async function verifyPasswordRecoveryOtp(email, code) {
  const normalizedEmail = normalizeEmail(email)
  const token = String(code || '').trim()

  if (!normalizedEmail || !/^\d{6}$/.test(token)) {
    throw new Error('Enter the six-digit recovery code.')
  }

  const { error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token,
    type: 'recovery',
  })

  if (error) {
    console.error('Supabase recovery code error:', error)
    throw new Error(error.message)
  }
}

// ======================================================
// UPDATE PASSWORD AFTER RECOVERY
// ======================================================

export async function updateSupabasePassword(password) {
  if (!password || password.length < 8) {
    throw new Error(
      'Password must contain at least 8 characters.'
    )
  }

  const { data, error } =
    await supabase.auth.updateUser({
      password
    })

  if (error) {
    console.error('Supabase password update error:', error)
    throw new Error(error.message)
  }

  return data
}
