import { useEffect, useSyncExternalStore } from 'react'
import Login from '../auths/login.jsx'
import StudentPortal from '../students/studentPortal.jsx'
import Admin from '../admin/admin.jsx'
import Staff from '../staff/staff.jsx'

const adminPages = {
  Overview: '/admin',
  'Live Queues': '/admin/live-queues',
  Students: '/admin/students',
  Staff: '/admin/staff',
  'Offices & Services': '/admin/offices-services',
  Feedback: '/admin/feedback',
  Performance: '/admin/performance',
  'Audit Logs': '/admin/audit-logs',
  Profile: '/admin/profile',
}

const studentPages = {
  Dashboard: '/student',
  Services: '/student/services',
  Calendar: '/student/calendar',
  'My Queue': '/student/my-queue',
  'Live Monitor': '/student/live-monitor',
  History: '/student/history',
  Review: '/student/review',
  Profile: '/student/profile',
}

const roleRoutes = {
  admin: { path: '/admin', Component: Admin, pages: adminPages },
  staff: { path: '/staff', Component: Staff },
  student: { path: '/student', Component: StudentPortal, pages: studentPages },
}

const getPathname = () => window.location.pathname
const subscribe = (listener) => {
  window.addEventListener('popstate', listener)
  return () => window.removeEventListener('popstate', listener)
}

export default function AppRoutes({ session, checkingSession, onLogin, onLogout, onRoleChanged, onSwitchRole }) {
  const pathname = useSyncExternalStore(subscribe, getPathname)
  const role = session?.user?.role
  const route = session?.token && Object.hasOwn(roleRoutes, role) ? roleRoutes[role] : null
  const page = Object.entries(route?.pages ?? {}).find(([, path]) => path === pathname)?.[0]
  const validPath = route && (pathname === route.path || page !== undefined)
  const targetPath = validPath ? pathname : route?.path ?? '/'

  useEffect(() => {
    if (checkingSession) return
    // Unknown or unauthorized URLs return to the signed-in role's home.
    if (window.location.pathname !== targetPath) {
      window.history.replaceState(null, '', targetPath)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
  }, [checkingSession, targetPath])

  const navigatePage = (nextPage) => {
    const nextPath = route?.pages?.[nextPage]
    if (!nextPath || nextPath === window.location.pathname) return
    window.history.pushState(null, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  // Verify saved sessions before rendering protected pages or redirecting.
  if (checkingSession) {
    return <main className="app-loading" role="status" aria-live="polite">
      <strong>Queueless</strong>
      <span>Loading your session…</span>
    </main>
  }
  if (!route) return <Login onLogin={onLogin} />

  const Dashboard = route.Component
  const defaultPage = Object.keys(route.pages ?? {})[0] ?? 'Overview'
  return <Dashboard onLogout={onLogout} user={session.user} token={session.token} page={page ?? defaultPage} onNavigate={navigatePage} onRoleChanged={onRoleChanged} onSwitchRole={onSwitchRole} />
}
