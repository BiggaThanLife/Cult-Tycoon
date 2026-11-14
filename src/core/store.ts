// The single place the UI talks to the core: holds state, runs actions, saves, notifies.
import { applyOffline, type OfflineSummary } from './offline';
import { advanceTutorial, ensureDraft, newGame, tick } from './game';
import { loadGame, saveGame, wipeSave, type KV } from './save';
import type { Emit, GameEvent, GameState } from './types';

type Listener = (e: GameEvent) => void;

export class Store {
  state!: GameState;
  private listeners = new Set<Listener>();
  private sinceSave = 0;
  recovered = false;
  /** Summary from the most recent load / return-from-background, if any. */
  offline: OfflineSummary | null = null;

  constructor(private kv: KV, private now: () => number = () => Date.now()) {}

  emit: Emit = (e) => {
    for (const l of this.listeners) l(e);
  };
  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  boot(seed?: number): void {
    const res = loadGame(this.kv);
    this.recovered = res.recovered;
    if (res.state) {
      this.state = res.state;
      this.offline = applyOffline(this.state, this.now(), this.emit);
    } else {
      this.state = newGame(seed ?? (this.now() ^ 0x5eed) >>> 0, this.now());
      this.offline = null;
    }
    this.after();
  }

  /** Run an action against the state, then advance the tutorial, notify and schedule a save. */
  act<T>(fn: (g: GameState, emit: Emit) => T): T {
    const out = fn(this.state, this.emit);
    this.after();
    this.sinceSave = Math.max(this.sinceSave, 14);
    return out;
  }

  private after(): void {
    advanceTutorial(this.state, this.emit);
    ensureDraft(this.state, this.emit);
    this.emit({ type: 'changed' });
  }

  /** Per-frame update. `dt` is real seconds (already clamped by the caller). */
  update(dt: number, speed: number): void {
    tick(this.state, dt * speed, this.emit);
    if (advanceTutorial(this.state, this.emit)) this.emit({ type: 'changed' });
    this.sinceSave += dt;
    if (this.sinceSave >= 15) this.save();
  }

  save(): boolean {
    this.sinceSave = 0;
    return saveGame(this.kv, this.state, this.now());
  }

  /** Called when the page comes back from the background after a long gap. */
  resume(): OfflineSummary {
    this.offline = applyOffline(this.state, this.now(), this.emit);
    this.after();
    return this.offline;
  }

  /** Debug: pretend the player was away for `seconds`. */
  simulateAway(seconds: number): OfflineSummary {
    this.state.lastSeenWall = this.now() - seconds * 1000;
    this.state.highWater = this.state.lastSeenWall;
    return this.resume();
  }

  reset(seed?: number): void {
    wipeSave(this.kv);
    this.state = newGame(seed ?? (this.now() ^ 0x5eed) >>> 0, this.now());
    this.offline = null;
    this.after();
    this.save();
  }

  replace(state: GameState): void {
    this.state = state;
    this.offline = applyOffline(this.state, this.now(), this.emit);
    this.after();
    this.save();
  }
}
