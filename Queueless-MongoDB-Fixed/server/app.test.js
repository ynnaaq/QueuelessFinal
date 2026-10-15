import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { createApp } from './app.js'

async function start(options={}) {
  const api=createApp({dbPath:':memory:',seedDemo:true,...options})
  const server=api.app.listen(0,'127.0.0.1')
  await once(server,'listening')
  const request=async(url,{token,method='GET',body,status=200}={})=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}${url}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})
    const data=await response.json()
    assert.equal(response.status,status,JSON.stringify(data))
    return data
  }
  const login=async(role)=>request('/api/auth/login',{method:'POST',body:{email:role==='student'?'maria@student.edu':`${role}@school.edu`,password:role==='student'?'Student123!':role==='staff'?'Staff123!':'Admin123!'}})
  const stop=async()=>{await new Promise(resolve=>server.close(resolve));api.close()}
  return {request,login,stop}
}
const registration={name:'Second Student',email:'second@school.edu',password:'Password123!',accountId:'03-3456-789013'}
const visit={officeId:'Registrar',service:'Transcript / school records'}

test('authentication, validation, privacy and account management',async t=>{
  const api=await start();t.after(api.stop)
  const {request,login}=api
  await request('/api/portal/state',{status:401})
  await request('/api/auth/me',{token:'demo-admin-admin@school.edu',status:401})
  await request('/api/auth/register',{method:'POST',body:{...registration,role:'admin'},status:403})
  await request('/api/auth/register',{method:'POST',body:{...registration,role:'staff',office:'Unknown'},status:404})
  await request('/api/auth/register',{method:'POST',body:{...registration,password:'x'},status:400})
  const second=await request('/api/auth/register',{method:'POST',body:registration,status:201})
  await request('/api/auth/register',{method:'POST',body:{...registration,email:'third@school.edu'},status:409})
  const admin=await login('admin'),staff=await login('staff'),student=await login('student')
  assert.equal(admin.user.passwordHash,undefined)
  await request('/api/offices/reg',{method:'PATCH',token:student.token,body:{open:false},status:403})
  await request('/api/offices/reg',{method:'PATCH',token:admin.token,body:{open:'false'},status:400})
  const newStaff=await request('/api/admin/staff',{method:'POST',token:admin.token,body:{name:'Finance Staff',email:'finance@school.edu',password:'Password123!',office:'Finance'},status:201})
  assert.equal(newStaff.user.office,'Finance')
  await request('/api/offices/fin/requirements',{method:'POST',token:staff.token,body:{requirement:'Receipt'},status:403})
  await request('/api/offices/reg/requirements',{method:'POST',token:staff.token,body:{requirement:'Signed form'}})
  const state=await request('/api/portal/state',{token:student.token})
  assert.equal(state.users,undefined)
  assert(state.offices.find(o=>o.id==='reg').services[0].requirements.includes('Signed form'))
  const ticket=(await request('/api/tickets',{method:'POST',token:student.token,body:visit,status:201})).ticket
  const privateState=await request('/api/portal/state',{token:second.token})
  assert.equal(privateState.tickets.length,0)
  await request(`/api/tickets/${ticket.id}/cancel`,{method:'PATCH',token:second.token,status:404})
  await request(`/api/admin/users/${student.user.id}`,{method:'PATCH',token:admin.token,body:{status:'Suspended'}})
  await request('/api/auth/me',{token:student.token,status:401})
  await request('/api/auth/login',{method:'POST',body:{email:'maria@student.edu',password:'Student123!'},status:401})
  await request(`/api/admin/users/${student.user.id}`,{method:'PATCH',token:admin.token,body:{status:'Active'}})
  const restored=await login('student')
  await request('/api/auth/profile',{method:'PATCH',token:restored.token,body:{name:'Updated Student',email:'updated@school.edu',password:'Newpassword123!'}})
  const updated=await request('/api/auth/login',{method:'POST',body:{email:'updated@school.edu',password:'Newpassword123!'}})
  assert.equal(updated.user.name,'Updated Student')
  await request('/api/auth/logout',{method:'POST',token:updated.token})
  await request('/api/auth/me',{token:updated.token,status:401})
})

