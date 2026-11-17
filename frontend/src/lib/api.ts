import axios from "axios";

declare global {
  interface Window {
    __PLANNEROT_CONFIG__?: { API_URL?: string };
  }
}

export function apiBase(): string {
  if (typeof window !== "undefined" && window.__PLANNEROT_CONFIG__?.API_URL) {
    return window.__PLANNEROT_CONFIG__.API_URL.replace(/\/$/, "");
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

const ACCESS_KEY = "plannerot_access";
const REFRESH_KEY = "plannerot_refresh";

export function getAccess(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}
export function getRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}
export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export const api = axios.create({ baseURL: apiBase() + "/api" });

api.interceptors.request.use((config) => {
  const t = getAccess();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const rt = getRefresh();
  if (!rt) return null;
  try {
    const r = await axios.post(apiBase() + "/api/auth/refresh", null, {
      params: { refresh_token: rt },
    });
    setTokens(r.data.access_token, r.data.refresh_token);
    return r.data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && getRefresh()) {
      original._retry = true;
      refreshing = refreshing || tryRefresh().finally(() => { refreshing = null; });
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function apiError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const d = e.response?.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d) && d[0]?.msg) return d[0].msg;
    return e.message;
  }
  return String(e);
}