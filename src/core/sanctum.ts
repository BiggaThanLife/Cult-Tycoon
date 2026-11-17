// The Sanctum: a side view of the Sermon Hall's interior with storeys built on top (docs/specs/sanctum-view.md).
// Storeys hold three bays; a bay holds one room; identical neighbouring rooms of the same level merge into a
// 2- or 3-bay room with an output bonus. Followers are assigned to rooms; each room reads one "key" stat.
// Pure rules, no Phaser.
import { DATA } from './data';
import type { Emit, Follower, GameState, RoomState, RunState } from './types';
import { countItems, removeItems } from '../puzzle/merge';
import { addResource, addSuspicion, addXp, assignJobs, canAfford, inv, isAway } from './game';

const noEmit: Emit = () => {};
export const SR = () => DATA.rooms;
export const roomDef = (type: string) => DATA.rooms.rooms.find((r) => r.id === type)!;

/** A merged room: consecutive bays on one storey with the same type and level. */
export interface RoomGroup { type: string; level: number; storey: number; bays: RoomState[] }

export const sanctumUnlocked = (run: RunState) => run.level >= DATA.rooms.storeys[0].level;
export const builtStoreys = (run: RunState) => run.sanctum.storeys;

/** Every merged room, storey by storey, left to right. */
export function roomGroups(run: RunState): RoomGroup[] {
  const out: RoomGroup[] = [];
  for (let s = 1; s <= run.sanctum.storeys; s++) {
    let cur: RoomGroup | null = null;
    for (let bay = 0; bay < DATA.rooms.baysPerStorey; bay++) {
      const r = run.sanctum.rooms.find((x) => x.storey === s && x.bay === bay);
      if (r && cur && cur.type === r.type && cur.level === r.level) cur.bays.push(r);
      else {
        if (cur) out.push(cur);
        cur = r ? { type: r.type, level: r.level, storey: s, bays: [r] } : null;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}
export const groupOf = (run: RunState, roomId: number) => roomGroups(run).find((g) => g.bays.some((b) => b.id === roomId)) ?? null;
export const mergePct = (g: RoomGroup) => DATA.rooms.mergeBonusPct[g.bays.length - 1] ?? 0;
export const groupSealed = (run: RunState, g: RoomGroup) => g.bays.some((b) => (b.sealedUntil ?? 0) > run.time);
export const slotsOf = (g: RoomGroup) => g.bays.length * (roomDef(g.type).slots[g.level - 1] ?? 0);
export const workersOf = (run: RunState, g: RoomGroup) => run.followers.filter((f) => g.bays.some((b) => b.id === f.job));

/** What one worker adds to a room's output (0.5 = +50%), from the room's key stat. */
export function roomWork(f: Follower, key: string | null): number {
  if (!key) return 0;
  const stat = f.stats[key as keyof Follower['stats']] ?? 50;
  const sanity = key === 'sanity' ? 0 : (f.stats.sanity - 50) * 0.005;
  return Math.max(0, 0.5 * (0.5 + stat / 100 + sanity));
}
/** "good" / "ok" / "poor" fit of a follower for a room type (shown on the card). */
export function fit(f: Follower, type: string): 'good' | 'ok' | 'poor' {
  const key = roomDef(type).key;
  if (!key) return 'ok';
  const v = f.stats[key as keyof Follower['stats']] ?? 50;
  return v >= 60 ? 'good' : v >= 35 ? 'ok' : 'poor';
}
/** Output multiplier of a merged room: bays x merge bonus x (1 + sum of workers). 0 while sealed. */
export function groupMult(run: RunState, g: RoomGroup): number {
  if (groupSealed(run, g)) return 0;
  const key = roomDef(g.type).key;
  const work = workersOf(run, g).filter((f) => !isAway(run, f)).reduce((n, f) => n + roomWork(f, key), 0);
  return g.bays.length * (1 + mergePct(g) / 100) * (1 + work);
}
const eff = (g: RoomGroup, field: string): number => {
  const v = (roomDef(g.type).effect as Record<string, number | number[]>)[field];
  return Array.isArray(v) ? v[g.level - 1] ?? 0 : v ?? 0;
};
export const effectOf = eff;

// ---------- numbers other systems read ----------

export const sanctumBeds = (run: RunState) => roomGroups(run).filter((g) => g.type === 'bunk_room').reduce((n, g) => n + eff(g, 'beds') * g.bays.length, 0);
/** Bonus % applied to every rite payout. */
export const ritePctBonus = (run: RunState) => roomGroups(run).filter((g) => g.type === 'ritual_chamber').reduce((n, g) => n + eff(g, 'ritePct') * groupMult(run, g), 0);
/** Extra Omens per ritual win (Ritual Chamber level 3). */
export const omenPerWin = (run: RunState) => (roomGroups(run).some((g) => g.type === 'ritual_chamber' && eff(g, 'omenPerWin') > 0 && !groupSealed(run, g)) ? 1 : 0);
export const formCap = (run: RunState) => roomGroups(run).filter((g) => g.type === 'records_office').reduce((n, g) => n + eff(g, 'formCapPerBay') * g.bays.length, 0);
/** Suspicion a minute from height and from Wellness Retreats. */
export function sanctumHeat(run: RunState): number {
  const H = DATA.rooms.heightSuspicion;
  const height = Math.max(0, run.sanctum.storeys - (H.fromStorey - 1)) * H.perStoreyPerMin;
  const retreat = roomGroups(run).filter((g) => g.type === 'wellness_retreat' && !groupSealed(run, g)).reduce((n, g) => n + eff(g, 'suspicionPerMin') * g.bays.length, 0);
  return height + retreat;
}

// ---------- storeys ----------

export const nextStorey = (run: RunState) => DATA.rooms.storeys[run.sanctum.storeys] ?? null;
export function canBuildStorey(run: RunState): boolean {
  const n = nextStorey(run);
  return !!n && !run.sanctum.building && run.level >= n.level && canAfford(run, n.cost) && run.omens >= n.omens;
}
export function buildStorey(g: GameState, emit: Emit = noEmit): boolean {
  const run = g.run;
  if (!canBuildStorey(run)) return false;
  const n = nextStorey(run)!;
  run.devotion -= n.cost.devotion;
  run.donations -= n.cost.donations;
  run.omens -= n.omens;
  run.sanctum.building = { storey: run.sanctum.storeys + 1, doneAt: run.time + n.sec };
  if (n.sec <= 0) finishStorey(g, emit);
  return true;
}
function finishStorey(g: GameState, emit: Emit): void {
  const run = g.run;
  if (!run.sanctum.building) return;
  run.sanctum.storeys = run.sanctum.building.storey;
  run.sanctum.building = null;
  addXp(g, DATA.balance.xp.perBuild, emit);
  emit({ type: 'float', textKey: 'float.storey', tone: 'gain' });
}

// ---------- rooms ----------

export const roomAt = (run: RunState, storey: number, bay: number) => run.sanctum.rooms.find((r) => r.storey === storey && r.bay === bay) ?? null;
export const roomUnlocked = (run: RunState, type: string) => run.level >= roomDef(type).unlockLevel;

export function canBuildRoom(run: RunState, storey: number, bay: number, type: string): boolean {
  return storey >= 1 && storey <= run.sanctum.storeys && bay >= 0 && bay < DATA.rooms.baysPerStorey && !roomAt(run, storey, bay) && roomUnlocked(run, type) && canAfford(run, roomDef(type).cost);
}
export function buildRoom(g: GameState, storey: number, bay: number, type: string, emit: Emit = noEmit): RoomState | null {
  const run = g.run;
  if (!canBuildRoom(run, storey, bay, type)) return null;
  const def = roomDef(type);
  run.devotion -= def.cost.devotion;
  run.donations -= def.cost.donations;
  // a new bay next to a matching merged room joins at that room's level only if it is level 1 too
  const room: RoomState = { id: run.nextId++, type, storey, bay, level: 1, progress: 0 };
  run.sanctum.rooms.push(room);
  addXp(g, DATA.balance.xp.perBuild, emit);
  emit({ type: 'float', textKey: 'float.room', tone: 'gain' });
  return room;
}

/** What upgrading this merged room needs: costs scale with its width; one relic and the Omens per room. */
export function roomUpgradeCost(run: RunState, roomId: number) {
  const grp = groupOf(run, roomId);
  if (!grp) return null;
  const up = roomDef(grp.type).upgrades[grp.level - 1];
  if (!up) return null;
  const n = grp.bays.length;
  return { devotion: up.cost.devotion * n, donations: up.cost.donations * n, merge: up.merge ?? null, omens: up.omens ?? 0 };
}
export function canUpgradeRoom(run: RunState, roomId: number): boolean {
  const c = roomUpgradeCost(run, roomId);
  return !!c && canAfford(run, c) && run.omens >= c.omens && (!c.merge || countItems(run.reliquary, c.merge.chain, c.merge.tier) >= 1);
}
export function upgradeRoom(g: GameState, roomId: number, emit: Emit = noEmit): boolean {
  const run = g.run;
  if (!canUpgradeRoom(run, roomId)) return false;
  const c = roomUpgradeCost(run, roomId)!;
  const grp = groupOf(run, roomId)!;
  run.devotion -= c.devotion;
  run.donations -= c.donations;
  run.omens -= c.omens;
  if (c.merge) removeItems(run.reliquary, c.merge.chain, c.merge.tier, 1);
  for (const b of grp.bays) b.level++;
  addXp(g, DATA.balance.xp.perUpgrade, emit);
  addSuspicion(run, DATA.balance.suspicion.perUpgrade);
  emit({ type: 'float', textKey: 'float.upgraded', params: { n: grp.level + 1 }, tone: 'gain' });
  return true;
}
/** Knock down one bay: half its build cost back; its workers return to the Hall. */
export function demolishRoom(g: GameState, roomId: number): boolean {
  const run = g.run;
  const r = run.sanctum.rooms.find((x) => x.id === roomId);
  if (!r) return false;
  const def = roomDef(r.type);
  addResource(run, 'devotion', Math.floor(def.cost.devotion * DATA.rooms.demolishRefund));
  addResource(run, 'donations', Math.floor(def.cost.donations * DATA.rooms.demolishRefund));
  run.sanctum.rooms = run.sanctum.rooms.filter((x) => x.id !== roomId);
  for (const f of run.followers) if (f.job === roomId) f.job = null;
  assignJobs(run);
  return true;
}

/** Workers of a sealed room go back to the Hall: nobody is left behind the tape (review D-166). */
export function sendToHall(run: RunState, roomIds: number[]): void {
  for (const f of run.followers) if (f.job !== null && roomIds.includes(f.job)) f.job = null;
  assignJobs(run);
}

/** Move a follower into a merged room (or back to the Hall with null). */
export function assignFollower(g: GameState, followerId: number, roomId: number | null): boolean {
  const run = g.run;
  const f = run.followers.find((x) => x.id === followerId);
  if (!f) return false;
  if (roomId === null) { f.job = null; assignJobs(run); return true; }
  const grp = groupOf(run, roomId);
  if (!grp || groupSealed(run, grp) || workersOf(run, grp).length >= slotsOf(grp)) return false;
  f.job = roomId;
  return true;
}

// ---------- time ----------

/** Advance rooms by dt seconds. Offline: rooms work at the offline rate and draw no attention. */
export function tickSanctum(g: GameState, dt: number, emit: Emit, offline: boolean): void {
  const run = g.run;
  const S = run.sanctum;
  if (S.building && run.time >= S.building.doneAt) finishStorey(g, emit);
  const rate = offline ? DATA.balance.offline.productionMult : 1;
  for (const grp of roomGroups(run)) {
    const m = groupMult(run, grp) * rate;
    if (m <= 0) continue;
    const head = grp.bays[0];
    switch (grp.type) {
      case 'kitchen': {
        // the kitchen cooks while there is Basil; stew raises the whole flock's Sanity
        head.progress += (eff(grp, 'basilPerMin') * grp.bays.length * dt) / 60;
        while (head.progress >= 1 && inv(run, 'basil') > 0) { run.inventory.basil -= 1; head.progress -= 1; head.fed = (head.fed ?? 0) + 120; }
        if (head.progress >= 1) head.progress = 1; // waits for Basil, does not bank it
        if ((head.fed ?? 0) > 0) {
          head.fed = Math.max(0, (head.fed ?? 0) - dt);
          const gain = (eff(grp, 'sanityPerMin') * m * dt) / 60;
          for (const f of run.followers) f.stats.sanity = Math.min(100, f.stats.sanity + gain);
        }
        break;
      }
      case 'records_office': {
        head.progress += dt * m / grp.bays.length; // speed scales with workers and merge, not with width
        const every = eff(grp, 'formEverySec');
        while (head.progress >= every) {
          head.progress -= every;
          if (inv(run, 'filed_form') < formCap(run)) { run.inventory.filed_form = inv(run, 'filed_form') + 1; if (!offline) emit({ type: 'float', textKey: 'float.forms', tone: 'gain' }); }
        }
        break;
      }
      case 'reading_room': {
        // sealed rooms never reach here (groupMult is 0 while sealed), so nobody reads behind the tape
        const drop = (eff(grp, 'doubtPerMin') * (1 + mergePct(grp) / 100) * rate * dt) / 60;
        for (const f of workersOf(run, grp)) f.stats.doubt = Math.max(0, f.stats.doubt - drop);
        break;
      }
      case 'wellness_retreat':
        addResource(run, 'donations', (eff(grp, 'donationsPerMin') * m * dt) / 60);
        break;
      default:
        break;
    }
  }
  if (!offline) {
    const heat = sanctumHeat(run);
    if (heat > 0) addSuspicion(run, (heat * dt) / 60);
  }
}

/** Use Filed Forms to soften a visit: each cuts the outcome by formCutPct, up to formMaxPerVisit. Returns the extra cut (0-1). */
export function useForms(run: RunState): { used: number; cut: number } {
  const n = Math.min(inv(run, 'filed_form'), DATA.rooms.formMaxPerVisit);
  if (n <= 0) return { used: 0, cut: 0 };
  run.inventory.filed_form -= n;
  return { used: n, cut: (n * DATA.rooms.formCutPct) / 100 };
}
