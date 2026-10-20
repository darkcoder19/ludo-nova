// Signed-in account (optional — guests can always play, with ads).
import { useEffect, useState } from 'react';
import { setPremium } from '../ads/premium';

export interface Account { id: string; email: string; name: string | null; picture: string | null; plan: 'free' | 'premium'; admin: boolean }

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const KEY = 'ln-token';
const token = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const setToken = (t: string | null) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

let current: Account | null = null;
const subs = new Set<(a: Account | null) => void>();
function publish(a: Account | null) {
  current = a;
  setPremium(a?.plan === 'premium');
  subs.forEach((f) => f(a));
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = token();
  const res = await fetch(path, { ...init, headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}), ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `HTTP ${res.status}`), { status: res.status });
  return body as T;
}

/** Fetches the account and records activity. Called on load and every 2 minutes. */
export async function refresh() {
  if (!token()) { publish(null); return; }
  try {
    const { user } = await api<{ user: Account }>('/api/me');
    publish(user);
  } catch (e) {
    if ((e as { status?: number }).status === 401) { setToken(null); publish(null); }
  }
}

export async function signInWithGoogle(credential: string) {
  const { token: t, user } = await api<{ token: string; user: Account }>('/api/auth', { method: 'POST', body: JSON.stringify({ credential }) });
  setToken(t);
  publish(user);
}

export function signOut() { setToken(null); publish(null); (window as any).google?.accounts.id.disableAutoSelect(); }

export async function goPremium() {
  const { url } = await api<{ url: string }>('/api/checkout', { method: 'POST' });
  location.href = url;
}

let started = false;
export function useAccount() {
  const [a, setA] = useState<Account | null>(current);
  useEffect(() => {
    subs.add(setA);
    if (!started) {
      started = true;
      refresh();
      setInterval(refresh, 120000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
    }
    return () => { subs.delete(setA); };
  }, []);
  return a;
}

// ---- Google Identity Services button ----
let gisLoading: Promise<void> | null = null;
function loadGis() {
  gisLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return gisLoading;
}

export async function renderGoogleButton(el: HTMLElement, onError: (m: string) => void) {
  if (!GOOGLE_CLIENT_ID) return;
  await loadGis();
  const g = (window as any).google;
  g.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (r: { credential: string }) => signInWithGoogle(r.credential).catch((e) => onError(e.message)),
  });
  g.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: Math.min(el.clientWidth || 300, 360) });
}
