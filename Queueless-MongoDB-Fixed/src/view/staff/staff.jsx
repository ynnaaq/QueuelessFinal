import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPortalState, portalApi } from '../../services/auth.js'
import './staff.css'

const serviceData = {
  Registrar: { code: 'R', description: 'Academic records, enrollment and certifications', requirements: ['Valid school ID', 'Completed request form', 'Authorization letter if requesting for another person'] },
  Finance: { code: 'F', description: 'Payments, balances, receipts and assessments', requirements: ['Valid school ID', 'Payment or reference document', 'Assessment form when applicable'] },
  CSDL: { code: 'C', description: 'Student services, IDs, clearances and concerns', requirements: ['Valid school ID', 'Relevant clearance or concern form'] },
}

const initials = (name = '') => name.split(' ').filter(Boolean).map((p) => p[0]).join('').slice(0,2).toUpperCase() || 'ST'

export default function Staff({ onLogout, user, token }) {
  const [page, setPage] = useState('Queue')
  const [activeService, setActiveService] = useState(user?.office || 'Registrar')
  const [queues, setQueues] = useState({})
  const [skipped, setSkipped] = useState([])
  const [current, setCurrent] = useState(null)
  const [recentlyServed, setRecentlyServed] = useState(null)
  const [selected, setSelected] = useState(null)
  const [feedback, setFeedback] = useState([])
  const [officeOpen, setOfficeOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [requirements, setRequirements] = useState(() => Object.fromEntries(Object.entries(serviceData).map(([office, data]) => [office, [...data.requirements]])))
  const [staffProfile, setStaffProfile] = useState(() => ({ name: user?.name || 'Ana Reyes', email: user?.email || 'staff@school.edu', office: user?.office || 'Registrar' }))
  const [schedule, setSchedule] = useState(() => user?.schedule || [])

  const applyState = useCallback(({offices,tickets,feedback}) => {
    const names=Object.fromEntries(offices.map(o=>[o.id,o.name]))
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date())
    const entries=tickets.filter(t=>t.visitDate===date).map(t=>({...t,ticketId:t.id,id:t.accountId || t.studentId,office:names[t.officeId],joined:new Date(t.createdAt).toLocaleTimeString()})).sort((a,b)=>a.order-b.order)
    setQueues(Object.fromEntries(offices.map(o=>[o.name,entries.filter(t=>t.office===o.name && t.status==='waiting') ])))
    setCurrent(entries.find(t=>t.office===activeService && t.status==='serving') || null)
    setRecentlyServed(entries.filter(t=>t.office===activeService && t.status==='served').sort((a,b)=>new Date(b.completedAt || b.servedAt || 0)-new Date(a.completedAt || a.servedAt || 0))[0] || null)
    setSkipped(entries.filter(t=>t.status==='skipped'))
    setFeedback(feedback)
    setOfficeOpen(offices.find(o=>o.name===activeService)?.open || false)
    setRequirements(Object.fromEntries(offices.map(o=>[o.name,[...new Set(o.services.flatMap(s=>s.requirements))]])))
  }, [activeService])
  const refresh=async()=>applyState(await getPortalState(token))
  useEffect(()=>{
    let disposed=false
    const poll=async()=>{try {const state=await getPortalState(token);if(!disposed)applyState(state)}catch(error){if(!disposed)setNotice(error.message)}}
    poll();const timer=setInterval(poll,4000)
    return ()=>{disposed=true;clearInterval(timer)}
  },[token,applyState])
  const queue=queues[activeService] || []
  const waitingCount=Object.values(queues).reduce((n,items)=>n+items.length,0)
  const notify=(message)=>setNotice(message)
  const switchOffice=(office)=>{setActiveService(office);setSelected(null)}
  const action=async(ticket,action)=>{
    if(!ticket)return notify('No eligible ticket for this action.')
    try {
      const result=await portalApi('/api/tickets/'+ticket.ticketId+'/action',token,{method:'POST',body:JSON.stringify({action})})
      setSelected(null)
      if(action==='serve') {
        setRecentlyServed({...ticket,...result.ticket,status:'served'})
        notify(`${ticket.ticket} marked served.`)
      } else notify('Queue updated.')
      await refresh()
    }
    catch(error){notify(error.message)}
  }
  const callNext=()=>current?notify('Finish or skip the current ticket first.'):action(queue[0],'call')
  const skipCurrent=()=>action(current,'skip')
  const recall=(ticket=skipped.find(t=>t.office===activeService))=>action(ticket,'recall')
  const markServed=()=>action(current,'serve')
  const addRequirement=async(office,requirement)=>{
    try {await portalApi('/api/offices/'+encodeURIComponent(office)+'/requirements',token,{method:'POST',body:JSON.stringify({requirement})});await refresh();notify('Requirement saved.')}
    catch(error){notify(error.message)}
  }
  const saveProfile=async(profile)=>{
    try {const {user}=await portalApi('/api/auth/profile',token,{method:'PATCH',body:JSON.stringify(profile)});setStaffProfile(user);notify('Profile saved.')}
    catch(error){notify(error.message)}
  }
  const saveSchedule=async(nextSchedule)=>{
    try {const {user: updated}=await portalApi('/api/staff/schedule',token,{method:'PATCH',body:JSON.stringify({schedule:nextSchedule})});setSchedule(updated.schedule || []);notify('Schedule saved.')}
    catch(error){notify(error.message)}
  }

  const tabs = [['queues','Queue'], ['calendar','Schedule'], ['student','Students'], ['check','Requirements'], ['star','Feedback'], ['profile','Profile']]

  return (
    <main className="staff-app">
      <aside className="staff-sidebar">
        <div className="staff-brand"><img className="staff-mark" src="/queue-logo.png" alt="" /><div><b>Queueless</b><small>Staff workspace</small></div></div>
        <nav>{tabs.map(([icon,label]) => <button type="button" aria-current={page === label ? 'page' : undefined} className={page === label ? 'active' : ''} onClick={() => setPage(label)} key={label}><i><SidebarIcon name={icon}/></i><span>{label}</span>{label === 'Queue' && waitingCount > 0 && <em>{waitingCount}</em>}</button>)}</nav>
        <div className="staff-account"><span>{initials(user?.name || 'Ana Reyes')}</span><p><b>{user?.name || 'Ana Reyes'}</b><small>Service staff</small></p><button onClick={onLogout}>⇥</button></div>
      </aside>

      <section className="staff-main">
        <header className="staff-header"><div><small>Staff Portal</small><b>{page}</b></div><span className="live-indicator">Queue system live</span></header>
        <div className="staff-content">
          {notice && <div className="feature-notice">{notice}</div>}
          <StaffTitle page={page} office={activeService} waiting={queue.length} />
          {page !== 'Feedback' && page !== 'Profile' && <OfficeTabs assigned={user?.office} active={activeService} queues={queues} onChange={switchOffice} />}
          {page === 'Queue' && <QueuePage open={officeOpen} office={activeService} queue={queue} current={current} recentlyServed={recentlyServed} selected={selected} onSelect={setSelected} callNext={callNext} skip={skipCurrent} recall={() => recall()} served={markServed} />}
          {page === 'Students' && <StudentsPage office={activeService} queue={queue} current={current} skipped={skipped.filter((item) => item.office === activeService)} selected={selected} onSelect={setSelected} recall={recall} />}
          {page === 'Requirements' && <Requirements office={activeService} requirements={requirements[activeService]} onAdd={addRequirement} />}
          {page === 'Feedback' && <Feedback recent={feedback} />}
          {page === 'Schedule' && <ScheduleEditor schedule={schedule} onSave={saveSchedule} />}
          {page === 'Profile' && <StaffProfile profile={staffProfile} onSave={saveProfile} />}
        </div>
      </section>
    </main>
  )
}

