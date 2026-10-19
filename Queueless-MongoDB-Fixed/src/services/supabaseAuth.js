// Compatibility exports for the existing login UI. Authentication is handled
// by the application's MongoDB-backed API rather than Supabase.
import {
  login,
  register,
  requestPasswordReset,
  resetPassword,
  resendVerification,
  verifyEmail,
} from './auth.js'

export async function signUpWithSupabase(email, password, studentData = {}) {
  const name = [studentData.firstName, studentData.middleName, studentData.lastName]
    .filter(Boolean)
    .join(' ')

  return register({
    name,
    email,
    password,
    accountId: studentData.studentId,
    department: studentData.course,
    yearLevel: studentData.yearLevel,
    semester: studentData.semester,
    privacyConsent: true,
    role: 'student',
  })
}

export const verifySupabaseOtp = (email, code) => verifyEmail(email, code)
export const resendSupabaseOtp = (email) => resendVerification(email)
export const signInWithSupabase = (email, password) => login(email, password)
export const sendPasswordReset = (email) => requestPasswordReset(email)

export async function verifyPasswordRecoveryOtp(_email, code) {
  if (!/^\d{6}$/.test(String(code || '').trim())) {
    throw new Error('Enter the six-digit recovery code.')
  }
}

export const updateSupabasePassword = (email, code, password) =>
  resetPassword(email, code, password)
