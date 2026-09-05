// Remove tokens saved by older versions; authentication now uses an HttpOnly cookie.
export function clearLegacySession() {
  for (const key of ['tixora.session', 'team-task-manager.session']) {
    try { localStorage.removeItem(key); } catch { /* Storage may be blocked. */ }
  }
}
