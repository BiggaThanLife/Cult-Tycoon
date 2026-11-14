// Versioned save with migrations, atomic write, backup slot and export/import code.
import { SAVE_VERSION } from './game';
import { hashString } from './rng';
import type { GameState } from './types';

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export const KEYS = { current: 'ct.save', backup: 'ct.save.backup', tmp: 'ct.save.tmp', corrupt: 'ct.save.corrupt' };

/** migrations[n] upgrades save data from version n to n+1. */
export type Migrations = Record<number, (data: any) => any>;
export const MIGRATIONS: Migrations = {
  // v1 -> v2: sound setting added (defaults to on)
  1: (d) => {
    d.meta.settings = { ...d.meta.settings, sound: d.meta.settings?.sound ?? true };
    return d;
  },
};

interface Envelope { saveVersion: number; savedAt: number; data: unknown }

export function serialize(g: GameState, nowWall: number): string {
  const env: Envelope = { saveVersion: g.saveVersion, savedAt: nowWall, data: g };
  return JSON.stringify(env);
}

/** Parse + migrate + sanity-check. Throws on anything it can't trust. */
export function parse(raw: string, migrations: Migrations = MIGRATIONS, target: number = SAVE_VERSION): GameState {
  const env = JSON.parse(raw) as Envelope;
  if (!env || typeof env !== 'object' || typeof env.saveVersion !== 'number' || !env.data) throw new Error('save: bad envelope');
  let v = env.saveVersion;
  let data: any = env.data;
  if (v > target) throw new Error(`save: version ${v} is newer than this build (${target})`);
  while (v < target) {
    const m = migrations[v];
    if (!m) throw new Error(`save: no migration from version ${v}`);
    data = m(data);
    v++;
  }
  data.saveVersion = target;
  if (!data.run || !data.meta || typeof data.run.time !== 'number' || !Array.isArray(data.run.buildings)) throw new Error('save: bad shape');
  return data as GameState;
}

/** Atomic-ish write: tmp → verify → rotate current to backup → write current → drop tmp. */
export function saveGame(kv: KV, g: GameState, nowWall: number): boolean {
  try {
    g.lastSeenWall = nowWall;
    g.highWater = Math.max(g.highWater, nowWall);
    const raw = serialize(g, nowWall);
    kv.set(KEYS.tmp, raw);
    if (kv.get(KEYS.tmp) !== raw) throw new Error('save: verify failed');
    const prev = kv.get(KEYS.current);
    if (prev) kv.set(KEYS.backup, prev);
    kv.set(KEYS.current, raw);
    kv.remove(KEYS.tmp);
    return true;
  } catch {
    return false;
  }
}

export interface LoadResult { state: GameState | null; source: 'current' | 'backup' | 'tmp' | 'none'; recovered: boolean }

export function loadGame(kv: KV, migrations: Migrations = MIGRATIONS, target: number = SAVE_VERSION): LoadResult {
  let sawBroken = false;
  for (const source of ['current', 'backup', 'tmp'] as const) {
    let raw: string | null = null;
    try { raw = kv.get(KEYS[source]); } catch { raw = null; }
    if (!raw) continue;
    try {
      return { state: parse(raw, migrations, target), source, recovered: sawBroken };
    } catch {
      sawBroken = true;
      try { kv.set(KEYS.corrupt, raw); } catch { /* storage full or unavailable */ }
    }
  }
  return { state: null, source: 'none', recovered: sawBroken };
}

export function wipeSave(kv: KV): void {
  for (const k of [KEYS.current, KEYS.backup, KEYS.tmp]) kv.remove(k);
}

// ----- export / import code -----

function toB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromB64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function exportCode(g: GameState, nowWall: number): string {
  const body = toB64(serialize(g, nowWall));
  return `CT1.${hashString(body).toString(16)}.${body}`;
}

export function importCode(code: string, migrations: Migrations = MIGRATIONS, target: number = SAVE_VERSION): GameState {
  const parts = code.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'CT1') throw new Error('save code: not a Cult Tycoon code');
  if (hashString(parts[2]).toString(16) !== parts[1]) throw new Error('save code: checksum mismatch');
  return parse(fromB64(parts[2]), migrations, target);
}

/** In-memory KV (tests, and a fallback when localStorage is unavailable). */
export function memoryKV(): KV & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, get: (k) => map.get(k) ?? null, set: (k, v) => void map.set(k, v), remove: (k) => void map.delete(k) };
}

export function browserKV(): KV {
  const mem = memoryKV();
  let ok = true;
  try {
    localStorage.setItem('ct.probe', '1');
    localStorage.removeItem('ct.probe');
  } catch { ok = false; }
  if (!ok) return mem;
  return {
    get: (k) => { try { return localStorage.getItem(k); } catch { return mem.get(k); } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { mem.set(k, v); } },
    remove: (k) => { try { localStorage.removeItem(k); } catch { mem.remove(k); } },
  };
}
