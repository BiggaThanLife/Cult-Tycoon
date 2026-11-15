// Pure merge-grid engine ("The Reliquary"). No Phaser. Serializable state.
import { makeRng } from '../core/rng';

export interface MergeChainDef { id: string; tiers: string[] }
export interface MergeGeneratorDef { id: string; chain: string; maxCharges: number; rechargeSec: number; tierWeights: number[]; unlockLevel?: number }
export interface MergeDefs {
  grid: { w: number; h: number; shelf: number };
  chains: MergeChainDef[];
  generators: MergeGeneratorDef[];
  start: { gen: string; x: number; y: number }[];
}

export interface MergeItem { id: number; kind: 'item'; chain: string; tier: number /* 1-based */ }
export interface MergeGenerator { id: number; kind: 'gen'; gen: string; charges: number; cooldown: number }
export type MergeCell = MergeItem | MergeGenerator;
export interface MergeState {
  cells: (MergeCell | null)[]; // w*h, row-major
  shelf: (MergeItem | null)[];
  nextId: number;
  rngState: number;
}
export interface Loc { area: 'grid' | 'shelf'; i: number }
export type MoveResult =
  | { kind: 'none' }
  | { kind: 'move' }
  | { kind: 'swap' }
  | { kind: 'merge'; chain: string; tier: number; at: Loc };

export function createMerge(defs: MergeDefs, seed: number): MergeState {
  const s: MergeState = {
    cells: new Array(defs.grid.w * defs.grid.h).fill(null),
    shelf: new Array(defs.grid.shelf).fill(null),
    nextId: 1,
    rngState: seed >>> 0,
  };
  for (const g of defs.start) {
    const def = defs.generators.find((d) => d.id === g.gen)!;
    s.cells[g.y * defs.grid.w + g.x] = { id: s.nextId++, kind: 'gen', gen: g.gen, charges: def.maxCharges, cooldown: 0 };
  }
  return s;
}

function getAt(s: MergeState, loc: Loc): MergeCell | null {
  return loc.area === 'grid' ? s.cells[loc.i] ?? null : s.shelf[loc.i] ?? null;
}
function setAt(s: MergeState, loc: Loc, v: MergeCell | null): void {
  if (loc.area === 'grid') s.cells[loc.i] = v;
  else s.shelf[loc.i] = v as MergeItem | null;
}
function inRange(s: MergeState, loc: Loc): boolean {
  return loc.i >= 0 && loc.i < (loc.area === 'grid' ? s.cells.length : s.shelf.length);
}

