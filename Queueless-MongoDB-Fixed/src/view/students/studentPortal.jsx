import { useCallback, useEffect, useRef, useState } from 'react'
import { getPortalState, portalApi } from '../../services/auth.js'
import { studentTickets } from '../../services/studentTickets.js'
import { OfficeIcon as SharedOfficeIcon } from '../../components/OfficeIdentity.jsx'
import './students.css'
import { PortalSkeleton } from '../../components/PortalLoading.jsx'
import SidebarIcon from '../../components/SidebarIcon.jsx'

const services = [
  { office: 'Registrar', icon: 'registrar', color: '#7357d8', description: 'Academic records, enrollment and certifications', wait: 4, options: ['Transcript / school records', 'Certificate request', 'Enrollment concern'], requirements: ['Valid school ID', 'Completed request form', 'Authorization letter if requesting for another person'] },
  { office: 'Finance', icon: 'finance', color: '#1677c8', description: 'Payments, balances, receipts and assessments', wait: 6, options: ['Tuition / school fees', 'Official receipt request', 'Account assessment'], requirements: ['Valid school ID', 'Payment or reference document', 'Assessment form when applicable'] },
  { office: 'CSDL', icon: 'student', color: '#d45575', description: 'Student services, IDs, clearances and concerns', wait: 5, options: ['Student clearance', 'ID concern', 'General student concern'], requirements: ['Valid school ID', 'Relevant clearance or concern form'] },
  { office: 'Marketing', icon: 'marketing', color: '#e06c47', description: 'Marketing support, partnerships, and branding requests', wait: 4, options: ['Marketing inquiry', 'Sponsorship / partnership request', 'Branding material request'], requirements: ['Valid school ID', 'Relevant request details'] },
  { office: 'Bookstore', icon: 'bookstore', color: '#278a73', description: 'Textbooks, school supplies, and bookstore order support', wait: 3, options: ['Textbook purchase inquiry', 'School supplies purchase', 'Bookstore order concern'], requirements: ['Valid school ID', 'Order or receipt details'] },
]

// Keep the profile choices consistent with student registration. The API still
// calls this value `department`, so it is translated when the profile is saved.
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
]

const isSeniorHigh = (yearLevel = '') => /^Grade (11|12)$/.test(yearLevel)

