// Core game rules: new game, actions and tick. Pure TypeScript, no Phaser, no DOM.
// Every function takes the GameState and an `emit` callback for UI notifications.
import { DATA, buildingDef, cropDef, eventDef, orderDef, ritualDef, traitDef, type OrderNeed } from './data';
import { deriveSeed, makeRng, type Rng } from './rng';
import { TUTORIAL_ORDER, type BuildingState, type Emit, type Follower, type GameState, type RunState, type TutorialStep } from './types';
import { countItems, createMerge, moveItem, removeItems, tapGenerator, tickMerge, type Loc, type MoveResult } from '../puzzle/merge';
import { createGame, starsFor, type Match3State } from '../puzzle/match3';

const B = DATA.balance;
export const SAVE_VERSION = 2;
const noEmit: Emit = () => {};

// ---------- helpers ----------

export function stepIndex(step: TutorialStep | string): number {
  const i = TUTORIAL_ORDER.indexOf(step as TutorialStep);
  return i < 0 ? Infinity : i;
}
export const reached = (run: RunState, step: TutorialStep) => stepIndex(run.tutorial) >= stepIndex(step);

/** Run `fn` with the named RNG stream and persist the stream's state back into the save. */
export function withRng<T>(run: RunState, name: string, fn: (rng: Rng) => T): T {
  if (run.rng[name] === undefined) run.rng[name] = deriveSeed(run.seed, name);
  const rng = makeRng(run.rng[name]);
  const out = fn(rng);
  run.rng[name] = rng.state;
  return out;
}

export const xpNeeded = (level: number) => Math.round(B.xp.base * Math.pow(level, B.xp.exp));

export function addXp(g: GameState, amount: number, emit: Emit = noEmit): void {
  const run = g.run;
  run.xp += amount;
  while (run.xp >= xpNeeded(run.level)) {
    run.xp -= xpNeeded(run.level);
    run.level++;
    noteUnlock(g);
    emit({ type: 'levelUp', level: run.level });
  }
}

function noteUnlock(g: GameState): void {
  const s = g.meta.stats;
  s.longestGapSec = Math.max(s.longestGapSec, s.playSec - s.lastUnlockAt);
  s.lastUnlockAt = s.playSec;
}

export function addResource(run: RunState, res: 'devotion' | 'donations', amount: number): number {
  const cap = B.caps[res];
  const before = run[res];
  run[res] = Math.max(0, Math.min(cap, before + amount));
  return run[res] - before;
}

export function addSuspicion(run: RunState, amount: number): void {
  run.suspicion = Math.max(0, Math.min(B.suspicion.max, run.suspicion + amount));
  if (amount > 0) run.suspicionSeen = true;
}

export function suspicionBand(s: number): number {
  const b = B.suspicion.bands;
  return s < b[0] ? 0 : s < b[1] ? 1 : s < b[2] ? 2 : 3;
}

export const housing = (run: RunState) => run.buildings.reduce((n, b) => n + (buildingDef(b.type).housing ?? 0), 0);
export const hasBuilding = (run: RunState, type: string) => run.buildings.some((b) => b.type === type);
export const inv = (run: RunState, item: string) => run.inventory[item] ?? 0;

function traitSum(run: RunState, field: 'donationsPerMin' | 'suspicionDecayPct'): number {
  let n = 0;
  for (const f of run.followers) for (const tr of f.traits) n += traitDef(tr)[field] ?? 0;
  return n;
}
function traitMax(run: RunState, field: 'cropYieldBonus' | 'recruitSuspicion'): number {
  let n = 0;
  for (const f of run.followers) for (const tr of f.traits) n = Math.max(n, traitDef(tr)[field] ?? 0);
  return n;
}

// ---------- new game ----------