/** Nearest empty grid cell to index `from` (Chebyshev rings, deterministic order). */
export function nearestEmpty(s: MergeState, defs: MergeDefs, from: number): number {
  const { w, h } = defs.grid;
  const fx = from % w;
  const fy = Math.floor(from / w);
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < s.cells.length; i++) {
    if (s.cells[i]) continue;
    const dx = (i % w) - fx;
    const dy = Math.floor(i / w) - fy;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

/** Tap a generator: spawn an item into the nearest free cell. Returns the cell index or -1. */
export function tapGenerator(s: MergeState, defs: MergeDefs, idx: number): number {
  const g = s.cells[idx];
  if (!g || g.kind !== 'gen' || g.charges <= 0) return -1;
  const def = defs.generators.find((d) => d.id === g.gen)!;
  const target = nearestEmpty(s, defs, idx);
  if (target < 0) return -1;
  const rng = makeRng(s.rngState);
  const total = def.tierWeights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  let tier = 1;
  for (let t = 0; t < def.tierWeights.length; t++) {
    roll -= def.tierWeights[t];
    if (roll < 0) { tier = t + 1; break; }
  }
  s.rngState = rng.state;
  s.cells[target] = { id: s.nextId++, kind: 'item', chain: def.chain, tier };
  if (g.charges === def.maxCharges) g.cooldown = def.rechargeSec;
  g.charges--;
  return target;
}

/** Drag an item from one location to another: move, merge (two identical → next tier) or swap. */
export function moveItem(s: MergeState, defs: MergeDefs, from: Loc, to: Loc): MoveResult {
  if (!inRange(s, from) || !inRange(s, to)) return { kind: 'none' };
  if (from.area === to.area && from.i === to.i) return { kind: 'none' };
  const a = getAt(s, from);
  const b = getAt(s, to);
  if (!a) return { kind: 'none' };
  if (a.kind === 'gen' && to.area === 'shelf') return { kind: 'none' };
  if (!b) {
    setAt(s, to, a);
    setAt(s, from, null);
    return { kind: 'move' };
  }
  if (a.kind === 'item' && b.kind === 'item' && a.chain === b.chain && a.tier === b.tier) {
    const chain = defs.chains.find((c) => c.id === a.chain)!;
    if (a.tier < chain.tiers.length) {
      setAt(s, from, null);
      setAt(s, to, { id: s.nextId++, kind: 'item', chain: a.chain, tier: a.tier + 1 });
      return { kind: 'merge', chain: a.chain, tier: a.tier + 1, at: to };
    }
  }
  if (b.kind === 'gen' && from.area === 'shelf') return { kind: 'none' };
  setAt(s, to, a);
  setAt(s, from, b);
  return { kind: 'swap' };
}

export function tickMerge(s: MergeState, defs: MergeDefs, dt: number): void {
  for (const c of s.cells) {
    if (!c || c.kind !== 'gen') continue;
    const def = defs.generators.find((d) => d.id === c.gen)!;
    if (c.charges >= def.maxCharges) { c.cooldown = 0; continue; }
    c.cooldown -= dt;
    while (c.cooldown <= 0 && c.charges < def.maxCharges) {
      c.charges++;
      c.cooldown += def.rechargeSec;
    }
    if (c.charges >= def.maxCharges) c.cooldown = 0;
  }
}

export function countItems(s: MergeState, chain: string, tier: number): number {
  let n = 0;
  for (const c of [...s.cells, ...s.shelf]) if (c && c.kind === 'item' && c.chain === chain && c.tier === tier) n++;
  return n;
}

/** Remove `count` items of chain/tier (shelf first, then grid). Returns how many were removed. */
export function removeItems(s: MergeState, chain: string, tier: number, count: number): number {
  let removed = 0;
  const match = (c: MergeCell | null) => !!c && c.kind === 'item' && c.chain === chain && c.tier === tier;
  for (let i = 0; i < s.shelf.length && removed < count; i++) if (match(s.shelf[i])) { s.shelf[i] = null; removed++; }
  for (let i = 0; i < s.cells.length && removed < count; i++) if (match(s.cells[i])) { s.cells[i] = null; removed++; }
  return removed;
}

/** Put a generator on the grid if it is not there yet (used when one unlocks). Returns false if the grid is full. */
export function addGenerator(s: MergeState, defs: MergeDefs, genId: string): boolean {
  if (s.cells.some((c) => c && c.kind === 'gen' && c.gen === genId)) return true;
  const def = defs.generators.find((d) => d.id === genId);
  if (!def) return false;
  const centre = Math.floor(defs.grid.h / 2) * defs.grid.w + Math.floor(defs.grid.w / 2);
  const at = nearestEmpty(s, defs, centre);
  if (at < 0) return false;
  s.cells[at] = { id: s.nextId++, kind: 'gen', gen: genId, charges: def.maxCharges, cooldown: 0 };
  return true;
}

/** Put a new item of chain/tier on the grid near the centre. Returns false if the grid is full. */
export function placeItem(s: MergeState, defs: MergeDefs, chain: string, tier: number): boolean {
  const centre = Math.floor(defs.grid.h / 2) * defs.grid.w + Math.floor(defs.grid.w / 2);
  const at = nearestEmpty(s, defs, centre);
  if (at < 0) return false;
  s.cells[at] = { id: s.nextId++, kind: 'item', chain, tier };
  return true;
}
