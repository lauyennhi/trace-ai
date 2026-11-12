const TOKEN_KEY = "trace_token";

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** Calls the API with the bearer token and unwraps `{success, data}`. Throws ApiError with a Vietnamese message. */
export async function api<T = any>(path: string, options: { method?: string; body?: any } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method || "GET",
      headers: {
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ. Hãy kiểm tra mạng và thử lại.", 0);
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* non-json */ }
  if (res.status === 401 && token && !path.startsWith("/api/auth/login")) onUnauthorized?.();
  if (!res.ok || !json?.success) throw new ApiError(json?.message || `Lỗi máy chủ (${res.status}).`, res.status);
  return json.data !== undefined ? json.data : json;
}

/** Same as api() but returns the full JSON (for endpoints with extra fields such as `unread`). */
export async function apiRaw(path: string, options: { method?: string; body?: any } = {}): Promise<any> {
  const token = getToken();
  const res = await fetch(path, {
    method: options.method || "GET",
    headers: { ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return res.json();
}

/** fetch() with the bearer token attached. */
export const authFetch = (input: string, init: RequestInit = {}) =>
  fetch(input, { ...init, headers: { ...(init.headers || {}), ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) } });
