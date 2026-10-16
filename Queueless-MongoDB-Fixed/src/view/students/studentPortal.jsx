import { useCallback, useEffect, useRef, useState } from 'react'
import { getPortalState, portalApi } from '../../services/auth.js'
import { studentTickets } from '../../services/studentTickets.js'
import './students.css'

const services = [
  { office: 'Registrar', icon: '📋', color: '#7357d8', description: 'Academic records, enrollment and certifications', wait: 4, options: ['Transcript / school records', 'Certificate request', 'Enrollment concern'], requirements: ['Valid school ID', 'Completed request form', 'Authorization letter if requesting for another person'] },
  { office: 'Finance', icon: '💳', color: '#1677c8', description: 'Payments, balances, receipts and assessments', wait: 6, options: ['Tuition / school fees', 'Official receipt request', 'Account assessment'], requirements: ['Valid school ID', 'Payment or reference document', 'Assessment form when applicable'] },
  { office: 'CSDL', icon: '🪪', color: '#d45575', description: 'Student services, IDs, clearances and concerns', wait: 5, options: ['Student clearance', 'ID concern', 'General student concern'], requirements: ['Valid school ID', 'Relevant clearance or concern form'] },
]

const initials = (name = '') => name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'S'
const validSchoolId = (id) => /^03-\d{4}-\d{5,6}$/.test(id || '')
const validPassword = (password) => password.length >= 8 && !/\s/.test(password) && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*]/.test(password)
const passwordRule = 'Use 8+ characters with uppercase, lowercase, number, and ! @ # $ % ^ & *; no spaces.'
const campusDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

