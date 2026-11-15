// Core game rules: new game, actions and tick. Pure TypeScript, no Phaser, no DOM.
// Every function takes the GameState and an `emit` callback for UI notifications.
import { DATA, buildingDef, cropDef, entityDef, eventDef, orderDef, riteDef, ritualDef, traitDef, type BoonField, type OrderNeed, type UpgradeDef, type VisitEffects } from './data';
import { hashString } from './rng';
import { deriveSeed, makeRng, type Rng } from './rng';
import { TUTORIAL_ORDER, type ActiveRite, type BuildingState, type Emit, type Follower, type GameState, type RunState, type TutorialStep } from './types';
import { addGenerator, countItems, placeItem, createMerge, moveItem, removeItems, tapGenerator, tickMerge, type Loc, type MoveResult } from '../puzzle/merge';
import { createGame, starsFor, type Match3State } from '../puzzle/match3';

const B = DATA.balance;
export const SAVE_VERSION = 4;
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
    ensureGenerators(run);
    emit({ type: 'levelUp', level: run.level });
  }
}

function noteUnlock(g: GameState): void {
  const s = g.meta.stats;
  s.longestGapSec = Math.max(s.longestGapSec, s.playSec - s.lastUnlockAt);
  s.lastUnlockAt = s.playSec;
}

