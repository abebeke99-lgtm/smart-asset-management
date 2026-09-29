/**
 * Shared bearer-token helper for the Maintenance module.
 *
 * Why this exists
 * ---------------
 * The authenticated session token is written to localStorage under "token"
 * by src/contexts/AuthContext.jsx when a user logs in.
 *
 * Most of the app talks to the backend through src/services/apiClient.js, whose
 * request interceptor attaches `Authorization: Bearer <token>` automatically.
 * Several Maintenance screens call `fetch()` directly instead, so that
 * interceptor never runs for them and every one of those requests reached the
 * backend unauthenticated -> HTTP 401 -> "Unable to load maintenance ...".
 *
 * Reading the storage keys in one place keeps a single source of truth for
 * which key holds the live token, so the direct-fetch screens cannot drift
 * away from the axios interceptor again.
 *
 * This does not weaken authentication: the backend still verifies the token,
 * and a missing token simply yields 401 exactly as before.
 */

const TOKEN_KEYS = [
  ['localStorage', 'token'],
  ['localStorage', 'accessToken'],
  ['sessionStorage', 'token'],
  ['sessionStorage', 'accessToken']
];

const safeGet = (storeName, key) => {
  try {
    if (typeof window === 'undefined') return null;
    const store = window[storeName];
    return store ? store.getItem(key) : null;
  } catch {
    return null;
  }
};

/** Returns the current session token, or null when not signed in. */
export function getMaintenanceToken() {
  for (const [storeName, key] of TOKEN_KEYS) {
    const value = safeGet(storeName, key);
    if (value) return value;
  }
  return null;
}

/**
 * Merges the bearer header into an existing headers object.
 * @param {object} existing headers supplied by the caller (caller wins)
 * @returns {object} headers including Authorization when a token exists
 */
export function withMaintenanceAuth(existing = {}) {
  const token = getMaintenanceToken();
  if (!token) return { ...existing };
  if (existing && existing.Authorization) return { ...existing };
  return { ...existing, Authorization: `Bearer ${token}` };
}

export default getMaintenanceToken;
