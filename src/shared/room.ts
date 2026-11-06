// Generic multiplayer rooms for Sarvimo Games. A game supplies pure `Rules`; this file runs the
// lobby, bots, turn timer and networking (see link.ts). The host's browser is the authority.
import { openGuest, openHost, type GuestLink, type HostLink, type Status } from './link';

/** `title` is a badge id the player wears, `skin` their dice skin (cosmetic, shown to everyone). */
export interface Seat { id: string; name: string; avatar: string; bot: boolean; connected: boolean; title?: string; skin?: string }
export interface Look { title?: string; skin?: string }
const cleanLook = (l: Look = {}): Look => ({ title: l.title ? String(l.title).slice(0, 20) : undefined, skin: l.skin ? String(l.skin).slice(0, 12) : undefined });

export interface RoomState<G> {
  phase: 'lobby' | 'playing' | 'over';
  hostId: string;
  players: Seat[];
  turnMs: number;
  options: Record<string, string>;
  game: G | null;
  turnLeftMs: number;
}

export interface Rules<G, A> {
  maxPlayers: number;
  start(players: Seat[], options: Record<string, string>): G;
  /** Apply an action from `pid`. Return null if not allowed. */
  act(g: G, pid: string, a: A): G | null;
  /** Whose decision the game is waiting on. */
  waitingOn(g: G): string | null;
  /** Changes whenever a fresh turn timer should start. */
  turnKey(g: G): string;
  /** What a bot (or an absent player) does now. */
  bot(g: G, pid: string): A | null;
  /** What happens when a human's timer runs out. */
  timeout(g: G, pid: string): A | null;
  /** Host-driven step with no player input (e.g. finish an animation), with its delay. */
  auto?(g: G): { a: A; delay: number } | null;
  over(g: G): boolean;
  /** Extra time a turn needs for animations before a bot acts. */
  botDelay?(g: G): number;
}

export type LobbyAction =
  | { t: 'start' } | { t: 'rematch' } | { t: 'addBot' } | { t: 'kick'; id: string }
  | { t: 'timer'; ms: number } | { t: 'opt'; key: string; value: string };
export type RoomAction<A> = LobbyAction | { t: 'game'; a: A };

const BOT_NAMES = ['Nova', 'Pixel', 'Blaze', 'Echo', 'Comet', 'Zippy', 'Raja', 'Chintu'];
export const TIMER_CHOICES = [15000, 30000, 45000, 60000];
/** Actor id used for host-driven steps (see Rules.auto). */
export const AUTO = '__auto';

export class RoomHost<G, A> {
  state: RoomState<G>;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private turnStarted = Date.now();
  private lastKey = '';

  constructor(private rules: Rules<G, A>, hostId: string, name: string, avatar: string, private listener: (s: RoomState<G>) => void, options: Record<string, string> = {}, look: Look = {}) {
    this.state = { phase: 'lobby', hostId, players: [], turnMs: 30000, options, game: null, turnLeftMs: 30000 };
    this.join(hostId, name, avatar, false, look);
  }

  private set(s: RoomState<G>) {
    if (s.game && s.phase === 'playing' && this.rules.over(s.game)) s = { ...s, phase: 'over' };
    const key = s.game ? this.rules.turnKey(s.game) : '';
    if (key !== this.lastKey) { this.lastKey = key; this.turnStarted = Date.now(); }
    this.state = s;
    this.emit();
    this.schedule();
  }

  emit() { this.listener({ ...this.state, turnLeftMs: Math.max(0, this.state.turnMs - (Date.now() - this.turnStarted)) }); }

