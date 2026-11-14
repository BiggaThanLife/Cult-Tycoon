// Rituals: pure, deterministic, seeded match-3 engine (GDD §3.7).
// No Phaser, no DOM. The whole game state is plain JSON (including the rng state),
// so a game can be serialized mid-level and resumed with identical future refills.
//
// Conventions (also covered by tests/unit/match3.test.ts):
// - Board is `cells[y][x]`, y = 0 is the top row. `null` is an empty hole. Holes only
//   persist underneath a webbed tile (webbed tiles do not fall and block their column).
// - A horizontal 4-match creates 'lineH' (clears its ROW); a vertical 4-match creates
//   'lineV' (clears its COLUMN).
// - A new special replaces one tile of the match (that tile keeps its id and type and is
//   not removed/collected). Spawn cell priority: the swap destination `b`, then `a`, then
//   (for bombs) the row/column intersection, then the first cell in reading order. Webbed
//   tiles and tiles that already are specials are never chosen.
// - For special+special swaps the effect is centered on `b` (where the dragged tile lands).
// - Chain reactions triggered by a clear are resolved inside the same 'clear' step.
// - Relics are immune to every clear; they only leave the board through the bottom row.

import { makeRng, type Rng } from '../core/rng';

export const TILE_KINDS = ['candle', 'skull', 'eye', 'rune', 'herb', 'coin'] as const; // index = tile type 0..5
export type Special = 'none' | 'lineH' | 'lineV' | 'bomb' | 'sigil';

export interface Cell {
  /** unique per tile for the whole game (renderer tracks sprites by id) */
  id: number;
  /** 0..5 tile type; -1 for a relic */
  type: number;
  /** a sigil keeps its type but matches with anything when swapped */
  special: Special;
  /** relic tiles never match; they fall, and are collected when they reach the bottom row */
  relic: boolean;
  /**
   * cobweb layers on this cell, 0..2. A webbed tile cannot be swapped and does not fall;
   * a match that includes it, or any clear on it, removes one layer instead of the tile.
   */
  web: number;
}

export type Goal =
  | { kind: 'collect'; tile: number; count: number }
  | { kind: 'clearWebs' }
  | { kind: 'dropRelics'; count: number }
  | { kind: 'score'; target: number };

export interface LevelDef {
  id: string;
  seed: number;
  width: number;
  height: number;
  moves: number;
  /** how many of the 6 types are used (4..6) */
  tileTypes: number;
  goals: Goal[];
  webs?: { x: number; y: number; layers: number }[];
  /**
   * number of relics. The first ceil(n/2) start in the top row at seeded columns; the rest
   * spawn from the top during refills, at most one per 3 moves.
   */
  relics?: number;
  starScores: [number, number, number];
  /** par moves, filled in by the validator */
  par: number;
  purpose: 'sermon' | 'recruit' | 'summon' | 'defense';
  /** text key, e.g. "ritual.r1.name" */
  nameKey: string;
}

export interface Snapshot {
  /** 'bonus' is emitted once on a win: unused moves pay MOVE_BONUS each (scoreDelta = movesLeft * MOVE_BONUS) */
  kind: 'swap' | 'swapBack' | 'clear' | 'fall' | 'reshuffle' | 'bonus';
  /** deep copy of the board AFTER this step, indexed [y][x], y=0 is the top row */
  cells: (Cell | null)[][];
  /** tiles removed in this step (for 'clear'); a dropped relic has type -1 */
  cleared: { x: number; y: number; type: number; id: number }[];
  scoreDelta: number;
  /** cascade index, 1 for the first clear of a move (0 for swap/swapBack/reshuffle) */
  combo: number;
}

export interface Match3State {
  level: LevelDef;
  cells: (Cell | null)[][];
  movesLeft: number;
  movesUsed: number;
  score: number;
  /** per tile type, total tiles cleared */
  collected: number[];
  relicsDropped: number;
  rngState: number;
  nextId: number;
  /** relaxed mode: moves never run out (movesLeft stays, status never 'lost') */
  relaxed: boolean;
  status: 'playing' | 'won' | 'lost';
}

export interface Pos {
  x: number;
  y: number;
}

type Board = (Cell | null)[][];

const SCORE_PER_TILE = 10;
const SCORE_PER_SPECIAL = 20;
const SCORE_PER_RELIC = 100;
/** Points for each move left over when the goals are met (not in relaxed mode). */
export const MOVE_BONUS = 50;
const RELIC_SPAWN_INTERVAL = 3;
const MAX_WEB_LAYERS = 2;

