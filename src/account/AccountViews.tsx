import { useEffect, useRef, useState } from 'react';
import { api, goPremium, GOOGLE_CLIENT_ID, hasToken, renderGoogleButton, signOut, useAccount, type Account } from './account';

/** Home-screen account row: Google sign-in, or the signed-in chip with premium / admin actions. */
export function AccountBar({ onAdmin }: { onAdmin(): void }) {
  const me = useAccount();
  const btn = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');

  const restoring = !me && hasToken(); // saved login still loading — don't flash the Google button
  useEffect(() => {
    const el = btn.current;
    if (!me && !restoring && el) renderGoogleButton(el, setErr);
    return () => { if (el) el.innerHTML = ''; };
  }, [me, restoring]);

  if (!GOOGLE_CLIENT_ID) return null;
  if (restoring) return <div key="restoring" className="acct card"><span className="spinner" /> <small className="dim">Signing you in…</small></div>;
  if (!me) {
    return (
      <div key="signed-out" className="acct card">
        <div className="acct-pitch"><b>Save your progress</b><small>Sign in to go ad-free with Premium</small></div>
        <div ref={btn} className="gbtn" />
        {err && <small className="acct-err">{err}</small>}
      </div>
    );
  }
  return (
    <div key="signed-in" className="acct card signed">
      {me.picture ? <img src={me.picture} alt="" referrerPolicy="no-referrer" /> : <span className="acct-dot">{me.email[0].toUpperCase()}</span>}
      <div className="acct-who"><b>{me.name || me.email}</b><small>{me.plan === 'premium' ? '👑 Premium · no ads' : 'Free plan'}</small></div>
      {me.admin && <button className="btn glass xs" onClick={onAdmin}>Admin</button>}
      {me.plan !== 'premium' && <PremiumButton small />}
      <button className="btn ghost xs" onClick={signOut}>Sign out</button>
    </div>
  );
}

// ---- Premium (No Ads) upsell ----
let openSheet: (() => void) | null = null;
/** Opens the upgrade sheet from anywhere. */
export const askUpgrade = () => openSheet?.();

export function PremiumButton({ small = false }: { small?: boolean }) {
  const me = useAccount();
  if (me?.plan === 'premium') return null;
  return (
    <button className={`btn premium ${small ? 'xs' : 'sm'}`} onClick={(e) => { e.stopPropagation(); askUpgrade(); }}>
      {small ? '👑 ₹99/mo' : '👑 Remove ads · ₹99/month'}
    </button>
  );
}

/** Wide "No Ads" banner for home pages. */
export function UpgradeStrip() {
  const me = useAccount();
  if (me?.plan === 'premium') return <div className="up-strip on">👑 Premium · ad-free on every Sarvimo game</div>;
  return (
    <button className="up-strip" onClick={askUpgrade}>
      <span className="up-crown">👑</span>
      <span className="up-txt"><b>No Ads. Just games.</b><small>Premium ₹99/month · every Sarvimo game</small></span>
      <span className="up-cta">Upgrade</span>
    </button>
  );
}

/** Tiny chip for game screens. */
export function NoAdsChip() {
  const me = useAccount();
  if (me?.plan === 'premium') return null;
  return <button className="noads-chip" onClick={askUpgrade}>👑 No Ads</button>;
}

/** The sheet: sign in with Google if needed, then pay ₹99/month via Dodo. Mount once per page. */
export function UpgradeSheet() {
  const me = useAccount();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const btn = useRef<HTMLDivElement>(null);
  useEffect(() => { openSheet = () => { setErr(''); setOpen(true); }; return () => { openSheet = null; }; }, []);
  useEffect(() => {
    const el = btn.current;
    if (open && !me && el) renderGoogleButton(el, setErr);
    return () => { if (el) el.innerHTML = ''; };
  }, [open, me]);
  if (!open) return null;
  const pay = async () => {
    setBusy(true); setErr('');
    try { await goPremium(); } catch (e) { setErr((e as Error).message === 'Already premium' ? 'You are already Premium 👑' : 'Payments are being set up — please try again soon.'); setBusy(false); }
  };
  return (
    <div className="up-ov" onClick={() => setOpen(false)}>
      <div className="up-card" onClick={(e) => e.stopPropagation()}>
        <button className="up-x" onClick={() => setOpen(false)}>✕</button>
        <div className="up-hero">👑</div>
        <h2>Go Premium</h2>
        <p className="up-price"><b>₹99</b>/month</p>
        <ul>
          <li>🚫 No video or banner ads, ever</li>
          <li>⚡ Jump straight into rooms and rematches</li>
          <li>🎮 Works on LudoNova, SeedhiRush, DhandhaKing and every new game</li>
          <li>💛 Supports Sarvimo, made in India</li>
        </ul>
        {me?.plan === 'premium' ? <div className="up-done">You're Premium. Enjoy! 🎉</div>
          : me ? <button className="btn premium big" disabled={busy} onClick={pay}>{busy ? 'Opening checkout…' : 'Pay ₹99/month'}</button>
          : (<><small className="dim">Step 1 · sign in so we remember your plan</small><div ref={btn} className="gbtn" /></>)}
        {err && <small className="acct-err">{err}</small>}
        <small className="dim">Cancel any time. Secure checkout by Dodo Payments.</small>
      </div>
    </div>
  );
}

