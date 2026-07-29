type Refresher = () => Promise<string>;
type SessionClearer = () => void;

let refresher: Refresher | null = null;
let sessionClearer: SessionClearer | null = null;
let pendingRefresh: Promise<string> | null = null;

/**
 * Bridges apiFetch (a plain function, no React context) to AuthProvider's state — lets a 401
 * caused by an expired in-memory access token trigger a silent refresh-and-retry instead of
 * surfacing "Unauthorized" on every call until the user manually reloads the page. AuthProvider
 * registers these on mount; apiFetch calls them on 401.
 */
export function registerSessionHandlers(handlers: {
  refresh: Refresher;
  clear: SessionClearer;
}): void {
  refresher = handlers.refresh;
  sessionClearer = handlers.clear;
}

export function clearSessionHandlers(): void {
  refresher = null;
  sessionClearer = null;
}

/** Dedupes concurrent 401s so several requests failing at once trigger exactly one refresh. */
export async function refreshAccessToken(): Promise<string> {
  if (!refresher) throw new Error('No session handler registered');
  if (!pendingRefresh) {
    pendingRefresh = refresher().finally(() => {
      pendingRefresh = null;
    });
  }
  return pendingRefresh;
}

export function notifySessionExpired(): void {
  sessionClearer?.();
}