  join(id: string, name: string, avatar: string, bot = false, look: Look = {}): boolean {
    const s = this.state;
    const lk = cleanLook(look);
    if (s.players.some((p) => p.id === id)) {
      this.set({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, connected: true, name, ...lk } : p)) });
      return true;
    }
    if (s.phase !== 'lobby' || s.players.length >= this.rules.maxPlayers) return false;
    this.set({ ...s, players: [...s.players, { id, name: name.slice(0, 14) || 'Player', avatar, bot, connected: true, ...lk }] });
    return true;
  }

  setConnected(id: string, connected: boolean) {
    const s = this.state;
    if (s.phase === 'lobby' && !connected) { this.set({ ...s, players: s.players.filter((p) => p.id !== id) }); return; }
    this.set({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, connected } : p)) });
  }

  handle(from: string, a: RoomAction<A>) {
    const s = this.state;
    const isHost = from === s.hostId;
    switch (a.t) {
      case 'timer': if (isHost && s.phase === 'lobby' && TIMER_CHOICES.includes(a.ms)) this.set({ ...s, turnMs: a.ms }); return;
      case 'opt': if (isHost && s.phase === 'lobby') this.set({ ...s, options: { ...s.options, [a.key]: String(a.value).slice(0, 20) } }); return;
      case 'kick': if (isHost && s.phase === 'lobby' && a.id !== s.hostId) this.set({ ...s, players: s.players.filter((p) => p.id !== a.id) }); return;
      case 'addBot': {
        if (!isHost || s.phase !== 'lobby' || s.players.length >= this.rules.maxPlayers) return;
        const usedN = new Set(s.players.map((p) => p.name)), usedA = new Set(s.players.map((p) => p.avatar));
        const name = BOT_NAMES.filter((n) => !usedN.has(n))[0] ?? 'Bot';
        const free = Array.from({ length: 15 }, (_, i) => `c${i}`).filter((x) => !usedA.has(x));
        this.join(`bot-${Date.now()}-${s.players.length}`, name, free[Math.floor(Math.random() * free.length)] ?? 'c0', true);
        return;
      }
      case 'start':
        if (isHost && s.phase === 'lobby' && s.players.length >= 2) this.set({ ...s, phase: 'playing', game: this.rules.start(s.players, s.options) });
        return;
      case 'rematch': {
        if (!isHost || s.phase !== 'over') return;
        const players = s.players.filter((p) => p.connected || p.bot);
        if (players.length >= 2) this.set({ ...s, players, phase: 'playing', game: this.rules.start(players, s.options) });
        else this.set({ ...s, players, phase: 'lobby', game: null }); // everyone else left: back to the lobby
        return;
      }
      case 'game': {
        if (s.phase !== 'playing' || !s.game) return;
        const g = this.rules.act(s.game, from, a.a);
        if (g) this.set({ ...s, game: g });
      }
    }
  }

  private schedule() {
    clearTimeout(this.timer);
    const s = this.state;
    if (s.phase !== 'playing' || !s.game) return;
    const g = s.game;
    const after = (ms: number, fn: () => void) => { this.timer = setTimeout(fn, ms); };
    const step = this.rules.auto?.(g);
    if (step) { after(step.delay, () => this.handle(AUTO, { t: 'game', a: step.a })); return; }
    const pid = this.rules.waitingOn(g);
    if (!pid) return;
    const p = s.players.find((x) => x.id === pid);
    if (!p) return;
    if (p.bot || !p.connected) {
      after(this.rules.botDelay?.(g) ?? 1000, () => { const a = this.rules.bot(this.state.game!, pid); if (a) this.handle(pid, { t: 'game', a }); });
    } else if (s.turnMs) {
      const left = Math.max(0, s.turnMs - (Date.now() - this.turnStarted));
      after(left, () => { const a = this.rules.timeout(this.state.game!, pid); if (a) this.handle(pid, { t: 'game', a }); });
    }
  }

  /** Continue a saved game (the host left by mistake). Guests count as away until they reconnect. */
  restore(s: RoomState<G>) {
    this.lastKey = '';
    this.set({ ...s, players: s.players.map((p) => ({ ...p, connected: p.bot || p.id === s.hostId })) });
  }

  dispose() { clearTimeout(this.timer); }
}

// ---------------- networking ----------------

export interface Emote { from: string; emoji: string; id: number }
export type { Status };
export interface Handlers<G> { onState(s: RoomState<G>): void; onEmote(e: Emote): void; onStatus(st: Status, msg?: string): void }
export interface RoomSession<A> { code: string; myId: string; local: boolean; act(a: RoomAction<A>): void; emote(m: string): void; leave(): void }

