// Offline progress with clock-cheat guards.
import { DATA } from './data';
import { plotReady, tick } from './game';
import type { Emit, GameState } from './types';

export interface OfflineSummary {
  rawSec: number;        // wall-clock gap as measured (may be negative)
  appliedSec: number;    // what was actually simulated
  capped: boolean;       // gap exceeded the offline cap
  rollback: boolean;     // device clock moved backwards
  insane: boolean;       // gap larger than the sanity limit (treated as the cap)
  devotion: number;      // Devotion waiting in buildings (gained while away)
  donations: number;
  cropsReady: number;    // plots that became ready while away
  suspicionDrop: number;
  charges: number;       // generator charges restored
  show: boolean;         // long enough to show the Welcome Back screen
}

const snapshot = (g: GameState) => {
  const run = g.run;
  let stored = 0;
  let ready = 0;
  for (const b of run.buildings) {
    stored += b.stored;
    for (let i = 0; i < (b.plots?.length ?? 0); i++) if (plotReady(run, b, i)) ready++;
  }
  let charges = 0;
  for (const c of run.reliquary.cells) if (c && c.kind === 'gen') charges += c.charges;
  return { stored, ready, donations: run.donations, suspicion: run.suspicion, charges };
};

export function applyOffline(g: GameState, nowWall: number, emit: Emit = () => {}): OfflineSummary {
  const O = DATA.balance.offline;
  const ref = Math.max(g.lastSeenWall, g.highWater);
  const rawSec = (nowWall - ref) / 1000;
  const rollback = rawSec < 0;
  const insane = rawSec > O.maxSaneGapSec;
  const appliedSec = rollback ? 0 : Math.min(rawSec, O.capSec);
  const before = snapshot(g);
  let left = appliedSec;
  while (left > 0) {
    const step = Math.min(60, left);
    tick(g, step, emit, { offline: true });
    left -= step;
  }
  const after = snapshot(g);
  g.lastSeenWall = nowWall;
  g.highWater = Math.max(g.highWater, nowWall);
  const show = appliedSec >= O.summaryMinSec;
  if (show && g.run.tutorial === 'away') g.run.flags.away_done = true;
  return {
    rawSec, appliedSec, capped: rawSec > O.capSec, rollback, insane,
    devotion: Math.floor(after.stored - before.stored),
    donations: Math.floor(after.donations - before.donations),
    cropsReady: after.ready - before.ready,
    suspicionDrop: Math.round(before.suspicion - after.suspicion),
    charges: after.charges - before.charges,
    show,
  };
}
