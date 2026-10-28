// POST — starts a Dodo checkout for LudoNova Premium (₹99/month) and returns its URL.
import DodoPayments from 'dodopayments';
import { currentUser, env, json } from './_lib.js';

export async function POST(req: Request) {
  const user = await currentUser(req);
  if (!user) return json({ error: 'Sign in first' }, 401);
  if (user.plan === 'premium') return json({ error: 'Already premium' }, 400);

  const client = new DodoPayments({
    bearerToken: env('DODO_PAYMENTS_API_KEY'),
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode',
  });
  const origin = new URL(req.url).origin;
  const checkout = await client.checkoutSessions.create({
    product_cart: [{ product_id: env('DODO_PRODUCT_LUDO_PREMIUM'), quantity: 1 }],
    customer: { email: user.email, name: user.name || user.email.split('@')[0] },
    metadata: { ludo_user_id: user.id, app: 'ludonova' },
    return_url: `${origin}/?checkout=success`,
  });
  if (!checkout.checkout_url) return json({ error: 'No checkout link' }, 502);
  return json({ url: checkout.checkout_url });
}