const initials = (name = '') => name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'S'
function OfficeIcon({ name = 'office' }) {
  const icons = {
    registrar: <><path d="M5 4h14v17H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    finance: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/></>,
    student: <><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M8 14h8"/></>,
    marketing: <><path d="m4 13 11-5v8L4 11zM15 10h3a2 2 0 0 1 0 4h-3M7 13l1.5 6h3L10 12"/></>,
    bookstore: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21zM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21z"/></>,
    office: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 12h2M14 12h2M11 21v-5h2"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{icons[name] || icons.office}</svg>
}
const validSchoolId = (id) => /^03-\d{4}-\d{5,6}$/.test(id || '')
const validPassword = (password) => password.length >= 8 && !/\s/.test(password) && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[!@#$%^&*]/.test(password)
const passwordRule = 'Use 8+ characters with uppercase, lowercase, number, and ! @ # $ % ^ & *; no spaces.'
const campusDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())

export default function StudentPortal({ onLogout, user, token, page = 'Dashboard', onNavigate, onRoleChanged, onSwitchRole }) {
  const [officeState, setOfficeState] = useState([])
  const [queue, setQueue] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const queueMutation = useRef(0)
  const cancelPending = useRef(false)
  const activeTicketId = useRef(null)
  const nearQueueNoticeTicket = useRef(null)
  const [history, setHistory] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [notice, setNotice] = useState('')
  const [promotionNotice, setPromotionNotice] = useState(null)
  const [promotionOpen, setPromotionOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [choices, setChoices] = useState(() => Object.fromEntries(services.map((service) => [service.office, service.options[0]])))
  const [profile, setProfile] = useState(() => ({ name: user?.name || 'Student', email: user?.email || '', id: validSchoolId(user?.accountId) ? user.accountId : '', course: user?.course || user?.department || '', yearLevel: user?.yearLevel || 'First year', semester: user?.semester || '1st semester', avatar: user?.avatar || '' }))
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
    setChoices((current) => ({
      ...current,
      ...Object.fromEntries(normalizedOffices.map((office) => [office.name, current[office.name] || office.services[0]?.name || ''])),
    }))
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

    // Show the approaching-turn alert only once per ticket, rather than on
    // every automatic queue refresh.
    if (nextQueue && nextQueue.status !== 'Now serving' && nextQueue.ahead <= 2 && nearQueueNoticeTicket.current !== nextQueue.id) {
      nearQueueNoticeTicket.current = nextQueue.id
      setNotice(`You’re almost at the front of the line for ${nextQueue.office}: ${nextQueue.ahead} student${nextQueue.ahead === 1 ? '' : 's'} ahead.`)
    } else if (!nextQueue) {
      nearQueueNoticeTicket.current = null
    }

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
      finally { if (!disposed) setLoading(false) }
    }
    poll()
    const timer=setInterval(poll,2000)
    return ()=>{disposed=true;clearInterval(timer)}
  }, [token, applyState])
  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    let disposed = false
    const checkPromotion = async () => {
      try {
        const result = await portalApi('/api/notifications/promotion', token)
        if (!disposed && result.notification) setPromotionNotice(result.notification)
      } catch { /* The normal portal refresh handles expired sessions. */ }
    }
    checkPromotion()
    const timer = setInterval(checkPromotion, 4000)
    return () => { disposed = true; clearInterval(timer) }
  }, [token])
  const availableServices=officeState.map((office)=>{
    const known=services.find((service)=>service.office===office.name)
    const options=office.services.map((service)=>service.name)
    const selected=choices[office.name] || options[0] || ''
    return { ...office, office:office.name, icon:office.icon || known?.icon || 'office', color:office.color || known?.color || '#526bd9', description:office.description || known?.description || `Services and assistance from the ${office.name} office`, wait:office.wait, options, open:office.open, requirements:office.services.find((service)=>service.name===selected)?.requirements || ['Valid school ID'] }
  })
  const saveProfile=async(next)=>{
    const { course, ...profileDetails } = next
    try {const {user:updated}=await portalApi('/api/auth/profile',token,{method:'PATCH',body:JSON.stringify({...profileDetails,department:course})});setProfile({...updated,id:updated.accountId,course:updated.course || updated.department || ''});setNotice('Profile saved.');return true}
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
    ['monitor', 'Live Monitor'],
    ['history', 'History'],
    ['star', 'Review'],
    ['profile', 'Profile'],
  ]
  const navSections = [['Workspace',['Dashboard','Services','Calendar','My Queue','Live Monitor']],['Activity',['History','Review']],['Account',['Profile']]]

  return (
    <main className="student-app">
      <aside className="student-sidebar">
        <div className="student-logo"><img className="student-mark" src="/campus-queue-logo.png" alt="" /><span>Queueless<small>Student portal</small></span></div>
        <nav>{navSections.map(([section,labels]) => <div className="sidebar-nav-section" key={section}><span className="sidebar-section-label">{section}</span>{nav.filter(([,label]) => labels.includes(label)).map(([icon, label]) => <button type="button" title={label} aria-current={page === label ? 'page' : undefined} className={page === label ? 'active' : ''} onClick={() => go(label)} key={label}><i><SidebarIcon name={icon}/></i><span>{label}</span>{label === 'My Queue' && queue && <em>1</em>}</button>)}</div>)}</nav>
        {user.roles?.includes('staff') && <button type="button" className="student-role-switch" onClick={() => onSwitchRole('staff')}>Switch to Staff</button>}
        <div className="account"><span className="account-avatar">{profile.avatar ? <img src={profile.avatar} alt="" /> : initials(profile.name)}</span><p><b>{profile.name}</b><small>{profile.id}</small></p><button onClick={onLogout} title="Sign out">⇥</button></div>
      </aside>

      <section className="student-main">
        <header className="portal-header"><div><small>Student Portal</small><b>{page}</b></div><div className="portal-header-actions"><button type="button" className={`notification-button ${promotionNotice ? 'unread' : ''}`} aria-label="Notifications" onClick={() => promotionNotice && setPromotionOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>{promotionNotice && <i />}</button><span className="live-indicator">Queue system live</span></div></header>
        <div className="student-content page-transition" key={page}>
          {notice && <div className="feature-notice">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
          {loading ? <PortalSkeleton label="Loading student portal" /> : <>{page === 'Dashboard' && <Dashboard profile={profile} queue={queue} history={history} go={go} returningUser={returningUser} />}
          {page === 'Services' && <Services services={availableServices} active={queue} choices={choices} setChoices={setChoices} onDetails={setSelectedService} onJoin={joinQueue} />}
          {page === 'Calendar' && <Calendar services={availableServices} active={queue} choices={choices} onJoin={joinQueue} />}
          {page === 'My Queue' && <MyQueue queue={queue} cancelling={cancelling} onCancel={cancelQueue} go={go} />}
          {page === 'Live Monitor' && <LiveMonitor offices={officeState} />}
          {page === 'History' && <History history={history} onRate={setSelectedService} />}
          {page === 'Review' && <Review history={history} onRate={setSelectedService} />}
          {page === 'Profile' && <Profile profile={profile} onSave={saveProfile} onPasswordSave={(password) => saveProfile({password})} onAvatarPreview={(avatar) => setProfile((current) => ({ ...current, avatar }))} onLogout={onLogout} />}</>}
        </div>
      </section>

      {selectedService && (selectedService.ticket
        ? <FeedbackModal item={selectedService} onClose={() => setSelectedService(null)} onSubmit={submitFeedback} />
        : <RequirementsModal service={selectedService} choice={choices[selectedService.office]} onClose={() => setSelectedService(null)} onJoin={joinQueue} active={queue} />)}
      {promotionOpen && <PromotionModal notification={promotionNotice} onClose={() => setPromotionOpen(false)} onRespond={async (action) => { try { await portalApi(`/api/notifications/promotion/${promotionNotice.id}/respond`, token, { method: 'POST', body: JSON.stringify({ action }) }); await onRoleChanged(); setPromotionNotice(null); setPromotionOpen(false); if (action === 'accept') await onSwitchRole('staff') } catch (error) { setNotice(error.message) } }} />}
    </main>
  )
}

function PromotionModal({ notification, onClose, onRespond }) {
  return <div className="student-overlay" role="dialog" aria-modal="true" aria-labelledby="promotion-title"><section className="student-modal promotion-modal"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="modal-office"><OfficeIcon name="office" /></span><p className="float-kicker">STAFF PROMOTION</p><h2 id="promotion-title">{notification.title}</h2><p className="modal-copy">{notification.message}</p><span className="promotion-role">{notification.staffRole} · {notification.office}</span><div className="promotion-actions"><button type="button" className="modal-secondary" onClick={() => onRespond('decline')}>Decline</button><button type="button" className="modal-primary" onClick={() => onRespond('accept')}>Accept promotion</button></div></section></div>
}

function LegacyPromotionModal({ notification, onClose, onConfirm }) {
  return <div className="student-overlay" role="dialog" aria-modal="true" aria-labelledby="promotion-title"><section className="student-modal promotion-modal"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="modal-office"><OfficeIcon name="office" /></span><p className="float-kicker">NEW STAFF ACCESS</p><h2 id="promotion-title">{notification.title}</h2><p className="modal-copy">{notification.message} Confirm to open your staff dashboard.</p><span className="promotion-role">New role: Staff</span><button className="modal-primary" onClick={onConfirm}>Go to staff dashboard →</button></section></div>
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
    <section className="quick-services"><div className="section-heading"><div><h2>Popular offices</h2><p>Quick access to frequently used school services.</p></div><button onClick={() => go('Services')}>See all</button></div><div className="mini-service-grid">{services.slice(0,4).map((service) => <button key={service.office} onClick={() => go('Services')}><span><OfficeIcon name={service.icon}/></span><b>{service.office}</b><small>~{service.wait} min / student</small><em>→</em></button>)}</div></section>
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
      <div className="service-top"><SharedOfficeIcon office={service} size="lg" label={false}/><span className="open-pill">{service.open ? "Open" : "Closed"}</span></div>
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
        <div className="ticket-office"><span><OfficeIcon name={queue.service.icon}/></span><div><small>{queue.office}</small><p>{queue.serviceName}</p></div></div>
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

function LiveMonitor({ offices }) {
  const waiting = offices.reduce((sum, office) => sum + (office.waiting || 0), 0)
  return <><Title title="Live queue monitor" subtitle="Check campus-wide queue activity before you head to an office." action={<span className="status-chip">● {waiting} waiting now</span>} /><section className="student-monitor-grid">{offices.map((office) => <article key={office.id}><div className="student-monitor-head"><span>{office.code || office.name[0]}</span><section><h2>{office.name}</h2><p>{office.open ? 'Open for tickets' : 'Currently closed'}</p></section><em className={office.open ? 'open' : 'closed'}>{office.open ? 'Open' : 'Closed'}</em></div><dl><span><small>Waiting</small><b>{office.waiting || 0}</b></span><span><small>Now serving</small><b>{office.serving || '—'}</b></span><span><small>Served today</small><b>{office.served || 0}</b></span></dl></article>)}</section></>
}

function Review({ history, onRate }) {
  const completed = history.filter((item) => item.result === 'Served')
  return <><Title title="Service reviews" subtitle="Rate completed services from 1 to 5 stars and share your experience." />
    {!completed.length ? <section className="empty-state compact-empty"><span>★</span><h2>No services to review</h2><p>After a queue visit is completed, you can rate the service here.</p></section> : <section className="review-list">{completed.map((item) => <article key={`${item.ticket}-${item.completedAt}`}><div><b>{item.office}</b><p>{item.serviceName} · {item.ticket}</p></div>{item.feedback ? <strong>★ {item.feedback.rating}/5</strong> : <button onClick={() => onRate(item)}>Rate 1–5 stars</button>}</article>)}</section>}
  </>
}

function Profile({ profile, onSave, onPasswordSave, onAvatarPreview, onLogout }) {
  const [form, setForm] = useState({ ...profile, newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const update = ({ target }) => setForm((current) => {
    const nextValue = target.value
    // Courses and senior-high strands are separate sets of choices.
    const course = target.name === 'yearLevel' && isSeniorHigh(current.yearLevel) !== isSeniorHigh(nextValue)
      ? ''
      : current.course
    return { ...current, [target.name]: nextValue, course }
  })
  const selectPhoto = ({ target }) => {
    const photo = target.files?.[0]
    target.value = ''
    if (!photo) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(photo.type) || photo.size > 500 * 1024) return setError('Choose a PNG, JPEG, or WebP image smaller than 500 KB.')
    const reader = new FileReader()
    reader.onload = () => { const avatar = String(reader.result || ''); setForm((current) => ({ ...current, avatar })); onAvatarPreview(avatar); setError('') }
    reader.readAsDataURL(photo)
  }
  const submit = async (event) => {
    event.preventDefault()
    if (!editing) return
    if (form.newPassword && form.newPassword !== form.confirmPassword) return setError('New passwords do not match.')
    setError('')
    const { newPassword, confirmPassword: _confirmPassword, ...nextProfile } = form
    if (!await onSave({...nextProfile,password:newPassword || undefined})) return
    setForm((current) => ({ ...current, newPassword: '', confirmPassword: '' }))
    setEditing(false)
  }
  const savePassword = async () => {
    if (!editing) return
    if (!validPassword(form.newPassword) || form.newPassword !== form.confirmPassword) return setError(`Passwords must match. ${passwordRule}`)
    if (!await onPasswordSave(form.newPassword)) return
    setError('')
    setForm((current) => ({ ...current, newPassword: '', confirmPassword: '' }))
  }
  const cancelEditing = () => {
    setForm({ ...profile, newPassword: '', confirmPassword: '' })
    onAvatarPreview(profile.avatar || '')
    setError('')
    setEditing(false)
  }
  return <><Title title="My profile" subtitle={editing ? 'Update your student credentials and account details.' : 'Your student credentials are locked until you choose Edit profile.'} />
    <form className="profile-card profile-editor" onSubmit={submit}>
      <div className="profile-main"><div className="profile-avatar">{form.avatar ? <img src={form.avatar} alt="Profile preview" /> : <span>{initials(form.name)}</span>}</div><div><h2>{form.name || 'Student'}</h2><p>{form.email || 'Add your email address'}</p><em>Student</em></div><div className="profile-photo-actions">{editing && <><label>Change photo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPhoto}/></label>{form.avatar && <button type="button" onClick={() => { setForm((current) => ({ ...current, avatar: '' })); onAvatarPreview('') }}>Remove</button>}</>}<small>{editing ? 'PNG, JPEG, or WebP · max 500 KB' : 'Profile is locked'}</small></div></div>
      <div className="profile-form-fields">
        <label>Student ID<input name="id" value={form.id} readOnly placeholder="Student ID unavailable" title="Your Student ID is set during account creation." /></label>
        <label>Full name<input name="name" value={form.name} onChange={update} placeholder="Maria Santos" required disabled={!editing} /></label>
        <label>Email address<input name="email" type="email" value={form.email} onChange={update} placeholder="you@school.edu" required disabled={!editing} /></label>
        <label>{isSeniorHigh(form.yearLevel) ? 'Strand' : 'Course'}<select name="course" value={form.course} onChange={update} disabled={!editing}><option value="">{isSeniorHigh(form.yearLevel) ? 'Select strand' : 'Select course'}</option>{(isSeniorHigh(form.yearLevel) ? seniorHighStrands : courses).map((course) => <option key={course} value={course}>{course}</option>)}</select></label>
        <label>Year level<select name="yearLevel" value={form.yearLevel} onChange={update} disabled={!editing}><option>Grade 11</option><option>Grade 12</option><option>First year</option><option>Second year</option><option>Third year</option><option>Fourth year</option></select></label>
        <label>Semester<select name="semester" value={form.semester} onChange={update} disabled={!editing}><option>1st semester</option><option>2nd semester</option></select></label>
        <PasswordField label="New password" name="newPassword" value={form.newPassword} onChange={update} placeholder="Enter password" minLength="8" title={passwordRule} disabled={!editing} />
        <PasswordField label="Confirm new password" name="confirmPassword" value={form.confirmPassword} onChange={update} placeholder="Repeat password" minLength="8" title={passwordRule} disabled={!editing} />
        <button className="profile-password-save" type="button" onClick={savePassword} disabled={!editing || !validPassword(form.newPassword) || form.newPassword !== form.confirmPassword}>Save password</button>
      </div>
      <div className="profile-footer"><p className={error ? 'profile-error' : ''}>{error || (editing ? 'Use a new password only when you want to change it.' : 'Select Edit profile to unlock your credentials.')}</p><div><button type="button" onClick={editing ? cancelEditing : () => setEditing(true)}>{editing ? 'Cancel' : 'Edit profile'}</button><button className="profile-save" type="submit" disabled={!editing}>Save profile</button></div></div>
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


function RequirementsModal({ service, choice, onClose, onJoin, active }) {
  return <div className="student-overlay" role="dialog" aria-modal="true"><div className="student-modal"><button className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="modal-office"><OfficeIcon name={service.icon}/></span><p className="float-kicker">{service.office}</p><h2>{choice}</h2><p className="modal-copy">Prepare these before joining so your transaction is smoother when your number is called.</p><div className="requirement-list">{service.requirements.map((item) => <p key={item}><i>✓</i><span>{item}</span></p>)}</div><button className="modal-primary" disabled={Boolean(active) || !service.open} onClick={() => onJoin(service)}>{active ? 'You already have an active ticket' : 'Requirements ready — get ticket'}</button></div></div>
}

function FeedbackModal({ item, onClose, onSubmit }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  return <div className="student-overlay" role="dialog" aria-modal="true"><form className="student-modal feedback-modal" onSubmit={(event) => { event.preventDefault(); onSubmit(item.ticket, rating, comment) }}><button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button><span className="modal-office">★</span><p className="float-kicker">SERVICE FEEDBACK</p><h2>How was your visit?</h2><p className="modal-copy">{item.office} · {item.serviceName} · Ticket {item.ticket}</p><div className="star-picker" aria-label="Rate service">{[1,2,3,4,5].map((star) => <button type="button" className={star <= rating ? 'selected' : ''} onClick={() => setRating(star)} key={star}>★</button>)}</div><label className="feedback-label">Comment (optional)<textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Tell the school what went well or what could improve..." /></label><button className="modal-primary" disabled={!rating}>Submit {rating || ''}{rating ? '/5 ' : ''}rating</button></form></div>
}
