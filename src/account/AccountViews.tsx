import { useEffect, useRef, useState } from 'react';
import { api, goPremium, GOOGLE_CLIENT_ID, renderGoogleButton, signOut, useAccount, type Account } from './account';

/** Home-screen account row: Google sign-in, or the signed-in chip with premium / admin actions. */
export function AccountBar({ onAdmin }: { onAdmin(): void }) {
  const me = useAccount();
  const btn = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!me && btn.current) renderGoogleButton(btn.current, setErr);
  }, [me]);

  if (!GOOGLE_CLIENT_ID) return null;
  if (!me) {
    return (
      <div className="acct card">
        <div className="acct-pitch"><b>Save your progress</b><small>Sign in to go ad-free with Premium</small></div>
        <div ref={btn} className="gbtn" />
        {err && <small className="acct-err">{err}</small>}
      </div>
    );
  }
  return (
    <div className="acct card signed">
      {me.picture ? <img src={me.picture} alt="" referrerPolicy="no-referrer" /> : <span className="acct-dot">{me.email[0].toUpperCase()}</span>}
      <div className="acct-who"><b>{me.name || me.email}</b><small>{me.plan === 'premium' ? '👑 Premium · no ads' : 'Free plan'}</small></div>
      {me.admin && <button className="btn glass xs" onClick={onAdmin}>Admin</button>}
      {me.plan !== 'premium' && <PremiumButton small />}
      <button className="btn ghost xs" onClick={signOut}>Sign out</button>
    </div>
  );
}

export function PremiumButton({ small = false }: { small?: boolean }) {
  const me = useAccount();
  const [busy, setBusy] = useState(false);
  if (!GOOGLE_CLIENT_ID || me?.plan === 'premium') return null;
  const go = async () => {
    if (!me) { alert('Sign in with Google on the home screen first, then upgrade.'); return; }
    setBusy(true);
    try { await goPremium(); } catch (e) { alert((e as Error).message); setBusy(false); }
  };
  return (
    <button className={`btn premium ${small ? 'xs' : 'sm'}`} disabled={busy} onClick={go}>
      {busy ? '…' : small ? '👑 ₹99/mo' : '👑 Remove ads · ₹99/month'}
    </button>
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

  const load = () => api<{ users: Row[] }>('/api/admin/users').then((r) => setRows(r.users)).catch((e) => setErr(e.message));
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);

  const setPlan = async (r: Row, plan: 'free' | 'premium') => {
    setRows((rs) => rs!.map((x) => (x.id === r.id ? { ...x, plan, plan_source: 'admin' } : x)));
    try { await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ userId: r.id, plan }) }); } catch (e) { setErr((e as Error).message); load(); }
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
