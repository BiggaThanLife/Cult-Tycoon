// Seeded PRNG (mulberry32). All game randomness goes through here so runs,
// tests and the sim are reproducible. State is a single uint32 that is saved.

export interface Rng {
  /** current internal state (serializable) */
  state: number;
  /** float in [0, 1) */
  next(): number;
  /** integer in [0, n) */
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
}

export function makeRng(seed: number): Rng {
  const rng: Rng = {
    state: seed >>> 0,
    next() {
      rng.state = (rng.state + 0x6d2b79f5) >>> 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(n: number) {
      return Math.floor(rng.next() * n);
    },
    pick<T>(arr: readonly T[]): T {
      return arr[rng.int(arr.length)];
    },
    shuffle<T>(arr: T[]): T[] {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
  return rng;
}

/** FNV-1a string hash → uint32. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Derive an independent stream seed from a run seed and a stream name. */
export function deriveSeed(runSeed: number, name: string): number {
  return hashString(`${runSeed >>> 0}:${name}`);
}