export function addResource(run: RunState, res: 'devotion' | 'donations', amount: number): number {
  const cap = res === 'devotion' ? devotionCap(run) : B.caps.donations;
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

/** A building's per-level bonus for one field, e.g. levelBonus(b, 'housing') = extra beds from upgrades. */
export function levelBonus(b: BuildingState, field: 'outputPct' | 'housing' | 'plots' | 'brewBonus'): number {
  return (buildingDef(b.type).perLevel?.[field] ?? 0) * (b.level - 1);
}
export const housing = (run: RunState) => run.buildings.reduce((n, b) => n + (buildingDef(b.type).housing ? buildingDef(b.type).housing! + levelBonus(b, 'housing') : 0), 0);
export function devotionCap(run: RunState): number {
  let cap = B.caps.devotion;
  for (const b of run.buildings) {
    const caps = buildingDef(b.type).devotionCap;
    if (caps) cap = Math.max(cap, caps[Math.min(b.level, caps.length) - 1]);
  }
  return cap;
}

// ---------- entity boons: permanent bonuses earned with Favor ----------

/** How many of an entity's boons the current Favor has unlocked. */
export function boonsUnlocked(run: RunState, entityId: string): number {
  const fav = run.favor[entityId] ?? 0;
  return entityDef(entityId).boons.filter((b) => fav >= b.favor).length;
}
/** Sum of one boon field across every entity met this run. */
export function boon(run: RunState, field: BoonField): number {
  let n = 0;
  for (const id of run.met) {
    const fav = run.favor[id] ?? 0;
    for (const b of entityDef(id).boons) if (b.field === field && fav >= b.favor) n += b.value;
    const a = entityDef(id).audience;
    if (a && a.field === field && run.audiences.includes(id)) n += a.value;
  }
  return n;
}
// ---------- inspections: sealed buildings and followers away ----------

export const isSealed = (run: RunState, b: BuildingState | undefined) => !!b && (b.sealedUntil ?? 0) > run.time;
export const isAway = (run: RunState, f: Follower) => (f.awayUntil ?? 0) > run.time;
/** Seconds left (for "reopens in about N min"). */
export const sealLeft = (run: RunState, b: BuildingState) => Math.max(0, (b.sealedUntil ?? 0) - run.time);
const buildingOf = (run: RunState, type: string) => run.buildings.find((b) => b.type === type);

/** Things that unlock on reaching a compound level, for the level-up screen. */
export function unlocksAt(level: number): { kind: 'crop' | 'generator' | 'ritual'; id: string }[] {
  const out: { kind: 'crop' | 'generator' | 'ritual'; id: string }[] = [];
  for (const c of DATA.crops) if (c.unlockLevel === level && level > 1) out.push({ kind: 'crop', id: c.id });
  for (const gen of DATA.merge.generators) if ((gen.unlockLevel ?? 1) === level && level > 1) out.push({ kind: 'generator', id: gen.id });
  for (const r of DATA.rituals) if (r.unlock?.level === level) out.push({ kind: 'ritual', id: r.id });
  return out;
}
export const cropUnlocked = (run: RunState, cropId: string) => run.level >= (cropDef(cropId)?.unlockLevel ?? 1);
/** Place any generator the compound level has unlocked that is not on the merge grid yet. */
export function ensureGenerators(run: RunState): void {
  for (const gen of DATA.merge.generators) if (run.level >= (gen.unlockLevel ?? 1)) addGenerator(run.reliquary, DATA.merge, gen.id);
}
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
    ordersFilled: {},
    orderNextAt: {},
    lastOrder: {},
    met: [],
    hints: [],
    omens: 0,
    audiences: [],
    activeRite: null,
    inspection: null,
    daily: { day: '', bank: 0 },
    visitClock: 0,
    lastVisitAt: 0,
    draftBonus: 0,
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

// ---------- upgrades ----------

export const nextUpgrade = (b: BuildingState): UpgradeDef | null => buildingDef(b.type).upgrades?.[b.level - 1] ?? null;
export const maxLevel = (type: string) => 1 + (buildingDef(type).upgrades?.length ?? 0);
export function canUpgrade(run: RunState, b: BuildingState): boolean {
  const up = nextUpgrade(b);
  return !!up && canAfford(run, up.cost) && run.omens >= (up.omens ?? 0) && (!up.merge || countItems(run.reliquary, up.merge.chain, up.merge.tier) >= 1);
}
export function upgradeBuilding(g: GameState, buildingId: number, emit: Emit = noEmit): boolean {
  const run = g.run;
  const b = run.buildings.find((x) => x.id === buildingId);
  if (!b || !canUpgrade(run, b)) return false;
  const up = nextUpgrade(b)!;
  run.devotion -= up.cost.devotion;
  run.donations -= up.cost.donations;
  if (up.merge) removeItems(run.reliquary, up.merge.chain, up.merge.tier, 1);
  run.omens -= up.omens ?? 0;
  b.level++;
  const def = buildingDef(b.type);
  if (b.plots && def.plots) while (b.plots.length < def.plots + levelBonus(b, 'plots')) b.plots.push({ crop: null, plantedAt: 0 });
  addXp(g, B.xp.perUpgrade, emit);
  noteUnlock(g);
  emit({ type: 'float', textKey: 'float.upgraded', params: { n: b.level }, tone: 'gain', at: { building: b.id } });
  return true;
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
export const ritualDevotionPct = (run: RunState) => run.followers.reduce((n, f) => n + (isAway(run, f) ? 0 : followerRitualPct(f)), 0);
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
  if (!def.produces || isSealed(run, b)) return 0;
  let mult = 1;
  for (const f of run.followers) {
    if (f.job !== b.id || isAway(run, f)) continue;
    mult += followerWork(f);
  }
  mult += (levelBonus(b, 'outputPct') + boon(run, 'outputPct')) / 100;
  return (def.produces.perMin / 60) * mult;
}

export const storageCap = (b: BuildingState) => {
  const def = buildingDef(b.type);
  return def.produces ? def.produces.perMin * (def.storageMin ?? 10) * (1 + levelBonus(b, 'outputPct') / 100) : 0;
};

export function collect(g: GameState, buildingId: number, emit: Emit = noEmit): number {
  const run = g.run;
  const b = run.buildings.find((x) => x.id === buildingId);
  if (!b) return 0;
  const def = buildingDef(b.type);
  const amount = Math.floor(b.stored);
  if (!def.produces || amount <= 0 || isSealed(run, b)) return 0;
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
  if (!b || !p || p.crop || !def || isSealed(run, b) || !cropUnlocked(run, crop) || run.donations < def.seedCost) return false;
  run.donations -= def.seedCost;
  p.crop = crop;
  p.plantedAt = run.time;
  run.flags[`planted_${crop}`] = true;
  return true;
}

export function harvest(g: GameState, buildingId: number, slot: number, emit: Emit = noEmit): number {
  const run = g.run;
  const b = run.buildings.find((x) => x.id === buildingId);
  if (!b || isSealed(run, b) || !plotReady(run, b, slot)) return 0;
  const p = b.plots![slot];
  const crop = p.crop!;
  const n = cropDef(crop).yield + traitMax(run, 'cropYieldBonus') + boon(run, 'cropYieldBonus');
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
  if (!hasBuilding(run, 'alchemy_lab') || isSealed(run, buildingOf(run, 'alchemy_lab'))) return fail;
  if (ingredients.length < R.minIngredients || ingredients.length > R.maxIngredients) return fail;
  const need: Record<string, number> = {};
  for (const i of ingredients) need[i] = (need[i] ?? 0) + 1;
  for (const k of Object.keys(need)) if (inv(run, k) < need[k]) return fail;
  for (const k of Object.keys(need)) run.inventory[k] -= need[k];
  const rid = matchRecipe(ingredients);
  const recipe = rid ? R.recipes.find((x) => x.id === rid)! : null;
  const output = recipe ? recipe.output : R.failOutput;
  const lab = run.buildings.find((x) => x.type === 'alchemy_lab')!;
  const count = recipe ? 1 + (fine ? 1 : 0) + levelBonus(lab, 'brewBonus') : 1;
  run.inventory[output] = inv(run, output) + count;
  let discovered = false;
  const known = !!recipe && g.meta.grimoire.includes(recipe.id);
  if (recipe && !known) {
    g.meta.grimoire.push(recipe.id);
    discovered = true;
    addXp(g, B.xp.perRecipe, emit);
    noteUnlock(g);
  }
  if (recipe) run.flags[`brewed_${recipe.id}`] = true;
  return { ok: true, output, count, discovered, known };
}

/** A recipe the player may be shown: hinted in data, or hinted by an entity they have met. */
export const recipeHinted = (run: RunState, recipeId: string) => !!DATA.recipes.recipes.find((r) => r.id === recipeId)?.hinted || run.hints.includes(recipeId);

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
  const lv = DATA.rituals.find((r) => r.id === levelId);
  if (!lv) return false;
  if (lv.purpose === 'defense') return run.inspection?.level === levelId; // Look Busy boards only while a visitor waits
  const u = lv.unlock ?? {};
  if (u.step && !reached(run, u.step as TutorialStep)) return false;
  if (u.level && run.level < u.level) return false;
  return true;
}

