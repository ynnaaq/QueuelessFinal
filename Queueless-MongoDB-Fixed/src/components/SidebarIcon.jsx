const icons = {
  home: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 21v-6h6v6"/></>,
  queues: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="4" cy="6" r=".6"/><circle cx="4" cy="12" r=".6"/><circle cx="4" cy="18" r=".6"/></>,
  services: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></>,
  monitor: <><path d="M4 12s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"/><circle cx="12" cy="12" r="2"/></>,
  history: <><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>,
  profile: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
  student: <><circle cx="12" cy="7" r="3"/><path d="M6 21v-2a6 6 0 0 1 12 0v2M9 11l3 3 3-3"/></>,
  staff: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M15 15a5 5 0 0 1 6 4v2"/></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 12h2M14 12h2M8 16h2M14 16h2M11 21v-5h2"/></>,
  trend: <><path d="M5 17 17 5M10 5h7v7"/><path d="M5 7v10h10"/></>,
  check: <><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.3 2.3 4.7-5"/></>,
}

/** Shared line-icon system for every portal sidebar. */
export default function SidebarIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {icons[name] || icons.home}
  </svg>
}