export function newGame(seed: number, nowWall: number): GameState {
  const u = B.map.usable;
  const run: RunState = {
    seed: seed >>> 0,
    rng: {},
    time: 0,
    devotion: B.start.devotion,
    donations: B.start.donations,
    suspicion: 0,
    suspicionSeen: false,
    xp: 0,
    level: 1,
    nextId: 1,
    inventory: {},
    buildings: [],
    followers: [],
    pendingDrafts: 0,
    draft: null,
    reliquary: createMerge(DATA.merge, deriveSeed(seed, 'merge')),
    orders: [],
    favor: {},
    rituals: {},
    activeRitual: null,
    event: null,
    flags: {},
    tutorial: 'welcome',
    catAt: 0,
  };
  // The Dormitory comes with the land. The previous owners left in a hurry.
  run.buildings.push({ id: run.nextId++, type: 'dormitory', x: u.x + u.w - 3, y: u.y + 1, level: 1, stored: 0 });
  const g: GameState = {
    saveVersion: SAVE_VERSION,
    meta: {
      relics: 0,
      ascensions: 0,
      grimoire: [],
      mergeCodex: {},
      bestiary: [],
      endings: [],
      settings: { reducedMotion: false, relaxedPuzzles: false, speedIndex: 0, sound: true },
      stats: { playSec: 0, modeSec: {}, lastUnlockAt: 0, longestGapSec: 0 },
    },
    run,
    lastSeenWall: nowWall,
    highWater: nowWall,
  };
  run.catAt = withRng(run, 'events', (r) => B.cat.minSec + r.int(B.cat.maxSec - B.cat.minSec));
  return g;
}

// ---------- buildings ----------

export function canPlace(run: RunState, type: string, x: number, y: number, ignoreId?: number): boolean {
  const def = buildingDef(type);
  const u = B.map.usable;
  if (x < u.x || y < u.y || x + def.w > u.x + u.w || y + def.h > u.y + u.h) return false;
  for (const b of run.buildings) {
    if (b.id === ignoreId) continue;
    const d = buildingDef(b.type);
    if (x < b.x + d.w && x + def.w > b.x && y < b.y + d.h && y + def.h > b.y) return false;
  }
  return true;
}

export function buildable(run: RunState): string[] {
  return DATA.buildings
    .filter((d) => stepIndex(d.availableFrom) <= stepIndex(run.tutorial))
    .filter((d) => run.buildings.filter((b) => b.type === d.id).length < d.max)
    .map((d) => d.id);
}

export const canAfford = (run: RunState, cost: { devotion: number; donations: number }) =>
  run.devotion >= cost.devotion && run.donations >= cost.donations;

export function placeBuilding(g: GameState, type: string, x: number, y: number, emit: Emit = noEmit): boolean {
  const run = g.run;
  const def = buildingDef(type);
  if (!buildable(run).includes(type) || !canAfford(run, def.cost) || !canPlace(run, type, x, y)) return false;
  run.devotion -= def.cost.devotion;
  run.donations -= def.cost.donations;
  const b: BuildingState = { id: run.nextId++, type, x, y, level: 1, stored: 0 };
  if (def.plots) b.plots = Array.from({ length: def.plots }, () => ({ crop: null, plantedAt: 0 }));
  run.buildings.push(b);
  assignJobs(run);
  addXp(g, B.xp.perBuild, emit);
  noteUnlock(g);
  emit({ type: 'float', textKey: 'float.built', tone: 'gain', at: { building: b.id } });
  return true;
}

export function assignJobs(run: RunState): void {
  const producers = run.buildings.filter((b) => buildingDef(b.type).produces);
  for (const f of run.followers) {
    if (f.job !== null && run.buildings.some((b) => b.id === f.job)) continue;
    if (producers.length === 0) { f.job = null; continue; }
    const counts = producers.map((b) => run.followers.filter((o) => o.job === b.id).length);
    f.job = producers[counts.indexOf(Math.min(...counts))].id;
  }
}

// ---------- follower stats: what each one does (shown to the player in the follower sheet) ----------

