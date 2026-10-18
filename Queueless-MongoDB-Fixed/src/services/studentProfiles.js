
import { supabase } from '../lib/supabase.js'

export async function getStudentProfiles() {
  const { data, error } = await supabase
    .from('student_profiles')
    .select(
      'id, email, full_name, student_id, course, status'
    )
    .order('full_name', { ascending: true })

  if (error) throw error

  return (data || []).map((student) => ({
    id: student.id,
    name: student.full_name || '',
    email: student.email || '',
    accountId: student.student_id || '',
    department: student.course || '',
    status: student.status,
    role: 'student',
    queues: '—',
    last: '—'
  }))
}

export async function updateStudentStatus(id, status) {
  const { data, error } = await supabase
    .from('student_profiles')
    .update({ status })
    .eq('id', id)
    .select('id')
    .single()

  if (error) throw error

  return data
}

export async function deleteStudentProfile(id) {
  const { error } = await supabase
    .from('student_profiles')
    .delete()
    .eq('id', id)

  if (error) throw error
}