// ---------- rites: every ritual after the tutorial is aimed at a target ----------

export const ritesOpen = (run: RunState) => reached(run, 'away');

/** Can this rite be picked right now? Returns a text key explaining why not, or null. */
export function riteBlocked(g: GameState, riteId: string): string | null {
  const run = g.run;
  const r = riteDef(riteId);
  if (r.show.metAny && run.met.length === 0) return 'rite.locked';
  if (r.show.building && !hasBuilding(run, r.show.building)) return 'rite.locked';
  if (r.show.generator && run.level < (DATA.merge.generators.find((x) => x.id === r.show.generator)?.unlockLevel ?? 1)) return 'rite.locked';
  if (r.show.inspection && !run.inspection) return 'rite.look_busy.none';
  if (riteId === 'recruit' && run.followers.length + run.pendingDrafts >= housing(run)) return 'rite.recruit.full';
  return null;
}
/** Rites the player can see (locked ones are hidden; blocked-with-a-reason ones are shown greyed). */
export const ritesVisible = (g: GameState) => DATA.rites.rites.filter((r) => riteBlocked(g, r.id) !== 'rite.locked');

export function startRitual(g: GameState, levelId: string, rite?: ActiveRite): Match3State | null {
  if (!ritualUnlocked(g.run, levelId)) return null;
  const lv = ritualDef(levelId);
  if (lv.purpose === 'defense') rite = { id: 'look_busy' };
  else if (!ritesOpen(g.run)) rite = undefined;
  else if (!rite || riteBlocked(g, rite.id)) rite = { id: 'sermon' };
  const st = createGame(lv, { relaxed: g.meta.settings.relaxedPuzzles });
  g.run.activeRitual = st;
  g.run.activeRite = rite ?? null;
  if (rite) g.run.flags.riteUsed = true;
  return st;
}