/** Productivity sets work speed; Sanity nudges it up or down. Returns the share of a building's base output this follower adds (0.5 = +50%). */
export function followerWork(f: Follower): number {
  let pct = 0;
  for (const tr of f.traits) pct += traitDef(tr).outputPct ?? 0;
  const effort = 0.5 + f.stats.productivity / 100 + (f.stats.sanity - 50) * B.stats.sanityWorkPerPoint;
  return Math.max(0, B.worker.bonusPerWorker * effort * (1 + pct / 100));
}
/** The part of followerWork that comes from Sanity alone (can be negative). */
export const sanityWorkPart = (f: Follower) => B.worker.bonusPerWorker * (f.stats.sanity - 50) * B.stats.sanityWorkPerPoint;
/** Devotion: each point adds to the Devotion paid by rituals. Percent for one follower. */
export const followerRitualPct = (f: Follower) => f.stats.devotion * B.stats.devotionRitualPctPerPoint;
/** Total ritual Devotion bonus from the whole flock, in percent. */
export const ritualDevotionPct = (run: RunState) => run.followers.reduce((n, f) => n + followerRitualPct(f), 0);
/** Doubt: the flock's average Doubt slows how fast Suspicion fades. Returns the slowdown as a fraction (0.2 = 20% slower). */
export function doubtDecayPenalty(run: RunState): number {
  if (run.followers.length === 0) return 0;
  const avg = run.followers.reduce((n, f) => n + f.stats.doubt, 0) / run.followers.length;
  return Math.min(0.9, avg * B.stats.doubtDecayPenaltyPerPoint);
}
/** One follower's share of that slowdown, in percent (for display). */
export const followerDoubtPct = (run: RunState, f: Follower) => (run.followers.length ? (f.stats.doubt * B.stats.doubtDecayPenaltyPerPoint * 100) / run.followers.length : 0);

/** Production per second for a building, including assigned followers. */
export function productionRate(run: RunState, b: BuildingState): number {
  const def = buildingDef(b.type);
  if (!def.produces) return 0;
  let mult = 1;
  for (const f of run.followers) {
    if (f.job !== b.id) continue;
    mult += followerWork(f);
  }
  return (def.produces.perMin / 60) * mult;
}

export const storageCap = (b: BuildingState) => {
  const def = buildingDef(b.type);
  return def.produces ? def.produces.perMin * (def.storageMin ?? 10) : 0;
};

export function collect(g: GameState, buildingId: number, emit: Emit = noEmit): number {
  const run = g.run;
  const b = run.buildings.find((x) => x.id === buildingId);
  if (!b) return 0;
  const def = buildingDef(b.type);
  const amount = Math.floor(b.stored);
  if (!def.produces || amount <= 0) return 0;
  const got = addResource(run, def.produces.resource, amount);
  b.stored -= amount;
  run.flags.collected = true;
  emit({ type: 'float', textKey: `float.${def.produces.resource}`, params: { n: got }, tone: 'gain', at: { building: b.id } });
  return got;
}

// ---------- garden ----------

export function plotReady(run: RunState, b: BuildingState, slot: number): boolean {
  const p = b.plots?.[slot];
  return !!p && !!p.crop && run.time - p.plantedAt >= cropDef(p.crop).growSec;
}
export function plotProgress(run: RunState, b: BuildingState, slot: number): number {
  const p = b.plots?.[slot];
  if (!p || !p.crop) return 0;
  return Math.min(1, (run.time - p.plantedAt) / cropDef(p.crop).growSec);
}

export function plant(g: GameState, buildingId: number, slot: number, crop: string, emit: Emit = noEmit): boolean {
  const run = g.run;
  const b = run.buildings.find((x) => x.id === buildingId);
  const p = b?.plots?.[slot];
  const def = cropDef(crop);
  if (!b || !p || p.crop || !def || run.donations < def.seedCost) return false;
  run.donations -= def.seedCost;
  p.crop = crop;
  p.plantedAt = run.time;
  run.flags[`planted_${crop}`] = true;
  return true;
}

export function harvest(g: GameState, buildingId: number, slot: number, emit: Emit = noEmit): number {
  const run = g.run;
  const b = run.buildings.find((x) => x.id === buildingId);
  if (!b || !plotReady(run, b, slot)) return 0;
  const p = b.plots![slot];
  const crop = p.crop!;
  const n = cropDef(crop).yield + traitMax(run, 'cropYieldBonus');
  run.inventory[crop] = inv(run, crop) + n;
  p.crop = null;
  run.flags[`harvested_${crop}`] = true;
  emit({ type: 'float', textKey: 'float.item', params: { n, item: `item.${crop}.name` }, tone: 'gain', at: { building: b.id } });
  return n;
}

