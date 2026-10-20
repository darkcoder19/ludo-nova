// GET — the signed-in user. Doubles as the activity heartbeat (updates last_active_at).
import { currentUser, db, json, publicUser } from './_lib';

export async function GET(req: Request) {
  const user = await currentUser(req);
  if (!user) return json({ user: null }, 401);
  await db(`ludo_users?id=eq.${user.id}`, { method: 'PATCH', body: JSON.stringify({ last_active_at: new Date().toISOString() }) });
  return json({ user: publicUser(user) });
}
