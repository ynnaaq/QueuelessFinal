import { useEffect, useState } from 'react'
import { getPortalState, portalApi } from '../../services/auth.js'
import {
  getStudentProfiles,
  updateStudentStatus,
  deleteStudentProfile
} from '../../services/studentProfiles.js'
import './admin.css'

const initialOffices = [
  { id:'reg', name:'Registrar', code:'R', open:true, waiting:3, serving:'R-020', served:46, avgWait:12, rating:4.8, completion:94, hours:'8:00 AM – 5:00 PM', services:[{name:'Transcript / school records', requirements:['Valid school ID','Completed request form']},{name:'Certificate request', requirements:['Valid school ID','Request form']},{name:'Enrollment concern', requirements:['Valid school ID','Enrollment documents']}] },
  { id:'fin', name:'Finance', code:'F', open:true, waiting:3, serving:'F-103', served:38, avgWait:16, rating:4.6, completion:91, hours:'8:00 AM – 5:00 PM', services:[{name:'Tuition / school fees', requirements:['Valid school ID','Payment or reference document']},{name:'Official receipt request', requirements:['Valid school ID','Payment reference']},{name:'Account assessment', requirements:['Valid school ID','Assessment form when applicable']}] },
  { id:'csdl', name:'CSDL', code:'C', open:true, waiting:1, serving:'C-017', served:29, avgWait:9, rating:4.9, completion:96, hours:'8:00 AM – 5:00 PM', services:[{name:'Student clearance', requirements:['Valid school ID','Clearance form']},{name:'ID concern', requirements:['Valid school ID','Proof of enrollment']}] },
  { id:'mkt', name:'Marketing', code:'M', open:true, waiting:0, serving:'', served:0, avgWait:4, rating:0, completion:0, hours:'8:00 AM – 5:00 PM', services:[{name:'Marketing inquiry', requirements:['Valid school ID','Relevant request details']},{name:'Sponsorship / partnership request', requirements:['Valid school ID','Request letter or proposal']},{name:'Branding material request', requirements:['Valid school ID','Completed request form']}] },
  { id:'book', name:'Bookstore', code:'B', open:true, waiting:0, serving:'', served:0, avgWait:3, rating:0, completion:0, hours:'8:00 AM – 5:00 PM', services:[{name:'Textbook purchase inquiry', requirements:['Valid school ID','Course or subject details']},{name:'School supplies purchase', requirements:['Valid school ID']},{name:'Bookstore order concern', requirements:['Valid school ID','Order or receipt details']}] },
]

const nav = [
  ['Overview','home'],['Live Queues','queues'],['Students','student'],['Staff','staff'],['Offices & Services','building'],['Feedback','star'],['Performance','trend'],['Audit Logs','history'],['Profile','profile']
]
const navSections = [
  ['Workspace',['Overview','Live Queues']],
  ['People',['Students','Staff']],
  ['Operations',['Offices & Services','Feedback','Performance','Audit Logs']],
  ['Account',['Profile']],
]

const initials = (name='') => name.split(' ').filter(Boolean).map((p)=>p[0]).join('').slice(0,2).toUpperCase() || 'A'