// ---------------------------------------------------------------------------
// small board helpers
// ---------------------------------------------------------------------------

function cloneBoard(cells: Board): Board {
  return cells.map((row) => row.map((c) => (c ? { ...c } : null)));
}

function cloneState(state: Match3State): Match3State {
  return { ...state, cells: cloneBoard(state.cells), collected: state.collected.slice() };
}

function inBounds(cells: Board, x: number, y: number): boolean {
  return y >= 0 && y < cells.length && x >= 0 && x < cells[y].length;
}

/** type used for matching: -1 for holes and relics (never match) */
function matchType(c: Cell | null): number {
  return c && !c.relic ? c.type : -1;
}

function isInt(n: number): boolean {
  return Number.isInteger(n);
}

// ---------------------------------------------------------------------------
// match detection
// ---------------------------------------------------------------------------

interface Run {
  cells: Pos[];
  horizontal: boolean;
}

interface MatchGroup {
  type: number;
  /** unique cells, reading order (top to bottom, left to right) */
  cells: Pos[];
  special: Special;
  /** cells that belong to both a horizontal and a vertical run */
  intersections: Pos[];
}

function findRuns(cells: Board): Run[] {
  const h = cells.length;
  const w = h > 0 ? cells[0].length : 0;
  const runs: Run[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const t = matchType(cells[y][x]);
      let end = x + 1;
      while (t >= 0 && end < w && matchType(cells[y][end]) === t) end++;
      if (t >= 0 && end - x >= 3) {
        const run: Pos[] = [];
        for (let i = x; i < end; i++) run.push({ x: i, y });
        runs.push({ cells: run, horizontal: true });
      }
      x = end;
    }
  }
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      const t = matchType(cells[y][x]);
      let end = y + 1;
      while (t >= 0 && end < h && matchType(cells[end][x]) === t) end++;
      if (t >= 0 && end - y >= 3) {
        const run: Pos[] = [];
        for (let i = y; i < end; i++) run.push({ x, y: i });
        runs.push({ cells: run, horizontal: false });
      }
      y = end;
    }
  }
  return runs;
}

