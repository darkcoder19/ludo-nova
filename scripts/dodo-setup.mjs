// One-off: creates the "LudoNova Premium" ₹99/month product and the webhook in Sarvimo's Dodo
// account (key read from Sarvimo's .env.local), then writes ids/secret to ./.env.local. Secrets never printed.
import fs from 'node:fs';
import DodoPayments from 'dodopayments';

const read = (p) => Object.fromEntries(
  (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const src = read(process.argv[2]);
const apiKey = src.DODO_PAYMENTS_API_KEY;
const environment = src.DODO_PAYMENTS_ENVIRONMENT === 'live_mode' ? 'live_mode' : 'test_mode';
if (!apiKey) { console.error('No DODO_PAYMENTS_API_KEY in source env'); process.exit(1); }

const client = new DodoPayments({ bearerToken: apiKey, environment });
console.log('Mode:', environment);

const NAME = 'LudoNova Premium (Monthly)';
let productId;
for await (const p of client.products.list()) if (p.name === NAME) productId = p.product_id;
if (productId) console.log('= product exists');
else {
  const p = await client.products.create({
    name: NAME,
    description: 'LudoNova by Sarvimo — no ads, billed monthly.',
    tax_category: 'saas',
    price: {
      type: 'recurring_price', currency: 'INR', price: 9900, discount: 0, purchasing_power_parity: false,
      payment_frequency_count: 1, payment_frequency_interval: 'Month',
      subscription_period_count: 1, subscription_period_interval: 'Month',
    },
  });
  productId = p.product_id;
  console.log('+ created product at ₹99/month');
}

const URL_ = 'https://ludo-nova-bice.vercel.app/api/dodo-webhook';
let hook;
for await (const w of client.webhooks.list()) if (w.url === URL_) hook = w;
if (!hook) {
  hook = await client.webhooks.create({ url: URL_, description: 'LudoNova premium',
    filter_types: ['subscription.active', 'subscription.renewed', 'subscription.on_hold', 'subscription.cancelled', 'subscription.expired', 'subscription.failed', 'subscription.updated'] });
  console.log('+ created webhook');
} else console.log('= webhook exists');
const { secret } = await client.webhooks.retrieveSecret(hook.id);

const out = { DODO_PAYMENTS_ENVIRONMENT: environment, DODO_PAYMENTS_API_KEY: apiKey, DODO_PAYMENTS_WEBHOOK_KEY: secret, DODO_PRODUCT_LUDO_PREMIUM: productId };
let text = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
for (const [k, v] of Object.entries(out)) {
  const re = new RegExp(`^${k}=.*$`, 'm');
  text = re.test(text) ? text.replace(re, `${k}=${v}`) : text + (text && !text.endsWith('\n') ? '\n' : '') + `${k}=${v}\n`;
}
fs.writeFileSync('.env.local', text);
console.log('Wrote 4 values to .env.local (not shown). Product id:', productId);
