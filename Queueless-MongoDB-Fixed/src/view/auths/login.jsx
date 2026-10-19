import { supabase } from '../../lib/supabase.js'
import { useEffect, useState } from 'react'
import {
  signUpWithSupabase,
  verifySupabaseOtp,
  resendSupabaseOtp,
  signInWithSupabase,
  sendPasswordReset,
  verifyPasswordRecoveryOtp,
  updateSupabasePassword,
} from '../../services/supabaseAuth.js'
import './login.css'


const initialForm = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  studentId: '',
  course: '',
  yearLevel: '',
  semester: '',
  password: '',
  confirmPassword: '',
  privacyConsent: false,
}


const PASSWORD_PATTERN =
  '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])[A-Za-z\\d!@#$%^&*]{8,}'

const passwordTitle =
  'At least 8 characters with uppercase, lowercase, number, and one of ! @ # $ % ^ & *. No spaces.'

const studentIdPattern =
  '03-[0-9]{4}-[0-9]{5,6}'

// Allows letters, spaces, commas, periods, apostrophes and hyphens
const fullNamePattern =
  "[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' ,.-]*"


const courses = [
  'AB English Language',
  'Bachelor of Arts in Communication',
  'Bachelor of Arts in Political Science',

  'Bachelor of Elementary Education',
  'Bachelor of Secondary Education – English',
  'Bachelor of Secondary Education – Science',
  'Bachelor of Secondary Education – Social Studies',

  'BS Accountancy',
  'BS Accounting Information System (AcctgTech)',
  'BS Architecture',
  'BS Business Administration – Financial Management',
  'BS Business Administration – Marketing Management',

  'BS Civil Engineering',
  'BS Computer Engineering',
  'BS Criminology',
  'BS Electrical Engineering',
  'BS Electronics Engineering',
  'BS Entrepreneurship',
  'BS Hospitality Management',

  'BS Information Technology',
  'BS Management Accounting',
  'BS Mechanical Engineering',
  'BS Medical Laboratory Science',
  'BS Nursing',
  'BS Pharmacy',
  'BS Tourism Management',

  'Associate in Computer Technology',
]

const seniorHighStrands = [
  'ABM (Accountancy, Business and Management)',
  'HUMSS (Humanities and Social Sciences)',
  'STEM (Science, Technology, Engineering and Mathematics)',
  'GAS (General Academic Strand)',
  'TVL (Technical-Vocational-Livelihood)',
]

const isSeniorHigh = (yearLevel) =>
  yearLevel === 'Grade 11' || yearLevel === 'Grade 12'


// ======================================================
// PHINMA NAME + EMAIL VALIDATION
// ======================================================

const normalizeNamePart = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase()


const parseStudentName = (fullName) => {
  const name = String(fullName || '').trim()

  if (!name) {
    return null
  }

  /*
    FORMAT 1:
    Reyes, Jamie, Cruz

    Last, First, Middle
  */
  const commaParts = name
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (commaParts.length === 3) {
    return {
      lastName: commaParts[0],
      firstName: commaParts[1],
      middleName: commaParts[2],
    }
  }


  /*
    FORMAT 2:
    Park Yen, Kusimoto

    Last First, Middle

    This produces:
    First = Yen
    Middle = Kusimoto
    Last = Park

    Email:
    yeku.park.up@phinmaed.com
  */
  if (commaParts.length === 2) {
    const leftSide = commaParts[0]
      .split(/\s+/)
      .filter(Boolean)

    const rightSide = commaParts[1]
      .split(/\s+/)
      .filter(Boolean)

    if (
      leftSide.length >= 2 &&
      rightSide.length >= 1
    ) {
      return {
        lastName: leftSide[0],

        firstName: leftSide
          .slice(1)
          .join(' '),

        middleName: rightSide.join(' '),
      }
    }


    /*
      Also accepts:

      Reyes, Jamie Cruz

      Last, First Middle
    */
    if (
      leftSide.length === 1 &&
      rightSide.length >= 2
    ) {
      return {
        lastName: leftSide[0],
        firstName: rightSide[0],

        middleName: rightSide
          .slice(1)
          .join(' '),
      }
    }
  }


  /*
    FORMAT 3:
    Jamie Cruz Reyes

    First Middle Last
  */
  const normalParts = name
    .split(/\s+/)
    .filter(Boolean)

  if (normalParts.length >= 3) {
    return {
      firstName: normalParts[0],

      middleName: normalParts
        .slice(1, -1)
        .join(' '),

      lastName:
        normalParts[normalParts.length - 1],
    }
  }

  return null
}