// ---------- alchemy ----------

export interface BrewResult { ok: boolean; output: string; count: number; discovered: boolean; known: boolean }

export function matchRecipe(ingredients: string[]): string | null {
  const key = [...ingredients].sort().join('+');
  const r = DATA.recipes.recipes.find((x) => [...x.ingredients].sort().join('+') === key);
  return r ? r.id : null;
}

export function brew(g: GameState, ingredients: string[], fine: boolean, emit: Emit = noEmit): BrewResult {
  const run = g.run;
  const R = DATA.recipes;
  const fail: BrewResult = { ok: false, output: '', count: 0, discovered: false, known: false };
  if (!hasBuilding(run, 'alchemy_lab')) return fail;
  if (ingredients.length < R.minIngredients || ingredients.length > R.maxIngredients) return fail;
  const need: Record<string, number> = {};
  for (const i of ingredients) need[i] = (need[i] ?? 0) + 1;
  for (const k of Object.keys(need)) if (inv(run, k) < need[k]) return fail;
  for (const k of Object.keys(need)) run.inventory[k] -= need[k];
  const rid = matchRecipe(ingredients);
  const recipe = rid ? R.recipes.find((x) => x.id === rid)! : null;
  const output = recipe ? recipe.output : R.failOutput;
  const count = recipe && fine ? 2 : 1;
  run.inventory[output] = inv(run, output) + count;
  let discovered = false;
  const known = !!recipe && g.meta.grimoire.includes(recipe.id);
  if (recipe && !known) {
    g.meta.grimoire.push(recipe.id);
    discovered = true;
    noteUnlock(g);
  }
  if (recipe) run.flags[`brewed_${recipe.id}`] = true;
  return { ok: true, output, count, discovered, known };
}

// ---------- reliquary ----------

export function mergeTap(g: GameState, idx: number): number {
  return tapGenerator(g.run.reliquary, DATA.merge, idx);
}

export function mergeMove(g: GameState, from: Loc, to: Loc, emit: Emit = noEmit): MoveResult {
  const res = moveItem(g.run.reliquary, DATA.merge, from, to);
  if (res.kind === 'merge') {
    const prev = g.meta.mergeCodex[res.chain] ?? 1;
    if (res.tier > prev) {
      g.meta.mergeCodex[res.chain] = res.tier;
      noteUnlock(g);
    }
  }
  return res;
}

// ---------- rituals ----------

export function ritualUnlocked(run: RunState, levelId: string): boolean {
  const idx = DATA.rituals.findIndex((r) => r.id === levelId);
  const gates: TutorialStep[] = ['ritual1', 'ritual2', 'ritual3'];
  return idx >= 0 && reached(run, gates[Math.min(idx, gates.length - 1)]);
}

export function startRitual(g: GameState, levelId: string): Match3State | null {
  if (!ritualUnlocked(g.run, levelId)) return null;
  const st = createGame(ritualDef(levelId), { relaxed: g.meta.settings.relaxedPuzzles });
  g.run.activeRitual = st;
  return st;
}

export interface RitualReward { won: boolean; stars: number; firstTime: boolean; flockPct: number; devotion: number; donations: number; basil: number; drafts: number; favor: number; entity: string | null }