function findGroups(cells: Board): MatchGroup[] {
  const runs = findRuns(cells);
  if (runs.length === 0) return [];
  const w = cells[0].length;
  const key = (p: Pos) => p.y * w + p.x;

  // union runs that share a cell
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map<number, number>();
  runs.forEach((run, i) => {
    for (const p of run.cells) {
      const k = key(p);
      const o = owner.get(k);
      if (o === undefined) owner.set(k, i);
      else parent[find(i)] = find(o);
    }
  });

  const byRoot = new Map<number, Run[]>();
  runs.forEach((run, i) => {
    const r = find(i);
    const list = byRoot.get(r);
    if (list) list.push(run);
    else byRoot.set(r, [run]);
  });

  const groups: MatchGroup[] = [];
  for (const members of byRoot.values()) {
    const hKeys = new Set<number>();
    const vKeys = new Set<number>();
    const all = new Map<number, Pos>();
    let maxLen = 0;
    let hasH = false;
    let hasV = false;
    let longestHorizontal = true;
    for (const run of members) {
      if (run.cells.length > maxLen) {
        maxLen = run.cells.length;
        longestHorizontal = run.horizontal;
      }
      if (run.horizontal) hasH = true;
      else hasV = true;
      for (const p of run.cells) {
        all.set(key(p), p);
        (run.horizontal ? hKeys : vKeys).add(key(p));
      }
    }
    const sorted = [...all.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    let special: Special = 'none';
    if (maxLen >= 5) special = 'sigil';
    else if (hasH && hasV) special = 'bomb';
    else if (maxLen === 4) special = longestHorizontal ? 'lineH' : 'lineV';
    const first = sorted[0];
    groups.push({
      type: matchType(cells[first.y][first.x]),
      cells: sorted,
      special,
      intersections: sorted.filter((p) => hKeys.has(key(p)) && vKeys.has(key(p))),
    });
  }
  groups.sort((a, b) => key(a.cells[0]) - key(b.cells[0]));
  return groups;
}

function hasAnyMatch(cells: Board): boolean {
  return findRuns(cells).length > 0;
}

/** is the tile at (x,y) part of a 3+ run? */
function matchAt(cells: Board, x: number, y: number): boolean {
  const t = matchType(cells[y][x]);
  if (t < 0) return false;
  const w = cells[0].length;
  const h = cells.length;
  let n = 1;
  for (let i = x - 1; i >= 0 && matchType(cells[y][i]) === t; i--) n++;
  for (let i = x + 1; i < w && matchType(cells[y][i]) === t; i++) n++;
  if (n >= 3) return true;
  n = 1;
  for (let i = y - 1; i >= 0 && matchType(cells[i][x]) === t; i--) n++;
  for (let i = y + 1; i < h && matchType(cells[i][x]) === t; i++) n++;
  return n >= 3;
}

// ---------------------------------------------------------------------------
// swap classification
// ---------------------------------------------------------------------------

type SwapKind = 'locked' | 'none' | 'match' | 'sigil' | 'combo';

function classifySwap(cells: Board, a: Pos, b: Pos): SwapKind {
  if (!isInt(a.x) || !isInt(a.y) || !isInt(b.x) || !isInt(b.y)) return 'locked';
  if (!inBounds(cells, a.x, a.y) || !inBounds(cells, b.x, b.y)) return 'locked';
  if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return 'locked';
  const ca = cells[a.y][a.x];
  const cb = cells[b.y][b.x];
  if (!ca || !cb || ca.web > 0 || cb.web > 0) return 'locked';
  if (ca.special !== 'none' && cb.special !== 'none') return 'combo';
  if ((ca.special === 'sigil' && !cb.relic) || (cb.special === 'sigil' && !ca.relic)) return 'sigil';
  cells[a.y][a.x] = cb;
  cells[b.y][b.x] = ca;
  const ok = matchAt(cells, a.x, a.y) || matchAt(cells, b.x, b.y);
  cells[a.y][a.x] = ca;
  cells[b.y][b.x] = cb;
  return ok ? 'match' : 'none';
}

function isValidSwap(cells: Board, a: Pos, b: Pos): boolean {
  const k = classifySwap(cells, a, b);
  return k === 'match' || k === 'sigil' || k === 'combo';
}

/** every valid swap in deterministic scan order (row by row; right neighbour, then lower neighbour) */
function validMoves(cells: Board): { a: Pos; b: Pos }[] {
  const out: { a: Pos; b: Pos }[] = [];
  const h = cells.length;
  const w = h > 0 ? cells[0].length : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x + 1 < w && isValidSwap(cells, { x, y }, { x: x + 1, y })) out.push({ a: { x, y }, b: { x: x + 1, y } });
      if (y + 1 < h && isValidSwap(cells, { x, y }, { x, y: y + 1 })) out.push({ a: { x, y }, b: { x, y: y + 1 } });
    }
  }
  return out;
}

function boardHasMoves(cells: Board): boolean {
  const h = cells.length;
  const w = h > 0 ? cells[0].length : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x + 1 < w && isValidSwap(cells, { x, y }, { x: x + 1, y })) return true;
      if (y + 1 < h && isValidSwap(cells, { x, y }, { x, y: y + 1 })) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// move resolution
// ---------------------------------------------------------------------------

interface Ctx {
  state: Match3State;
  rng: Rng;
  /** null = do not record snapshots (fast path for playouts and hints) */
  steps: Snapshot[] | null;
  relicSpawnedThisMove: boolean;
}

interface ClearPlan {
  /** cells to hit; specials among them trigger and chain */
  hits: Pos[];
  /** tiles that turn into a special instead of being removed */
  creations: { pos: Pos; special: Special }[];
  /** sigil position key -> tile type it clears (sigil swapped with a normal tile) */
  sigilTargets: Map<number, number>;
}

function record(ctx: Ctx, kind: Snapshot['kind'], cleared: Snapshot['cleared'], scoreDelta: number, combo: number): void {
  if (ctx.steps) ctx.steps.push({ kind, cells: cloneBoard(ctx.state.cells), cleared, scoreDelta, combo });
}

function planFromGroups(cells: Board, groups: MatchGroup[], preferred: Pos[]): ClearPlan {
  const plan: ClearPlan = { hits: [], creations: [], sigilTargets: new Map() };
  for (const g of groups) {
    plan.hits.push(...g.cells);
    if (g.special === 'none') continue;
    const inGroup = (p: Pos) => g.cells.some((c) => c.x === p.x && c.y === p.y);
    const candidates = [...preferred.filter(inGroup), ...g.intersections, ...g.cells];
    const spot = candidates.find((p) => {
      const c = cells[p.y][p.x];
      return !!c && c.web === 0 && c.special === 'none';
    });
    if (spot) plan.creations.push({ pos: spot, special: g.special });
  }
  return plan;
}

