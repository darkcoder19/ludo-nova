// How room messages travel between the host's browser and its guests.
// 1. Direct WebRTC (PeerJS): free and fast, but it fails between many home/mobile networks (CGNAT).
// 2. Relay through Supabase Realtime (a websocket on 443): works on every network.
// The host listens on both; a guest tries direct first and switches to the relay if that stalls.
import { RealtimeClient } from '@supabase/realtime-js';
import Peer, { type DataConnection, type PeerOptions } from 'peerjs';

export type Status = 'connecting' | 'online' | 'reconnecting' | 'closed';

const env = import.meta.env;
const RELAY_URL: string = env.VITE_SUPABASE_URL || 'https://gxyubgooamqcdlfurklm.supabase.co';
// A publishable key is meant to ship in browsers; it only allows what the project's settings allow.
const RELAY_KEY: string = env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_apFDa7iRZD3W6aub9eKgCQ_xcMO4ilK';
const devFlag = (k: string) => !!env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has(k);
/** Dev only: `?localrelay` relays between tabs of this browser, `?nop2p` makes a guest skip the direct link. */
const RELAY: 'supabase' | 'local' | null = devFlag('localrelay') ? 'local' : RELAY_KEY ? 'supabase' : null;
const NO_P2P = devFlag('nop2p');
export const relayReady = () => RELAY !== null;