// ---------- daily rite ----------

/** Advance the daily bank to `today` (a local date string such as 2026-11-15). Clock changes backwards add nothing. */
export function updateDaily(run: RunState, today: string): void {
  const d = run.daily;
  if (d.day === today) return;
  const days = d.day ? Math.round((Date.parse(today) - Date.parse(d.day)) / 86400000) : 1;
  if (days > 0) d.bank = Math.min(DATA.rites.daily.bankMax, d.bank + days);
  d.day = today;
}
/** Today's board: an unlocked, non-summon, non-inspection level picked by the date. */
export function dailyLevel(run: RunState, today: string): string | null {
  const pool = DATA.rituals.filter((l) => l.purpose !== 'summon' && l.purpose !== 'defense' && ritualUnlocked(run, l.id));
  return pool.length ? pool[hashString(today) % pool.length].id : null;
}

// ---------- inspections ----------

export interface VisitSummary { fine: number; sealed: string | null; sealMin: number; away: string | null; awayMin: number; suspicion: number }

/** Apply a visit's outcome. `cut` (0-1) shrinks fines, seals and time away (Look Busy stars). Suspicion always falls. */
export function applyVisit(g: GameState, fx: VisitEffects, cut: number, emit: Emit = noEmit): VisitSummary {
  const run = g.run;
  const keep = Math.max(0, 1 - cut);
  const out: VisitSummary = { fine: 0, sealed: null, sealMin: 0, away: null, awayMin: 0, suspicion: 0 };
  if (fx.finePct) {
    out.fine = Math.floor((run.donations * fx.finePct * keep) / 100);
    run.donations -= out.fine;
    if (out.fine > 0) emit({ type: 'float', textKey: 'float.fine', params: { n: out.fine }, tone: 'loss' });
  }
  if (fx.sealSec && keep > 0) {
    const options = run.buildings.filter((b) => b.type !== 'dormitory');
    const b = options.length ? withRng(run, 'events', (r) => r.pick(options)) : null;
    if (b) {
      b.sealedUntil = Math.max(b.sealedUntil ?? 0, run.time + fx.sealSec * keep);
      out.sealed = b.type;
      out.sealMin = Math.max(1, Math.round((fx.sealSec * keep) / 60));
      emit({ type: 'float', textKey: 'float.sealed', tone: 'loss', at: { building: b.id } });
    }
  }
  if (fx.awaySec && keep > 0) {
    const here = run.followers.filter((f) => !isAway(run, f));
    const f = here.length ? withRng(run, 'events', (r) => r.pick(here)) : null;
    if (f) {
      f.awayUntil = run.time + fx.awaySec * keep;
      out.away = f.name;
      out.awayMin = Math.max(1, Math.round((fx.awaySec * keep) / 60));
    }
  }
  const before = run.suspicion;
  if (fx.suspicionTo !== undefined) run.suspicion = Math.min(run.suspicion, fx.suspicionTo);
  if (fx.suspicion) addSuspicion(run, fx.suspicion);
  out.suspicion = Math.round(run.suspicion - before);
  if (out.suspicion < 0) emit({ type: 'float', textKey: 'float.suspicion_down', params: { n: -out.suspicion }, tone: 'gain' });
  run.lastVisitAt = run.time;
  return out;
}

/** Settle a waiting inspection without playing Look Busy: the normal outcome applies. */
export function settleInspection(g: GameState, emit: Emit = noEmit): VisitSummary | null {
  const run = g.run;
  const ins = run.inspection;
  if (!ins) return null;
  run.inspection = null;
  const ch = eventDef(ins.event).choices.find((c) => c.id === ins.choice)!;
  return applyVisit(g, ch.effects, 0, emit);
}