// ---- Admin dashboard ----
interface Row extends Pick<Account, 'id' | 'email' | 'name' | 'picture' | 'plan'> { plan_source: string | null; created_at: string; last_active_at: string | null }

function seen(iso: string | null) {
  if (!iso) return { label: 'Never', bucket: 'old' };
  const t = new Date(iso);
  const mins = (Date.now() - t.getTime()) / 60000;
  if (mins < 5) return { label: 'Online now', bucket: 'now' };
  const day = (d: Date) => d.toDateString();
  const y = new Date(Date.now() - 864e5);
  const time = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (day(t) === day(new Date())) return { label: `Today, ${time}`, bucket: 'today' };
  if (day(t) === day(y)) return { label: `Yesterday, ${time}`, bucket: 'yesterday' };
  return { label: t.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }), bucket: 'old' };
}

export function AdminDashboard({ onClose }: { onClose(): void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'now' | 'today' | 'yesterday' | 'premium'>('all');

  const load = () => api<{ users: Row[] }>(`${import.meta.env.BASE_URL}api/admin/users`).then((r) => setRows(r.users)).catch((e) => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const setPlan = async (r: Row, plan: 'free' | 'premium') => {
    setRows((rs) => rs!.map((x) => (x.id === r.id ? { ...x, plan, plan_source: 'admin' } : x)));
    try { await api(`${import.meta.env.BASE_URL}api/admin/users`, { method: 'POST', body: JSON.stringify({ userId: r.id, plan }) }); } catch (e) { setErr((e as Error).message); load(); }
  };

  const all = rows ?? [];
  const count = (b: string) => all.filter((r) => seen(r.last_active_at).bucket === b).length;
  const list = all
    .filter((r) => filter === 'all' || (filter === 'premium' ? r.plan === 'premium' : seen(r.last_active_at).bucket === filter || (filter === 'today' && seen(r.last_active_at).bucket === 'now')))
    .filter((r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="screen admin">
      <div className="topbar">
        <button className="btn ghost sm" onClick={onClose}>← Back</button>
        <b>Admin · LudoNova</b>
        <button className="btn ghost sm" onClick={load}>↻</button>
      </div>
      {err && <div className="banner err">{err}</div>}
      <div className="stats">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}><b>{all.length}</b><small>Users</small></button>
        <button className={filter === 'now' ? 'on' : ''} onClick={() => setFilter('now')}><b>{count('now')}</b><small>Online</small></button>
        <button className={filter === 'today' ? 'on' : ''} onClick={() => setFilter('today')}><b>{count('now') + count('today')}</b><small>Today</small></button>
        <button className={filter === 'yesterday' ? 'on' : ''} onClick={() => setFilter('yesterday')}><b>{count('yesterday')}</b><small>Yesterday</small></button>
        <button className={filter === 'premium' ? 'on' : ''} onClick={() => setFilter('premium')}><b>{all.filter((r) => r.plan === 'premium').length}</b><small>Premium</small></button>
      </div>
      <input className="name" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="ulist">
        {!rows && !err && <div className="dim">Loading…</div>}
        {list.map((r) => {
          const s = seen(r.last_active_at);
          return (
            <div key={r.id} className="urow card">
              {r.picture ? <img src={r.picture} alt="" referrerPolicy="no-referrer" /> : <span className="acct-dot">{r.email[0].toUpperCase()}</span>}
              <div className="uinfo">
                <b>{r.name || r.email.split('@')[0]}</b>
                <small>{r.email}</small>
                <small className={`seen ${s.bucket}`}>● {s.label}</small>
              </div>
              <div className="seg plan">
                <button className={r.plan === 'free' ? 'on' : ''} onClick={() => setPlan(r, 'free')}>Free</button>
                <button className={r.plan === 'premium' ? 'on prem' : ''} onClick={() => setPlan(r, 'premium')}>Premium</button>
              </div>
            </div>
          );
        })}
        {rows && !list.length && <div className="dim">No players here yet.</div>}
      </div>
    </div>
  );
}
