/**
 * Force a fresh XSRF-TOKEN cookie by re-fetching
 * `/sanctum/csrf-cookie`. Keep this for explicit recovery flows only:
 * normal login already obtains CSRF through apiClient.csrf() before
 * posting credentials.
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