export default function Admin({ onLogout, user, token, page = 'Overview', onNavigate }) {
  const [menuOpen,setMenuOpen] = useState(false)
  const [students,setStudents] = useState([])
  const [staff,setStaff] = useState([])
  const [offices,setOffices] = useState(initialOffices.map(o=>({...o,waiting:0,served:0,serving:"",rating:0,completion:0,avgWait:0})))
  const [addStaffOpen,setAddStaffOpen] = useState(false)
  const [addOfficeOpen,setAddOfficeOpen] = useState(false)
  const [scheduleMember,setScheduleMember] = useState(null)
  const [notice,setNotice] = useState('')
  const [feedback,setFeedback] = useState([])
  const [queueTrends,setQueueTrends] = useState([])
  const [refreshing,setRefreshing] = useState(false)
  const [auditLogs,setAuditLogs] = useState(()=>{try{return JSON.parse(localStorage.getItem('queueless-admin-audit')||'[]')}catch{return []}})

  const notify = (text) => { setNotice(text); window.setTimeout(()=>setNotice(''),2600) }
  const recordAudit = (action, subject) => setAuditLogs((current)=>{const next=[{id:crypto.randomUUID(),action,subject,time:new Date().toLocaleString()},...current].slice(0,100);localStorage.setItem('queueless-admin-audit',JSON.stringify(next));return next})
  const go = (next) => { onNavigate(next); setMenuOpen(false) }
const applyState = ({ offices, users, feedback, queueTrends = [] }) => {
  setOffices(offices)
  setStaff(users.filter(u => u.role === 'staff'))
  setFeedback(feedback)
  setQueueTrends(queueTrends)
}

const refresh = async () => {
  const [portalResult, studentResult] =
    await Promise.allSettled([
      getPortalState(token),
      getStudentProfiles()
    ])

  if (portalResult.status === 'fulfilled') {
    applyState(portalResult.value)
  }

  if (studentResult.status === 'fulfilled') {
    setStudents(studentResult.value)
  }

  if (
    portalResult.status === 'rejected' &&
    studentResult.status === 'rejected'
  ) {
    throw new Error(
      `Could not refresh dashboard: ${studentResult.reason?.message}`
    )
  }

  if (studentResult.status === 'rejected') {
    throw studentResult.reason
  }
}

  const refreshNow=async()=>{
    setRefreshing(true)
    try { await refresh(); notify('Dashboard refreshed.') }
    catch(error) { notify(error.message) }
    finally { setRefreshing(false) }
  }
  const mutate=async(path,method,body)=>{
    try {await portalApi(path,token,{method,body:JSON.stringify(body)});await refresh();notify('Changes saved.');return true}
    catch(error){notify(error.message);return false}
  }
  
const toggleStudent = async (id) => {
  const student = students.find(s => s.id === id)
  if (!student) return false

  const nextStatus =
    student.status === 'Active'
      ? 'Suspended'
      : 'Active'

  try {
    await updateStudentStatus(id, nextStatus)
    await refresh()
    recordAudit(`${nextStatus === 'Active' ? 'Reactivated' : 'Suspended'} student`, student.name)
    notify('Student status updated.')
    return true
  } catch (error) {
    notify(error.message)
    return false
  }
}

  const toggleStaff=async(id)=>{const u=staff.find(u=>u.id===id);if(!u)return false;const nextStatus=u.status==='Active'?'Inactive':'Active';const saved=await mutate('/api/admin/users/'+id,'PATCH',{status:nextStatus});if(saved)recordAudit(`${nextStatus === 'Active' ? 'Reactivated' : 'Deactivated'} staff account`,u.name);return saved}
  const deleteStudent=async(student)=>{if(!window.confirm(`Delete ${student.name}'s student profile? This cannot be undone.`))return;try{await deleteStudentProfile(student.id);await refresh();recordAudit('Deleted student profile',student.name);notify('Student profile deleted.')}catch(error){notify(error.message)}}
  const deleteStaff=async(member)=>{if(!window.confirm(`Delete ${member.name}'s staff account? This cannot be undone.`))return;try{await portalApi('/api/admin/users/'+member.id,token,{method:'DELETE'});await refresh();recordAudit('Deleted staff account',member.name);notify('Staff account deleted.')}catch(error){notify(error.message)}}
  const reviewStaff=(id,action)=>mutate('/api/admin/staff/'+id+'/approval','PATCH',{action})
  const toggleOffice=(id)=>mutate('/api/offices/'+id,'PATCH',{open:!offices.find(o=>o.id===id).open})
  const addRequirement=(id,serviceIndex,requirement)=>mutate('/api/offices/'+id+'/requirements','POST',{serviceIndex,requirement})
  const addStaff=async(entry)=>{if(await mutate('/api/admin/staff','POST',entry))setAddStaffOpen(false)}
  const addOffice=async(entry)=>{if(await mutate('/api/offices','POST',entry))setAddOfficeOpen(false)}
  const saveStaffSchedule=async(schedule)=>{if(await mutate('/api/admin/staff/'+scheduleMember.id+'/schedule','PATCH',{schedule}))setScheduleMember(null)}
  useEffect(()=>{
    let disposed=false
    const poll=async()=>{try{const state=await getPortalState(token);if(!disposed)applyState(state)}catch(error){if(!disposed)setNotice(error.message)}}
    poll();const timer=setInterval(poll,4000)
    return ()=>{disposed=true;clearInterval(timer)}
  },[token])

  const content = {
    Overview:<Overview offices={offices} students={students} staff={staff} queueTrends={queueTrends} setPage={go} />,
    'Live Queues':<LiveQueues offices={offices} />,
    Students:<Students students={students} toggleStudent={toggleStudent} onDelete={deleteStudent} />,
    Staff:<StaffScheduleManager staff={staff} toggleStaff={toggleStaff} reviewStaff={reviewStaff} onDelete={deleteStaff} onAdd={()=>setAddStaffOpen(true)} onSchedule={setScheduleMember} />,
    'Offices & Services':<OfficeManager offices={offices} toggleOffice={toggleOffice} addRequirement={addRequirement} onAdd={()=>setAddOfficeOpen(true)} />,
    Feedback:<FeedbackPage feedback={feedback} offices={offices} />,
    Performance:<Performance offices={offices} />,
    'Audit Logs':<AuditLogs logs={auditLogs} />,
    Profile:<Profile user={user} token={token} />,
  }[page]

  return <main className="admin-app">
    {menuOpen && <button className="admin-backdrop" aria-label="Close menu" onClick={()=>setMenuOpen(false)} />}
    <aside className={`admin-sidebar ${menuOpen?'open':''}`}>
      <div className="admin-logo"><Mark/><div><b>Queueless</b><small>Admin console</small></div><button className="close-admin-menu" onClick={()=>setMenuOpen(false)}>×</button></div>
      <nav>{navSections.map(([section,names])=><div className="sidebar-nav-section" key={section}><span className="sidebar-section-label">{section}</span>{nav.filter(([name])=>names.includes(name)).map(([name,icon])=><button className={page===name?'selected':''} onClick={()=>go(name)} key={name}><i><NavIcon name={icon}/></i><span>{name}</span>{name==='Live Queues'&&<em>{offices.reduce((n,o)=>n+o.waiting,0)}</em>}</button>)}</div>)}</nav>
      <div className="admin-profile"><span>{initials('School Admin')}</span><div><b>School Admin</b><small>Administrator</small></div><button type="button" onClick={onLogout} title="Log out" aria-label="Log out">⇥</button></div>
    </aside>

    <section className="admin-main">
      <header className="admin-header"><div className="admin-header-left"><button className="admin-menu-toggle" onClick={()=>setMenuOpen(true)}>☰</button><div><small>Admin Console</small><b>{page}</b></div></div><div className="admin-header-right"><button className={`admin-refresh ${refreshing?'refreshing':''}`} type="button" onClick={refreshNow} disabled={refreshing} aria-label="Refresh dashboard data"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.9-3.9L3 9.2M4 13a8 8 0 0 0 14.9 3.9l2.1-2.1M3 4v5.2h5.2M21 20v-5.2h-5.2"/></svg><span>{refreshing?'Refreshing':'Refresh'}</span></button><span className="live-indicator">System live</span><span className="header-date">{new Date().toLocaleDateString()}</span></div></header>
      <div className="admin-content">{notice&&<div className="feature-notice">{notice}</div>}{content}</div>
    </section>
    {addStaffOpen&&<AddStaffModal offices={offices} onClose={()=>setAddStaffOpen(false)} onAdd={addStaff}/>} 
    {addOfficeOpen&&<AddOfficeModal onClose={()=>setAddOfficeOpen(false)} onAdd={addOffice}/>} 
    {scheduleMember&&<AdminScheduleModal member={scheduleMember} onClose={()=>setScheduleMember(null)} onSave={saveStaffSchedule}/>} 
  </main>
}

