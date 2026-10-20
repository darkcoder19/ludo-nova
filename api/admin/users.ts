// GET — every player, newest activity first. Admin only.
import { currentUser, db, isAdmin, json, type UserRow } from '../_lib';

export async function GET(req: Request) {
  const me = await currentUser(req);
  if (!isAdmin(me)) return json({ error: 'Forbidden' }, 403);
  const users = await db<UserRow[]>('ludo_users?select=id,email,name,picture,plan,plan_source,created_at,last_active_at&order=last_active_at.desc.nullslast&limit=1000');
  return json({ users });
}

// POST { userId, plan } — move a player between free and premium by hand.
export async function POST(req: Request) {
  const me = await currentUser(req);
  if (!isAdmin(me)) return json({ error: 'Forbidden' }, 403);
  const { userId, plan } = (await req.json().catch(() => ({}))) as { userId?: string; plan?: string };
  if (!userId || (plan !== 'free' && plan !== 'premium')) return json({ error: 'Bad request' }, 400);
  const [user] = await db<UserRow[]>(`ludo_users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ plan, plan_source: 'admin' }),
  });
  return json({ user });
}