/** Close the active ritual and pay out. Call when its status is 'won' or 'lost' (or to abandon). */
export function finishRitual(g: GameState, emit: Emit = noEmit): RitualReward {
  const run = g.run;
  const st = run.activeRitual as Match3State | null;
  const out: RitualReward = { won: false, stars: 0, firstTime: false, flockPct: 0, devotion: 0, donations: 0, basil: 0, drafts: 0, favor: 0, entity: null };
  run.activeRitual = null;
  if (!st || st.status !== 'won') return out;
  const level = st.level;
  const idx = DATA.rituals.findIndex((r) => r.id === level.id);
  const stars = Math.max(1, starsFor(st));
  const prev = run.rituals[level.id] ?? 0;
  const firstTime = prev === 0;
  const R = B.ritual;
  const replay = firstTime ? 1 : R.replayMult;
  let dev = (R.devotionBase + R.devotionPerIndex * idx) * R.starMult[stars];
  if (level.purpose === 'sermon') dev *= 1 + R.sermonBonus;
  out.flockPct = Math.round(ritualDevotionPct(run));
  dev *= 1 + ritualDevotionPct(run) / 100;
  out.won = true;
  out.stars = stars;
  out.firstTime = firstTime;
  out.devotion = addResource(run, 'devotion', Math.round(dev * replay));
  out.donations = addResource(run, 'donations', Math.round((R.donationsFlat + (st.collected[5] ?? 0) * R.coinValue) * replay));
  if (hasBuilding(run, 'greenhouse')) {
    out.basil = Math.floor((st.collected[4] ?? 0) * 0.2 * replay);
    if (out.basil > 0) run.inventory.basil = inv(run, 'basil') + out.basil;
  }
  if (stars > prev) {
    addXp(g, (stars - prev) * B.xp.perStar, emit);
    run.rituals[level.id] = stars;
  }
  if (level.purpose === 'sermon' && firstTime) out.drafts = 1;
  if (level.purpose === 'recruit') out.drafts = firstTime ? 2 : 1;
  out.drafts = Math.max(0, Math.min(out.drafts, housing(run) - run.followers.length - run.pendingDrafts));
  run.pendingDrafts += out.drafts;
  if (level.purpose === 'summon') {
    const ent = DATA.entities.find((e) => e.summonRitual === level.id);
    if (ent) {
      out.entity = ent.id;
      if (!g.meta.bestiary.includes(ent.id)) {
        g.meta.bestiary.push(ent.id);
        noteUnlock(g);
        for (const o of DATA.orders.filter((x) => x.from === ent.id)) run.orders.push({ id: o.id, filled: false });
      }
      if (firstTime) {
        out.favor = R.summonFavor;
        run.favor[ent.id] = (run.favor[ent.id] ?? 0) + out.favor;
      }
    }
  }
  if (firstTime) noteUnlock(g);
  ensureDraft(g, emit);
  return out;
}

// ---------- recruits ----------

export function generateRecruit(run: RunState, rng: Rng): Follower {
  const F = DATA.followers;
  const used = new Set(run.followers.map((f) => f.name));
  const free = F.names.filter((n) => !used.has(n));
  const name = rng.pick(free.length ? free : F.names);
  const pool = rng.shuffle(F.traits.map((x) => x.id));
  const traits = pool.slice(0, rng.next() < 0.45 ? 2 : 1);
  const stats = { devotion: 35 + rng.int(31), sanity: 45 + rng.int(31), productivity: 35 + rng.int(31), doubt: 15 + rng.int(26) };
  for (const tr of traits) {
    const s = traitDef(tr).stats;
    if (!s) continue;
    for (const k of Object.keys(s) as (keyof typeof stats)[]) stats[k] = Math.max(0, Math.min(100, stats[k] + (s[k] ?? 0)));
  }
  return { id: 0, name, traits, stats, skin: rng.int(F.skins), robe: rng.int(F.robes), job: null };
}

export function ensureDraft(g: GameState, emit: Emit = noEmit): void {
  const run = g.run;
  if (run.draft || run.pendingDrafts <= 0) return;
  if (run.followers.length >= housing(run)) { run.pendingDrafts = 0; return; }
  run.draft = withRng(run, 'recruits', (rng) => {
    const out: Follower[] = [];
    const names = new Set<string>();
    while (out.length < DATA.followers.draftSize) {
      const f = generateRecruit(run, rng);
      if (names.has(f.name)) continue;
      names.add(f.name);
      out.push(f);
    }
    return out;
  });
  emit({ type: 'draft' });
}

