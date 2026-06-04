/**
 * Lightweight in-memory cache of the currently logged-in user id.
 *
 * `useBroadcastSync` is mounted at the AppShell level and receives
 * realtime events for all cashiers. To suppress the toast for the
 * cashier's own actions, the hook needs the current user id without
 * taking a dependency on the React tree of `useHospitalSession`.
 *
 * The session setter is called from the login and logout flows so
 * the cache stays in sync with the API client state. The cache is
 * intentionally a module-level singleton because the broadcast
 * subscription is also a module-level singleton in the echo client.
 */

let currentUserId: number | null = null;

export function setStoredUserId(userId: number | null): void {
  currentUserId = userId;
}

export function getStoredUserId(): number | null {
  return currentUserId;
}
