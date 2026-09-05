// Remove tokens saved by older versions; authentication now uses an HttpOnly cookie.
export function clearLegacySession() {
  try { localStorage.removeItem('tixora.session'); } catch { /* Storage may be blocked. */ }
}
