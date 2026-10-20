// The authoritative game runner. Lives on the room creator's device (or locally for bot games).
import { botChoice, move, newLobby, nextTurn, roll, startGame, timeout, type GameState, type Mode } from './engine';

export type Action =
  | { t: 'roll' }
  | { t: 'move'; idx: number }
  | { t: 'start' }
  | { t: 'mode'; mode: Mode }
  | { t: 'timer'; ms: number }
  | { t: 'addBot' }
  | { t: 'kick'; id: string }
  | { t: 'rematch' };

const BOT_NAMES = ['Nova', 'Pixel', 'Blaze', 'Echo', 'Comet', 'Zippy'];
const BOT_AVATARS = ['🤖', '👾', '🦊', '🐯'];

export class GameHost {
  state: GameState;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private turnStarted = Date.now();
  private listener: (s: GameState) => void;

  constructor(hostId: string, name: string, avatar: string, listener: (s: GameState) => void) {
    this.listener = listener;
    this.state = newLobby(hostId);
    this.join(hostId, name, avatar);
  }

  private set(s: GameState) {
    // A "chance" starts when the turn passes or a bonus roll is granted; the timer covers roll + move.
    const turnChanged = s.turn !== this.state.turn || (!s.rolled && this.state.rolled) || s.phase !== this.state.phase;
    this.state = s;
    if (turnChanged) this.turnStarted = Date.now();
    this.emit();
    this.schedule();
  }

  emit() {
    this.listener({ ...this.state, turnLeftMs: Math.max(0, this.state.turnMs - (Date.now() - this.turnStarted)) });
  }

  join(id: string, name: string, avatar: string, bot = false): boolean {
    const s = this.state;
    const existing = s.players.find((p) => p.id === id);
    if (existing) {
      this.set({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, connected: true, name } : p)) });
      return true;
    }
    if (s.phase !== 'lobby' || s.players.length >= 4) return false;
    this.set({ ...s, players: [...s.players, { id, name: name.slice(0, 14), avatar, bot, connected: true, color: 'red' }] });
    return true;
  }

  setConnected(id: string, connected: boolean) {
    const s = this.state;
    if (s.phase === 'lobby' && !connected) {
      this.set({ ...s, players: s.players.filter((p) => p.id !== id) });
      return;
    }
    this.set({ ...s, players: s.players.map((p) => (p.id === id ? { ...p, connected } : p)) });
  }

  handle(from: string, a: Action) {
    const s = this.state;
    const isHost = from === s.hostId;
    switch (a.t) {
      case 'timer': if (isHost && s.phase === 'lobby' && [0, 10000, 15000, 20000, 30000].includes(a.ms)) this.set({ ...s, turnMs: a.ms }); return;
      case 'mode': if (isHost && s.phase === 'lobby') this.set({ ...s, mode: a.mode }); return;
      case 'addBot': {
        if (!isHost || s.phase !== 'lobby' || s.players.length >= 4) return;
        const n = s.players.filter((p) => p.bot).length;
        this.join(`bot-${Date.now()}-${s.players.length}`, BOT_NAMES[(n + Math.floor(Math.random() * 6)) % 6], BOT_AVATARS[n % 4], true);
        return;
      }
      case 'kick': if (isHost && s.phase === 'lobby' && a.id !== s.hostId) this.set({ ...s, players: s.players.filter((p) => p.id !== a.id) }); return;
      case 'start': if (isHost && s.phase === 'lobby' && s.players.length >= 2) this.set(startGame(s)); return;
      case 'rematch':
        if (isHost && s.phase === 'over') this.set(startGame({ ...s, players: s.players.filter((p) => p.connected || p.bot) }));
        return;
    }
    if (s.phase !== 'playing' || s.players[s.turn].id !== from) return;
    if (a.t === 'roll' && !s.rolled) this.set(roll(s));
    if (a.t === 'move' && s.rolled) this.set(move(s, a.idx));
  }

  /** Drives bots, auto-moves, dead turns and idle players so the game never stalls. */
  private schedule() {
    clearTimeout(this.timer);
    const s = this.state;
    if (s.phase !== 'playing') return;
    const cur = s.players[s.turn];
    const auto = cur.bot || !cur.connected;
    const after = (ms: number, fn: () => void) => { this.timer = setTimeout(fn, ms); };

    if (!s.rolled) {
      if (auto) after(900, () => this.set(roll(this.state)));
      else this.onTimeout(after);
    } else if (s.movable.length === 0) {
      after(1300, () => this.set(nextTurn(this.state)));
    } else if (auto || s.movable.length === 1 || this.allSame(s)) {
      after(auto ? 900 : 750, () => this.set(move(this.state, auto ? botChoice(this.state) : this.state.movable[0])));
    } else {
      this.onTimeout(after);
    }
  }

  private onTimeout(after: (ms: number, fn: () => void) => void) {
    if (!this.state.turnMs) return;
    const left = this.state.turnMs - (Date.now() - this.turnStarted);
    after(Math.max(0, left), () => this.set(timeout(this.state)));
  }

  // All movable tokens sit in the yard together, so the choice doesn't matter.
  private allSame(s: GameState) {
    const t = s.tokens[s.players[s.turn].color]!;
    return s.movable.every((i) => t[i] === -1);
  }

  dispose() { clearTimeout(this.timer); }
}