function Mark(){return <img className="admin-mark" src="/campus-queue-logo.png" alt=""/>}
function NavIcon({ name }){
  const paths={
    home:<><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-6h6v6"/></>,
    queues:<><path d="M4 6h16M4 12h16M4 18h16"/></>,
    student:<><circle cx="12" cy="7" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2M9 11l3 3 3-3"/></>,
    staff:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M15 15a5 5 0 0 1 6 4v2"/></>,
    building:<><path d="M4 21V4h16v17M8 8h1M8 12h1M8 16h1M12 8h1M12 12h1M12 16h1M16 8h1M16 12h1M16 16h1"/></>,
    star:<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>,
    trend:<><path d="M5 17 17 5M10 5h7v7"/></>, history:<><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5M12 7v5l3 2"/></>,
    profile:<><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}
function PasswordEye({ visible }){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.75"/>{visible&&<path d="M4 4 20 20"/>}</svg>
}
function PageTitle({ eyebrow='ADMIN CONSOLE',title,subtitle,action }){return <section className="admin-title"><div><span>{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action}</section>}
function Progress({ value }){return <span className="progress"><i style={{width:`${value}%`}}/></span>}

function Overview({ offices,students,staff,queueTrends,setPage }){
  const totalWaiting=offices.reduce((sum,o)=>sum+o.waiting,0), served=offices.reduce((sum,o)=>sum+o.served,0), active=offices.filter((o)=>o.open).length
  const average=offices.length?(offices.reduce((sum,o)=>sum+o.rating,0)/offices.length).toFixed(1):'0.0'
  const busiest=[...offices].sort((a,b)=>b.waiting-a.waiting)[0]
  const averageWait=totalWaiting ? Math.round(offices.reduce((sum,o)=>sum+(o.avgWait*o.waiting),0)/totalWaiting) : '—'
  const peakLoad=Math.max(...offices.map((office)=>office.waiting),1)
  return <section className="dashboard-overview">
    <div className="dashboard-overview-heading"><div><small>ADMIN CONSOLE</small><h1>Live queue monitor</h1><p>Monitor every office queue from one screen. Staff controls remain inside each staff workspace.</p></div><button className="overview-refresh" onClick={()=>setPage('Live Queues')} aria-label="Open live queues"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.9-3.9L3 9.2M4 13a8 8 0 0 0 14.9 3.9l2.1-2.1M3 4v5.2h5.2M21 20v-5.2h-5.2"/></svg></button></div>
    <section className="overview-stat-grid"><article><small>Waiting</small><strong>{totalWaiting}</strong></article><article><small>Served</small><strong>{served}</strong></article><article><small>Avg Wait</small><strong className="wait-value">{averageWait}{averageWait!=='—'&&<i> min</i>}</strong></article><article><small>Offices</small><strong>{active}</strong></article></section>
    <section className="overview-dashboard-grid"><article className="dashboard-panel queue-activity"><h2>Queue Activity</h2><QueueActivityChart trends={queueTrends}/></article><article className="dashboard-panel office-load"><h2>Office Load</h2><div className="office-load-list">{offices.map((office)=><div key={office.id}><span><b>{office.name}</b><em>{office.waiting} waiting</em></span><Progress value={(office.waiting/peakLoad)*100}/></div>)}</div></article></section>
    <article className="dashboard-panel dashboard-snapshot"><div><h2>Office Snapshot</h2><button onClick={()=>setPage('Live Queues')}>View All</button></div>{offices.map((office)=><button key={office.id} onClick={()=>setPage('Live Queues')}><b>{office.name}</b><span>{office.waiting} waiting</span></button>)}</article>
  </section>
  return <>
    <PageTitle title="Good afternoon, Admin." subtitle="Here’s the campus queue activity and service health at a glance." action={<button className="admin-primary" onClick={()=>setPage('Live Queues')}>View live queues →</button>}/>
    <section className="admin-kpis">
      <article><span className="kpi-icon purple">☰</span><div><small>Waiting now</small><strong>{totalWaiting}</strong><p>Across {active} open offices</p></div><em>LIVE</em></article>
      <article><span className="kpi-icon mint">✓</span><div><small>Served today</small><strong>{served}</strong><p>Completed transactions</p></div></article>
      <article><span className="kpi-icon amber">★</span><div><small>Student rating</small><strong>{average}<i>/5</i></strong><p>Overall satisfaction</p></div></article>
      <article><span className="kpi-icon blue">♙</span><div><small>Accounts</small><strong>{students.length+staff.length}</strong><p>{students.length} students · {staff.length} staff</p></div></article>
    </section>
    <section className="admin-overview-grid">
      <article className="overview-card office-health"><div className="card-head"><div><h2>Office snapshot</h2><p>Real-time queue load and daily completion.</p></div><button onClick={()=>setPage('Offices & Services')}>Manage offices</button></div><div className="office-health-list">{offices.map((office)=><button onClick={()=>setPage('Live Queues')} key={office.id}><span className="office-code">{office.code}</span><div><b>{office.name}</b><small>{office.open?'Open now':'Closed'}</small></div><section><small>{office.waiting} waiting</small><Progress value={Math.min(100,office.waiting*18)}/></section><strong>{office.served}<small>served</small></strong><em className={office.open?'open':'closed'}>{office.open?'Open':'Closed'}</em></button>)}</div></article>
      <AnalyticsChart offices={offices} totalServed={served} onViewPerformance={()=>setPage('Performance')} />
      <aside className="overview-side"><article className="priority-card"><span>NEEDS ATTENTION</span><h2>{busiest?.name || 'No active queues'}</h2><strong>{busiest?.waiting || 0}</strong><p>students currently waiting</p><button onClick={()=>setPage('Live Queues')}>Open queue monitor →</button></article><article className="satisfaction-card"><div><span>★</span><section><small>Student satisfaction</small><strong>{average}/5</strong></section></div><Progress value={Number(average)*20}/><p>Ratings are based on submitted student feedback.</p><button onClick={()=>setPage('Feedback')}>Review feedback</button></article></aside>
    </section>
    <QueueTrendChart trends={queueTrends} />
  </>
}

function QueueActivityChart({ trends }) {
  const values=trends.length ? trends : [0,0,0,0,0]
  const peak=Math.max(...values.map((item)=>typeof item==='number'?item:item.count),1)
  const points=values.map((item,index)=>{const count=typeof item==='number'?item:item.count;return `${(index/Math.max(values.length-1,1))*100},${89-(count/peak)*68}`}).join(' ')
  return <div className="activity-chart" role="img" aria-label="Queue activity over recent days"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 18H100M0 48H100M0 78H100"/><polyline points={points}/></svg><div>{values.map((item,index)=><span key={typeof item==='number'?index:item.date}>{typeof item==='number'?['Mon','Tue','Wed','Thu','Fri'][index]||'':new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(new Date(`${item.date}T12:00:00`))}</span>)}</div></div>
}

function QueueTrendChart({ trends }) {
  const peak = Math.max(...trends.map((item) => item.count), 1)
  const points = trends.map((item, index) => `${(index / Math.max(trends.length - 1, 1)) * 100},${100 - (item.count / peak) * 82 - 9}`).join(' ')
  const total = trends.reduce((sum, item) => sum + item.count, 0)
  return <section className="queue-trend-card"><div className="queue-trend-heading"><div><span>QUEUE ACTIVITY</span><h2>Daily queue trends</h2><p>Students joining queues over the last seven days.</p></div><strong>{total}<small> tickets</small></strong></div><div className="queue-trend-chart" role="img" aria-label="Line chart of tickets created in the past seven days"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path className="trend-grid" d="M0 10H100M0 50H100M0 90H100"/><polyline className="trend-line" points={points}/>{trends.map((item, index) => <circle className="trend-dot" key={item.date} cx={(index / Math.max(trends.length - 1, 1)) * 100} cy={100 - (item.count / peak) * 82 - 9} r="2.2"/> )}</svg></div><div className="queue-trend-labels">{trends.map((item) => <span key={item.date}><b>{item.count}</b>{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${item.date}T12:00:00`))}</span>)}</div></section>
}

function AnalyticsChart({ offices, totalServed, onViewPerformance }){
  const peak=Math.max(...offices.map((office)=>office.served),1)
  const highest=[...offices].sort((a,b)=>b.served-a.served)[0]
  return <section className="analytics-card">
    <div className="analytics-card-head"><div><span>DAILY ANALYTICS</span><h2>Service volume by office</h2><p>{totalServed} transactions completed across campus today.</p></div>{onViewPerformance&&<button onClick={onViewPerformance}>View performance <span aria-hidden="true">→</span></button>}</div>
    <div className="analytics-summary"><span><b>{highest?.name || 'No office data'}</b><small>Highest service volume</small></span><strong>{highest?.served || 0}<small>served</small></strong></div>
    <div className="volume-chart" role="img" aria-label="Bar chart of tickets served today by office">
      <div className="volume-scale" aria-hidden="true"><span>{peak}</span><span>{Math.round(peak/2)}</span><span>0</span></div>
      <div className="volume-bars">{offices.map((office)=><div className="volume-bar-group" key={office.id}><div className="volume-bar-track"><i style={{height:`${Math.max(office.served ? 9 : 0,Math.round((office.served/peak)*100))}%`}}><b>{office.served}</b></i></div><span>{office.code}</span><small>{office.name}</small></div>)}</div>
    </div>
  </section>
}

function LiveQueues({ offices }){
  const totalWaiting=offices.reduce((sum,o)=>sum+o.waiting,0)
  return <><PageTitle title="Live queue monitor" subtitle="Monitor every office queue from one screen. Staff controls remain inside each staff workspace." action={<span className="admin-live-pill">● {totalWaiting} waiting campus-wide</span>}/>
    <section className="live-office-grid">{offices.map((office)=><article key={office.id}><div className="live-office-head"><span>{office.code}</span><div><h2>{office.name}</h2><p>{office.hours}</p></div><em className={office.open?'open':'closed'}>{office.open?'Open':'Closed'}</em></div><div className="live-numbers"><span><small>Waiting</small><strong>{office.waiting}</strong></span><span><small>Serving</small><strong>{office.serving||'—'}</strong></span><span><small>Served today</small><strong>{office.served}</strong></span></div><div className="load-line"><span>Current load</span><Progress value={Math.min(100,office.waiting*20)}/><b>{office.waiting===0?'Clear':office.waiting<=2?'Light':'Busy'}</b></div></article>)}</section>
    <section className="monitor-table"><div className="card-head"><div><h2>Campus queue status</h2><p>At-a-glance operational status for all school offices.</p></div></div><div className="monitor-head"><span>Office</span><span>Status</span><span>Now serving</span><span>Waiting</span><span>Avg. wait</span><span>Today</span></div>{offices.map((office)=><div className="monitor-row" key={office.id}><span><i>{office.code}</i><b>{office.name}</b></span><em className={office.open?'open':'closed'}>{office.open?'Accepting tickets':'Closed'}</em><strong>{office.serving||'—'}</strong><span>{office.waiting}</span><span>{office.avgWait} min</span><span>{office.served} served</span></div>)}</section>
  </>
}

function Students({ students,toggleStudent,onDelete }){
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('All')
  const visible=students.filter((s)=>(filter==='All'||s.status===filter)&&`${s.name} ${s.email} ${s.accountId}`.toLowerCase().includes(search.toLowerCase()))
  return <><PageTitle title="Student accounts" subtitle="Search student accounts, review queue activity, and control queue access."/>
    <section className="manager-card"><div className="manager-tools"><div className="search-box">⌕<input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name, email, or school ID..."/></div><div className="filter-buttons">{['All','Active','Suspended'].map((item)=><button className={filter===item?'active':''} onClick={()=>setFilter(item)} key={item}>{item}</button>)}</div></div><div className="account-table-head"><span>Student</span><span>School ID</span><span>Department</span><span>Queue visits</span><span>Status</span><span>Action</span></div>{visible.map((student)=><div className="account-row" key={student.id}><span className="person-cell"><i>{initials(student.name)}</i><span><b>{student.name}</b><small>{student.email}</small></span></span><span>{student.accountId}</span><span>{student.department}</span><span>{student.queues}<small>Last: {student.last}</small></span><em className={student.status.toLowerCase()}>{student.status}</em><span className="account-actions"><button className={student.status==='Active'?'suspend':'activate'} onClick={()=>toggleStudent(student.id)}>{student.status==='Active'?'Suspend':'Reactivate'}</button><button className="delete-account" onClick={()=>onDelete(student)}>Delete</button></span></div>)}{!visible.length&&<p className="no-data">No student accounts match your filters.</p>}</section>
  </>
}

function StaffManager({ staff,toggleStaff,reviewStaff,onAdd }){
  const [search,setSearch]=useState('')
  const visible=staff.filter((s)=>`${s.name} ${s.email} ${s.office}`.toLowerCase().includes(search.toLowerCase()))
  return <><PageTitle title="Staff accounts" subtitle="Approve staff requests and manage account access." action={<button className="admin-primary" onClick={onAdd}>+ Add staff</button>}/>
    <section className="manager-card"><div className="manager-tools"><div className="search-box">⌕<input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search staff name, email, or office..."/></div><span className="result-count">{visible.length} accounts</span></div><div className="staff-admin-grid">{visible.map((member)=><article key={member.id}><div className="staff-person"><span>{initials(member.name)}</span><div><h3>{member.name}</h3><p>{member.email}</p></div><em className={member.status.toLowerCase()}>{member.status}</em></div><div className="staff-meta"><span><small>Assigned office</small><b>{member.office}</b></span><span><small>Role</small><b>Service Staff</b></span></div>{member.status==='Pending'?<div className="staff-review-actions"><button className="approve" onClick={()=>reviewStaff(member.id,'approve')}>Approve</button><button className="reject" onClick={()=>reviewStaff(member.id,'reject')}>Reject</button></div>:<button onClick={()=>toggleStaff(member.id)}>{member.status==='Active'?'Deactivate account':'Reactivate account'}</button>}</article>)}</div></section>
  </>
}

function OfficeManager({ offices,toggleOffice,addRequirement,onAdd }){
  const [expanded,setExpanded]=useState(offices[0].id)
  const [drafts,setDrafts]=useState({})
  return <><PageTitle title="Offices & services" subtitle="Control office availability and keep student-facing service requirements accurate." action={<button className="admin-primary" onClick={onAdd}>+ Add office</button>}/>
    <section className="office-manager-list">{offices.map((office)=><article className={expanded===office.id?'expanded':''} key={office.id}><div className="office-manager-head"><button className="office-main-button" onClick={()=>setExpanded(expanded===office.id?null:office.id)}><span>{office.code}</span><div><h2>{office.name}</h2><p>{office.services.length} services · {office.hours}</p></div><em>{expanded===office.id?'−':'+'}</em></button><label className="office-switch"><input type="checkbox" checked={office.open} onChange={()=>toggleOffice(office.id)}/><i/><span>{office.open?'Open':'Closed'}</span></label></div>{expanded===office.id&&<div className="service-manager">{office.services.map((service,index)=><section key={service.name}><div className="service-manager-title"><div><span>SERVICE {index+1}</span><h3>{service.name}</h3></div><em>{service.requirements.length} requirements</em></div><div className="requirements-admin-list">{service.requirements.map((req,reqIndex)=><p key={`${req}-${reqIndex}`}><i>✓</i>{req}</p>)}</div><form onSubmit={(e)=>{e.preventDefault();const key=`${office.id}-${index}`;addRequirement(office.id,index,drafts[key]||'');setDrafts((d)=>({...d,[key]:''}))}}><input value={drafts[`${office.id}-${index}`]||''} onChange={(e)=>setDrafts((d)=>({...d,[`${office.id}-${index}`]:e.target.value}))} placeholder="Add another requirement..."/><button>Add</button></form></section>)}</div>}</article>)}</section>
  </>
}

function FeedbackPage({ feedback,offices }){
  const average=feedback.length?(feedback.reduce((sum,f)=>sum+f.rating,0)/feedback.length).toFixed(1):'0.0'
  const dist=[5,4,3,2,1].map((star)=>({star,count:feedback.filter((f)=>f.rating===star).length}))
  const [office,setOffice]=useState('All')
  const visible=feedback.filter((item)=>office==='All'||item.office===office)
  return <><PageTitle title="Student satisfaction" subtitle="Monitor 1–5 ratings and comments submitted after students are served." action={<select className="title-select" value={office} onChange={(e)=>setOffice(e.target.value)}><option>All</option>{offices.map((o)=><option key={o.id}>{o.name}</option>)}</select>}/>
    <section className="feedback-admin-grid"><article className="rating-overview"><span>OVERALL RATING</span><div><strong>{average}</strong><small>/5</small></div><p className="stars">★★★★★</p><small>{feedback.length} responses</small><div className="rating-dist">{dist.map((row)=><p key={row.star}><span>{row.star} ★</span><Progress value={feedback.length?(row.count/feedback.length)*100:0}/><b>{row.count}</b></p>)}</div></article><article className="feedback-feed"><div className="card-head"><div><h2>Recent responses</h2><p>Written comments from served students.</p></div></div>{visible.map((item)=><section key={item.ticket}><div className="review-top"><span>{initials(item.student)}</span><div><b>{item.student}</b><small>{item.office} · {item.ticket}</small></div><strong>★ {item.rating}.0</strong></div><p>“{item.comment}”</p><small>{item.time}</small></section>)}{!visible.length&&<p className="no-data">No feedback for this office.</p>}</article></section>
  </>
}

function Performance({ offices }){
  const served=offices.reduce((sum,o)=>sum+o.served,0)
  const averageWait=offices.length?Math.round(offices.reduce((sum,o)=>sum+o.avgWait,0)/offices.length):0
  const completion=offices.length?Math.round(offices.reduce((sum,o)=>sum+o.completion,0)/offices.length):0
  const averageRating=offices.length?(offices.reduce((sum,o)=>sum+o.rating,0)/offices.length).toFixed(1):'0.0'
  const peak=[...offices].sort((a,b)=>b.served-a.served)[0]
  return <><PageTitle title="Office performance" subtitle="Compare service volume, waiting time, completion, and student satisfaction by office."/>
    <section className="performance-kpis"><article><small>Total served</small><strong>{served}</strong><p>All offices today</p></article><article><small>Avg. wait</small><strong>{averageWait} min</strong><p>Across all offices</p></article><article><small>Avg. service time</small><strong>{averageWait || '—'}<i>{averageWait?' min':''}</i></strong><p>Estimated from queues</p></article><article><small>Completion rate</small><strong>{completion}%</strong><p>Tickets completed</p></article><article><small>Satisfaction rating</small><strong>{averageRating}<i>/5</i></strong><p>From student feedback</p></article><article><small>Peak office</small><strong>{peak?.code || '—'}</strong><p>{peak?.name || 'No office data'}</p></article></section>
    <AnalyticsChart offices={offices} totalServed={served} />
    <section className="performance-table"><div className="performance-head"><span>Office</span><span>Served</span><span>Avg. wait</span><span>Completion</span><span>Rating</span><span>Load</span></div>{offices.map((office)=><article key={office.id}><span><i>{office.code}</i><b>{office.name}</b></span><strong>{office.served}</strong><span>{office.avgWait} min</span><span className="completion-cell"><b>{office.completion}%</b><Progress value={office.completion}/></span><span className="rating-cell">★ {office.rating}</span><em>{office.waiting===0?'Clear':office.waiting<=2?'Light':'Busy'}</em></article>)}</section>
  </>
}

function Profile({ user, token }){
  const [form,setForm]=useState({name:user.name,email:user.email,password:'',confirmPassword:''})
  const [notice,setNotice]=useState('')
  const [passwordVisible,setPasswordVisible]=useState(false)
  const [confirmPasswordVisible,setConfirmPasswordVisible]=useState(false)
  const update=({target})=>setForm((current)=>({...current,[target.name]:target.value}))
  const submit=async(event)=>{event.preventDefault();if(form.password!==form.confirmPassword)return setNotice('Passwords do not match.');try{await portalApi('/api/auth/profile',token,{method:'PATCH',body:JSON.stringify(form)});setNotice('Profile saved successfully.');setForm(current=>({...current,password:'',confirmPassword:''}))}catch(error){setNotice(error.message)}}
  return <><PageTitle title="Admin profile" subtitle="Update your administrator account details."/><form className="admin-profile-editor" onSubmit={submit}><div className="admin-profile-heading"><span>{initials(form.name)}</span><div><h2>{form.name}</h2><p>Administrator account</p></div></div><div className="admin-profile-fields"><label>Full name<input name="name" value={form.name} onChange={update} required /></label><label>Email address<input name="email" type="email" value={form.email} onChange={update} required /></label><label className="admin-password-field">Password<span><input name="password" type={passwordVisible ? 'text' : 'password'} value={form.password} onChange={update} placeholder="New password" minLength="8" /><button type="button" onClick={()=>setPasswordVisible((visible)=>!visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'} title={passwordVisible ? 'Hide password' : 'Show password'}><PasswordEye visible={passwordVisible}/></button></span></label><label className="admin-password-field">Confirm password<span><input name="confirmPassword" type={confirmPasswordVisible ? 'text' : 'password'} value={form.confirmPassword} onChange={update} placeholder="Repeat password" minLength="8" /><button type="button" onClick={()=>setConfirmPasswordVisible((visible)=>!visible)} aria-label={confirmPasswordVisible ? 'Hide password' : 'Show password'} title={confirmPasswordVisible ? 'Hide password' : 'Show password'}><PasswordEye visible={confirmPasswordVisible}/></button></span></label></div><div className="admin-profile-footer"><p className={notice.includes('match')?'profile-error':''}>{notice||'Leave passwords blank to keep your current password.'}</p><button className="admin-primary">Save profile</button></div></form></>}

function AddStaffModal({ offices,onClose,onAdd }){
  const [form,setForm]=useState({email:'',office:offices[0]?.name||'Registrar'})
  return <div className="admin-modal-wrap" role="dialog" aria-modal="true"><form className="admin-modal" onSubmit={(e)=>{e.preventDefault();onAdd(form)}}><button type="button" className="admin-modal-close" onClick={onClose}>×</button><span className="float-kicker">STAFF ACCOUNT</span><h2>Add staff member</h2><p>Enter the staff member’s email and assign the office they will manage. They can set their password through Forgot password.</p><label>School email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="name@school.edu" required/></label><label>Assigned office<select value={form.office} onChange={(e)=>setForm({...form,office:e.target.value})}>{offices.map((o)=><option key={o.id}>{o.name}</option>)}</select></label><button className="admin-primary modal-submit">Create staff account</button></form></div>
}

function AddOfficeModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', code: '', wait: '4', service: 'General inquiry' })
  const update = ({ target }) => setForm((current) => ({ ...current, [target.name]: target.value }))
  return <div className="admin-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="add-office-title"><form className="admin-modal" onSubmit={(event) => { event.preventDefault(); onAdd({ ...form, wait: Number(form.wait) }) }}><button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">×</button><span className="float-kicker">OFFICE SETUP</span><h2 id="add-office-title">Add office</h2><p>Create an office that students can use for queue services and assign staff to manage.</p><label>Office name<input name="name" value={form.name} onChange={update} placeholder="Guidance Office" required maxLength="80" /></label><label>Ticket code<input name="code" value={form.code} onChange={update} placeholder="G" required maxLength="4" pattern="[A-Za-z0-9]+" title="Use up to four letters or numbers." /></label><label>Typical service time (minutes)<input name="wait" type="number" value={form.wait} onChange={update} min="1" max="120" required /></label><label>First service<input name="service" value={form.service} onChange={update} placeholder="General inquiry" required maxLength="100" /></label><button className="admin-primary modal-submit">Create office</button></form></div>
}

function OldStaffScheduleManager({ staff, toggleStaff, reviewStaff, onDelete, onAdd, onSchedule }) {
  const [search,setSearch]=useState('')
  const visible=staff.filter((member)=>`${member.name} ${member.email} ${member.office}`.toLowerCase().includes(search.toLowerCase()))
  return <><PageTitle title="Staff accounts & schedules" subtitle="Manage staff access and edit each staff member’s weekly shifts." action={<button className="admin-primary" onClick={onAdd}>+ Add staff</button>}/><section className="manager-card"><div className="manager-tools"><div className="search-box">Search <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search staff name, email, or office..."/></div><span className="result-count">{visible.length} accounts</span></div><div className="staff-admin-grid">{visible.map((member)=><article key={member.id}><div className="staff-person"><span>{initials(member.name)}</span><div><h3>{member.name}</h3><p>{member.email}</p></div><em className={member.status.toLowerCase()}>{member.status}</em></div><div className="staff-meta"><span><small>Assigned office</small><b>{member.office}</b></span><span><small>Weekly shifts</small><b>{member.schedule?.length || 0} scheduled</b></span></div><button className="schedule-edit" onClick={()=>onSchedule(member)}>Edit schedule</button>{member.status==='Pending'?<div className="staff-review-actions"><button className="approve" onClick={()=>reviewStaff(member.id,'approve')}>Approve</button><button className="reject" onClick={()=>reviewStaff(member.id,'reject')}>Reject</button></div>:<button onClick={()=>toggleStaff(member.id)}>{member.status==='Active'?'Deactivate account':'Reactivate account'}</button>}</article>)}</div></section></>
}

function StaffScheduleManager({ staff, toggleStaff, reviewStaff, onDelete, onAdd, onSchedule }) {
  const [search,setSearch]=useState('')
  const visible=staff.filter((member)=>`${member.name} ${member.email} ${member.office}`.toLowerCase().includes(search.toLowerCase()))
  return <><PageTitle title="Staff accounts & schedules" subtitle="Manage staff access and edit each staff member's weekly shifts." action={<button className="admin-primary" onClick={onAdd}>+ Add staff</button>}/><section className="manager-card"><div className="manager-tools"><div className="search-box">Search <input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search staff name, email, or office..."/></div><span className="result-count">{visible.length} accounts</span></div><div className="staff-admin-grid">{visible.map((member)=><article key={member.id}><div className="staff-person"><span>{initials(member.name)}</span><div><h3>{member.name}</h3><p>{member.email}</p></div><em className={member.status.toLowerCase()}>{member.status}</em></div><div className="staff-meta"><span><small>Assigned office</small><b>{member.office}</b></span><span><small>Weekly shifts</small><b>{member.schedule?.length || 0} scheduled</b></span></div><button className="schedule-edit" onClick={()=>onSchedule(member)}>Edit schedule</button>{member.status==='Pending'?<div className="staff-review-actions"><button className="approve" onClick={()=>reviewStaff(member.id,'approve')}>Approve</button><button className="reject" onClick={()=>reviewStaff(member.id,'reject')}>Reject</button></div>:<button onClick={()=>toggleStaff(member.id)}>{member.status==='Active'?'Deactivate account':'Reactivate account'}</button>}<button className="delete-account" onClick={()=>onDelete(member)}>Delete account</button></article>)}</div></section></>
}

function AuditLogs({ logs }) {
  return <><PageTitle title="Audit logs" subtitle="History of account-management actions performed from this admin console."/><section className="audit-log-card"><div className="audit-log-head"><span>Activity history</span><small>{logs.length} recorded actions</small></div>{logs.length ? logs.map((log)=><article key={log.id}><i>◷</i><div><b>{log.action}</b><p>{log.subject}</p></div><time>{log.time}</time></article>) : <p className="no-data">No account actions have been recorded yet.</p>}</section></>
}

const scheduleDays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
function AdminScheduleModal({ member,onClose,onSave }){
  const [items,setItems]=useState(member.schedule||[])
  const change=(index,field,value)=>setItems((current)=>current.map((item,i)=>i===index?{...item,[field]:value}:item))
  const add=()=>setItems((current)=>[...current,{day:'Monday',start:'08:00',end:'17:00'}])
  return <div className="admin-modal-wrap" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title"><section className="admin-modal schedule-modal"><button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close schedule editor">×</button><div className="schedule-modal-heading"><span className="float-kicker">STAFF SCHEDULE</span><h2 id="schedule-modal-title">{member.name}</h2><p><span>{member.office}</span>Manage this staff member’s weekly availability.</p></div><div className="schedule-summary"><span className="schedule-summary-icon">◷</span><div><strong>{items.length} shift{items.length===1?'':'s'} scheduled</strong><small>Times use your local campus time.</small></div></div><div className="admin-schedule-list">{items.map((item,index)=><div className="admin-schedule-row" key={`${item.day}-${index}`}><label>Day<select aria-label={`Shift ${index+1} day`} value={item.day} onChange={(event)=>change(index,'day',event.target.value)}>{scheduleDays.map((day)=><option key={day}>{day}</option>)}</select></label><label>From<input aria-label={`Shift ${index+1} start time`} type="time" value={item.start} onChange={(event)=>change(index,'start',event.target.value)}/></label><span className="schedule-arrow">→</span><label>To<input aria-label={`Shift ${index+1} end time`} type="time" value={item.end} onChange={(event)=>change(index,'end',event.target.value)}/></label><button type="button" className="schedule-remove" onClick={()=>setItems((current)=>current.filter((_,i)=>i!==index))} aria-label={`Remove ${item.day} shift`}>×</button></div>)}{!items.length&&<div className="schedule-empty"><span>◷</span><strong>No shifts scheduled</strong><p>Add the first shift to show when {member.name.split(' ')[0]} is available.</p></div>}</div><button type="button" className="schedule-add" onClick={add}><span>+</span>Add shift</button><button type="button" className="admin-primary modal-submit" onClick={()=>onSave(items)}>Save schedule</button></section></div>
}