export function draftPick(g: GameState, index: number, emit: Emit = noEmit): Follower | null {
  const run = g.run;
  if (!run.draft || !run.draft[index]) return null;
  const heat = B.suspicion.perRecruit + traitMax(run, 'recruitSuspicion');
  const f = { ...run.draft[index], id: run.nextId++ };
  run.followers.push(f);
  run.draft = null;
  run.pendingDrafts = Math.max(0, run.pendingDrafts - 1);
  assignJobs(run);
  addSuspicion(run, heat);
  emit({ type: 'float', textKey: 'float.suspicion_up', params: { n: heat }, tone: 'loss' });
  ensureDraft(g, emit);
  return f;
}

// ---------- orders ----------

export function needHave(run: RunState, need: OrderNeed): number {
  return 'item' in need ? inv(run, need.item) : countItems(run.reliquary, need.merge, need.tier);
}
export function canFill(run: RunState, orderId: string): boolean {
  const o = run.orders.find((x) => x.id === orderId);
  return !!o && !o.filled && orderDef(orderId).needs.every((n) => needHave(run, n) >= n.count);
}
export function fillOrder(g: GameState, orderId: string, emit: Emit = noEmit): boolean {
  const run = g.run;
  if (!canFill(run, orderId)) return false;
  const def = orderDef(orderId);
  for (const n of def.needs) {
    if ('item' in n) run.inventory[n.item] -= n.count;
    else removeItems(run.reliquary, n.merge, n.tier, n.count);
  }
  run.orders.find((x) => x.id === orderId)!.filled = true;
  if (def.reward.devotion) addResource(run, 'devotion', def.reward.devotion);
  if (def.reward.donations) addResource(run, 'donations', def.reward.donations);
  if (def.reward.favor) run.favor[def.from] = (run.favor[def.from] ?? 0) + def.reward.favor;
  const xp = (B.xp.perOrderBase + B.xp.perOrderPerLevel * run.level) * (def.kind === 'entity' ? B.xp.entityOrderMult : 1);
  addXp(g, Math.round(xp), emit);
  return true;
}

// ---------- events ----------

export function triggerEvent(g: GameState, id: string, emit: Emit = noEmit): boolean {
  if (g.run.event || !DATA.events.some((e) => e.id === id)) return false;
  g.run.event = { id };
  emit({ type: 'event', id });
  return true;
}

export function choiceAvailable(run: RunState, eventId: string, choice: number): boolean {
  const c = eventDef(eventId).choices[choice];
  return !!c && (!c.requires || inv(run, c.requires.item) >= c.requires.count);
}

export function resolveEvent(g: GameState, choice: number, emit: Emit = noEmit): boolean {
  const run = g.run;
  if (!run.event) return false;
  const id = run.event.id;
  if (!choiceAvailable(run, id, choice)) return false;
  const fx = eventDef(id).choices[choice].effects;
  if (fx.consume) run.inventory[fx.consume.item] = inv(run, fx.consume.item) - fx.consume.count;
  if (fx.suspicion) {
    addSuspicion(run, fx.suspicion);
    emit({ type: 'float', textKey: fx.suspicion > 0 ? 'float.suspicion_up' : 'float.suspicion_down', params: { n: Math.abs(fx.suspicion) }, tone: fx.suspicion > 0 ? 'loss' : 'gain' });
  }
  if (fx.devotion) addResource(run, 'devotion', fx.devotion);
  if (fx.donations) addResource(run, 'donations', fx.donations);
  if (fx.flag) run.flags[fx.flag] = true;
  run.flags[`${id}_done`] = true;
  run.flags[`${id}_choice_${eventDef(id).choices[choice].id}`] = true;
  run.event = null;
  return true;
}

// ---------- tick ----------