/** Applies a clear plan (plus any relic sitting in the bottom row). Returns true if anything changed. */
function executeClear(ctx: Ctx, plan: ClearPlan, combo: number): boolean {
  const { state } = ctx;
  const cells = state.cells;
  const h = cells.length;
  const w = cells[0].length;
  const key = (x: number, y: number) => y * w + x;
  const protect = new Set(plan.creations.map((c) => key(c.pos.x, c.pos.y)));
  const seen = new Set<number>();
  const queue: Pos[] = plan.hits.slice();
  const cleared: Snapshot['cleared'] = [];
  let websHit = 0;
  let tilesRemoved = 0;

  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    if (!inBounds(cells, x, y)) continue;
    const k = key(x, y);
    if (seen.has(k)) continue;
    seen.add(k);
    const c = cells[y][x];
    if (!c || c.relic) continue;
    if (c.web > 0) {
      c.web--;
      websHit++;
      continue;
    }
    if (protect.has(k)) continue;
    cells[y][x] = null;
    cleared.push({ x, y, type: c.type, id: c.id });
    state.collected[c.type] = (state.collected[c.type] ?? 0) + 1;
    tilesRemoved++;
    switch (c.special) {
      case 'lineH':
        for (let i2 = 0; i2 < w; i2++) queue.push({ x: i2, y });
        break;
      case 'lineV':
        for (let i2 = 0; i2 < h; i2++) queue.push({ x, y: i2 });
        break;
      case 'bomb':
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) queue.push({ x: x + dx, y: y + dy });
        break;
      case 'sigil': {
        const target = plan.sigilTargets.get(k) ?? c.type;
        for (let yy = 0; yy < h; yy++) {
          for (let xx = 0; xx < w; xx++) if (matchType(cells[yy][xx]) === target) queue.push({ x: xx, y: yy });
        }
        break;
      }
      default:
        break;
    }
  }

  let created = 0;
  for (const cr of plan.creations) {
    const c = cells[cr.pos.y][cr.pos.x];
    if (c && !c.relic) {
      c.special = cr.special;
      created++;
    }
  }

  let relics = 0;
  for (let x = 0; x < w; x++) {
    const c = cells[h - 1][x];
    if (c && c.relic) {
      cells[h - 1][x] = null;
      cleared.push({ x, y: h - 1, type: -1, id: c.id });
      state.relicsDropped++;
      relics++;
    }
  }

  const scoreDelta = tilesRemoved * SCORE_PER_TILE * combo + created * SCORE_PER_SPECIAL + relics * SCORE_PER_RELIC;
  state.score += scoreDelta;
  const changed = cleared.length > 0 || websHit > 0 || created > 0;
  if (changed) record(ctx, 'clear', cleared, scoreDelta, combo);
  return changed;
}

function countRelicsOnBoard(cells: Board): number {
  let n = 0;
  for (const row of cells) for (const c of row) if (c && c.relic) n++;
  return n;
}

function initialRelicCount(level: LevelDef): number {
  return Math.min(Math.ceil((level.relics ?? 0) / 2), level.width);
}

function newTile(state: Match3State, type: number): Cell {
  return { id: state.nextId++, type, special: 'none', relic: false, web: 0 };
}

/** Gravity + refill. Returns true if anything moved or spawned. */
function applyGravity(ctx: Ctx, combo: number): boolean {
  const { state, rng } = ctx;
  const cells = state.cells;
  const h = cells.length;
  const w = cells[0].length;
  let changed = false;
  const refilledColumns: number[] = [];

  for (let x = 0; x < w; x++) {
    let floor = h - 1; // lowest free slot of the current segment
    for (let y = h - 1; y >= 0; y--) {
      const c = cells[y][x];
      if (!c) continue;
      if (c.web > 0) {
        floor = y - 1; // webbed tiles stay put and start a new segment above them
        continue;
      }
      if (y !== floor) {
        cells[floor][x] = c;
        cells[y][x] = null;
        changed = true;
      }
      floor--;
    }
    // only the segment that is open to the top gets refilled
    if (floor >= 0) refilledColumns.push(x);
    for (let y = floor; y >= 0; y--) {
      cells[y][x] = newTile(state, rng.int(state.level.tileTypes));
      changed = true;
    }
  }

  // late relics enter from the top, at most one per RELIC_SPAWN_INTERVAL moves
  const total = state.level.relics ?? 0;
  if (total > 0 && !ctx.relicSpawnedThisMove && refilledColumns.length > 0) {
    const spawned = state.relicsDropped + countRelicsOnBoard(cells);
    const spawnedLate = spawned - initialRelicCount(state.level);
    if (spawned < total && state.movesUsed >= RELIC_SPAWN_INTERVAL * (spawnedLate + 1)) {
      const x = refilledColumns[rng.int(refilledColumns.length)];
      const c = cells[0][x];
      if (c) {
        c.type = -1;
        c.relic = true;
        ctx.relicSpawnedThisMove = true;
      }
    }
  }

  if (changed) record(ctx, 'fall', [], 0, combo);
  return changed;
}