type HostMsg<G> = { t: 'state'; s: RoomState<G> } | { t: 'emote'; e: Emote } | { t: 'full' };
type GuestMsg<A> = { t: 'hello'; id: string; name: string; avatar: string; title?: string; skin?: string } | { t: 'act'; a: RoomAction<A> } | { t: 'emote'; emoji: string };

let emoteSeq = Date.now();
export interface Me { id: string; name: string; avatar: string; title?: string; skin?: string }

function core<G, A>(rules: Rules<G, A>, me: Me, h: Handlers<G>, send: (m: HostMsg<G>) => void, options?: Record<string, string>) {
  const host = new RoomHost(rules, me.id, me.name, me.avatar, (s) => { h.onState(s); send({ t: 'state', s }); }, options, { title: me.title, skin: me.skin });
  const emote = (from: string, emoji: string) => { const e = { from, emoji, id: emoteSeq++ }; h.onEmote(e); send({ t: 'emote', e }); };
  return { host, emote };
}

export function soloRoom<G, A>(rules: Rules<G, A>, me: Me, bots: number, options: Record<string, string>, h: Handlers<G>, restore?: RoomState<G>): RoomSession<A> {
  const { host, emote } = core(rules, me, h, () => {}, options);
  if (restore) host.restore(restore);
  else {
    host.handle(me.id, { t: 'timer', ms: 60000 });
    for (let i = 0; i < bots; i++) host.handle(me.id, { t: 'addBot' });
    host.handle(me.id, { t: 'start' });
  }
  h.onStatus('online');
  return { code: 'SOLO', myId: me.id, local: true, act: (a) => host.handle(me.id, a), emote: (e) => emote(me.id, e), leave: () => host.dispose() };
}

/** `resume`: reopen a room the host left by mistake, on its old code, from the saved game. */
export function hostRoom<G, A>(prefix: string, rules: Rules<G, A>, me: Me, h: Handlers<G>, onCode: (c: string) => void, resume?: { code: string; state: RoomState<G> }): RoomSession<A> {
  const conns = new Map<GuestLink, string>();
  let link: HostLink | null = null; // the host emits its first state before the link exists
  const { host, emote } = core(rules, me, h, (m) => link?.broadcast(m, conns.keys()));
  const session: RoomSession<A> = {
    code: '', myId: me.id, local: false,
    act: (a) => host.handle(me.id, a), emote: (e) => emote(me.id, e),
    leave: () => { host.dispose(); link?.close(); },
  };
  link = openHost(prefix, {
    onCode: (code) => { session.code = code; onCode(code); },
    onStatus: h.onStatus,
    onData: (l, raw) => {
      const m = raw as GuestMsg<A>;
      if (m.t === 'hello') {
        if (!host.join(m.id, m.name, m.avatar, false, { title: m.title, skin: m.skin })) { l.send({ t: 'full' } satisfies HostMsg<G>); setTimeout(() => l.close(), 300); return; }
        conns.set(l, m.id);
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
  }, resume?.code);
  if (resume) host.restore(resume.state);
  return session;
}

export function joinRoom<G, A>(prefix: string, code: string, me: Me, h: Handlers<G>): RoomSession<A> {
  const hello: GuestMsg<A> = { t: 'hello', id: me.id, name: me.name, avatar: me.avatar, title: me.title, skin: me.skin };
  let seated = false;
  const link = openGuest(prefix, code, me.id, hello, {
    onStatus: h.onStatus,
    onFail: (msg) => h.onStatus('closed', msg),
    onData: (raw) => {
      const m = raw as HostMsg<G>;
      if (m.t === 'state') {
        if (m.s.players.some((p) => p.id === me.id)) seated = true;
        else if (seated && m.s.phase === 'lobby') { link.close(); h.onStatus('closed', 'The host removed you from the room.'); return; }
        h.onStatus('online'); h.onState(m.s);
      }
      if (m.t === 'emote') h.onEmote(m.e);
      if (m.t === 'full') { link.close(); h.onStatus('closed', 'That room is full or already playing.'); }
    },
  });
  const send = (m: GuestMsg<A>) => link.send(m);
  return { code: code.toUpperCase(), myId: me.id, local: false, act: (a) => send({ t: 'act', a }), emote: (e) => send({ t: 'emote', emoji: e }), leave: () => link.close() };
}
