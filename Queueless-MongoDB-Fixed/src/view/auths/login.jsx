import { useState } from 'react'
import { login, register, requestPasswordReset, resetPassword, resendVerification, verifyEmail } from '../../services/auth.js'
import './login.css'

const initialForm = {
  fullName: '',
  email: '',
  studentId: '',
  accountType: 'Student',
  office: 'Registrar',
  course: '',
  yearLevel: '',
  password: '',
  confirmPassword: '',
  privacyConsent: false,
}

const PASSWORD_PATTERN = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*])[A-Za-z\\d!@#$%^&*]{8,}'
const passwordTitle = 'At least 8 characters with uppercase, lowercase, number, and one of ! @ # $ % ^ & *. No spaces.'
const studentIdPattern = '03-[0-9]{4}-[0-9]{5,6}'
const fullNamePattern = "[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]*"
const suggestedSchoolEmail = (name) => {
  const parts = name.trim().toLowerCase().replace(/[^a-z\\s-]/g, '').split(/\\s+/).filter(Boolean)
  if (parts.length < 2) return ''
  return `${parts[0].slice(0, 2)}${parts.length > 2 ? parts[1].slice(0, 2) : ''}.${parts.at(-1)}.up@phinmaed.com`
}

function QueueMark() {
  return <img className="queue-logo" src="/queue-logo.png" alt="" />
}

export default function Login({ onLogin }) {
  const [page, setPage] = useState('signin')
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [reset, setReset] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return { email: params.get('email') || '', code: '', password: '', confirmPassword: '' }
  })
  const [account, setAccount] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [remember, setRemember] = useState(true)
  const [signingIn, setSigningIn] = useState(false)

  const updateCredentials = ({ target }) => setCredentials((current) => ({ ...current, [target.name]: target.value }))
  const updateAccount = ({ target }) => setAccount((current) => ({ ...current, [target.name]: target.type === 'checkbox' ? target.checked : target.value }))
  const updateReset = ({ target }) => setReset((current) => ({ ...current, [target.name]: target.value }))

  const authenticate = async (event) => {
    event.preventDefault()
    if (signingIn) return
    setSigningIn(true)
    try { const session = await login(credentials.email, credentials.password); setMessage(''); onLogin?.(session, remember) } catch (error) { if (error.message === 'Verify your email address before signing in.') { setReset((current) => ({ ...current, email: credentials.email, code: '' })); setMessage(error.message); setPage('verify') } else setMessage(error.message) } finally { setSigningIn(false) }
  }

  const createAccount = async (event) => {
    event.preventDefault()
    if (account.password !== account.confirmPassword) return setMessage('Passwords do not match.')
    try { const result = await register({ name: account.fullName, email: account.email, password: account.password, accountId: account.studentId, role: account.accountType.toLowerCase(), department: account.accountType === 'Student' ? account.course : undefined, yearLevel: account.accountType === 'Student' ? account.yearLevel : undefined, semester: account.accountType === 'Student' ? account.semester : undefined, office: account.accountType === 'Staff' ? account.office : undefined, privacyConsent: account.privacyConsent }); setReset((current) => ({ ...current, email: result.email || account.email, code: '' })); setMessage(result.message); setPage('verify') } catch (error) { if (error.message === 'We could not send the code. Please try again later.') { setReset((current) => ({ ...current, email: account.email, code: '' })); setPage('verify') } setMessage(error.message) }
  }

  const requestReset = async (event) => {
    event.preventDefault()
    try {
      const result = await requestPasswordReset(reset.email)
      setMessage(result.message)
      setReset((current) => ({ ...current, code: '', password: '', confirmPassword: '' }))
      setPage('reset')
    } catch (error) { setMessage(error.message) }
  }

  const completeReset = async (event) => {
    event.preventDefault()
    if (reset.password !== reset.confirmPassword) return setMessage('Passwords do not match.')
    try {
      const result = await resetPassword(reset.email, reset.code, reset.password)
      setMessage(result.message)
      setPage('signin')
      setReset({ email: '', code: '', password: '', confirmPassword: '' })
    } catch (error) { setMessage(error.message) }
  }

  const confirmEmail = async (event) => {
    event.preventDefault()
    try { const result = await verifyEmail(reset.email, reset.code); setMessage(result.message); setPage('signin') } catch (error) { setMessage(error.message) }
  }

  const resendCode = async () => {
    try { const result = await resendVerification(reset.email); setMessage(result.message) } catch (error) { setMessage(error.message) }
  }

  return (
    <main className={`login-page ${page === 'signin' ? 'page-signin' : page === 'create' ? 'page-create' : 'page-reset'}`}>
      <nav className="auth-nav">
        <button className="nav-brand" type="button" onClick={() => setPage('signin')}><QueueMark /><span><b>Queueless</b><small>Campus queue system</small></span></button>
        <button className="nav-cta" type="button" onClick={() => { setMessage(''); setPage(page === 'signin' ? 'create' : 'signin') }}>{page === 'signin' ? 'Create account' : 'Sign in'}</button>
      </nav>

      <section className="auth-shell">
        <aside className="auth-hero">
          <div className="hero-badge">SMARTER CAMPUS SERVICES</div>
          <h1>Your turn,<br/><em>without the line.</em></h1>
          <p>Join school-office queues from your phone, see exactly where you are, and arrive when it’s nearly your turn.</p>
          <div className="hero-preview" aria-hidden="true">
            <div className="preview-top"><span>Registrar</span><b>Live queue</b></div>
            <strong>R-024</strong>
            <div className="preview-stats"><span><small>Students ahead</small><b>3</b></span><span><small>Est. wait</small><b>12 min</b></span></div>
            <div className="preview-progress"><i /></div>
            <small>We’ll keep your position updated in real time.</small>
          </div>
          <div className="hero-points"><span>✓ Digital tickets</span><span>✓ Live status</span><span>✓ Requirements checklist</span></div>
        </aside>

        <section className="auth-content">
          {page === 'signin' ? (
            <form className="auth-card" onSubmit={authenticate}>
              <div className="card-heading"><span>WELCOME BACK</span><h2>Sign in to Queueless</h2><p>One account, the right dashboard for your role.</p></div>
              <label>Email address<input name="email" type="email" value={credentials.email} onChange={updateCredentials} placeholder="Enter your email" autoComplete="email" required /></label>
              <PasswordField label="Password" name="password" value={credentials.password} onChange={updateCredentials} placeholder="Enter your password" autoComplete="current-password" required />
              <div className="forgot-row"><label className="remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Keep me signed in</label><button type="button" onClick={() => { setMessage(''); setPage('forgot') }}>Forgot password?</button></div>
              <button className="primary-button" type="submit" disabled={signingIn} aria-busy={signingIn}>{signingIn ? <><i className="button-spinner" aria-hidden="true" /> Signing in...</> : <>Sign in <span>→</span></>}</button>
              {message && <p className="signin-message" role="status">{message}</p>}
              <p className="account-switch">New to Queueless? <button type="button" onClick={() => { setMessage(''); setPage('create') }}>Create an account</button></p>
            </form>
          ) : page === 'forgot' ? (
            <form className="auth-card reset-card" onSubmit={requestReset}>
              <div className="card-heading"><span>PASSWORD RECOVERY</span><h2>Forgot your password?</h2><p>Enter your email and we’ll send a reset link if an account matches it.</p></div>
              <label>Email address<input name="email" type="email" value={reset.email} onChange={updateReset} placeholder="Enter your email" autoComplete="email" required /></label>
              <button className="primary-button" type="submit">Send reset link <span>→</span></button>
              {message && <p className="signin-message reset-message" role="status">{message}</p>}
              <p className="account-switch"><button type="button" onClick={() => { setMessage(''); setPage('signin') }}>Back to sign in</button></p>
            </form>
          ) : page === 'verify' ? (
            <form className="auth-card reset-card" onSubmit={confirmEmail}>
              <div className="card-heading"><span>VERIFY YOUR EMAIL</span><h2>Enter your code</h2><p>We sent a six-digit code to <b>{reset.email}</b>. Verify your email before signing in.</p></div>
              <label>Verification code<input name="code" value={reset.code} onChange={updateReset} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required /></label>
              <button className="primary-button" type="submit">Verify email <span>→</span></button>
              {message && <p className="signin-message reset-message" role="status">{message}</p>}
              <p className="account-switch">Didn’t receive it? <button type="button" onClick={resendCode}>Resend code</button></p>
            </form>
          ) : page === 'reset' ? (
            <form className="auth-card reset-card" onSubmit={completeReset}>
              <div className="card-heading"><span>CHOOSE A NEW PASSWORD</span><h2>Reset your password</h2><p>Enter the six-digit code we sent to your email, then choose a new password.</p></div>
              <label>Email address<input name="email" type="email" value={reset.email} onChange={updateReset} autoComplete="email" required /></label>
              <label>Reset code<input name="code" value={reset.code} onChange={updateReset} placeholder="123456" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required /></label>
              <PasswordField label="New password" name="password" value={reset.password} onChange={updateReset} minLength="8" pattern={PASSWORD_PATTERN} title={passwordTitle} autoComplete="new-password" required />
              <PasswordField label="Confirm new password" name="confirmPassword" value={reset.confirmPassword} onChange={updateReset} minLength="8" pattern={PASSWORD_PATTERN} title={passwordTitle} autoComplete="new-password" required />
              <button className="primary-button" type="submit">Reset password <span>→</span></button>
              {message && <p className="signin-message" role="status">{message}</p>}
              <p className="account-switch"><button type="button" onClick={() => { setMessage(''); setPage('signin') }}>Back to sign in</button></p>
            </form>
          ) : (
            <form className="auth-card create-card" onSubmit={createAccount}>
              <div className="card-heading"><span>GET STARTED</span><h2>Create an account</h2><p>Create a student or staff account to access your dashboard.</p></div>
              <div className="create-fields">
                <label className="wide">Full name<input name="fullName" value={account.fullName} onChange={updateAccount} placeholder="Last Name, First Name, Middle Name" pattern={fullNamePattern} title="Use letters, spaces, apostrophes, and hyphens only." required /></label>
                <label className="wide">Email address<input name="email" type="email" value={account.email} onChange={updateAccount} placeholder={suggestedSchoolEmail(account.fullName) || 'Enter your email'} required /><small className="field-help">PHINMA students may use {suggestedSchoolEmail(account.fullName) || 'their phinmaed email'}: a personal email is also accepted.</small></label>
                {account.accountType === 'Student' && <label>Student ID<input name="studentId" value={account.studentId} onChange={updateAccount} placeholder="03-1234-123456" pattern={studentIdPattern} title="Use 03-1234-12345 or 03-1234-123456" required /></label>}
                <label>Account type<select name="accountType" value={account.accountType} onChange={updateAccount}><option>Student</option><option>Staff</option></select></label>
                {account.accountType === 'Student' ? <><label>Course / strand<input name="course" value={account.course} onChange={updateAccount} placeholder="STEM / BSIT" required /></label><label>Year level<select name="yearLevel" value={account.yearLevel} onChange={updateAccount} required><option value="" disabled>Select level</option><option>Grade 11</option><option>Grade 12</option><option>First year</option><option>Second year</option><option>Third year</option><option>Fourth year</option></select></label><label>Semester<select name="semester" value={account.semester || ''} onChange={updateAccount} required><option value="" disabled>Select semester</option><option>1st semester</option><option>2nd semester</option></select></label></> : <label>Assigned office<select name="office" value={account.office} onChange={updateAccount} required><option>Registrar</option><option>Finance</option><option>CSDL</option></select></label>}
                <PasswordField label="Password" name="password" value={account.password} onChange={updateAccount} placeholder="Enter password" minLength="8" pattern={PASSWORD_PATTERN} title={passwordTitle} required />
                <PasswordField label="Confirm password" name="confirmPassword" value={account.confirmPassword} onChange={updateAccount} placeholder="Repeat password" minLength="8" pattern={PASSWORD_PATTERN} title={passwordTitle} required />
              </div>
              <label className="privacy-consent"><input name="privacyConsent" type="checkbox" checked={account.privacyConsent} onChange={updateAccount} required /> <span>I agree to the <b>Privacy Notice</b> and consent to Queueless using my name, school email, school ID, and academic details only to create my account and provide campus queue services. We do not collect payment information.</span></label>
              <p className="security-note">Staff accounts require administrator approval before they can sign in. Admin accounts should be provisioned by the school.</p>
              <button className="primary-button" type="submit">Create account <span>→</span></button>
              {message && <p className="signin-message" role="status">{message}</p>}
              <p className="account-switch">Already registered? <button type="button" onClick={() => { setMessage(''); setPage('signin') }}>Sign in</button></p>
            </form>
          )}
        </section>
      </section>
    </main>
  )
}

function PasswordField({ label, ...props }) {
  const [visible, setVisible] = useState(false)
  return <label className="password-field">{label}<span><input {...props} type={visible ? 'text' : 'password'} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}><PasswordEye visible={visible}/></button></span></label>
}

function PasswordEye({ visible }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.75"/>{visible&&<path d="M4 4 20 20"/>}</svg>
}
