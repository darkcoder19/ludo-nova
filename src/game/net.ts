// LudoNova rooms. The host's browser is the game server; guests send actions to it (see shared/link.ts).
import { openGuest, openHost, type GuestLink, type HostLink, type Status } from '../shared/link';
import type { GameState } from './engine';
import { GameHost, type Action } from './host';

const PREFIX = 'ludonova-v1-';
export type { Status };

export interface Emote { from: string; emoji: string; id: number }

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
  const conns = new Map<GuestLink, string>();
  let link: HostLink | null = null; // the host emits its first state before the link exists
  const { host, emote } = createHostCore(myId, name, avatar, h, (m) => link?.broadcast(m, conns.keys()));
  const session: Session = {
    code: '', myId, local: false,
    act: (a) => host.handle(myId, a),
    emote: (e) => emote(myId, e),
    leave: () => { host.dispose(); link?.close(); },
  };
  link = openHost(PREFIX, {
    onCode: (code) => { session.code = code; onCode(code); },
    onStatus: h.onStatus,
    onData: (l, raw) => {
      const m = raw as GuestMsg;
      if (m.t === 'hello') {
        if (!host.join(m.id, m.name, m.avatar)) { l.send({ t: 'full' } satisfies HostMsg); setTimeout(() => l.close(), 300); return; }
        conns.set(l, m.id);
        l.send({ t: 'state', s: host.state } satisfies HostMsg);
        host.emit();
        return;
      }
      const id = conns.get(l);
      if (!id) return;
      if (m.t === 'act') host.handle(id, m.a);
      if (m.t === 'emote') emote(id, String(m.emoji).slice(0, 80));
    },
    onClose: (l) => {
      const id = conns.get(l);
      conns.delete(l);
      if (id && ![...conns.values()].includes(id)) host.setConnected(id, false);
    },
  });
  return session;
}

export function joinRoom(code: string, myId: string, name: string, avatar: string, h: Handlers): Session {
  let seated = false;
  const link = openGuest(PREFIX, code, myId, { t: 'hello', id: myId, name, avatar } satisfies GuestMsg, {
    onStatus: h.onStatus,
    onFail: (msg) => h.onStatus('closed', msg),
    onData: (raw) => {
      const m = raw as HostMsg;
      if (m.t === 'state') {
        if (m.s.players.some((p) => p.id === myId)) seated = true;
        else if (seated && m.s.phase === 'lobby') { link.close(); h.onStatus('closed', 'The host removed you from the room.'); return; }
        h.onStatus('online'); h.onState(m.s);
      }
      if (m.t === 'emote') h.onEmote(m.e);
      if (m.t === 'full') { link.close(); h.onStatus('closed', 'That room is full or already playing.'); }
    },
  });
  const send = (m: GuestMsg) => link.send(m);
  return {
    code: code.toUpperCase(), myId, local: false,
    act: (a) => send({ t: 'act', a }),
    emote: (emoji) => send({ t: 'emote', emoji }),
    leave: () => link.close(),
  };
}
