// Rooms over WebRTC (PeerJS free broker). The host's browser is the game server; guests send actions to it.
import Peer, { type DataConnection } from 'peerjs';
import type { GameState } from './engine';
import { GameHost, type Action } from './host';

const PREFIX = 'ludonova-v1-';
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const makeCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export interface Emote { from: string; emoji: string; id: number }
export type Status = 'connecting' | 'online' | 'reconnecting' | 'closed';

type HostMsg = { t: 'state'; s: GameState } | { t: 'emote'; e: Emote } | { t: 'full' };
type GuestMsg = { t: 'hello'; id: string; name: string; avatar: string } | { t: 'act'; a: Action } | { t: 'emote'; emoji: string };

export interface Session {
  code: string;
  myId: string;
  local: boolean;
  act(a: Action): void;
  emote(emoji: string): void;
  leave(): void;
}

export interface Handlers {
  onState(s: GameState): void;
  onEmote(e: Emote): void;
  onStatus(st: Status, msg?: string): void;
}

let emoteSeq = 1;

function createHostCore(myId: string, name: string, avatar: string, h: Handlers, broadcast: (m: HostMsg) => void) {
  const host = new GameHost(myId, name, avatar, (s) => { h.onState(s); broadcast({ t: 'state', s }); });
  const emote = (from: string, emoji: string) => {
    const e = { from, emoji, id: emoteSeq++ };
    h.onEmote(e); broadcast({ t: 'emote', e });
  };
  return { host, emote };
}

/** Offline game against bots — same engine, no network. */
export function localGame(myId: string, name: string, avatar: string, bots: number, mode: 'classic' | 'quick', h: Handlers): Session {
  const { host, emote } = createHostCore(myId, name, avatar, h, () => {});
  host.handle(myId, { t: 'mode', mode });
  for (let i = 0; i < bots; i++) host.handle(myId, { t: 'addBot' });
  host.handle(myId, { t: 'start' });
  h.onStatus('online');
  return { code: 'SOLO', myId, local: true, act: (a) => host.handle(myId, a), emote: (e) => emote(myId, e), leave: () => host.dispose() };
}

export function hostRoom(myId: string, name: string, avatar: string, h: Handlers, onCode: (c: string) => void): Session {
  const conns = new Map<DataConnection, string>();
  const broadcast = (m: HostMsg) => conns.forEach((_, c) => c.open && c.send(m));
  const { host, emote } = createHostCore(myId, name, avatar, h, broadcast);
  let peer: Peer;
  let closed = false;
  const session: Session = {
    code: '', myId, local: false,
    act: (a) => host.handle(myId, a),
    emote: (e) => emote(myId, e),
    leave: () => { closed = true; host.dispose(); peer?.destroy(); },
  };

  const open = (attempt = 0) => {
    const code = makeCode();
    peer = new Peer(PREFIX + code);
    h.onStatus('connecting');
    peer.on('open', () => { session.code = code; onCode(code); h.onStatus('online'); });
    peer.on('error', (err) => {
      if (closed) return;
      if (err.type === 'unavailable-id' && attempt < 5) { peer.destroy(); open(attempt + 1); return; }
      if (err.type === 'peer-unavailable') return;
      h.onStatus('reconnecting', 'Connection trouble — retrying…');
    });
    peer.on('disconnected', () => { if (!closed) setTimeout(() => !closed && !peer.destroyed && peer.reconnect(), 1500); });
    peer.on('connection', (conn) => {
      conn.on('data', (raw) => {
        const m = raw as GuestMsg;
        if (m.t === 'hello') {
          if (!host.join(m.id, m.name, m.avatar)) { conn.send({ t: 'full' }); setTimeout(() => conn.close(), 300); return; }
          conns.set(conn, m.id);
          conn.send({ t: 'state', s: host.state });
          host.emit();
          return;
        }
        const id = conns.get(conn);
        if (!id) return;
        if (m.t === 'act') host.handle(id, m.a);
        if (m.t === 'emote') emote(id, String(m.emoji).slice(0, 80));
      });
      conn.on('close', () => {
        const id = conns.get(conn);
        conns.delete(conn);
        if (id && ![...conns.values()].includes(id)) host.setConnected(id, false);
      });
    });
  };
  open();
  return session;
}

export function joinRoom(code: string, myId: string, name: string, avatar: string, h: Handlers): Session {
  const peer = new Peer();
  let conn: DataConnection | null = null;
  let closed = false;
  let gotState = false;
  let retries = 0;

  const connect = () => {
    if (closed) return;
    conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
    conn.on('open', () => { retries = 0; conn!.send({ t: 'hello', id: myId, name, avatar } satisfies GuestMsg); });
    conn.on('data', (raw) => {
      const m = raw as HostMsg;
      if (m.t === 'state') { gotState = true; h.onStatus('online'); h.onState(m.s); }
      if (m.t === 'emote') h.onEmote(m.e);
      if (m.t === 'full') { closed = true; h.onStatus('closed', 'That room is full or already playing.'); }
    });
    conn.on('close', () => {
      if (closed) return;
      h.onStatus('reconnecting', 'Lost the host — reconnecting…');
      if (retries++ < 20) setTimeout(connect, 2000);
      else h.onStatus('closed', 'The host left the room.');
    });
  };

  h.onStatus('connecting');
  peer.on('open', connect);
  peer.on('error', (err) => {
    if (closed) return;
    if (err.type === 'peer-unavailable') {
      if (!gotState) { closed = true; h.onStatus('closed', `No room found with code ${code.toUpperCase()}.`); }
      else if (retries++ < 20) setTimeout(connect, 2000);
      else h.onStatus('closed', 'The host left the room.');
      return;
    }
    h.onStatus('reconnecting', 'Connection trouble — retrying…');
  });
  peer.on('disconnected', () => { if (!closed) setTimeout(() => !closed && !peer.destroyed && peer.reconnect(), 1500); });

  const send = (m: GuestMsg) => conn?.open && conn.send(m);
  return {
    code: code.toUpperCase(), myId, local: false,
    act: (a) => send({ t: 'act', a }),
    emote: (emoji) => send({ t: 'emote', emoji }),
    leave: () => { closed = true; peer.destroy(); },
  };
}
