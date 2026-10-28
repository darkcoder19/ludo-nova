// Shared helpers for the serverless routes. Files starting with "_" are not routes on Vercel.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

// Comma-separated list in ADMIN_EMAILS (ADMIN_EMAIL still accepted).
export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'yashmaheshwari2002@gmail.com,support@sarvimo.com')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
for (const e of ['yashmaheshwari2002@gmail.com', 'support@sarvimo.com']) if (!ADMIN_EMAILS.includes(e)) ADMIN_EMAILS.push(e);

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  plan: 'free' | 'premium';
  plan_source: string | null;
  subscription_id: string | null;
  created_at: string;
  last_active_at: string | null;
}

/** Minimal PostgREST client using the service-role key (server only). */
export async function db<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      // New sb_secret_ keys go only in apikey; legacy service_role JWTs also need the bearer header.
      ...(key.startsWith('eyJ') ? { authorization: `Bearer ${key}` } : {}),
      'content-type': 'application/json',
      ...(init.prefer ? { prefer: init.prefer } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`db ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

// ---- session tokens: base64url(payload).hmac ----
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const sign = (data: string) => createHmac('sha256', env('SESSION_SECRET')).update(data).digest('base64url');

export function issueToken(uid: string) {
  const body = b64(JSON.stringify({ uid, exp: Date.now() + 60 * 864e5 }));
  return `${body}.${sign(body)}`;
}

export function readToken(req: Request): string | null {
  const raw = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(body, 'base64url').toString());
    return typeof uid === 'string' && exp > Date.now() ? uid : null;
  } catch {
    return null;
  }
}

export async function currentUser(req: Request): Promise<UserRow | null> {
  const uid = readToken(req);
  if (!uid) return null;
  const rows = await db<UserRow[]>(`ludo_users?id=eq.${encodeURIComponent(uid)}&select=*`);
  return rows[0] ?? null;
}

export const isAdmin = (u: UserRow | null) => !!u && ADMIN_EMAILS.includes(u.email.toLowerCase());

export const publicUser = (u: UserRow) => ({
  id: u.id, email: u.email, name: u.name, picture: u.picture, plan: u.plan, admin: isAdmin(u),
});
