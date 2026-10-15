import test from 'node:test'
import assert from 'node:assert/strict'
import { studentTickets } from '../src/services/studentTickets.js'

test('student portal ignores other students tickets from legacy unfiltered responses', () => {
  const tickets = [
    { id: 'other-active', studentId: 'other@school.edu', status: 'waiting' },
    { id: 'mine', studentId: 'student@school.edu', status: 'waiting' },
    { id: 'other-history', studentId: 'other@school.edu', status: 'cancelled' },
    { id: 'my-history', studentId: 'student@school.edu', status: 'cancelled' },
  ]
  assert.deepEqual(studentTickets(tickets, { email: 'student@school.edu' }).map(t => t.id), ['mine', 'my-history'])
  assert.deepEqual(studentTickets(tickets, { email: 'new@school.edu' }), [])
  assert.deepEqual(studentTickets(tickets, {}), [])
})

test('MongoDB owners and ticket IDs normalize to the cancellation identifier', () => {
  const tickets = [
    { _id: 'ticket-a', studentId: { _id: 'student-a', email: 'Student@School.edu' } },
    { _id: 'ticket-b', studentId: 'student-a' },
    { id: 'ticket-c', studentId: null },
  ]
  assert.deepEqual(studentTickets(tickets, { id: 'student-a' }).map(t => t.id), ['ticket-a', 'ticket-b'])
  assert.equal(studentTickets(tickets, { email: 'student@school.edu' })[0].id, 'ticket-a')
})