function StaffTitle({ page, office, waiting }) {
  const copy = {
    Queue: ['Queue control', `Call and manage ${office} queue numbers in real time.`],
    Students: ['Student information', 'Review waiting, called, and skipped student tickets.'],
    Requirements: ['Service requirements', 'Edit the documents students should bring before processing.'],
    Feedback: ['Student feedback', 'View ratings and comments from completed queue transactions.'],
    Schedule: ['My schedule', 'Add, move, or update the shifts assigned to you.'],
    Profile: ['Staff profile', 'Edit your staff account details and assigned office.'],
  }[page]
  return <section className="staff-title"><div><span>STAFF WORKSPACE · {office.toUpperCase()}</span><h1>{copy[0]}</h1><p>{copy[1]}</p></div><div className="staff-title-stat"><small>Waiting now</small><strong>{waiting}</strong></div></section>
}

function SidebarIcon({ name }) {
  const paths = {
    queues: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    student: <><circle cx="12" cy="7" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2M9 11l3 3 3-3"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></>,
    profile: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function OfficeTabs({ assigned, active, queues, onChange }) {
  return <div className="staff-office-tabs">{Object.keys(serviceData).filter(office=>office===assigned).map((office) => <button className={active === office ? 'active' : ''} onClick={() => onChange(office)} key={office}><span>{serviceData[office].code}</span><b>{office}</b><em>{queues[office]?.length || 0}</em></button>)}</div>
}

function QueuePage({ open, office, queue, current, recentlyServed, selected, onSelect, callNext, skip, recall, served }) {
  const next = queue.find((student) => student.ticket !== current?.ticket)
  return <>
    <section className="staff-summary">
      <article><span>WAITING</span><strong>{queue.length}</strong><p>student{queue.length === 1 ? '' : 's'} in {office}</p></article>
      <article><span>NOW SERVING</span><strong className={current ? '' : 'empty'}>{current?.ticket || '—'}</strong><p>{current?.name || 'No student called'}</p></article>
      <article><span>UP NEXT</span><strong className="next-ticket">{next?.ticket || '—'}</strong><p>{next?.name || 'Queue is clear'}</p></article>
      <article><span>QUEUE STATUS</span><strong className="open-state">{open ? "OPEN" : "CLOSED"}</strong><p>Accepting digital tickets</p></article>
    </section>

    <section className="staff-control-card">
      <div className="serving-panel">
        <div className="serving-head"><div><span>{current ? 'CURRENT WINDOW' : recentlyServed ? 'MOST RECENT TICKET' : 'CURRENT WINDOW'}</span><h2>{current?.ticket || recentlyServed?.ticket || 'Ready to call next'}</h2></div><em className={!current && recentlyServed ? 'served-status' : ''}>{current ? 'Serving' : recentlyServed ? 'Served' : 'Idle'}</em></div>
        {current ? <div className="current-student"><span>{initials(current.name)}</span><div><b>{current.name}</b><small>{current.id}</small><p>{current.service}</p></div></div> : recentlyServed ? <div className="current-student served-ticket"><span>{initials(recentlyServed.name)}</span><div><b>{recentlyServed.name}</b><small>{recentlyServed.id}</small><p>✓ Service completed</p></div></div> : <p className="idle-copy">When you are ready, call the first student in the waiting list.</p>}
        <div className="control-actions"><button className="call" onClick={callNext}>🔔 Call next</button><button onClick={skip}>Skip</button><button onClick={recall}>Recall</button><button className="served" onClick={served}>✓ Mark served</button></div>
      </div>

      <div className="staff-waiting-list">
        <div className="staff-list-head"><div><h2>Waiting list</h2><p>Oldest ticket appears first.</p></div><span>{queue.length} waiting</span></div>
        <div className="staff-table-head"><span>#</span><span>Ticket</span><span>Student</span><span>Service</span><span>Joined</span></div>
        <div className="queue-rows">{queue.length ? queue.map((student,index) => <button className={`${selected?.ticket === student.ticket ? 'selected' : ''} ${current?.ticket === student.ticket ? 'current' : ''}`} onClick={() => onSelect(student)} key={student.ticket}><span>{index+1}</span><strong>{student.ticket}</strong><span><b>{student.name}</b><small>{student.id}</small></span><span>{student.service}</span><span>{student.joined}</span></button>) : <p className="no-data">No students are waiting for {office}.</p>}</div>
      </div>
    </section>

    {selected && <StudentInfo student={selected} status={current?.ticket === selected.ticket ? 'Now serving' : 'Waiting'} />}
  </>
}

function StudentsPage({ office, queue, current, skipped, selected, onSelect, recall }) {
  const students = useMemo(() => queue.map((student) => ({ ...student, status: current?.ticket === student.ticket ? 'Serving' : 'Waiting' })), [queue,current])
  return <section className="staff-directory-card">
    <div className="staff-list-head"><div><h2>{office} student tickets</h2><p>Choose a student to see their complete queue information.</p></div><span>{students.length} active</span></div>
    <div className="student-cards">{students.map((student) => <button className={selected?.ticket === student.ticket ? 'selected' : ''} onClick={() => onSelect(student)} key={student.ticket}><span>{initials(student.name)}</span><div><b>{student.name}</b><small>{student.id}</small><p>{student.ticket} · {student.service}</p></div><em className={student.status.toLowerCase()}>{student.status}</em></button>)}</div>
    {selected && <StudentInfo student={selected} status={current?.ticket === selected.ticket ? 'Now serving' : 'Waiting'} />}
    <div className="skipped-block"><div className="staff-list-head"><div><h2>Skipped numbers</h2><p>Return a student to the front when they are ready.</p></div></div>{skipped.length ? skipped.map((student) => <article key={student.ticket}><div><strong>{student.ticket}</strong><span><b>{student.name}</b><small>{student.id} · skipped {student.skippedAt}</small></span></div><button onClick={() => recall(student)}>Recall ticket</button></article>) : <p className="no-data">No skipped queue numbers for {office}.</p>}</div>
  </section>
}

function StudentInfo({ student, status }) {
  return <aside className="student-info-card"><div className="student-info-head"><div><span>{initials(student.name)}</span><section><small>SELECTED STUDENT</small><h3>{student.name}</h3><p>{student.id}</p></section></div><em>{status}</em></div><dl><div><dt>Queue ticket</dt><dd>{student.ticket}</dd></div><div><dt>Requested service</dt><dd>{student.service}</dd></div><div><dt>Joined queue</dt><dd>{student.joined}</dd></div><div><dt>Office</dt><dd>{student.ticket.slice(0,1) === 'R' ? 'Registrar' : student.ticket.slice(0,1) === 'F' ? 'Finance' : 'CSDL'}</dd></div></dl></aside>
}

function Requirements({ office, requirements, onAdd }) {
  const data = serviceData[office]
  const [draft, setDraft] = useState('')
  return <section className="requirements-page"><article className="requirement-hero"><span>{data.code}</span><div><p className="float-kicker">{office.toUpperCase()} OFFICE</p><h2>{data.description}</h2><p>Edit this checklist so students know what to bring before joining the queue.</p></div></article><article className="requirement-card"><div className="staff-list-head"><div><h2>Editable document checklist</h2><p>Requirements shown to students for this office.</p></div><span>{requirements.length} items</span></div>{requirements.map((item,index) => <div className="requirement-row" key={`${item}-${index}`}><span>{index+1}</span><b>{item}</b><em>Required</em></div>)}<form className="requirement-add" onSubmit={(event) => { event.preventDefault(); onAdd(office, draft); setDraft('') }}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add another requirement..." /><button>Add requirement</button></form></article></section>
}

function Feedback({ recent }) {
  const average = recent.length ? (recent.reduce((sum,item) => sum + item.rating,0)/recent.length).toFixed(1) : '—'
  return <section className="feedback-page"><div className="feedback-summary"><article><small>Average rating</small><strong>{average}{average !== '—' && <span>/5</span>}</strong><p>{recent.length ? 'Based on all student feedback' : 'No feedback yet'}</p></article><article><small>Responses</small><strong>{recent.length}</strong><p>All offices shown</p></article><article><small>Positive ratings</small><strong>{recent.length ? `${Math.round(recent.filter((item)=>item.rating >= 4).length/recent.length*100)}%` : '—'}</strong><p>4–5 star responses</p></article></div><div className="feedback-list"><div className="staff-list-head"><div><h2>Overall feedback</h2><p>Ratings and comments from every school office.</p></div></div>{recent.length ? recent.map((item) => <article key={`${item.ticket}-${item.time}`}><div className="feedback-score"><strong>{item.rating}.0</strong><span>{'★'.repeat(item.rating)}</span></div><div><b>{item.comment}</b><p>{item.student} · {item.office} · {item.ticket} · {item.time}</p></div></article>) : <p className="no-data">No student feedback has been submitted yet.</p>}</div></section>
}

function StaffProfile({ profile, onSave }) {
  const [form, setForm] = useState(profile)
  const update = ({ target }) => setForm((current) => ({ ...current, [target.name]: target.value }))
  return <section className="staff-profile-card"><div className="staff-profile-head"><span>{initials(form.name)}</span><div><h2>{form.name}</h2><p>{form.email}</p><em>Service staff</em></div></div><form className="staff-profile-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}><label>Full name<input name="name" value={form.name} onChange={update} required /></label><label>Email address<input name="email" type="email" value={form.email} onChange={update} required /></label><label>Assigned office<select name="office" value={form.office} disabled>{Object.keys(serviceData).map((office) => <option key={office}>{office}</option>)}</select></label><button className="staff-profile-save">Save profile</button></form></section>
}

const shiftDays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
function ScheduleEditor({ schedule, onSave }) {
  const [items, setItems] = useState(schedule)
  useEffect(() => setItems(schedule), [schedule])
  const change = (index, field, value) => setItems((current) => current.map((item, i) => i === index ? {...item, [field]:value} : item))
  const add = () => setItems((current) => [...current, {day:'Monday', start:'08:00', end:'17:00'}])
  return <section className="schedule-card"><div className="schedule-card-head"><div><h2>Weekly shift list</h2><p>Changes are visible to you and the administrator immediately after saving.</p></div><button type="button" onClick={add}>+ Add shift</button></div><div className="schedule-list">{items.length ? items.map((item,index)=><div className="schedule-row" key={`${item.day}-${index}`}><label>Day<select value={item.day} onChange={(e)=>change(index,'day',e.target.value)}>{shiftDays.map((day)=><option key={day}>{day}</option>)}</select></label><label>Starts<input type="time" value={item.start} onChange={(e)=>change(index,'start',e.target.value)} /></label><label>Ends<input type="time" value={item.end} onChange={(e)=>change(index,'end',e.target.value)} /></label><button type="button" className="schedule-remove" onClick={()=>setItems((current)=>current.filter((_,i)=>i!==index))}>Remove</button></div>) : <p className="no-data">No shifts have been added yet.</p>}</div><div className="schedule-actions"><span>{items.length} shift{items.length===1?'':'s'} scheduled</span><button type="button" className="staff-profile-save" onClick={()=>onSave(items)}>Save schedule</button></div></section>
}