const suggestedSchoolEmail = ({
  firstName = '',
  middleName = '',
  lastName = '',
}) => {

  const firstTwo =
    normalizeNamePart(firstName)
      .slice(0, 2)

  const middleTwo =
    normalizeNamePart(middleName)
      .slice(0, 2)

  const last =
    normalizeNamePart(lastName)

  if (
    firstTwo.length < 2 ||
    middleTwo.length < 2 ||
    !last
  ) {
    return ''
  }

  return `${firstTwo}${middleTwo}.${last}.up@phinmaed.com`
}


// ======================================================

function QueueMark() {
  return (
    <img
      className="queue-logo"
      src="/campus-queue-logo.png"
      alt=""
    />
  )
}


export default function Login({ onLogin }) {
  const [page, setPage] =
    useState('signin')

  const [
    credentials,
    setCredentials,
  ] = useState({
    email: '',
    password: '',
  })


  const [reset, setReset] =
    useState(() => {
      const params =
        new URLSearchParams(
          window.location.search
        )

      return {
        email:
          params.get('email') || '',

        code: '',
        password: '',
        confirmPassword: '',
      }
    })


  const [
    account,
    setAccount,
  ] = useState(initialForm)

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    remember,
    setRemember,
  ] = useState(true)

  const [
    signingIn,
    setSigningIn,
  ] = useState(false)


  const [sendingReset, setSendingReset] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Supabase redirects back to this page after the user opens the
  // password-recovery email. The query marker helps us recover the UI
  // even when the auth event is processed before React mounts.
  useEffect(() => {
    let active = true
    const recoveryReturn =
      new URLSearchParams(window.location.search).get('auth') === 'recovery'

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (!active) return
        if (event === 'PASSWORD_RECOVERY') {
          setPage('reset')
          setMessage('Create your new Queueless password below.')
        }
      }
    )

    if (recoveryReturn) {
      supabase.auth.getSession()
        .then(({ data, error }) => {
          if (!active) return
          if (error || !data.session) {
            setPage('forgot')
            setMessage('This password recovery link is invalid or expired. Request a new one.')
            return
          }
          setPage('reset')
          setMessage('Create your new Queueless password below.')
        })
        .catch(() => {
          if (!active) return
          setPage('forgot')
          setMessage('We could not validate your password recovery link. Request a new one.')
        })
    }

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])


  // Expected PHINMA email based on entered name
  const expectedEmail =
    suggestedSchoolEmail(
      account
    )

  const studentFullName = [
    account.firstName,
    account.middleName,
    account.lastName,
  ].filter(Boolean).join(' ')


  // Check if entered email matches expected email
  const emailMismatch =
    Boolean(
      account.email &&
      expectedEmail &&
      account.email
        .trim()
        .toLowerCase() !==
        expectedEmail.toLowerCase()
    )


  const updateCredentials = ({
    target,
  }) =>
    setCredentials(
      (current) => ({
        ...current,
        [target.name]:
          target.value,
      })
    )


  const updateAccount = ({ target }) =>
    setAccount(
      (current) => {
        const value = target.type === 'checkbox' ? target.checked : target.value

        // A strand cannot be used as a college course (and vice versa).
        // Grade 11 and Grade 12 share the same strand choices, so retain a
        // selection when moving between those two levels.
        if (target.name === 'yearLevel') {
          const course = isSeniorHigh(current.yearLevel) !== isSeniorHigh(value)
            ? ''
            : current.course

          return { ...current, yearLevel: value, course }
        }

        return { ...current, [target.name]: value }
      }
    )

  const useSuggestedEmail = () =>
    setAccount((current) => ({
      ...current,
      email: expectedEmail,
    }))


  const updateReset = ({
    target,
  }) =>
    setReset(
      (current) => ({
        ...current,

        [target.name]:
          target.value,
      })
    )


  // ======================================================
  // LOGIN
  // ======================================================

  const authenticate = async (event) => {
    event.preventDefault()
    if (signingIn) return

    setSigningIn(true)
    setMessage('')

    try {
      const result = await signInWithSupabase(
        credentials.email,
        credentials.password
      )

      if (!result.token || !result.user) {
        throw new Error('Sign in failed: no session was returned.')
      }

      // The parent app may still expect an Express session shape.
      // Its onLogin/session management must also be migrated to Supabase.
      onLogin?.(result, remember)
    } catch (error) {
      const errorMessage = error?.message || 'Could not sign in.'
      if (/email not confirmed|email not verified/i.test(errorMessage)) {
        setReset((current) => ({
          ...current,
          email: credentials.email.trim().toLowerCase(),
          code: '',
        }))
        setPage('verify')
      }
      setMessage(errorMessage)
    } finally {
      setSigningIn(false)
    }
  }


  // ======================================================
  // ======================================================
  // CREATE ACCOUNT
  // ======================================================

  const createAccount = async (event) => {
    event.preventDefault()
    setMessage('')

    if (account.password !== account.confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }
    if (!expectedEmail) {
      setMessage('Enter your complete first name, middle name, and last name.')
      return
    }
    if (emailMismatch) {
      setMessage(`The name and PHINMA email do not match. Expected email: ${expectedEmail}`)
      return
    }
    if (!account.privacyConsent) {
      setMessage('Please agree to the Privacy Notice.')
      return
    }

    try {
      const result = await signUpWithSupabase(
        account.email,
        account.password,
        {
          firstName: account.firstName,
          middleName: account.middleName,
          lastName: account.lastName,
          studentId: account.studentId,
          course: account.course,
          yearLevel: account.yearLevel,
          semester: account.semester,
        }
      )

      const email = account.email.trim().toLowerCase()
      setReset((current) => ({ ...current, email, code: '' }))

      setPage('verify')
      setMessage(result.message || 'Check your school email for the verification code.')
    } catch (error) {
      console.error('Supabase registration error:', error)
      setMessage(error?.message || 'Registration failed. Please try again.')
    }
  }


  // ======================================================
  // ======================================================
  // SUPABASE PASSWORD RECOVERY
  // ======================================================

  const requestReset = async (event) => {
    event.preventDefault()
    if (sendingReset) return

    setSendingReset(true)
    setMessage('')

    try {
      const result = await sendPasswordReset(reset.email)
      setReset((current) => ({ ...current, code: '', password: '', confirmPassword: '' }))
      setPage('recovery-code')
      setMessage(result.message)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSendingReset(false)
    }
  }

  const verifyPasswordResetCode = async (event) => {
    event.preventDefault()
    setMessage('')

    try {
      await verifyPasswordRecoveryOtp(reset.email, reset.code)
      setPage('reset')
      setMessage('Code verified. Choose a new password.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const completeReset = async (event) => {
    event.preventDefault()
    if (updatingPassword) return

    if (reset.password !== reset.confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }

    setUpdatingPassword(true)
    setMessage('')

    try {
      await updateSupabasePassword(reset.email, reset.code, reset.password)

      setReset({ email: '', code: '', password: '', confirmPassword: '' })
      setPage('signin')
      setMessage('Your password was updated. You can now sign in.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setUpdatingPassword(false)
    }
  }


  // ======================================================
  // EMAIL VERIFICATION
  // ======================================================

  const confirmEmail = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      await verifySupabaseOtp(reset.email, reset.code)
      setPage('signin')
      setMessage('Email verified successfully. Please sign in.')
    } catch (error) {
      console.error('Supabase verification error:', error)
      setMessage(error?.message || 'Verification failed.')
    }
  }

  const resendCode = async () => {
    setMessage('')
    try {
      const result = await resendSupabaseOtp(reset.email)
      setMessage(result?.message || 'If eligible, a new verification email has been sent.')
    } catch (error) {
      console.error('Supabase resend error:', error)
      setMessage(error?.message || 'Could not resend verification code.')
    }
  }


  return (
    <main
      className={`login-page ${
        page === 'signin'
          ? 'page-signin'
          : page === 'create'
            ? 'page-create'
            : 'page-reset'
      }`}
    >
      <nav className="auth-nav">
        <button
          className="nav-brand"
          type="button"
          onClick={() =>
            setPage('signin')
          }
        >
          <QueueMark />

          <span>
            <b>Queueless</b>
            <small>
              Campus queue system
            </small>
          </span>
        </button>


        <button
          className="nav-cta"
          type="button"
          onClick={() => {
            setMessage('')

            setPage(
              page === 'signin'
                ? 'create'
                : 'signin'
            )
          }}
        >
          {page === 'signin'
            ? 'Create account'
            : 'Sign in'}
        </button>
      </nav>


      <section className="auth-shell">
        <aside className="auth-hero">
          <div className="hero-badge">
            SMARTER CAMPUS SERVICES
          </div>

          <h1>
            Your turn,
            <br />

            <em>
              without the line.
            </em>
          </h1>

          <p>
            Join school-office queues
            from your phone, see exactly
            where you are, and arrive
            when it’s nearly your turn.
          </p>


          <div
            className="hero-preview"
            aria-hidden="true"
          >
            <div className="preview-top">
              <span>
                Registrar
              </span>

              <b>
                Live queue
              </b>
            </div>

            <strong>
              R-024
            </strong>

            <div className="preview-stats">
              <span>
                <small>
                  Students ahead
                </small>

                <b>3</b>
              </span>

              <span>
                <small>
                  Est. wait
                </small>

                <b>
                  12 min
                </b>
              </span>
            </div>

            <div className="preview-progress">
              <i />
            </div>

            <small>
              We’ll keep your position
              updated in real time.
            </small>
          </div>


          <div className="hero-points">
            <span>
              ✓ Digital tickets
            </span>

            <span>
              ✓ Live status
            </span>

            <span>
              ✓ Requirements checklist
            </span>
          </div>
        </aside>


        <section className="auth-content">
          {page === 'signin' ? (
            <form
              className="auth-card"
              onSubmit={authenticate}
            >
              <div className="card-heading">
                <span>
                  WELCOME BACK
                </span>

                <h2>
                  Sign in to Queueless
                </h2>

                <p>
                  One account, the right
                  dashboard for your role.
                </p>
              </div>


              <label>
                Email address

                <input
                  name="email"
                  type="email"
                  value={
                    credentials.email
                  }
                  onChange={
                    updateCredentials
                  }
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </label>


              <PasswordField
                label="Password"
                name="password"
                value={
                  credentials.password
                }
                onChange={
                  updateCredentials
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />


              <div className="forgot-row">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) =>
                      setRemember(
                        event.target
                          .checked
                      )
                    }
                  />

                  Keep me signed in
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMessage('')
                    setPage('forgot')
                  }}
                >
                  Forgot password?
                </button>
              </div>


              <button
                className="primary-button"
                type="submit"
                disabled={signingIn}
                aria-busy={signingIn}
              >
                {signingIn ? (
                  <>
                    <i
                      className="button-spinner"
                      aria-hidden="true"
                    />

                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <span>→</span>
                  </>
                )}
              </button>


              {message && (
                <p
                  className="signin-message"
                  role="status"
                >
                  {message}
                </p>
              )}


              <p className="account-switch">
                New to Queueless?{' '}

                <button
                  type="button"
                  onClick={() => {
                    setMessage('')
                    setPage('create')
                  }}
                >
                  Create an account
                </button>
              </p>
            </form>
          ) : page === 'forgot' ? (
            <form
              className="auth-card reset-card"
              onSubmit={requestReset}
            >
              <div className="card-heading">
                <span>
                  PASSWORD RECOVERY
                </span>

                <h2>
                  Forgot your password?
                </h2>

                <p>
                  Enter your email and
                  we’ll send a six-digit reset code
                  if an account matches it.
                </p>
              </div>


              <label>
                Email address

                <input
                  name="email"
                  type="email"
                  value={reset.email}
                  onChange={updateReset}
                  placeholder="Enter your email"
                  autoComplete="email"
                  required
                />
              </label>


              <button
                className="primary-button"
                type="submit"
                disabled={sendingReset}
              >
                {sendingReset ? 'Sending recovery email...' : 'Send reset code'}
                <span>→</span>
              </button>


              {message && (
                <p
                  className="signin-message reset-message"
                  role="status"
                >
                  {message}
                </p>
              )}


              <p className="account-switch">
                <button
                  type="button"
                  onClick={() => {
                    setMessage('')
                    setPage('signin')
                  }}
                >
                  Back to sign in
                </button>
              </p>
            </form>
          ) : page === 'recovery-code' ? (
            <form className="auth-card reset-card" onSubmit={verifyPasswordResetCode}>
              <div className="card-heading">
                <span>PASSWORD RECOVERY</span>
                <h2>Enter your reset code</h2>
                <p>We sent a six-digit code to <b>{reset.email}</b>. Enter it to choose a new password.</p>
              </div>
              <label>
                Reset code
                <input name="code" value={reset.code} onChange={updateReset} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required />
              </label>
              <button className="primary-button" type="submit">Verify code <span>→</span></button>
              {message && <p className="signin-message reset-message" role="status">{message}</p>}
              <p className="account-switch">Didn't receive it? <button type="button" onClick={requestReset}>Send another code</button></p>
            </form>
          ) : page === 'verify' ? (
            <form
              className="auth-card reset-card"
              onSubmit={confirmEmail}
            >
              <div className="card-heading">
                <span>
                  VERIFY YOUR EMAIL
                </span>

                <h2>
                  Enter your code
                </h2>

                <p>
                  We sent a six-digit
                  code to{' '}

                  <b>
                    {reset.email}
                  </b>
                  . Verify your email
                  before signing in.
                </p>
              </div>


              <label>
                Verification code

                <input
                  name="code"
                  value={reset.code}
                  onChange={updateReset}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength="6"
                  required
                />
              </label>


              <button
                className="primary-button"
                type="submit"
              >
                Verify email
                <span>→</span>
              </button>


              {message && (
                <p
                  className="signin-message reset-message"
                  role="status"
                >
                  {message}
                </p>
              )}


              <p className="account-switch">
                Didn’t receive it?{' '}

                <button
                  type="button"
                  onClick={resendCode}
                >
                  Resend code
                </button>
              </p>
            </form>
          ) : page === 'reset' ? (
            <form
              className="auth-card reset-card"
              onSubmit={completeReset}
            >
              <div className="card-heading">
                <span>
                  CHOOSE A NEW PASSWORD
                </span>

                <h2>
                  Reset your password
                </h2>

                <p>
                  Choose a new password to finish
                  your Supabase recovery request.
                </p>
              </div>


              <PasswordField
                label="New password"
                name="password"
                value={reset.password}
                onChange={updateReset}
                minLength="8"
                pattern={
                  PASSWORD_PATTERN
                }
                title={
                  passwordTitle
                }
                autoComplete="new-password"
                required
              />


              <PasswordField
                label="Confirm new password"
                name="confirmPassword"
                value={
                  reset.confirmPassword
                }
                onChange={updateReset}
                minLength="8"
                pattern={
                  PASSWORD_PATTERN
                }
                title={
                  passwordTitle
                }
                autoComplete="new-password"
                required
              />


              <button
                className="primary-button"
                type="submit"
                disabled={updatingPassword}
              >
                {updatingPassword ? 'Updating password...' : 'Reset password'}
                <span>→</span>
              </button>


              {message && (
                <p
                  className="signin-message"
                  role="status"
                >
                  {message}
                </p>
              )}


              <p className="account-switch">
                <button
                  type="button"
                  onClick={() => {
                    setMessage('')
                    setPage('signin')
                  }}
                >
                  Back to sign in
                </button>
              </p>
            </form>
          ) : (
            <form
              className="auth-card create-card"
              onSubmit={createAccount}
            >
              <div className="card-heading">
                <span>
                  GET STARTED
                </span>

                <h2>
                  Create a student account
                </h2>

                <p>
                  Set up your account to
                  access campus queue
                  services.
                </p>
              </div>


              <div className="create-fields">
                <label>
                  First name
                  <input name="firstName" value={account.firstName} onChange={updateAccount} placeholder="First name" pattern={fullNamePattern} required />
                </label>

                <label>
                  Middle name
                  <input name="middleName" value={account.middleName} onChange={updateAccount} placeholder="Middle name" pattern={fullNamePattern} required />
                </label>

                <label className="wide">
                  Last name
                  <input name="lastName" value={account.lastName} onChange={updateAccount} placeholder="Last name" pattern={fullNamePattern} required />
                  <small className="field-help">Your school email uses the first two letters of your first and middle names, followed by your last name.</small>
                </label>


                <label className="wide">
                  Email address

                  <input
                    name="email"
                    type="email"
                    value={
                      account.email
                    }
                    onChange={
                      updateAccount
                    }
                    placeholder={
                      expectedEmail ||
                      'Enter your PHINMA email'
                    }
                    className={
                      emailMismatch
                        ? 'input-error'
                        : ''
                    }
                    required
                  />


                  {expectedEmail &&
                    account.email
                      .trim()
                      .toLowerCase() !==
                      expectedEmail.toLowerCase() && (
                      <span className="email-suggestion">
                        <span>
                          Suggested PHINMA email:
                          <b>{expectedEmail}</b>
                        </span>
                        <button
                          type="button"
                          onClick={useSuggestedEmail}
                        >
                          Use this email
                        </button>
                      </span>
                    )}


                  {emailMismatch && (
                    <small
                      className="field-error"
                      role="alert"
                    >
                      ⚠ The name and
                      PHINMA email do not
                      match. Expected:{' '}

                      <b>
                        {expectedEmail}
                      </b>
                    </small>
                  )}


                  {!emailMismatch &&
                    account.email &&
                    expectedEmail && (
                      <small className="field-success">
                        ✓ PHINMA email
                        matches the name.
                      </small>
                    )}
                </label>


                <label>
                  Student ID

                  <input
                    name="studentId"
                    value={
                      account.studentId
                    }
                    onChange={
                      updateAccount
                    }
                    placeholder="03-1234-123456"
                    pattern={
                      studentIdPattern
                    }
                    title="Use 03-1234-12345 or 03-1234-123456"
                    required
                  />
                </label>


                <label>
                  Year level

                  <select
                    name="yearLevel"
                    value={
                      account.yearLevel
                    }
                    onChange={
                      updateAccount
                    }
                    required
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select level
                    </option>

                    <option>
                      Grade 11
                    </option>

                    <option>
                      Grade 12
                    </option>

                    <option>
                      First year
                    </option>

                    <option>
                      Second year
                    </option>

                    <option>
                      Third year
                    </option>

                    <option>
                      Fourth year
                    </option>
                  </select>
                </label>


                <label>
                  {isSeniorHigh(account.yearLevel) ? 'Strand' : 'Course'}

                  <select
                    name="course"
                    value={
                      account.course
                    }
                    onChange={
                      updateAccount
                    }
                    required
                  >
                    <option
                      value=""
                      disabled
                    >
                      {isSeniorHigh(account.yearLevel) ? 'Select strand' : 'Select course'}
                    </option>

                    {(isSeniorHigh(account.yearLevel) ? seniorHighStrands : courses).map(
                      (course) => (
                        <option
                          key={course}
                        >
                          {course}
                        </option>
                      )
                    )}
                  </select>
                </label>


                <label>
                  Semester

                  <select
                    name="semester"
                    value={
                      account.semester ||
                      ''
                    }
                    onChange={
                      updateAccount
                    }
                    required
                  >
                    <option
                      value=""
                      disabled
                    >
                      Select semester
                    </option>

                    <option>
                      1st semester
                    </option>

                    <option>
                      2nd semester
                    </option>
                  </select>
                </label>


                <PasswordField
                  label="Password"
                  name="password"
                  value={
                    account.password
                  }
                  onChange={
                    updateAccount
                  }
                  placeholder="Enter password"
                  minLength="8"
                  pattern={
                    PASSWORD_PATTERN
                  }
                  title={
                    passwordTitle
                  }
                  required
                />


                <PasswordField
                  label="Confirm password"
                  name="confirmPassword"
                  value={
                    account.confirmPassword
                  }
                  onChange={
                    updateAccount
                  }
                  placeholder="Repeat password"
                  minLength="8"
                  pattern={
                    PASSWORD_PATTERN
                  }
                  title={
                    passwordTitle
                  }
                  required
                />
              </div>


              <div className="privacy-consent">
                <input
                  name="privacyConsent"
                  type="checkbox"
                  checked={
                    account.privacyConsent
                  }
                  onChange={
                    updateAccount
                  }
                  required
                  aria-label="Agree to the Privacy Notice"
                />

                <span>
                  I have read and agree to
                  the{' '}

                  <b>
                    Privacy Notice
                  </b>

                  {' '}and consent to the
                  collection and use of my
                  personal information for
                  account registration and
                  campus queue services.
                </span>
              </div>


              <button
                className="primary-button"
                type="submit"
                disabled={
                  Boolean(
                    account.email &&
                    emailMismatch
                  )
                }
              >
                Create account
                <span>→</span>
              </button>


              {message && (
                <p
                  className="signin-message"
                  role="status"
                >
                  {message}
                </p>
              )}


              <p className="account-switch">
                Already registered?{' '}

                <button
                  type="button"
                  onClick={() => {
                    setMessage('')
                    setPage('signin')
                  }}
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </section>
      </section>
    </main>
  )
}


function PasswordField({
  label,
  ...props
}) {
  const [
    visible,
    setVisible,
  ] = useState(false)

  return (
    <label className="password-field">
      {label}

      <span>
        <input
          {...props}
          type={
            visible
              ? 'text'
              : 'password'
          }
        />

        <button
          type="button"
          onClick={() =>
            setVisible(
              (current) =>
                !current
            )
          }
          aria-label={
            visible
              ? 'Hide password'
              : 'Show password'
          }
          title={
            visible
              ? 'Hide password'
              : 'Show password'
          }
        >
          <PasswordEye
            visible={visible}
          />
        </button>
      </span>
    </label>
  )
}


function PasswordEye({
  visible,
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />

      <circle
        cx="12"
        cy="12"
        r="2.75"
      />

      {visible && (
        <path d="M4 4 20 20" />
      )}
    </svg>
  )
}
