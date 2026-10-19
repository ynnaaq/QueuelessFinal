import { getPortalState, portalApi } from './auth.js'

const mapStudent = (student) => ({ ...student, queues: '—', last: '—' })

export async function getStudentProfiles(token) {
  const { users = [] } = await getPortalState(token)
  return users.filter((user) => user.role === 'student').map(mapStudent)
}

export const updateStudentStatus = (token, id, status) =>
  portalApi(`/api/admin/users/${encodeURIComponent(id)}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })

export const deleteStudentProfile = (token, id) =>
  portalApi(`/api/admin/users/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  })
