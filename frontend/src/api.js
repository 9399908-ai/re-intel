import { API_URL } from './config';

const AUTH_KEY = 'reintel_auth';

export function loadAuth() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    return auth?.token && auth?.user ? auth : null;
  } catch {
    return null;
  }
}

export function saveAuth(auth) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

// Fetch wrapper: attaches the JWT, throws on errors, logs out on 401
export async function authFetch(path, options = {}) {
  const auth = loadAuth();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && auth) {
    clearAuth();
    window.location.reload();
    throw new Error('Session expired');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}
