// The inspection walkthrough (docs/specs/sanctum-view.md section 4, guardrails D-149).
// When the Sanctum has rooms, a visit checks an agenda of rooms. Each room's findings come from what the room is
// (zoning / health / tax exposure), whether it is staffed, and how doubtful its staff are. Filed Forms cancel
// findings. The result is computed at once and stored in `run.walk` for the Sanctum screen to play back.
// Every visit lowers Suspicion. No timers anywhere.
import { DATA, eventDef } from './data';
import { addSuspicion, inv, isAway } from './game';
import { roomDef, roomGroups, sendToHall, slotsOf, workersOf, type RoomGroup } from './sanctum';
import type { Emit, Follower, GameState, RunState } from './types';

const noEmit: Emit = () => {};
const RI = () => DATA.rooms.inspection;

export interface InspectRules { rooms: number; tags: string[]; finePerFinding: number; sealAt: number; sealSec: number; awaySec?: number }
export interface WalkStep { room: number; type: string; storey: number; findings: number; reasons: { key: string; n: number }[] }
export interface WalkResult {
  event: string; steps: WalkStep[]; total: number; forms: number; fine: number;
  sealed: string | null; sealMin: number; away: string | null; awayMin: number; suspicion: number; cutPct: number;
}

/** Room id 0 stands for the Main Hall (the Sermon Hall's interior). */
export const HALL = 0;

export const inspectRules = (eventId: string): InspectRules | null => (eventDef(eventId) as unknown as { inspect?: InspectRules }).inspect ?? null;
/** A visit becomes a walkthrough when it has inspection rules and the Sanctum has at least one room. */
export const walkApplies = (run: RunState, eventId: string) => !!inspectRules(eventId) && run.sanctum.rooms.length > 0;

interface Spot { id: number; type: string; storey: number; exposure: Record<string, number>; workers: Follower[]; slots: number; group: RoomGroup | null }

function spots(run: RunState): Spot[] {
  const hallB = run.buildings.find((b) => b.type === 'sermon_hall');
  const hall: Spot = { id: HALL, type: 'main_hall', storey: 0, exposure: DATA.rooms.hall.exposure, workers: run.followers.filter((f) => f.job === hallB?.id && !isAway(run, f)), slots: 0, group: null };
  const rooms = roomGroups(run).map((g) => ({ id: g.bays[0].id, type: g.type, storey: g.storey, exposure: (roomDef(g.type) as unknown as { exposure: Record<string, number> }).exposure ?? {}, workers: workersOf(run, g).filter((f) => !isAway(run, f)), slots: slotsOf(g), group: g }));
  return [hall, ...rooms];
}

/** Findings for one place, with the reasons (shown on the agenda and in the report). */
function findingsFor(s: Spot, tags: string[], bays: number): { n: number; reasons: { key: string; n: number }[] } {
  const R = RI();
  const reasons: { key: string; n: number }[] = [];
  for (const tag of tags) {
    const e = (s.exposure[tag] ?? 0) * Math.max(1, bays);
    if (e > 0) reasons.push({ key: tag, n: e });
  }
  const staffed = s.workers.length;
  if (s.slots > 0 && staffed === 0) reasons.push({ key: 'empty', n: 1 });
  if (s.id === HALL && staffed === 0) reasons.push({ key: 'empty', n: 1 });
  const full = s.id === HALL ? staffed >= 2 : s.slots > 0 && staffed >= s.slots;
  const avgDoubt = staffed ? s.workers.reduce((n, f) => n + f.stats.doubt, 0) / staffed : 100;
  if (full && avgDoubt < R.calmBelow) reasons.push({ key: 'calm', n: -1 });
  const n = Math.max(0, reasons.reduce((a, r) => a + r.n, 0));
  return { n, reasons };
}

/** The rooms an official will check, in order: the Hall first, then the most exposed rooms. */
export function agenda(run: RunState, eventId: string): WalkStep[] {
  const rules = inspectRules(eventId);
  if (!rules) return [];
  const all = spots(run);
  const [hall, ...rooms] = all;
  const score = (s: Spot) => rules.tags.reduce((n, tag) => n + (s.exposure[tag] ?? 0), 0);
  // most exposed first; ties go to the lower storey (the official is climbing)
  const ordered = [...rooms].sort((a, b) => score(b) - score(a) || a.storey - b.storey || a.id - b.id);
  const picked = [hall, ...ordered.slice(0, Math.max(0, rules.rooms - 1))];
  const steps = picked.map((s) => {
    const f = findingsFor(s, rules.tags, s.group ? s.group.bays.length : 1);
    return { room: s.id, type: s.type, storey: s.storey, findings: f.n, reasons: f.reasons };
  });
  // Doubt counts presence, not placement (review D-166): one finding in the Hall if anyone on the premises has
  // high Doubt, wherever they work. Moving people around can never change it.
  if (run.followers.some((f) => !isAway(run, f) && f.stats.doubt >= RI().doubtAt)) {
    steps[0].reasons.push({ key: 'doubt', n: 1 });
    steps[0].findings += 1;
  }
  return steps;
}