/** Roll for a visit once a minute while the game is open and nothing else is going on. */
function rollVisit(g: GameState, dt: number, emit: Emit): void {
  const run = g.run;
  run.visitClock += dt;
  if (run.visitClock < 60) return;
  run.visitClock -= 60;
  if (run.tutorial !== 'done' || run.event || run.activeRitual || run.inspection || run.draft) return;
  if (run.time - run.lastVisitAt < B.inspections.minGapSec) return;
  const band = run.suspicion >= B.inspections.fullReviewAt ? 4 : suspicionBand(run.suspicion);
  if (band === 0) return;
  const chance = band === 4 ? 1 : B.inspections.chancePerMin[band];
  const pool = DATA.events.filter((e) => e.visitor && e.band === band);
  if (!pool.length) return;
  const hit = withRng(run, 'events', (r) => (r.next() < chance ? r.pick(pool) : null));
  if (hit) { run.lastVisitAt = run.time; triggerEvent(g, hit.id, emit); }
}

export interface RiteResult { id: string; tiles: number; amount: number; lost: number; entity?: string; crop?: string; visit?: VisitSummary; cutPct?: number }
export interface RitualReward { won: boolean; stars: number; firstTime: boolean; flockPct: number; boonPct: number; devotion: number; donations: number; basil: number; drafts: number; favor: number; entity: string | null; omens: number; firstThree: number; daily: number; rite: RiteResult | null }

/** Pay out a rite's target from the focus tiles collected. */
function payRite(g: GameState, rite: ActiveRite, st: Match3State, won: boolean, stars: number, emit: Emit): RiteResult {
  const run = g.run;
  const def = riteDef(rite.id);
  const tiles = def.focus >= 0 ? st.collected[def.focus] ?? 0 : 0;
  const res: RiteResult = { id: rite.id, tiles, amount: 0, lost: 0, entity: rite.entity, crop: rite.crop };
  const P = def.pays;
  if (rite.id === 'look_busy') {
    // win: stars cut the outcome; loss: the normal outcome, never a worse one
    const ins = run.inspection;
    if (!ins) return res;
    run.inspection = null;
    const ch = eventDef(ins.event).choices.find((c) => c.id === ins.choice)!;
    const cut = won ? Math.min(1, stars * (P.cutPerStar ?? 0)) : 0;
    res.cutPct = Math.round(cut * 100);
    res.visit = applyVisit(g, { ...ch.effects, suspicion: (ch.effects.suspicion ?? 0) + (won ? P.winSuspicion ?? 0 : 0) }, cut, emit);
    return res;
  }
  if (!won) return res;
  if (rite.id === 'sermon' && P.doubtPerTiles) {
    res.amount = Math.floor(tiles / P.doubtPerTiles);
    for (const f of run.followers) f.stats.doubt = Math.max(0, f.stats.doubt - res.amount);
  } else if (rite.id === 'recruit') {
    if (run.followers.length + run.pendingDrafts < housing(run)) {
      run.pendingDrafts += P.draft ?? 1;
      run.draftBonus = tiles >= (P.bigDraftAt ?? Infinity) ? (P.bigDraftSize ?? 4) - DATA.followers.draftSize : 0;
      res.amount = DATA.followers.draftSize + run.draftBonus;
    }
  } else if (rite.id === 'communion' && rite.entity && run.met.includes(rite.entity)) {
    res.amount = Math.round(tiles * (P.favorPerTile ?? 0));
    addFavor(g, rite.entity, res.amount, emit);
  } else if (rite.id === 'harvest' && rite.crop && cropUnlocked(run, rite.crop)) {
    res.amount = Math.floor(tiles / (P.cropPerTiles ?? 3));
    run.inventory[rite.crop] = inv(run, rite.crop) + res.amount;
  } else if (rite.id === 'vigil') {
    const n = Math.floor(tiles / (P.stubPerTiles ?? 4));
    for (let i = 0; i < n; i++) { if (placeItem(run.reliquary, DATA.merge, 'candle', 1)) res.amount++; else res.lost++; }
  }
  return res;
}