test('queue lifecycle, concurrent joins, FIFO, feedback and office controls',async t=>{
  const api=await start();t.after(api.stop)
  const {request,login}=api
  const student=await login('student'),staff=await login('staff'),admin=await login('admin')
  const second=await request('/api/auth/register',{method:'POST',body:registration,status:201})
  await request('/api/tickets',{method:'POST',token:student.token,body:{...visit,service:'Invalid'},status:400})
  await request('/api/tickets',{method:'POST',token:student.token,body:{...visit,visitDate:'2026-02-30'},status:400})
  // Requests are sent concurrently; exactly one may create an active ticket.
  const results=await Promise.allSettled([request('/api/tickets',{method:'POST',token:student.token,body:visit,status:201}),request('/api/tickets',{method:'POST',token:student.token,body:visit,status:409})])
  assert(results.every(r=>r.status==='fulfilled'))
  const first=results[0].value.ticket
  const next=(await request('/api/tickets',{method:'POST',token:second.token,body:visit,status:201})).ticket
  assert.equal(first.queuePosition,0);assert.equal(next.queuePosition,1)
  const action=(ticket,action,status=200,token=staff.token)=>request(`/api/tickets/${ticket.id}/action`,{method:'POST',token,body:{action},status})
  await action(next,'call',409)
  await action(first,'serve',409)
  await action(first,'call',403,student.token)
  await action(first,'call')
  await action(next,'call',409)
  await action(first,'skip')
  await action(first,'recall')
  await action(first,'call')
  await action(first,'serve')
  await action(first,'serve',409)
  await request(`/api/tickets/${first.id}/feedback`,{method:'POST',token:student.token,body:{rating:6},status:400})
  await request(`/api/tickets/${first.id}/feedback`,{method:'POST',token:student.token,body:{rating:5,comment:'Helpful staff'}})
  await request(`/api/tickets/${first.id}/feedback`,{method:'POST',token:student.token,body:{rating:4},status:409})
  const state=await request('/api/portal/state',{token:admin.token})
  const office=state.offices.find(o=>o.id==='reg')
  assert.equal(office.served,1);assert.equal(office.waiting,1);assert.equal(office.rating,5)
  assert.equal(state.feedback[0].comment,'Helpful staff')
  await request(`/api/tickets/${next.id}/cancel`,{method:'PATCH',token:second.token})
  const later=(await request('/api/tickets',{method:'POST',token:second.token,body:visit,status:201})).ticket
  assert.notEqual(later.ticket,next.ticket)
  await request('/api/offices/fin',{method:'PATCH',token:admin.token,body:{open:false}})
  await request('/api/tickets',{method:'POST',token:student.token,body:{officeId:'Finance',service:'Account assessment'},status:400})
  await request('/api/offices/fin',{method:'PATCH',token:admin.token,body:{open:true}})
  const finance=(await request('/api/tickets',{method:'POST',token:student.token,body:{officeId:'Finance',service:'Account assessment'},status:201})).ticket
  await action(finance,'call',403)
})

test('database and sessions survive restart; scheduled tickets cannot be called early',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'queueless-test-'))
  const dbPath=path.join(dir,'queue.sqlite')
  let api=await start({dbPath})
  t.after(async()=>{await api.stop();fs.rmSync(dir,{recursive:true,force:true})})
  const student=await api.login('student'),staff=await api.login('staff')
  const date=new Date(Date.now()+86400000).toISOString().slice(0,10)
  const ticket=(await api.request('/api/tickets',{method:'POST',token:student.token,body:{...visit,visitDate:date},status:201})).ticket
  await api.request(`/api/tickets/${ticket.id}/action`,{method:'POST',token:staff.token,body:{action:'call'},status:409})
  await api.stop()
  api=await start({dbPath,seedDemo:false})
  const state=await api.request('/api/portal/state',{token:student.token})
  assert.equal(state.tickets[0].id,ticket.id)
  assert.equal(state.tickets[0].visitDate,date)
  assert.equal(state.offices.find(o=>o.id==='reg').waiting,0)
  await api.request(`/api/tickets/${ticket.id}/cancel`,{method:'PATCH',token:student.token})
})

test('staff self-registration immediately grants assigned-office staff access',async t=>{
  const api=await start();t.after(api.stop)
  const {request,login}=api
  const account={name:'New Staff',email:'newstaff@school.edu',password:'Staffpassword123!',role:'staff',office:'Finance'}
  const staff=await request('/api/auth/register',{method:'POST',body:account,status:201})
  assert.equal(staff.user.role,'staff')
  assert.equal(staff.user.office,'Finance')
  assert.equal(staff.user.status,'Active')
  assert.ok(staff.token)
  const me=await request('/api/auth/me',{token:staff.token})
  assert.equal(me.user.role,'staff')
  await request('/api/portal/state',{token:staff.token})
  const student=await login('student')
  const {ticket}=await request('/api/tickets',{method:'POST',token:student.token,body:{officeId:'Finance',service:'Account assessment'},status:201})
  await request(`/api/tickets/${ticket.id}/action`,{method:'POST',token:staff.token,body:{action:'call'}})
  await request('/api/offices/reg/requirements',{method:'POST',token:staff.token,body:{requirement:'Wrong office'},status:403})
  await request('/api/admin/staff',{method:'POST',token:staff.token,body:account,status:403})
  await request('/api/auth/logout',{method:'POST',token:staff.token})
  const signedIn=await request('/api/auth/login',{method:'POST',body:{email:account.email,password:account.password}})
  assert.equal(signedIn.user.role,'staff')
  assert.equal(signedIn.user.office,'Finance')
  await request('/api/auth/register',{method:'POST',body:account,status:409})
})

test('owners can cancel waiting, serving and skipped tickets and join again',async t=>{
  const api=await start();t.after(api.stop)
  const {request,login}=api
  const student=await login('student'),staff=await login('staff')
  for(const state of ['waiting','serving','skipped']) {
    const {ticket}=await request('/api/tickets',{method:'POST',token:student.token,body:visit,status:201})
    if(state!=='waiting')await request(`/api/tickets/${ticket.id}/action`,{method:'POST',token:staff.token,body:{action:'call'}})
    if(state==='skipped')await request(`/api/tickets/${ticket.id}/action`,{method:'POST',token:staff.token,body:{action:'skip'}})
    const result=await request(`/api/tickets/${ticket.id}/cancel`,{method:'PATCH',token:student.token})
    assert.equal(result.ticket.status,'cancelled')
    const portal=await request('/api/portal/state',{token:student.token})
    assert.equal(portal.tickets.find(t=>t.id===ticket.id).status,'cancelled')
    assert.equal(portal.tickets.filter(t=>['waiting','serving','skipped'].includes(t.status)).length,0)
  }
})
