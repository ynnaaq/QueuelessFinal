export function AppLoadingScreen() {
  return <main className="app-loading" role="status" aria-live="polite">
    <div className="app-loading-logo"><img src="/campus-queue-logo.png" alt="" /><strong>Queueless</strong></div>
    <span className="app-loading-spinner" aria-hidden="true" />
    <span>Preparing your workspace…</span>
  </main>
}

export function PortalSkeleton({ label = 'Loading dashboard' }) {
  return <section className="portal-skeleton" role="status" aria-label={label}>
    <div className="skeleton-line skeleton-title" />
    <div className="skeleton-line skeleton-copy" />
    <div className="skeleton-cards"><i /><i /><i /></div>
    <div className="skeleton-panel" />
  </section>
}