// PeerJS's built-in TURN servers no longer answer, so only list STUN servers that do.
const PEER_OPTS: PeerOptions = {
  config: { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:stun.cloudflare.com:3478' }] },
};

const DIRECT_GRACE = 5000; // how long a guest waits on the direct link before using the relay
const PING_EVERY = 8000;
const SILENT_AFTER = 25000; // no word for this long = that side is gone (relay only)
const GIVE_UP_AFTER = 90000;

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

// ---------------- relay ----------------
/** Relay envelope: `f` is the sender ('H' = host), `to` targets one guest. */
interface Env { f: string; to?: string; m: { t: string } & Record<string, unknown> }
interface RelayChan { send(e: Env): void; close(): void }

let client: RealtimeClient | null = null;
const rt = () => (client ??= new RealtimeClient(`${RELAY_URL}/realtime/v1`, { params: { apikey: RELAY_KEY, eventsPerSecond: 20 } }));

function openRelay(topic: string, onMsg: (e: Env) => void, onUp: (up: boolean) => void): RelayChan {
  if (RELAY === 'local') {
    const bc = new BroadcastChannel(`relay:${topic}`);
    bc.onmessage = (ev) => onMsg(ev.data as Env);
    setTimeout(() => onUp(true), 50);
    return { send: (e) => bc.postMessage(e), close: () => bc.close() };
  }
  const ch = rt().channel(topic, { config: { broadcast: { self: false, ack: false } } });
  ch.on('broadcast', { event: 'm' }, ({ payload }) => onMsg(payload as Env));
  ch.subscribe((st) => {
    if (st === 'SUBSCRIBED') onUp(true);
    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') onUp(false);
  });
  return { send: (e) => void ch.send({ type: 'broadcast', event: 'm', payload: e }), close: () => void rt().removeChannel(ch) };
}

// ---------------- host ----------------
export interface GuestLink { via: 'direct' | 'relay'; send(m: unknown): void; close(): void }
export interface HostEvents {
  onCode(code: string): void;
  onStatus(st: Status, msg?: string): void;
  onData(link: GuestLink, m: unknown): void;
  onClose(link: GuestLink): void;
}
export interface HostLink { broadcast(m: unknown, to: Iterable<GuestLink>): void; close(): void }

export function openHost(prefix: string, ev: HostEvents): HostLink {
  let closed = false, ready = false, code = '';
  let peer: Peer | null = null, relay: RelayChan | null = null, relayUp = false;
  const relayGuests = new Map<string, { link: GuestLink; seen: number }>();

  const isReady = () => {
    if (closed) return;
    if (!ready) { ready = true; ev.onCode(code); }
    ev.onStatus('online');
  };
  const dropRelayGuest = (id: string) => {
    const g = relayGuests.get(id);
    if (!g) return;
    relayGuests.delete(id);
    ev.onClose(g.link);
  };

  const onRelay = (e: Env) => {
    if (!e?.f || e.f === 'H' || !e.m) return;
    let g = relayGuests.get(e.f);
    if (!g) {
      if (e.m.t !== 'hello') return;
      const id = e.f;
      const link: GuestLink = { via: 'relay', send: (m) => relay?.send({ f: 'H', to: id, m: m as Env['m'] }), close: () => { relayGuests.delete(id); } };
      g = { link, seen: Date.now() };
      relayGuests.set(id, g);
    }
    g.seen = Date.now();
    if (e.m.t === 'ping') return;
    if (e.m.t === 'bye') { dropRelayGuest(e.f); return; }
    ev.onData(g.link, e.m);
  };

  const start = (attempt: number) => {
    code = makeCode();
    peer = new Peer(prefix + code, PEER_OPTS);
    peer.on('open', isReady);
    peer.on('error', (err) => {
      if (closed) return;
      if (err.type === 'unavailable-id') {
        peer?.destroy(); peer = null;
        if (!ready && attempt < 5) { relay?.close(); relay = null; start(attempt + 1); }
        return;
      }
      if (err.type === 'peer-unavailable') return;
      if (!relayUp) ev.onStatus('reconnecting', 'Connection trouble — retrying…');
    });
    peer.on('disconnected', () => { if (!closed) setTimeout(() => peer && !closed && !peer.destroyed && peer.reconnect(), 1500); });
    peer.on('connection', (conn: DataConnection) => {
      const link: GuestLink = { via: 'direct', send: (m) => { if (conn.open) conn.send(m); }, close: () => conn.close() };
      conn.on('data', (m) => ev.onData(link, m));
      conn.on('close', () => ev.onClose(link));
    });
    if (RELAY) relay = openRelay(prefix + code, onRelay, (up) => { relayUp = up; if (up) isReady(); });
  };

  const tick = setInterval(() => {
    if (!relay || !relayGuests.size) return;
    relay.send({ f: 'H', m: { t: 'ping' } });
    const now = Date.now();
    [...relayGuests].forEach(([id, g]) => { if (now - g.seen > SILENT_AFTER) dropRelayGuest(id); });
  }, PING_EVERY);

  ev.onStatus('connecting');
  start(0);
  return {
    broadcast: (m, to) => {
      let relayed = false;
      for (const l of to) {
        if (l.via === 'direct') l.send(m);
        else relayed = true;
      }
      // One relay message reaches every relay guest at once.
      if (relayed) relay?.send({ f: 'H', m: m as Env['m'] });
    },
    close: () => { closed = true; clearInterval(tick); peer?.destroy(); relay?.close(); },
  };
}

// ---------------- guest ----------------
export interface GuestEvents {
  onData(m: unknown): void;
  onStatus(st: Status, msg?: string): void;
  /** The guest could not get in (or lost the host for good). */
  onFail(msg: string): void;
}
export interface GuestSide { send(m: unknown): void; close(): void }

export function openGuest(prefix: string, rawCode: string, myId: string, hello: unknown, ev: GuestEvents): GuestSide {
  const code = rawCode.toUpperCase();
  let closed = false, mode: 'direct' | 'relay' = 'direct';
  let heard = false, lastHeard = 0, hostMissing = false, retries = 0;
  let peer: Peer | null = null, conn: DataConnection | null = null, relay: RelayChan | null = null;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(() => !closed && fn(), ms));

  const fail = (msg: string) => { if (closed) return; close(); ev.onFail(msg); };
  const fromHost = (m: unknown) => {
    if (closed || !m || typeof m !== 'object') return;
    heard = true; lastHeard = Date.now();
    const t = (m as { t?: string }).t;
    if (t === 'ping') return;
    if (t === 'bye') { ev.onStatus('reconnecting', 'The host left — waiting for them…'); return; }
    ev.onData(m);
  };

  const useRelay = () => {
    if (closed || mode === 'relay') return;
    if (!RELAY) {
      if (heard) { ev.onStatus('reconnecting', 'Lost the host — reconnecting…'); if (retries++ < 20) later(2000, direct); else fail('The host left the room.'); }
      else if (hostMissing) fail(`No room found with code ${code}.`);
      else fail('Couldn’t reach the host’s device from your network. Try again, or play on the same Wi-Fi.');
      return;
    }
    mode = 'relay';
    peer?.destroy(); peer = null; conn = null;
    ev.onStatus(heard ? 'reconnecting' : 'connecting', heard ? 'Switching to the relay…' : 'Connecting through the relay…');
    const sinceStart = Date.now();
    relay = openRelay(prefix + code, (e) => { if (e?.f === 'H' && (!e.to || e.to === myId)) fromHost(e.m); }, (up) => { if (up) relay?.send({ f: myId, m: hello as Env['m'] }); });
    // Keep saying hello until the host answers; then ping so each side knows the other is still there.
    const beat = setInterval(() => {
      if (closed) { clearInterval(beat); return; }
      const now = Date.now();
      if (!heard || now - lastHeard > SILENT_AFTER) relay?.send({ f: myId, m: hello as Env['m'] });
      else relay?.send({ f: myId, m: { t: 'ping' } });
      if (!heard && now - sinceStart > 9000) { clearInterval(beat); fail(`No room found with code ${code}.`); return; }
      if (heard && now - lastHeard > SILENT_AFTER) ev.onStatus('reconnecting', 'Lost the host — reconnecting…');
      if (heard && now - lastHeard > GIVE_UP_AFTER) { clearInterval(beat); fail('The host left the room.'); }
    }, 3000);
    timers.push(beat as unknown as ReturnType<typeof setTimeout>);
  };

  function direct() {
    if (closed || mode === 'relay') return;
    if (!peer || peer.destroyed) {
      peer = new Peer(PEER_OPTS);
      peer.on('open', connect);
      peer.on('error', (err) => {
        if (closed || mode === 'relay') return;
        if (err.type === 'peer-unavailable') hostMissing = true;
        useRelay();
      });
      peer.on('disconnected', () => { if (!closed && mode === 'direct') setTimeout(() => peer && !peer.destroyed && peer.reconnect(), 1500); });
    } else connect();
    // A direct link that hasn't delivered anything by now is stuck (usually NAT): move to the relay.
    const mark = Date.now();
    later(DIRECT_GRACE, () => { if (mode === 'direct' && (!heard || lastHeard < mark)) useRelay(); });
  }
  function connect() {
    if (closed || mode === 'relay' || !peer) return;
    conn = peer.connect(prefix + code, { reliable: true });
    conn.on('open', () => conn?.send(hello));
    conn.on('data', fromHost);
    conn.on('close', () => { if (!closed && mode === 'direct') useRelay(); });
  }

  function close() {
    if (closed) return;
    closed = true;
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    if (relay) { relay.send({ f: myId, m: { t: 'bye' } }); const r = relay; setTimeout(() => r.close(), 200); }
    peer?.destroy();
  }

  ev.onStatus('connecting');
  // Start on the next tick so the caller has stored this session before any failure is reported.
  setTimeout(() => { if (closed) return; if (NO_P2P) useRelay(); else direct(); }, 0);
  return {
    send: (m) => {
      if (mode === 'direct') { if (conn?.open) conn.send(m); }
      else relay?.send({ f: myId, m: m as Env['m'] });
    },
    close,
  };
}