export const projectedFindings = (run: RunState, eventId: string) => agenda(run, eventId).reduce((n, s) => n + s.findings, 0);

/**
 * Walk the agenda and apply the outcome. `cut` (0-1) is the Look Busy reduction; `bonusSuspicion` is added on top
 * (a Look Busy win lowers it further). Returns the result and stores it for the walkthrough animation.
 */
export function conductWalk(g: GameState, eventId: string, choiceId: string, cut: number, bonusSuspicion = 0, emit: Emit = noEmit): WalkResult {
  const run = g.run;
  const rules = inspectRules(eventId)!;
  const ch = eventDef(eventId).choices.find((c) => c.id === choiceId)!;
  const steps = agenda(run, eventId);
  const raw = steps.reduce((n, s) => n + s.findings, 0);
  const forms = Math.min(inv(run, 'filed_form'), raw);
  if (forms > 0) run.inventory.filed_form -= forms;
  const total = raw - forms;
  const keep = Math.max(0, 1 - cut);
  const out: WalkResult = { event: eventId, steps, total, forms, fine: 0, sealed: null, sealMin: 0, away: null, awayMin: 0, suspicion: 0, cutPct: Math.round(cut * 100) };
  // fine: per finding, never more than a quarter of what you have
  out.fine = Math.floor(Math.min(rules.finePerFinding * total, (run.donations * RI().maxFinePct) / 100) * keep);
  run.donations -= out.fine;
  if (out.fine > 0) emit({ type: 'float', textKey: 'float.fine', params: { n: out.fine }, tone: 'loss' });
  // seal the room with the most findings (never the Hall or a Bunk Room)
  if (total >= rules.sealAt && rules.sealSec * keep >= 30) {
    const worst = steps.filter((s) => s.room !== HALL && s.type !== 'bunk_room' && s.findings > 0).sort((a, b) => b.findings - a.findings)[0];
    const grp = worst ? roomGroups(run).find((gg) => gg.bays[0].id === worst.room) : null;
    if (grp) {
      for (const bay of grp.bays) bay.sealedUntil = Math.max(bay.sealedUntil ?? 0, run.time + rules.sealSec * keep);
      sendToHall(run, grp.bays.map((b) => b.id));
      out.sealed = grp.type;
      out.sealMin = Math.max(1, Math.round((rules.sealSec * keep) / 60));
      emit({ type: 'float', textKey: 'float.sealed', tone: 'loss' });
    }
  }
  // Full Review: a very doubtful worker on the agenda may choose to help with the inquiry, and comes back
  if (rules.awaySec && rules.awaySec * keep >= 60) {
    // anyone present with high Doubt may choose to help, whatever their job (review D-166)
    const pool = run.followers.filter((f) => !isAway(run, f) && f.stats.doubt >= RI().awayDoubtAt);
    const f = pool.sort((a, b) => b.stats.doubt - a.stats.doubt)[0];
    if (f) {
      f.awayUntil = run.time + rules.awaySec * keep;
      out.away = f.name;
      out.awayMin = Math.max(1, Math.round((rules.awaySec * keep) / 60));
    }
  }
  // Suspicion: always down; a clean visit counts for more
  const before = run.suspicion;
  if (ch.effects.suspicionTo !== undefined) run.suspicion = Math.min(run.suspicion, ch.effects.suspicionTo);
  const base = (ch.effects.suspicion ?? 0) * (total === 0 ? RI().cleanSuspicionMult : 1);
  addSuspicion(run, base + bonusSuspicion);
  out.suspicion = Math.round(run.suspicion - before);
  if (out.suspicion < 0) emit({ type: 'float', textKey: 'float.suspicion_down', params: { n: -out.suspicion }, tone: 'gain' });
  run.lastVisitAt = run.time;
  run.inspection = null;
  run.walk = out;
  return out;
}

/** The Sanctum screen calls this when the walkthrough animation has been shown. */
export function clearWalk(g: GameState): void { g.run.walk = null; }