/** Close the active ritual and pay out. Call when its status is 'won' or 'lost' (or to abandon). */
export function finishRitual(g: GameState, emit: Emit = noEmit): RitualReward {
  const run = g.run;
  const st = run.activeRitual as Match3State | null;
  const rite = run.activeRite;
  const out: RitualReward = { won: false, stars: 0, firstTime: false, flockPct: 0, boonPct: 0, devotion: 0, donations: 0, basil: 0, drafts: 0, favor: 0, entity: null, omens: 0, firstThree: 0, daily: 0, rite: null };
  run.activeRitual = null;
  run.activeRite = null;
  if (!st) return out;
  const won = st.status === 'won';
  const stars = won ? Math.max(1, starsFor(st)) : 0;
  // a Look Busy board settles its inspection whether it is won or lost (abandoning counts as a loss)
  if (rite && (won || rite.id === 'look_busy')) out.rite = payRite(g, rite, st, won, stars, emit);
  if (!won) return out;
  const level = st.level;
  const idx = DATA.rituals.findIndex((r) => r.id === level.id);
  const prev = run.rituals[level.id] ?? 0;
  const firstTime = prev === 0;
  const R = B.ritual;
  const O = DATA.rites.omens;
  const replay = firstTime ? 1 : R.replayMult;
  let dev = (R.devotionBase + R.devotionPerIndex * idx) * R.starMult[stars];
  if (level.purpose === 'sermon' || rite?.id === 'sermon') dev *= 1 + R.sermonBonus;
  out.flockPct = Math.round(ritualDevotionPct(run));
  out.boonPct = boon(run, 'ritualDevotionPct');
  dev *= 1 + (ritualDevotionPct(run) + out.boonPct) / 100;
  out.won = true;
  out.stars = stars;
  out.firstTime = firstTime;
  if (level.purpose !== 'defense') {
    out.devotion = addResource(run, 'devotion', Math.round(dev * replay));
    out.donations = addResource(run, 'donations', Math.round((R.donationsFlat + (st.collected[5] ?? 0) * R.coinValue) * replay));
  }
  if (!rite && hasBuilding(run, 'greenhouse')) {
    out.basil = Math.floor((st.collected[4] ?? 0) * 0.2 * replay);
    if (out.basil > 0) run.inventory.basil = inv(run, 'basil') + out.basil;
  }
  // Omens: only rituals make them
  out.omens = st.relaxed ? O.relaxedFlat : stars * O.perStar;
  if (stars === 3 && prev < 3) out.firstThree = O.firstThreeStar;
  if (rite?.daily && run.daily.bank > 0) { out.daily = DATA.rites.daily.bonus * run.daily.bank; run.daily.bank = 0; }
  run.omens += out.omens + out.firstThree + out.daily;
  if (stars > prev) {
    addXp(g, (stars - prev) * B.xp.perStar, emit);
    run.rituals[level.id] = stars;
  }
  if (level.purpose === 'sermon' && firstTime && !rite) out.drafts = 1;
  if (level.purpose === 'recruit' && firstTime) out.drafts = 2;
  if (level.purpose === 'recruit' && !firstTime && !rite) out.drafts = 1;
  out.drafts = Math.max(0, Math.min(out.drafts, housing(run) - run.followers.length - run.pendingDrafts));
  run.pendingDrafts += out.drafts;
  if (level.purpose === 'summon') {
    const ent = DATA.entities.find((e) => e.summonRitual === level.id);
    if (ent) {
      out.entity = ent.id;
      if (!run.met.includes(ent.id)) {
        run.met.push(ent.id);
        if (!g.meta.bestiary.includes(ent.id)) g.meta.bestiary.push(ent.id);
        noteUnlock(g);
        if (ent.hintsRecipe && !run.hints.includes(ent.hintsRecipe)) run.hints.push(ent.hintsRecipe);
        for (const o of DATA.orders.filter((x) => x.from === ent.id && x.tutorial)) run.orders.push({ id: o.id });
        run.orderNextAt[ent.id] = run.time;
        out.favor = R.summonFavor;
        addFavor(g, ent.id, out.favor, emit);
        refillOrders(g, emit);
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
    const size = DATA.followers.draftSize + run.draftBonus;
    while (out.length < size) {
      const f = generateRecruit(run, rng);
      if (names.has(f.name)) continue;
      names.add(f.name);
      out.push(f);
    }
    return out;
  });
  run.draftBonus = 0;
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

/** Can the player currently make this? Orders never ask for something out of reach. */
export function producible(g: GameState, need: OrderNeed): boolean {
  const run = g.run;
  if ('merge' in need) {
    const gen = DATA.merge.generators.find((x) => x.chain === need.merge);
    return !!gen && run.level >= (gen.unlockLevel ?? 1) && reached(run, 'merge');
  }
  const crop = DATA.crops.find((c) => c.id === need.item);
  if (crop) return hasBuilding(run, 'greenhouse') && cropUnlocked(run, crop.id);
  if (need.item === DATA.recipes.failOutput) return hasBuilding(run, 'alchemy_lab');
  const recipe = DATA.recipes.recipes.find((r) => r.output === need.item);
  if (!recipe || !hasBuilding(run, 'alchemy_lab')) return false;
  if (!g.meta.grimoire.includes(recipe.id) && !recipeHinted(run, recipe.id)) return false;
  return recipe.ingredients.every((i) => cropUnlocked(run, i));
}

export const activeOrders = (run: RunState, entityId: string) => run.orders.filter((o) => orderDef(o.id).from === entityId);

/** Top each met entity's board back up to its slots from that entity's repeating pool. */
export function refillOrders(g: GameState, emit: Emit = noEmit): void {
  const run = g.run;
  const O = B.orders;
  for (const ent of run.met) {
    let guard = 0;
    while (activeOrders(run, ent).length < O.slotsPerEntity && run.time >= (run.orderNextAt[ent] ?? 0) && guard++ < 4) {
      const pool = DATA.orders.filter((o) => o.from === ent && !o.tutorial && !run.orders.some((a) => a.id === o.id) && o.needs.every((n) => producible(g, n)));
      if (pool.length === 0) break;
      const fresh = pool.filter((o) => o.id !== run.lastOrder[ent]);
      const pick = withRng(run, 'orders', (r) => r.pick(fresh.length ? fresh : pool));
      run.orders.push({ id: pick.id });
      run.lastOrder[ent] = pick.id;
      run.orderNextAt[ent] = run.time + O.refillSec;
    }
  }
}

export function canFill(run: RunState, orderId: string): boolean {
  return run.orders.some((x) => x.id === orderId) && orderDef(orderId).needs.every((n) => needHave(run, n) >= n.count);
}

function addFavor(g: GameState, entityId: string, amount: number, emit: Emit): number {
  const run = g.run;
  const before = boonsUnlocked(run, entityId);
  run.favor[entityId] = (run.favor[entityId] ?? 0) + amount;
  const after = boonsUnlocked(run, entityId);
  for (let i = before; i < after; i++) {
    noteUnlock(g);
    emit({ type: 'boon', entity: entityId, index: i });
  }
  return after - before;
}

/** Spend Omens to swap an open order for a different one from the same entity. */
export function rerollOrder(g: GameState, orderId: string, emit: Emit = noEmit): boolean {
  const run = g.run;
  const cost = DATA.rites.omens.rerollCost;
  if (run.omens < cost || !run.orders.some((o) => o.id === orderId)) return false;
  const ent = orderDef(orderId).from;
  run.omens -= cost;
  run.orders = run.orders.filter((o) => o.id !== orderId);
  run.lastOrder[ent] = orderId;
  run.orderNextAt[ent] = run.time;
  refillOrders(g, emit);
  return true;
}

export function canAudience(run: RunState, entityId: string): boolean {
  const O = DATA.rites.omens;
  return run.met.includes(entityId) && !run.audiences.includes(entityId) && (run.favor[entityId] ?? 0) >= O.audienceFavor && run.omens >= O.audienceCost;
}
/** Spend Omens for an entity's 4th boon. */
export function grantAudience(g: GameState, entityId: string): boolean {
  if (!canAudience(g.run, entityId)) return false;
  g.run.omens -= DATA.rites.omens.audienceCost;
  g.run.audiences.push(entityId);
  noteUnlock(g);
  return true;
}

export interface FillResult { ok: boolean; mult: number; devotion: number; donations: number; favor: number; boons: number }

export function fillOrder(g: GameState, orderId: string, emit: Emit = noEmit): FillResult {
  const run = g.run;
  const out: FillResult = { ok: false, mult: 1, devotion: 0, donations: 0, favor: 0, boons: 0 };
  if (!canFill(run, orderId)) return out;
  const def = orderDef(orderId);
  for (const n of def.needs) {
    if ('item' in n) run.inventory[n.item] -= n.count;
    else removeItems(run.reliquary, n.merge, n.tier, n.count);
  }
  run.orders = run.orders.filter((x) => x.id !== orderId);
  run.ordersFilled[orderId] = (run.ordersFilled[orderId] ?? 0) + 1;
  // a gamble order rolls its payout when delivered: higher on average, never below half
  out.mult = def.kind === 'gamble' ? withRng(run, 'anansi', (r) => r.pick(B.orders.gamble)) : 1;
  out.ok = true;
  out.devotion = addResource(run, 'devotion', Math.round((def.reward.devotion ?? 0) * out.mult));
  out.donations = addResource(run, 'donations', Math.round((def.reward.donations ?? 0) * out.mult));
  out.favor = (def.reward.favor ?? 0) + boon(run, 'favorPerOrder');
  out.boons = addFavor(g, def.from, out.favor, emit);
  addXp(g, Math.round((B.xp.perOrderBase + B.xp.perOrderPerLevel * run.level) * B.xp.entityOrderMult), emit);
  run.orderNextAt[def.from] = Math.max(run.orderNextAt[def.from] ?? 0, run.time + B.orders.refillSec);
  return out;
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
  const def = eventDef(id);
  const fx = def.choices[choice].effects;
  if (fx.consume) run.inventory[fx.consume.item] = inv(run, fx.consume.item) - fx.consume.count;
  run.flags[`${id}_done`] = true;
  run.flags[`${id}_choice_${def.choices[choice].id}`] = true;
  if (def.visitor) {
    run.event = null;
    // Look Busy: the visitor waits; the outcome is decided by the ritual (or by settling)
    if (fx.lookBusy) run.inspection = { event: id, choice: def.choices[choice].id, level: fx.lookBusy };
    else applyVisit(g, fx, 0, emit);
    return true;
  }
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
  const don = traitSum(run, 'donationsPerMin') + boon(run, 'donationsPerMin');
  if (don > 0) addResource(run, 'donations', (don / 60) * dt * prodMult);
  if (run.suspicion > 0) {
    const decay = (B.suspicion.decayPerMin / 60) * dt * (1 + (traitSum(run, 'suspicionDecayPct') + boon(run, 'suspicionDecayPct')) / 100) * (1 - doubtDecayPenalty(run)) * (off ? B.offline.suspicionDecayMult : 1);
    run.suspicion = Math.max(0, run.suspicion - decay);
  }
  tickMerge(run.reliquary, DATA.merge, dt);
  refillOrders(g, emit);
  if (!off) {
    g.meta.stats.playSec += dt;
    if (!run.event && !run.flags.cat_adopted && reached(run, 'build_greenhouse') && run.time >= run.catAt) {
      run.catAt = run.time + withRng(run, 'events', (r) => B.cat.minSec + r.int(B.cat.maxSec - B.cat.minSec));
      triggerEvent(g, 'cat', emit);
    }
    if (run.tutorial === 'reporter' && !run.event && !run.flags.reporter_done) triggerEvent(g, 'reporter', emit);
    rollVisit(g, dt, emit);
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
  orders: (g) => DATA.orders.filter((o) => o.tutorial).every((o) => (g.run.ordersFilled[o.id] ?? 0) > 0),
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
    case 'orders': return run.met.length > 0;
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
