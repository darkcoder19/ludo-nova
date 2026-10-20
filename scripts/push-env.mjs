// Copies every KEY=value in .env.local into the linked Vercel project (production), without printing values.
// Usage: npx vercel login && npx vercel link && node scripts/push-env.mjs
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const lines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean);
for (const [, key, value] of lines) {
  if (!value) { console.log(`- ${key} is empty, skipped`); continue; }
  spawnSync('npx', ['--yes', 'vercel@39.1.1', 'env', 'rm', key, 'production', '--yes'], { stdio: 'ignore', shell: true });
  const r = spawnSync('npx', ['--yes', 'vercel@39.1.1', 'env', 'add', key, 'production'], { input: value, stdio: ['pipe', 'ignore', 'pipe'], shell: true });
  console.log(r.status === 0 ? `+ ${key}` : `! ${key} failed: ${r.stderr?.toString().trim().split('\n').pop()}`);
}
console.log('Done. Redeploy (git push or `npx vercel --prod`) so the new values take effect.');