function hasBottomRelic(cells: Board): boolean {
  return cells[cells.length - 1].some((c) => !!c && c.relic);
}

function resolveBoard(ctx: Ctx, firstPlan: ClearPlan): void {
  const cells = ctx.state.cells;
  let combo = 1;
  let plan: ClearPlan | null = firstPlan;
  // every iteration removes a tile, a web layer or a relic, so this terminates
  while (plan) {
    const cleared = executeClear(ctx, plan, combo);
    const fell = applyGravity(ctx, combo);
    if (!cleared && !fell) break;
    combo++;
    const groups = findGroups(cells);
    plan = groups.length > 0 || hasBottomRelic(cells) ? planFromGroups(cells, groups, []) : null;
  }
}

function allPositions(cells: Board): Pos[] {
  const out: Pos[] = [];
  for (let y = 0; y < cells.length; y++) for (let x = 0; x < cells[y].length; x++) out.push({ x, y });
  return out;
}

/** Plan for special+special swaps. Called AFTER the physical swap; `b` is the effect center. */
function comboPlan(cells: Board, a: Pos, b: Pos): ClearPlan {
  const plan: ClearPlan = { hits: [a, b], creations: [], sigilTargets: new Map() };
  const ca = cells[a.y][a.x] as Cell;
  const cb = cells[b.y][b.x] as Cell;
  const h = cells.length;
  const w = cells[0].length;
  const isLine = (s: Special) => s === 'lineH' || s === 'lineV';
  const sa = ca.special;
  const sb = cb.special;

  if (sa === 'sigil' && sb === 'sigil') {
    ca.special = 'none';
    cb.special = 'none';
    plan.hits.push(...allPositions(cells));
    return plan;
  }

  if (sa === 'sigil' || sb === 'sigil') {
    const sigil = sa === 'sigil' ? ca : cb;
    const other = sa === 'sigil' ? cb : ca;
    sigil.special = 'none';
    for (const p of allPositions(cells)) {
      const c = cells[p.y][p.x];
      if (!c || c.relic || c.type !== other.type) continue;
      if (c.web === 0 && c.special === 'none') {
        // converted lines alternate orientation in a checkerboard so they cover the board
        c.special = other.special === 'bomb' ? 'bomb' : (p.x + p.y) % 2 === 0 ? 'lineH' : 'lineV';
      }
      plan.hits.push(p);
    }
    return plan;
  }

  ca.special = 'none';
  cb.special = 'none';
  let radius: number;
  let cross: boolean;
  if (isLine(sa) && isLine(sb)) {
    radius = 0;
    cross = true;
  } else if (sa === 'bomb' && sb === 'bomb') {
    radius = 2;
    cross = false;
  } else {
    radius = 1;
    cross = true;
  }
  if (cross) {
    for (let d = -radius; d <= radius; d++) {
      for (let x = 0; x < w; x++) plan.hits.push({ x, y: b.y + d });
      for (let y = 0; y < h; y++) plan.hits.push({ x: b.x + d, y });
    }
  } else {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) plan.hits.push({ x: b.x + dx, y: b.y + dy });
    }
  }
  return plan;
}

function goalsDone(state: Match3State): boolean {
  return goalProgress(state).every((g) => g.done);
}

/** Seeded reshuffle of the plain tiles; relics, webbed tiles, specials and holes stay in place. */
function reshuffleBoard(ctx: Ctx): void {
  const { state, rng } = ctx;
  const cells = state.cells;
  const spots: Pos[] = [];
  for (const p of allPositions(cells)) {
    const c = cells[p.y][p.x];
    if (c && !c.relic && c.web === 0 && c.special === 'none') spots.push(p);
  }
  const ok = () => !hasAnyMatch(cells) && boardHasMoves(cells);
  let done = false;
  for (let attempt = 0; attempt < 200 && !done; attempt++) {
    const tiles = rng.shuffle(spots.map((p) => cells[p.y][p.x]));
    spots.forEach((p, i) => (cells[p.y][p.x] = tiles[i]));
    done = ok();
  }
  // Fallback for boards whose tile mix cannot form a move at all: re-roll the plain tiles' types.
  for (let attempt = 0; attempt < 2000 && !done; attempt++) {
    for (const p of spots) (cells[p.y][p.x] as Cell).type = rng.int(state.level.tileTypes);
    done = ok();
  }
  record(ctx, 'reshuffle', [], 0, 0);
}