export default function StudentPortal({ onLogout, user, token, page = 'Dashboard', onNavigate }) {
  const [officeState, setOfficeState] = useState([])
  const [queue, setQueue] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const queueMutation = useRef(0)
  const cancelPending = useRef(false)
  const activeTicketId = useRef(null)
  const [history, setHistory] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [notice, setNotice] = useState('')
  const [choices, setChoices] = useState(() => Object.fromEntries(services.map((service) => [service.office, service.options[0]])))
  const [profile, setProfile] = useState(() => ({ name: user?.name || 'Student', email: user?.email || '', id: validSchoolId(user?.accountId) ? user.accountId : '03-0000-000000', department: user?.department || 'CITE', yearLevel: user?.yearLevel || 'First year', semester: user?.semester || '1st semester' }))
  const [returningUser] = useState(() => {
    const key = `queueless-welcomed-${user?.id || user?.email || 'student'}`
    const seen = localStorage.getItem(key) === 'true'
    localStorage.setItem(key, 'true')
    return seen
  })

  const applyState = useCallback(({offices = [], tickets = []}) => {
    // Older API responses omit service lists and may use MongoDB IDs or office names.
    const normalizedOffices = offices.map((office) => ({
      ...office,
      id: office.id || office._id || office.name,
      services: Array.isArray(office.services) ? office.services : [],
    }))
    setOfficeState(normalizedOffices)
    const convert = (ticket) => {
      const office = normalizedOffices.find(o=>o.id===ticket.officeId || o.name===ticket.officeId)
      const base = services.find(s=>s.office===office?.name)
      const service = {...base, requirements:office?.services?.find(s=>s.name===ticket.service)?.requirements || base?.requirements || []}
      const minutesPerVisit=office?.serviceMinutes || office?.wait || 4
      return {...ticket,office:office?.name,serviceName:ticket.service,service,ahead:ticket.queuePosition,estimated:ticket.queuePosition*minutesPerVisit,status:ticket.status==='serving'?'Now serving':ticket.status==='skipped'?'Skipped — awaiting recall':ticket.visitDate>campusDate()?'Scheduled':'Waiting',result:ticket.status==='served'?'Served':'Cancelled',completedAt:ticket.completedAt ? new Date(ticket.completedAt).toLocaleString() : ''}
    }
    const ownedTickets = studentTickets(tickets, { id: user?.id, _id: user?._id, email: profile.email })
    const nextQueue = ownedTickets
      .filter(ticket => ['waiting', 'serving', 'skipped'].includes(ticket.status))
      .map(convert)[0] || null
    const nextHistory = ownedTickets
      .filter(ticket => ['served', 'cancelled'].includes(ticket.status))
      .map(convert)
      .reverse()
    const completedTicket = activeTicketId.current
      ? ownedTickets.find(ticket =>
          ticket.id === activeTicketId.current &&
          ticket.status === 'served'
        )
      : null

    setQueue(nextQueue)
    setHistory(nextHistory)

    if (completedTicket) {
      setNotice(
        `Your ${completedTicket.ticket} ticket has been marked served. You can now rate the service in Review.`
      )
    }

    activeTicketId.current = nextQueue?.id || null
  }, [user?.id, user?._id, profile.email])
  const refresh = async () => applyState(await getPortalState(token))
  useEffect(() => {
    let disposed=false
    const poll=async()=>{
      if (cancelPending.current) return
      const version = queueMutation.current
      try { const state=await getPortalState(token); if(!disposed && version === queueMutation.current && !cancelPending.current) applyState(state) }
      catch(error) {if(!disposed && version === queueMutation.current)setNotice(error.message)}
    }
    poll()
    const timer=setInterval(poll,2000)
    return ()=>{disposed=true;clearInterval(timer)}
  }, [token, applyState])
  const availableServices=services.map(service=>{
    const office=officeState.find(o=>o.name===service.office)
    return {...service,open:office?.open ?? false,requirements:office?.services?.find(s=>s.name===choices[service.office])?.requirements || service.requirements}
  })
  const saveProfile=async(next)=>{
    try {const {user:updated}=await portalApi('/api/auth/profile',token,{method:'PATCH',body:JSON.stringify(next)});setProfile({...updated,id:updated.accountId});setNotice('Profile saved.');return true}
    catch(error){setNotice(error.message);return false}
  }

  const go = (next) => { setSelectedService(null); onNavigate(next) }
  const showNotice = (message) => setNotice(message)

  const joinQueue = async (service, visitDate = '') => {
    if (queue) return showNotice('You already have an active ticket. Cancel it before joining another queue.')
    if (!token) return showNotice('Your session has expired. Please sign in again.')
    if (!service?.office || !choices[service.office]) return showNotice('Choose a school service before getting a ticket.')
    try {
      const { ticket } = await portalApi('/api/tickets', token, { method: 'POST', body: JSON.stringify({ officeId: service.office, service: choices[service.office], visitDate }) })
      const office=officeState.find((item)=>item.name===service.office)
      const minutesPerVisit=office?.serviceMinutes || office?.wait || service.wait
      setQueue({ ...ticket, office: service.office, serviceName: ticket.service, service, ahead: ticket.queuePosition, estimated: ticket.queuePosition * minutesPerVisit, status: 'Waiting', visitDate })
      go('My Queue'); showNotice(`Your ${service.office} digital ticket is ready.`)
      await refresh()
    } catch (error) {
      if (error.message === 'Your session has expired.') return onLogout()
      showNotice(error.message)
    }
  }

  const cancelQueue = async () => {
    if (!queue || cancelPending.current) return
    if (!queue.id) return showNotice('This ticket is missing its ID. Refresh the page to reload your ticket.')
    cancelPending.current = true
    setCancelling(true)
    queueMutation.current += 1
    try {
      await portalApi(`/api/tickets/${encodeURIComponent(queue.id)}/cancel`, token, { method: 'PATCH' })
      setQueue(null)
      setHistory(items => [{ ...queue, result: 'Cancelled', completedAt: new Date().toLocaleString() }, ...items.filter(item => item.id !== queue.id)])
      showNotice('Your queue ticket was cancelled.')
    } catch (error) {
      showNotice(error.message)
    } finally {
      // Reconcile tickets that were served/cancelled elsewhere, even after a 404.
      try { await refresh() } catch { /* Keep the action result until polling recovers. */ }
      queueMutation.current += 1
      cancelPending.current = false
      setCancelling(false)
    }
  }

  const submitFeedback = async (ticketNumber, rating, comment) => {
    const ticket=history.find(t=>t.ticket===ticketNumber)
    try {await portalApi('/api/tickets/'+ticket.id+'/feedback',token,{method:'POST',body:JSON.stringify({rating,comment})});await refresh();setSelectedService(null);showNotice('Your feedback was submitted.')}
    catch(error){showNotice(error.message)}
  }

  const nav = [
    ['home', 'Dashboard'],
    ['services', 'Services'],
    ['calendar', 'Calendar'],
    ['queues', 'My Queue'],
    ['history', 'History'],
    ['star', 'Review'],
    ['profile', 'Profile'],
  ]

  return (
    <main className="student-app">
      <aside className="student-sidebar">
        <div className="student-logo"><img className="student-mark" src="/queue-logo.png" alt="" /><span>Queueless<small>Student portal</small></span></div>
        <nav>{nav.map(([icon, label]) => <button type="button" title={label} aria-current={page === label ? 'page' : undefined} className={page === label ? 'active' : ''} onClick={() => go(label)} key={label}><i><SidebarIcon name={icon}/></i><span>{label}</span>{label === 'My Queue' && queue && <em>1</em>}</button>)}</nav>
        <div className="account"><span>{initials(profile.name)}</span><p><b>{profile.name}</b><small>{profile.id}</small></p><button onClick={onLogout} title="Sign out">⇥</button></div>
      </aside>

      <section className="student-main">
        <header className="portal-header"><div><small>Student Portal</small><b>{page}</b></div><span className="live-indicator">Queue system live</span></header>
        <div className="student-content">
          {notice && <div className="feature-notice">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
          {page === 'Dashboard' && <Dashboard profile={profile} queue={queue} history={history} go={go} returningUser={returningUser} />}
          {page === 'Services' && <Services services={availableServices} active={queue} choices={choices} setChoices={setChoices} onDetails={setSelectedService} onJoin={joinQueue} />}
          {page === 'Calendar' && <Calendar services={availableServices} active={queue} choices={choices} onJoin={joinQueue} />}
          {page === 'My Queue' && <MyQueue queue={queue} cancelling={cancelling} onCancel={cancelQueue} go={go} />}
          {page === 'History' && <History history={history} onRate={setSelectedService} />}
          {page === 'Review' && <Review history={history} onRate={setSelectedService} />}
          {page === 'Profile' && <Profile profile={profile} onSave={saveProfile} onPasswordSave={(password) => saveProfile({password})} onLogout={onLogout} />}
        </div>
      </section>

      {selectedService && (selectedService.ticket
        ? <FeedbackModal item={selectedService} onClose={() => setSelectedService(null)} onSubmit={submitFeedback} />
        : <RequirementsModal service={selectedService} choice={choices[selectedService.office]} onClose={() => setSelectedService(null)} onJoin={joinQueue} active={queue} />)}
    </main>
  )
}

function Title({ eyebrow = 'QUEUELESS STUDENT PORTAL', title, subtitle, action }) {
  return <section className="page-title"><div><b>{eyebrow}</b><h1>{title}</h1><p>{subtitle}</p></div>{action}</section>
}

function Dashboard({ profile, queue, history, go, returningUser }) {
  const served = history.filter((item) => item.result === 'Served').length
  const lastServed = history.find((item) => item.result === 'Served')
  return <>
    <Title title={<>Hello, <em>{profile.name.split(' ')[0] || 'Student'}{returningUser ? ' — welcome back' : ''}.</em></>} subtitle="Manage school-office visits without spending your day in a physical line." action={<button className="title-action" onClick={() => go('Services')}>+ Join a queue</button>} />
    {lastServed && <section className="served-confirmation"><span>✓</span><div><small>LAST VISIT</small><b>{lastServed.ticket} · Served</b><p>{lastServed.office} · {lastServed.serviceName}</p></div><button onClick={() => go('Review')}>Rate service</button></section>}
    <section className="student-stats">
      <article><span className="stat-icon purple">🎟</span><div><small>Active ticket</small><strong>{queue?.ticket || 'No ticket'}</strong><p>{queue ? queue.office : 'You are not queued'}</p></div></article>
      <article><span className="stat-icon mint">◷</span><div><small>Estimated wait</small><strong>{queue ? `${queue.estimated} min` : '—'}</strong><p>{queue ? `${queue.ahead} student${queue.ahead === 1 ? '' : 's'} ahead` : 'Join a service to begin'}</p></div></article>
      <article><span className="stat-icon amber">✓</span><div><small>Completed visits</small><strong>{served}</strong><p>{history.length} total queue transaction{history.length === 1 ? '' : 's'}</p></div></article>
    </section>
    {queue ? <section className="active-queue-card"><div className="active-copy"><span>ACTIVE QUEUE</span><h2>{queue.ticket} · {queue.office}</h2><p>{queue.serviceName}</p><div className="inline-status"><b>{queue.status}</b><span>{queue.ahead} ahead</span><span>~{queue.estimated} min</span></div><button onClick={() => go('My Queue')}>Track my queue →</button></div><QueueOrbit ticket={queue.ticket} ahead={queue.ahead} status={queue.status} /></section>
      : <section className="welcome-card"><div><span>START HERE</span><h2>Choose an office. Get a ticket. <em>Keep moving.</em></h2><p>Check service requirements before joining, then follow your live queue position from any device.</p><button onClick={() => go('Services')}>Browse available offices →</button></div><div className="welcome-steps"><span><b>1</b>Pick a service</span><i /><span><b>2</b>Get a ticket</span><i /><span><b>3</b>Track your turn</span></div></section>}
    <section className="quick-services"><div className="section-heading"><div><h2>Popular offices</h2><p>Quick access to frequently used school services.</p></div><button onClick={() => go('Services')}>See all</button></div><div className="mini-service-grid">{services.slice(0,4).map((service) => <button key={service.office} onClick={() => go('Services')}><span>{service.icon}</span><b>{service.office}</b><small>~{service.wait} min / student</small><em>→</em></button>)}</div></section>
  </>
}

function QueueOrbit({ ticket, ahead, status }) {
  return <div className="queue-orbit"><i /><i /><i /><div><small>YOUR NUMBER</small><strong>{ticket}</strong><span>{status === 'Now serving' ? 'Please proceed' : status === 'Scheduled' ? 'Scheduled visit' : status?.startsWith('Skipped') ? 'Awaiting recall' : ahead === 0 ? 'Waiting to be called' : `${ahead} ahead`}</span></div></div>
}

function Services({ services, active, choices, setChoices, onDetails, onJoin }) {
  return <>
    <Title title="Offices & services" subtitle="Choose the exact service you need and review the required documents before taking a ticket." />
    {active && <div className="active-reminder"><b>Active ticket: {active.ticket}</b><span>{active.office} · {active.serviceName}</span><small>You can only hold one active queue ticket at a time.</small></div>}
    <div className="service-grid">{services.map((service) => <article className="service-card" style={{ '--service-color': service.color }} key={service.office}>
      <div className="service-top"><span className="office-icon service-logo">{service.icon}</span><span className="open-pill">{service.open ? "Open" : "Closed"}</span></div>
      <h3>{service.office}</h3><p>{service.description}</p>
      <label>School service<select value={choices[service.office]} onChange={(event) => setChoices((current) => ({ ...current, [service.office]: event.target.value }))}>{service.options.map((option) => <option key={option}>{option}</option>)}</select></label>
      <div className="service-meta"><span><small>Typical service time</small><b>~{service.wait} min</b></span><span><small>Requirements</small><b>{service.requirements.length} items</b></span></div>
      <div className="service-actions"><button onClick={() => onDetails(service)}>View requirements</button><button className="primary" disabled={Boolean(active) || !service.open} onClick={() => onJoin(service)}>{active ? 'Ticket already active' : 'Get digital ticket'}</button></div>
    </article>)}</div>
  </>
}

function MyQueue({ queue, cancelling, onCancel, go }) {
  if (!queue) return <><Title title="My queue" subtitle="Your active digital ticket and live queue status will appear here." /><section className="empty-state"><span>🎟</span><h2>No active queue</h2><p>Select an office and school service to get your next digital ticket.</p><button onClick={() => go('Services')}>View services</button></section></>
  const progress = Math.max(8, 100 - queue.ahead * 10)
  return <>
    <Title title="My queue" subtitle="Keep this page open — your position and estimated waiting time update automatically." action={<span className="status-chip">● {queue.status}</span>} />
    <section className="queue-layout">
      <article className="digital-ticket">
        <div className="ticket-head"><span>DIGITAL QUEUE TICKET</span><b>LIVE</b></div>
        <div className="ticket-office"><span>{queue.service.icon}</span><div><small>{queue.office}</small><p>{queue.serviceName}</p></div></div>
        <strong className="ticket-code">{queue.ticket}</strong>
        <div className="ticket-progress"><div><span>Requirements status</span><b>{queue.status === 'Now serving' ? 'Ongoing' : 'Ready'}</b></div><i><em style={{ width: `${progress}%` }} /></i></div>
        <div className="ticket-stats"><span><small>Students ahead</small><b>{queue.ahead}</b></span><span><small>Estimated wait</small><b>{queue.estimated} min</b></span><span><small>Queue date</small><b>{queue.visitDate || 'Today'}</b></span></div>
        <p className="queue-message">{queue.status === 'Now serving' ? 'Your number is being served. Please proceed to the office window.' : queue.status === 'Scheduled' ? `Your visit is scheduled for ${queue.visitDate}. Check your queue on that date.` : queue.status.startsWith('Skipped') ? 'Your ticket was skipped. Contact the office when you are ready to be recalled.' : queue.ahead === 0 ? 'You are first in line. Please wait for staff to call your number.' : queue.ahead <= 2 ? 'You’re almost up. Please make your way toward the office.' : 'You can continue with your day. Check back as your turn gets closer.'}</p>
        <div className="ticket-actions"><button type="button" className="danger-text" disabled={cancelling} onClick={onCancel}>{cancelling ? 'Cancelling…' : 'Cancel queue'}</button></div>
      </article>
      <aside className="queue-side">
        <article className="requirements-card"><span className="float-kicker">BE READY</span><h3>Service requirements</h3>{queue.service.requirements.map((item) => <p key={item}><i>✓</i>{item}</p>)}<small>Bring original documents when required by the office.</small></article>
        <article className="queue-tip"><b>Requirements tracker</b><p><strong>{queue.status === 'Now serving' ? 'Ongoing' : 'Ready'}</strong> — staff will mark your service done when the visit is complete. You can then rate it from 1 to 5 in Review.</p></article>
      </aside>
    </section>
  </>
}

function History({ history, onRate }) {
  return <>
    <Title title="Queue history" subtitle="Review your previous office visits and rate completed service experiences." />
    {!history.length ? <section className="empty-state compact-empty"><span>◷</span><h2>No history yet</h2><p>Your served and cancelled queue tickets will appear here.</p></section> :
      <section className="history-card"><div className="history-head"><span>Ticket</span><span>Office & service</span><span>Completed</span><span>Status</span><span>Feedback</span></div>{history.map((item) => <article key={`${item.ticket}-${item.completedAt}`}><strong>{item.ticket}</strong><div><b>{item.office}</b><small>{item.serviceName}</small></div><span>{item.completedAt}</span><em className={item.result.toLowerCase()}>{item.result}</em><div className="history-rating">{item.result === 'Served' ? (item.feedback ? <span>★ {item.feedback.rating}/5</span> : <button onClick={() => onRate(item)}>Rate service</button>) : <span>—</span>}</div></article>)}</section>}
  </>
}

function Calendar({ services, active, choices, onJoin }) {
  const [office, setOffice] = useState(services[0].office)
  const [date, setDate] = useState(campusDate)
  const service = services.find((item) => item.office === office)
  return <><Title title="Queue calendar" subtitle="Pick the date for your queue spot before you visit the school office." />
    <section className="calendar-card">
      <div className="calendar-heading"><span className="office-icon">▣</span><div><h2>Reserve a queue date</h2><p>Choose an office and the day you plan to claim your ticket.</p></div></div>
      <div className="calendar-fields"><label>School office<select value={office} onChange={(event) => setOffice(event.target.value)}>{services.map((item) => <option key={item.office}>{item.office}</option>)}</select></label><label>Queue date<input type="date" value={date} min={campusDate()} onChange={(event) => setDate(event.target.value)} /></label></div>
      <div className="calendar-summary"><span><small>Selected service</small><b>{service.office}</b></span><span><small>Service type</small><b>{choices[service.office]}</b></span><span><small>Status</small><b>{active ? 'Ticket already active' : 'Ready to reserve'}</b></span></div>
      <button className="modal-primary" disabled={Boolean(active) || !service.open} onClick={() => onJoin(service, date)}>{active ? 'Cancel your active ticket first' : 'Get queue spot for this date'}</button>
    </section>
  </>
}

function Review({ history, onRate }) {
  const completed = history.filter((item) => item.result === 'Served')
  return <><Title title="Service reviews" subtitle="Rate completed services from 1 to 5 stars and share your experience." />
    {!completed.length ? <section className="empty-state compact-empty"><span>★</span><h2>No services to review</h2><p>After a queue visit is completed, you can rate the service here.</p></section> : <section className="review-list">{completed.map((item) => <article key={`${item.ticket}-${item.completedAt}`}><div><b>{item.office}</b><p>{item.serviceName} · {item.ticket}</p></div>{item.feedback ? <strong>★ {item.feedback.rating}/5</strong> : <button onClick={() => onRate(item)}>Rate 1–5 stars</button>}</article>)}</section>}
  </>
}

function Profile({ profile, onSave, onPasswordSave, onLogout }) {
  const [form, setForm] = useState({ ...profile, newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const update = ({ target }) => setForm((current) => ({ ...current, [target.name]: target.value }))
  const submit = async (event) => {
    event.preventDefault()
    if (form.newPassword && form.newPassword !== form.confirmPassword) return setError('New passwords do not match.')
    setError('')
    const { newPassword, confirmPassword: _confirmPassword, ...nextProfile } = form
    if (!await onSave({...nextProfile,password:newPassword || undefined})) return
    setForm((current) => ({ ...current, newPassword: '', confirmPassword: '' }))
  }
  const savePassword = async () => {
    if (!validPassword(form.newPassword) || form.newPassword !== form.confirmPassword) return setError(`Passwords must match. ${passwordRule}`)
    if (!await onPasswordSave(form.newPassword)) return
    setError('')
    setForm((current) => ({ ...current, newPassword: '', confirmPassword: '' }))
  }
  return <><Title title="My profile" subtitle="Update your student credentials and account details." />
    <form className="profile-card profile-editor" onSubmit={submit}>
      <div className="profile-main"><span>{initials(form.name)}</span><div><h2>{form.name || 'Student'}</h2><p>{form.email || 'Add your email address'}</p><em>Student</em></div></div>
      <div className="profile-form-fields">
        <label>Student ID<input name="id" value={form.id} readOnly placeholder="03-1234-123456" pattern="03-[0-9]{4}-[0-9]{5,6}" title="Use 03-1234-12345 or 03-1234-123456" required /></label>
        <label>Full name<input name="name" value={form.name} onChange={update} placeholder="Maria Santos" required /></label>
        <label>Email address<input name="email" type="email" value={form.email} onChange={update} placeholder="you@school.edu" required /></label>
        <label>Department<select name="department" value={form.department} onChange={update}><option>SHS</option><option>CAS</option><option>CAHS</option><option>CCJE</option><option>CEA</option><option>CELA</option><option>CHTM</option><option>CITE</option><option>CMA</option></select></label>
        <label>Year level<select name="yearLevel" value={form.yearLevel} onChange={update}><option>Grade 11</option><option>Grade 12</option><option>First year</option><option>Second year</option><option>Third year</option><option>Fourth year</option></select></label>
        <label>Semester<select name="semester" value={form.semester} onChange={update}><option>1st semester</option><option>2nd semester</option></select></label>
        <PasswordField label="New password" name="newPassword" value={form.newPassword} onChange={update} placeholder="Aa1!password" minLength="8" title={passwordRule} />
        <PasswordField label="Confirm new password" name="confirmPassword" value={form.confirmPassword} onChange={update} placeholder="Repeat password" minLength="8" title={passwordRule} />
        <button className="profile-password-save" type="button" onClick={savePassword} disabled={!validPassword(form.newPassword) || form.newPassword !== form.confirmPassword}>Save password</button>
      </div>
      <div className="profile-footer"><p className={error ? 'profile-error' : ''}>{error || 'Use a new password only when you want to change it.'}</p><div><button type="button" onClick={onLogout}>Sign out</button><button className="profile-save" type="submit">Save profile</button></div></div>
    </form>
  </>
}

function PasswordField({ label, ...props }) {
  const [visible, setVisible] = useState(false)
  return <label className="profile-password-field">{label}<span><input {...props} type={visible ? 'text' : 'password'} /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}><PasswordEye visible={visible}/></button></span></label>
}

function PasswordEye({ visible }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.75"/>{visible&&<path d="M4 4 20 20"/>}</svg>
}

function SidebarIcon({ name }) {
  const paths = {
    home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-6h6v6"/></>,
    services: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></>,
    queues: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    history: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>,
    profile: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function RequirementsModal({ service, choice, onClose, onJoin, active }) {
  return <div className="student-overlay" role="dialog" aria-modal="true"><div className="student-modal"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="modal-office">{service.icon}</span><p className="float-kicker">{service.office}</p><h2>{choice}</h2><p className="modal-copy">Prepare these before joining so your transaction is smoother when your number is called.</p><div className="requirement-list">{service.requirements.map((item) => <p key={item}><i>✓</i><span>{item}</span></p>)}</div><button className="modal-primary" disabled={Boolean(active) || !service.open} onClick={() => onJoin(service)}>{active ? 'You already have an active ticket' : 'Requirements ready — get ticket'}</button></div></div>
}

function FeedbackModal({ item, onClose, onSubmit }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  return <div className="student-overlay" role="dialog" aria-modal="true"><form className="student-modal feedback-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(item.ticket, rating, comment) }}><button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="modal-office">★</span><p className="float-kicker">SERVICE FEEDBACK</p><h2>How was your visit?</h2><p className="modal-copy">{item.office} · {item.serviceName} · Ticket {item.ticket}</p><div className="star-picker" aria-label="Rate service">{[1,2,3,4,5].map((star) => <button type="button" className={star <= rating ? 'selected' : ''} onClick={() => setRating(star)} key={star}>★</button>)}</div><label className="feedback-label">Comment (optional)<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tell the school what went well or what could improve..." /></label><button className="modal-primary" disabled={!rating}>Submit {rating || ''}{rating ? '/5 ' : ''}rating</button></form></div>
}
