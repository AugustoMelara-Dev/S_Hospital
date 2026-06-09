/**
 * Force a fresh XSRF-TOKEN cookie by re-fetching
 * `/sanctum/csrf-cookie`. The frontend calls this on logout and on a
 * 401 from the API so the next mutating request gets a token bound to
 * the next authenticated user, not the previous one.
 */

export async function invalidateCsrfCookie(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }

  try {
    await window.fetch('/sanctum/csrf-cookie', {
      credentials: 'include',
      method: 'GET',
    });
  } catch {
    // Best-effort: a network failure here is non-fatal because the
    // caller's primary action (logout / 401 cleanup) is what matters.
  }
}
