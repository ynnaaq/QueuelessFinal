import './officeIdentity.css'

// One source of visual identity for every portal. Persisted office values take
// precedence, so an administrator can configure future offices without a UI
// release; unknown offices get an accessible neutral fallback.
const defaults = {
  bookstore: { icon: 'book', color: '#178667', label: 'Bookstore' },
  csdl: { icon: 'user', color: '#d34f7c', label: 'CSDL' },
  finance: { icon: 'card', color: '#2879cf', label: 'Finance' },
  library: { icon: 'library', color: '#7656d6', label: 'Library' },
  marketing: { icon: 'megaphone', color: '#df7837', label: 'Marketing' },
  registrar: { icon: 'graduation', color: '#159b9b', label: 'Registrar' },
}

const keyFor = office => String(office?.name || office || '').trim().toLowerCase()
export function officeIdentity(office) {
  const fallback = defaults[keyFor(office)] || { icon: 'building', color: '#536bd4', label: typeof office === 'string' ? office : office?.name || 'Office' }
  return { ...fallback, ...(typeof office === 'object' ? { icon: office.icon || fallback.icon, color: office.color || fallback.color } : {}) }
}

export function OfficeIcon({ office, size = 'md', label = true, className = '' }) {
  const identity = officeIdentity(office)
  const paths = {
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21zM20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5A2.5 2.5 0 0 1 20 21z"/></>,
    user: <><circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
    card: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/></>,
    library: <><path d="M4 21V4h5v17M9 4h6v17M15 4h5v17"/><path d="M3 21h18"/></>,
    megaphone: <><path d="m4 13 11-5v8L4 11zM15 10h3a2 2 0 0 1 0 4h-3M7 13l1.5 6h3L10 12"/></>,
    graduation: <><path d="m3 9 9-5 9 5-9 5zM7 11.2V16c2.8 2 7.2 2 10 0v-4.8M21 10v5"/></>,
    building: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 12h2M14 12h2M11 21v-5h2"/></>,
  }
  return <span className={`office-identity office-identity-${size} ${className}`} style={{ '--office-color': identity.color }} title={identity.label}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{paths[identity.icon] || paths.building}</svg>
    {label && <span>{identity.label}</span>}
  </span>
}