/** Core move function shared by trySwap, hints and playouts. */
function applySwap(state: Match3State, a: Pos, b: Pos, steps: Snapshot[] | null): boolean {
  if (state.status !== 'playing') return false;
  const cells = state.cells;
  const kind = classifySwap(cells, a, b);
  if (kind === 'locked') return false;

  const ctx: Ctx = { state, rng: makeRng(state.rngState), steps, relicSpawnedThisMove: false };
  const ca = cells[a.y][a.x] as Cell;
  const cb = cells[b.y][b.x] as Cell;
  cells[a.y][a.x] = cb;
  cells[b.y][b.x] = ca;
  record(ctx, 'swap', [], 0, 0);

  if (kind === 'none') {
    cells[a.y][a.x] = ca;
    cells[b.y][b.x] = cb;
    record(ctx, 'swapBack', [], 0, 0);
    return false;
  }

  state.movesUsed++;
  if (!state.relaxed) state.movesLeft = Math.max(0, state.movesLeft - 1);

  let plan: ClearPlan;
  if (kind === 'combo') {
    plan = comboPlan(cells, a, b);
  } else if (kind === 'sigil') {
    // after the swap `ca` sits at b and `cb` at a
    const sigilPos = ca.special === 'sigil' ? b : a;
    const other = ca.special === 'sigil' ? cb : ca;
    plan = { hits: [sigilPos], creations: [], sigilTargets: new Map([[sigilPos.y * cells[0].length + sigilPos.x, other.type]]) };
  } else {
    plan = planFromGroups(cells, findGroups(cells), [b, a]);
  }
  resolveBoard(ctx, plan);

  if (goalsDone(state)) {
    state.status = 'won';
    if (!state.relaxed && state.movesLeft > 0) {
      const bonus = state.movesLeft * MOVE_BONUS;
      state.score += bonus;
      record(ctx, 'bonus', [], bonus, 0);
    }
  } else if (!state.relaxed && state.movesLeft <= 0) state.status = 'lost';
  else if (!boardHasMoves(cells)) reshuffleBoard(ctx);

  state.rngState = ctx.rng.state;
  return true;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

function assertLevel(level: LevelDef): void {
  const fail = (msg: string): never => {
    throw new Error(`match3: level "${level.id}": ${msg}`);
  };
  if (!isInt(level.width) || !isInt(level.height) || level.width < 3 || level.height < 1) fail('bad board size');
  if (!isInt(level.tileTypes) || level.tileTypes < 3 || level.tileTypes > TILE_KINDS.length) fail('bad tileTypes');
  for (const web of level.webs ?? []) {
    if (web.x < 0 || web.x >= level.width || web.y < 0 || web.y >= level.height) fail('web out of bounds');
  }
}

export function createGame(level: LevelDef, opts?: { relaxed?: boolean; extraMoves?: number }): Match3State {
  assertLevel(level);
  const rng = makeRng(level.seed);
  const state: Match3State = {
    level,
    cells: [],
    movesLeft: level.moves + (opts?.extraMoves ?? 0),
    movesUsed: 0,
    score: 0,
    collected: TILE_KINDS.map(() => 0),
    relicsDropped: 0,
    rngState: 0,
    nextId: 1,
    relaxed: opts?.relaxed ?? false,
    status: 'playing',
  };
  const { width: w, height: h } = level;

  for (let attempt = 0; ; attempt++) {
    // tile types first: never complete a run of three while filling
    const types: number[][] = [];
    for (let y = 0; y < h; y++) {
      types.push([]);
      for (let x = 0; x < w; x++) {
        const options: number[] = [];
        for (let t = 0; t < level.tileTypes; t++) {
          const rowRun = x >= 2 && types[y][x - 1] === t && types[y][x - 2] === t;
          const colRun = y >= 2 && types[y - 1][x] === t && types[y - 2][x] === t;
          if (!rowRun && !colRun) options.push(t);
        }
        types[y].push(rng.pick(options));
      }
    }
    const webs = types.map((row) => row.map(() => 0));
    for (const web of level.webs ?? []) webs[web.y][web.x] = Math.max(1, Math.min(MAX_WEB_LAYERS, web.layers));
    const freeTop: number[] = [];
    for (let x = 0; x < w; x++) if (webs[0][x] === 0) freeTop.push(x);
    const relicColumns = new Set(rng.shuffle(freeTop).slice(0, h > 1 ? initialRelicCount(level) : 0));

    state.nextId = 1;
    state.cells = types.map((row, y) =>
      row.map((type, x): Cell => {
        const relic = y === 0 && relicColumns.has(x);
        return { id: state.nextId++, type: relic ? -1 : type, special: 'none', relic, web: webs[y][x] };
      }),
    );
    if (boardHasMoves(state.cells) || attempt >= 500) break;
  }
  state.rngState = rng.state;
  return state;
}

/**
 * Mutates state. A valid swap costs one move and returns every animation step.
 * An adjacent swap that matches nothing returns `valid: false` with steps [swap, swapBack]
 * and costs no move. Non-adjacent, out-of-bounds, webbed or empty cells (or a finished
 * game) return `valid: false` with no steps.
 */
export function trySwap(state: Match3State, a: Pos, b: Pos): { valid: boolean; steps: Snapshot[] } {
  const steps: Snapshot[] = [];
  const valid = applySwap(state, a, b, steps);
  return { valid, steps };
}

export function hasMoves(state: Match3State): boolean {
  return boardHasMoves(state.cells);
}

/** heuristic board value used to rank moves (hints and validator playouts) */
function boardValue(state: Match3State): number {
  let v = state.score;
  for (const goal of state.level.goals) {
    if (goal.kind === 'collect') v += 40 * Math.min(state.collected[goal.tile] ?? 0, goal.count);
    else if (goal.kind === 'clearWebs') v -= 60 * websRemaining(state.cells);
    else if (goal.kind === 'dropRelics') {
      v += 400 * state.relicsDropped;
      state.cells.forEach((row, y) => row.forEach((c) => (v += c && c.relic ? 30 * y : 0)));
    }
  }
  return v;
}

function evaluateMove(state: Match3State, a: Pos, b: Pos): number {
  const sim = cloneState(state);
  sim.status = 'playing';
  // The evaluation must not peek at the real upcoming refills (a hint or a playout policy
  // that knows the future is not a fair model of a player), so it runs on a scrambled stream.
  sim.rngState = (Math.imul(state.rngState ^ 0x5bd1e995, 0x2c1b3c6d) + 0x1234567) >>> 0;
  const before = boardValue(sim);
  applySwap(sim, a, b, null);
  return boardValue(sim) - before + (goalsDone(sim) ? 10000 : 0);
}

function bestMove(state: Match3State, moves: { a: Pos; b: Pos }[]): { a: Pos; b: Pos } | null {
  let best: { a: Pos; b: Pos } | null = null;
  let bestValue = -Infinity;
  for (const m of moves) {
    const v = evaluateMove(state, m.a, m.b);
    if (v > bestValue) {
      bestValue = v;
      best = m;
    }
  }
  return best;
}

/**
 * Deterministic hint: the valid swap with the best immediate outcome (score, specials
 * created, goal progress); ties go to the first one in scan order. null if there is none.
 */
export function findHint(state: Match3State): { a: Pos; b: Pos } | null {
  return bestMove(state, validMoves(state.cells));
}

function websRemaining(cells: Board): number {
  let n = 0;
  for (const row of cells) for (const c of row) if (c) n += c.web;
  return n;
}

export function goalProgress(state: Match3State): { goal: Goal; current: number; target: number; done: boolean }[] {
  return state.level.goals.map((goal) => {
    switch (goal.kind) {
      case 'collect': {
        const current = Math.min(state.collected[goal.tile] ?? 0, goal.count);
        return { goal, current, target: goal.count, done: current >= goal.count };
      }
      case 'clearWebs': {
        // progress is counted in web layers
        const remaining = websRemaining(state.cells);
        const initial = (state.level.webs ?? []).reduce((s, web) => s + Math.max(1, Math.min(MAX_WEB_LAYERS, web.layers)), 0);
        const target = Math.max(initial, remaining);
        return { goal, current: target - remaining, target, done: remaining === 0 };
      }
      case 'dropRelics': {
        const current = Math.min(state.relicsDropped, goal.count);
        return { goal, current, target: goal.count, done: current >= goal.count };
      }
      case 'score': {
        const current = Math.min(state.score, goal.target);
        return { goal, current, target: goal.target, done: state.score >= goal.target };
      }
    }
  });
}

/**
 * 0 if the level is not won. A win is always worth at least 1 star; 2 and 3 stars need
 * starScores[1] and starScores[2]. Relaxed mode caps at 1.
 */
export function starsFor(state: Match3State): 0 | 1 | 2 | 3 {
  if (state.status !== 'won') return 0;
  if (state.relaxed) return 1;
  const [, two, three] = state.level.starScores;
  if (state.score >= three) return 3;
  if (state.score >= two) return 2;
  return 1;
}

export interface PlayoutResult {
  won: boolean;
  movesUsed: number;
  score: number;
}

/**
 * Seeded playouts with a simple policy: 70% best-greedy move (immediate score and goal
 * progress), 30% random valid move. Extra export used by tools/levels/validate.ts to
 * derive star thresholds.
 */
export function runPlayouts(level: LevelDef, playouts = 500): PlayoutResult[] {
  const results: PlayoutResult[] = [];
  for (let i = 0; i < playouts; i++) {
    const state = createGame(level);
    const policy = makeRng(((level.seed ^ 0x9e3779b9) + Math.imul(i + 1, 0x85ebca6b)) >>> 0);
    while (state.status === 'playing') {
      const moves = validMoves(state.cells);
      if (moves.length === 0) break;
      const greedy = policy.next() < 0.7;
      const move = greedy ? (bestMove(state, moves) as { a: Pos; b: Pos }) : policy.pick(moves);
      applySwap(state, move.a, move.b, null);
    }
    results.push({ won: state.status === 'won', movesUsed: state.movesUsed, score: state.score });
  }
  return results;
}

/** winRate over all playouts; avgMovesUsed, par and avgScore are measured on winning playouts only. */
export function validateLevel(
  level: LevelDef,
  playouts = 500,
): { winRate: number; avgMovesUsed: number; par: number; avgScore: number } {
  const results = runPlayouts(level, playouts);
  const wins = results.filter((r) => r.won);
  const avg = (f: (r: PlayoutResult) => number) => (wins.length ? wins.reduce((s, r) => s + f(r), 0) / wins.length : 0);
  const avgMovesUsed = avg((r) => r.movesUsed);
  return {
    winRate: results.length ? wins.length / results.length : 0,
    avgMovesUsed,
    par: Math.round(avgMovesUsed),
    avgScore: avg((r) => r.score),
  };
}

// ---------------------------------------------------------------------------
// test helpers
// ---------------------------------------------------------------------------

/**
 * Test helper: replace the board with a hand-built one. One string per row (top row
 * first), cells separated by spaces. Each cell token is:
 *   `0`..`5`  tile type        `R`  relic        `.`  empty hole
 * optionally followed by one special letter and/or web stars:
 *   `h` lineH   `v` lineV   `b` bomb   `s` sigil      `*` one web layer, `**` two
 * Example row: "0 1h 2* R . 3b** 4s 5". Every tile gets a fresh id. The row count and
 * width must match the level's height and width.
 */
export function __setBoard(state: Match3State, rows: string[]): void {
  const { width, height } = state.level;
  if (rows.length !== height) throw new Error(`__setBoard: expected ${height} rows, got ${rows.length}`);
  const specials: Record<string, Special> = { h: 'lineH', v: 'lineV', b: 'bomb', s: 'sigil' };
  state.cells = rows.map((row) => {
    const tokens = row.trim().split(/\s+/);
    if (tokens.length !== width) throw new Error(`__setBoard: expected ${width} cells in "${row}"`);
    return tokens.map((token): Cell | null => {
      const m = /^([0-5R.])([hvbs]?)(\*{0,2})$/.exec(token);
      if (!m) throw new Error(`__setBoard: bad cell "${token}"`);
      if (m[1] === '.') return null;
      const relic = m[1] === 'R';
      return {
        id: state.nextId++,
        type: relic ? -1 : Number(m[1]),
        special: relic ? 'none' : (specials[m[2]] ?? 'none'),
        relic,
        web: relic ? 0 : m[3].length,
      };
    });
  });
}

/** Test helper: force a seeded reshuffle (same code path as the automatic no-moves reshuffle). */
export function __reshuffle(state: Match3State): Snapshot {
  const steps: Snapshot[] = [];
  const ctx: Ctx = { state, rng: makeRng(state.rngState), steps, relicSpawnedThisMove: false };
  reshuffleBoard(ctx);
  state.rngState = ctx.rng.state;
  return steps[0];
}

/** Test helper: true if the board currently contains a 3+ match. */
export function __hasMatch(state: Match3State): boolean {
  return hasAnyMatch(state.cells);
}