export function tick(g: GameState, dt: number, emit: Emit = noEmit, opts: { offline?: boolean } = {}): void {
  if (!(dt > 0)) return;
  const run = g.run;
  const off = !!opts.offline;
  const prodMult = off ? B.offline.productionMult : 1;
  run.time += dt;
  for (const b of run.buildings) {
    const rate = productionRate(run, b);
    if (rate > 0) b.stored = Math.min(storageCap(b), b.stored + rate * dt * prodMult);
  }
  const don = traitSum(run, 'donationsPerMin');
  if (don > 0) addResource(run, 'donations', (don / 60) * dt * prodMult);
  if (run.suspicion > 0) {
    const decay = (B.suspicion.decayPerMin / 60) * dt * (1 + traitSum(run, 'suspicionDecayPct') / 100) * (1 - doubtDecayPenalty(run)) * (off ? B.offline.suspicionDecayMult : 1);
    run.suspicion = Math.max(0, run.suspicion - decay);
  }
  tickMerge(run.reliquary, DATA.merge, dt);
  if (!off) {
    g.meta.stats.playSec += dt;
    if (!run.event && !run.flags.cat_adopted && reached(run, 'build_greenhouse') && run.time >= run.catAt) {
      run.catAt = run.time + withRng(run, 'events', (r) => B.cat.minSec + r.int(B.cat.maxSec - B.cat.minSec));
      triggerEvent(g, 'cat', emit);
    }
    if (run.tutorial === 'reporter' && !run.event && !run.flags.reporter_done) triggerEvent(g, 'reporter', emit);
  }
}

// ---------- tutorial ----------

const STEP_DONE: Record<TutorialStep, (g: GameState) => boolean> = {
  welcome: (g) => !!g.run.flags.welcomed,
  build_hall: (g) => hasBuilding(g.run, 'sermon_hall'),
  collect: (g) => !!g.run.flags.collected,
  ritual1: (g) => (g.run.rituals.r1 ?? 0) > 0,
  draft1: (g) => g.run.followers.length >= 1,
  ritual2: (g) => (g.run.rituals.r2 ?? 0) > 0,
  draft2: (g) => g.run.followers.length >= 3,
  build_greenhouse: (g) => hasBuilding(g.run, 'greenhouse'),
  plant: (g) => !!g.run.flags.planted_basil && !!g.run.flags.planted_nightshade,
  merge: (g) => (g.meta.mergeCodex.paper ?? 1) >= 3,
  harvest: (g) => !!g.run.flags.harvested_basil && !!g.run.flags.harvested_nightshade,
  build_lab: (g) => hasBuilding(g.run, 'alchemy_lab'),
  brew: (g) => !!g.run.flags.brewed_amnesia_brew,
  reporter: (g) => !!g.run.flags.reporter_done,
  ritual3: (g) => (g.run.rituals.r3 ?? 0) > 0,
  orders: (g) => g.run.orders.length > 0 && g.run.orders.every((o) => o.filled),
  away: (g) => !!g.run.flags.away_done,
  ascension: (g) => !!g.run.flags.ascension_viewed,
  done: () => false,
};

/** Move the tutorial forward as far as its conditions allow. Returns true if it advanced. */
export function advanceTutorial(g: GameState, emit: Emit = noEmit): boolean {
  let moved = false;
  for (let guard = 0; guard < TUTORIAL_ORDER.length; guard++) {
    const step = g.run.tutorial;
    if (step === 'done' || !STEP_DONE[step](g)) break;
    g.run.tutorial = TUTORIAL_ORDER[stepIndex(step) + 1];
    noteUnlock(g);
    moved = true;
    emit({ type: 'tutorial', step: g.run.tutorial });
  }
  return moved;
}

// ---------- tabs ----------

export type TabId = 'compound' | 'rituals' | 'reliquary' | 'alchemy' | 'orders';
export function tabUnlocked(run: RunState, tab: TabId): boolean {
  switch (tab) {
    case 'compound': return true;
    case 'rituals': return reached(run, 'ritual1');
    case 'alchemy': return hasBuilding(run, 'greenhouse');
    case 'reliquary': return reached(run, 'merge');
    case 'orders': return run.orders.length > 0;
  }
}

// ---------- debug ----------

export function debugSkip(g: GameState, seconds: number, emit: Emit = noEmit): void {
  let left = seconds;
  while (left > 0) {
    const step = Math.min(60, left);
    tick(g, step, emit);
    left -= step;
  }
}
