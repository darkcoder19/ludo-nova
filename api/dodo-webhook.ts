// Dodo webhook: the only thing (besides the admin) that flips a player to premium or back to free.
import DodoPayments from 'dodopayments';
import { db, env, json } from './_lib';

type Sub = { subscription_id: string; status: string; customer?: { email?: string }; metadata?: Record<string, string> | null };

export async function POST(req: Request) {
  const raw = await req.text();
  let event: { type: string; data: Sub };
  try {
    const verifier = new DodoPayments({
      bearerToken: process.env.DODO_PAYMENTS_API_KEY || 'verify-only',
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
      webhookKey: env('DODO_PAYMENTS_WEBHOOK_KEY'),
    });
    event = verifier.webhooks.unwrap(raw, {
      headers: {
        'webhook-id': req.headers.get('webhook-id') ?? '',
        'webhook-signature': req.headers.get('webhook-signature') ?? '',
        'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
      },
    }) as unknown as { type: string; data: Sub };
  } catch {
    return json({ error: 'Invalid signature' }, 401);
  }

  if (!event.type.startsWith('subscription.')) return json({ received: true });
  const d = event.data;
  // Sarvimo shares this Dodo account; ignore subscriptions that aren't ours.
  if (d.metadata?.app && d.metadata.app !== 'ludonova') return json({ received: true });

  const premium = d.status === 'active' || d.status === 'on_hold';
  const patch = JSON.stringify({ plan: premium ? 'premium' : 'free', plan_source: 'dodo', subscription_id: d.subscription_id });

  const uid = d.metadata?.ludo_user_id;
  const email = d.customer?.email?.toLowerCase();
  const filter = uid ? `id=eq.${encodeURIComponent(uid)}` : email ? `email=eq.${encodeURIComponent(email)}` : null;
  if (!filter) return json({ received: true });
  try {
    await db(`ludo_users?${filter}`, { method: 'PATCH', body: patch });
  } catch (e) {
    console.error('[ludo billing]', e);
    return json({ error: 'retry' }, 500);
  }
  return json({ received: true });
}
