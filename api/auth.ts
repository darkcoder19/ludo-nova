// POST { credential } — a Google Identity Services ID token. Verifies it, upserts the user, returns a session.
import { db, env, issueToken, json, publicUser, type UserRow } from './_lib.js';

export async function POST(req: Request) {
  const { credential } = (await req.json().catch(() => ({}))) as { credential?: string };
  if (!credential) return json({ error: 'Missing credential' }, 400);

  const info = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!info.ok) return json({ error: 'Invalid Google token' }, 401);
  const t = (await info.json()) as { aud: string; sub: string; email: string; email_verified: string | boolean; name?: string; picture?: string };
  if (t.aud !== env('GOOGLE_CLIENT_ID')) return json({ error: 'Token not for this app' }, 401);
  if (!(t.email_verified === true || t.email_verified === 'true')) return json({ error: 'Email not verified' }, 401);

  const now = new Date().toISOString();
  const [user] = await db<UserRow[]>('ludo_users?on_conflict=email', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    body: JSON.stringify({ google_sub: t.sub, email: t.email.toLowerCase(), name: t.name ?? null, picture: t.picture ?? null, last_active_at: now }),
  });
  return json({ token: issueToken(user.id), user: publicUser(user) });
}
