// Headless economy simulation for the vertical slice. Uses the real core rules (src/core).
// Plays scripted strategies forward with estimated time costs per player action and reports
// when each unlock lands, the longest gap without an unlock, and resource curves.
// Usage: npm run sim   (exits 1 if a pacing check fails)
import { writeFileSync, mkdirSync } from 'node:fs';
import { DATA } from '../../src/core/data';
import * as G from '../../src/core/game';
import type { GameState } from '../../src/core/types';
import type { Match3State } from '../../src/puzzle/match3';
import { validateLevel } from '../../src/puzzle/match3';
import { countItems } from '../../src/puzzle/merge';

const MAX_GAP_SEC = 600; // CLAUDE.md: no more than ~10 minutes of active play without an unlock
const SEC_PER_MOVE = 4;

interface Row { t: number; what: string; devotion: number; donations: number; suspicion: number; level: number }
interface Result { name: string; rows: Row[]; total: number; longestGap: number; actions: Record<string, number>; stuck: string | null }

const levelStats = Object.fromEntries(DATA.rituals.map((l) => [l.id, validateLevel(l, 200)]));

function simulate(name: string, opts: { seed: number; idleBetween: number; ritualStars: number; failFirstTry: boolean }): Result {
  const g: GameState = G.newGame(opts.seed, 0);
  const rows: Row[] = [];
  const actions: Record<string, number> = {};
  let clock = 0;
  let lastUnlock = 0;
  let longestGap = 0;
  let stuck: string | null = null;
  const spend = (sec: number, kind: string) => {
    G.debugSkip(g, sec);
    if (g.run.event?.id === 'cat') G.resolveEvent(g, 0);
    clock += sec;
    actions[kind] = (actions[kind] ?? 0) + sec;
  };
  const mark = (what: string) => {
    longestGap = Math.max(longestGap, clock - lastUnlock);
    lastUnlock = clock;
    rows.push({ t: clock, what, devotion: Math.floor(g.run.devotion), donations: Math.floor(g.run.donations), suspicion: Math.round(g.run.suspicion), level: g.run.level });
  };
  const sync = () => { const before = g.run.tutorial; G.advanceTutorial(g); G.ensureDraft(g); if (g.run.tutorial !== before) mark(`step: ${g.run.tutorial}`); };
  const ritual = (id: string) => {
    const stats = levelStats[id];
    const tries = opts.failFirstTry && stats.winRate < 0.9 ? 2 : 1;
    for (let i = 0; i < tries; i++) {
      const st = G.startRitual(g, id) as Match3State;
      const lost = i < tries - 1;
      spend((lost ? st.level.moves : stats.par) * SEC_PER_MOVE + 15, 'ritual');
      st.status = lost ? 'lost' : 'won';
      st.score = st.level.starScores[opts.ritualStars - 1];
      st.collected = [8, 8, 8, 8, 8, 0];
      G.finishRitual(g);
    }
  };
  const afford = (type: string) => {
    const def = DATA.buildings.find((b) => b.id === type)!;
    let guard = 0;
    while (!G.canAfford(g.run, def.cost) && guard++ < 60) {
      // the active way to earn: collect, then replay the first ritual
      for (const b of g.run.buildings) G.collect(g, b.id);
      if (G.canAfford(g.run, def.cost)) break;
      ritual('r1');
    }
    if (!G.canAfford(g.run, def.cost)) stuck = `cannot afford ${type}`;
  };
  const build = (type: string, x: number, y: number) => { afford(type); spend(10, 'build'); if (!G.placeBuilding(g, type, x, y)) stuck = stuck ?? `cannot place ${type}`; };
  const idle = () => { if (opts.idleBetween) spend(opts.idleBetween, 'idle'); };

  g.run.flags.welcomed = true; spend(8, 'read'); sync();
  build('sermon_hall', 8, 10); sync();
  spend(20, 'idle'); for (const b of g.run.buildings) G.collect(g, b.id); sync(); idle();
  ritual('r1'); sync(); spend(12, 'draft'); G.draftPick(g, 0); sync(); idle();
  ritual('r2'); sync(); spend(12, 'draft'); G.draftPick(g, 0); spend(12, 'draft'); G.draftPick(g, 0); sync(); idle();
  build('greenhouse', 12, 10); sync();
  const gh = g.run.buildings.find((b) => b.type === 'greenhouse')!;
  spend(10, 'garden'); G.plant(g, gh.id, 0, 'basil'); G.plant(g, gh.id, 1, 'nightshade'); sync();
  const gen = g.run.reliquary.cells.findIndex((c) => c?.kind === 'gen');
  const spots: number[] = [];
  for (let i = 0; i < 4; i++) { spend(2, 'merge'); spots.push(G.mergeTap(g, gen)); }
  spend(3, 'merge'); G.mergeMove(g, { area: 'grid', i: spots[0] }, { area: 'grid', i: spots[1] });
  spend(3, 'merge'); G.mergeMove(g, { area: 'grid', i: spots[2] }, { area: 'grid', i: spots[3] });
  spend(3, 'merge'); G.mergeMove(g, { area: 'grid', i: spots[1] }, { area: 'grid', i: spots[3] }); sync();
  // wait for the nightshade, doing something useful meanwhile
  let waited = 0;
  while (!G.plotReady(g.run, gh, 1) && waited < 600) { const before = clock; ritual('r1'); waited += clock - before; }
  spend(6, 'garden'); G.harvest(g, gh.id, 0); G.harvest(g, gh.id, 1); sync(); idle();
  build('alchemy_lab', 8, 14); sync();
  spend(15, 'brew'); if (!G.brew(g, ['basil', 'nightshade'], false).ok) stuck = stuck ?? 'cannot brew'; sync();
  spend(1, 'idle'); spend(10, 'read'); if (!G.resolveEvent(g, 0)) stuck = stuck ?? 'reporter unresolved'; sync(); idle();
  ritual('r3'); sync();
  spend(10, 'orders'); if (!G.fillOrder(g, 'mothman_1')) stuck = stuck ?? 'order 1 unfillable';
  spend(10, 'orders'); if (!G.fillOrder(g, 'mothman_2')) stuck = stuck ?? 'order 2 unfillable'; sync();
  longestGap = Math.max(longestGap, clock - lastUnlock);
  return { name, rows, total: clock, longestGap, actions, stuck };
}

// ---------------------------------------------------------------------------------------------
// Long run: a simple bot keeps playing after the tutorial (orders, upgrades, summons, recruits).
// It is not clever; if this bot never waits long for something new, a person will not either.
// ---------------------------------------------------------------------------------------------
/** The no-long-wait rule is enforced for this many minutes after the tutorial; beyond it the report says when content runs out. */
const CHECK_MIN = 60;
interface LongResult { earlyGap: number; earlyGapAt: number; lastNewAt: number; name: string; minutes: number; levelAt: Record<number, number>; metAt: Record<string, number>; longestGap: number; gapAt: number; unlocks: number; actions: Record<string, number>; final: string }

function simulateLong(name: string, seed: number, minutes: number, stars: number): LongResult {
  const g = playSliceFast(seed);
  const run = g.run;
  const actions: Record<string, number> = {};
  const levelAt: Record<number, number> = {};
  const metAt: Record<string, number> = {};
  let clock = 0;
  let lastUnlock = 0;
  let longestGap = 0;
  let gapAt = 0;
  let unlocks = 0;
  let earlyGap = 0;
  let visits = 0;
  let earlyGapAt = 0;
  const progress = () => [run.level, run.met.length, g.meta.grimoire.length, run.buildings.reduce((n, b) => n + b.level, 0), Object.keys(run.rituals).length, Object.values(g.meta.mergeCodex).reduce((a, b) => a + b, 0), run.met.reduce((n, e) => n + G.boonsUnlocked(run, e), 0), run.followers.length].join('|');
  let seen = progress();
  const spend = (sec: number, kind: string) => {
    G.debugSkip(g, sec);
    if (run.event) {
      const ev = DATA.events.find((e) => e.id === run.event!.id)!;
      // visitors: answer with Look Busy (played right after); other events: first available choice
      const lb = ev.choices.findIndex((c) => c.id === 'look_busy');
      const pick = ev.visitor && lb >= 0 ? lb : G.choiceAvailable(run, ev.id, 0) ? 0 : 1;
      G.resolveEvent(g, pick);
      if (ev.visitor) visits++;
    }
    clock += sec;
    actions[kind] = (actions[kind] ?? 0) + sec;
    const now = progress();
    if (now !== seen) {
      seen = now;
      unlocks++;
      if (clock - lastUnlock > longestGap) { longestGap = clock - lastUnlock; gapAt = clock; }
      if (lastUnlock < CHECK_MIN * 60 && clock - lastUnlock > earlyGap) { earlyGap = clock - lastUnlock; earlyGapAt = clock; }
      lastUnlock = clock;
      if (!levelAt[run.level]) levelAt[run.level] = clock;
      for (const e of run.met) if (metAt[e] === undefined) metAt[e] = clock;
    }
  };
  /** Pick the rite a sensible player would: recruit if beds are free, harvest what an open order lacks, else commune. */
  const pickRite = (): { id: string; entity?: string; crop?: string } => {
    if (!G.riteBlocked(g, 'recruit')) return { id: 'recruit' };
    for (const o of run.orders) for (const n of DATA.orders.find((x) => x.id === o.id)!.needs) {
      if ('item' in n && G.needHave(run, n) < n.count && DATA.crops.some((c) => c.id === n.item) && G.cropUnlocked(run, n.item) && !G.riteBlocked(g, 'harvest')) return { id: 'harvest', crop: n.item };
    }
    const next = run.met.filter((e) => G.boonsUnlocked(run, e) < 3).sort((a, b) => (run.favor[b] ?? 0) - (run.favor[a] ?? 0))[0];
    if (next) return { id: 'communion', entity: next };
    return { id: 'sermon' };
  };
  const ritual = (id: string) => {
    const daily = G.dailyLevel(run, 'sim-day');
    const st = G.startRitual(g, id, run.inspection ? undefined : pickRite()) as Match3State | null;
    if (!st) return false;
    void daily;
    spend(st.level.par * SEC_PER_MOVE + 20, 'ritual');
    st.status = 'won';
    st.score = st.level.starScores[stars - 1];
    st.collected = [12, 12, 12, 12, 12, 0]; // a typical winning board clears about 12 of each tile
    G.finishRitual(g);
    G.ensureDraft(g);
    while (run.draft) { spend(10, 'draft'); G.draftPick(g, 0); }
    return true;
  };
  /** Try to get one more of a merge item; returns true if it did something. */
  const workMerge = (chain: string, tier: number): boolean => {
    const cells = run.reliquary.cells;
    for (let tr = tier - 1; tr >= 1; tr--) {
      const idx = cells.map((c, i) => (c && c.kind === 'item' && c.chain === chain && c.tier === tr ? i : -1)).filter((i) => i >= 0);
      if (idx.length >= 2) { spend(3, 'merge'); G.mergeMove(g, { area: 'grid', i: idx[0] }, { area: 'grid', i: idx[1] }); return true; }
    }
    const gen = cells.findIndex((c) => c && c.kind === 'gen' && DATA.merge.generators.find((d) => d.id === c.gen)!.chain === chain);
    if (gen < 0) return false;
    const cell = cells[gen];
    if (cell && cell.kind === 'gen' && cell.charges > 0) { spend(2, 'merge'); return G.mergeTap(g, gen) >= 0; }
    return false;
  };
  const gh = () => run.buildings.find((b) => b.type === 'greenhouse')!;
  const want = (): G.FillResult | null => null;
  void want;
  const workItem = (item: string, count: number): boolean => {
    if (G.inv(run, item) >= count) return false;
    const crop = DATA.crops.find((c) => c.id === item);
    const house = gh();
    if (crop) {
      for (let i = 0; i < house.plots!.length; i++) if (G.plotReady(run, house, i)) { spend(3, 'garden'); G.harvest(g, house.id, i); return true; }
      const growing = house.plots!.filter((p) => p.crop === item).length;
      if (growing * crop.yield + G.inv(run, item) >= count) return false;
      const free = house.plots!.findIndex((p) => !p.crop);
      if (free >= 0 && run.donations >= crop.seedCost) { spend(4, 'garden'); return G.plant(g, house.id, free, item); }
      return false;
    }
    const recipe = DATA.recipes.recipes.find((r) => r.output === item);
    if (item === DATA.recipes.failOutput) {
      if (G.inv(run, 'basil') >= 3) { spend(12, 'brew'); return G.brew(g, ['basil', 'basil', 'basil'], false).ok; }
      return workItem('basil', 3);
    }
    if (!recipe) return false;
    const needs: Record<string, number> = {};
    for (const i of recipe.ingredients) needs[i] = (needs[i] ?? 0) + 1;
    if (Object.entries(needs).every(([i, n]) => G.inv(run, i) >= n)) { spend(15, 'brew'); return G.brew(g, recipe.ingredients, false).ok; }
    for (const [i, n] of Object.entries(needs)) if (workItem(i, n)) return true;
    return false;
  };
  if (!levelAt[run.level]) levelAt[run.level] = 0;
  for (const e of run.met) metAt[e] = 0;
  while (clock < minutes * 60) {
    if (run.inspection) { ritual(run.inspection.level); continue; }
    for (const b of run.buildings) if (b.stored >= 5 && run.devotion < G.devotionCap(run)) G.collect(g, b.id);
    const house = gh();
    let acted = false;
    for (let i = 0; i < house.plots!.length && !acted; i++) if (G.plotReady(run, house, i)) { spend(3, 'garden'); G.harvest(g, house.id, i); acted = true; }
    if (acted) continue;
    const fill = run.orders.find((o) => G.canFill(run, o.id));
    if (fill) { spend(8, 'orders'); G.fillOrder(g, fill.id); continue; }
    const aud = run.met.find((e) => G.canAudience(run, e));
    if (aud) { spend(5, 'orders'); G.grantAudience(g, aud); continue; }
    const up = run.buildings.find((b) => G.canUpgrade(run, b));
    if (up) { spend(8, 'upgrade'); G.upgradeBuilding(g, up.id); continue; }
    const summon = DATA.entities.find((e) => !run.met.includes(e.id) && G.ritualUnlocked(run, e.summonRitual));
    if (summon) { ritual(summon.summonRitual); continue; }
    if (!G.riteBlocked(g, 'recruit')) { ritual(G.ritualUnlocked(run, 'r7') ? 'r7' : 'r2'); continue; }
    // work towards open orders, then towards the cheapest upgrade's merge item
    for (const o of run.orders) {
      for (const need of DATA.orders.find((x) => x.id === o.id)!.needs) {
        if (G.needHave(run, need) >= need.count) continue;
        if ('item' in need ? workItem(need.item, need.count) : workMerge(need.merge, need.tier)) { acted = true; break; }
      }
      if (acted) break;
    }
    if (acted) continue;
    for (const b of run.buildings) {
      const next = G.nextUpgrade(b);
      if (next?.merge && countItems(run.reliquary, next.merge.chain, next.merge.tier) < 1 && run.level >= (DATA.merge.generators.find((d) => d.chain === next.merge!.chain)!.unlockLevel ?? 1) && workMerge(next.merge.chain, next.merge.tier)) { acted = true; break; }
    }
    if (acted) continue;
    // nothing to make right now: preach if there is room for Devotion, otherwise wait for crops and charges
    const sermon = [...DATA.rituals].reverse().find((r) => r.purpose === 'sermon' && G.ritualUnlocked(run, r.id));
    if (sermon) ritual(sermon.id);
    else spend(10, 'wait');
  }
  if (clock - lastUnlock > longestGap) { longestGap = clock - lastUnlock; gapAt = clock; }
  if (lastUnlock < CHECK_MIN * 60 && clock - lastUnlock > earlyGap) { earlyGap = clock - lastUnlock; earlyGapAt = clock; }
  actions.visits = visits;
  return { earlyGap, earlyGapAt, lastNewAt: lastUnlock, name, minutes, levelAt, metAt, longestGap, gapAt, unlocks, actions, final: `Lv${run.level}, ${run.followers.length} followers, ${run.met.length} entities, buildings ${run.buildings.map((b) => b.level).join('/')}, grimoire ${g.meta.grimoire.length}` };
}

/** The tutorial, played instantly, as the starting point for the long run. */
function playSliceFast(seed: number): GameState {
  const g = G.newGame(seed, 0);
  const sync = () => { G.advanceTutorial(g); G.ensureDraft(g); };
  const win = (id: string) => { const st = G.startRitual(g, id) as Match3State; st.status = 'won'; st.score = st.level.starScores[1]; G.finishRitual(g); sync(); };
  g.run.flags.welcomed = true; sync();
  G.placeBuilding(g, 'sermon_hall', 8, 10); sync();
  G.debugSkip(g, 30); G.collect(g, g.run.buildings.find((b) => b.type === 'sermon_hall')!.id); sync();
  win('r1'); G.draftPick(g, 0); sync();
  win('r2'); G.draftPick(g, 0); G.draftPick(g, 0); sync();
  G.placeBuilding(g, 'greenhouse', 12, 10); sync();
  const gh = g.run.buildings.find((b) => b.type === 'greenhouse')!;
  G.plant(g, gh.id, 0, 'basil'); G.plant(g, gh.id, 1, 'nightshade'); sync();
  const gen = g.run.reliquary.cells.findIndex((c) => c?.kind === 'gen');
  const sp = [0, 1, 2, 3].map(() => G.mergeTap(g, gen));
  G.mergeMove(g, { area: 'grid', i: sp[0] }, { area: 'grid', i: sp[1] }); G.mergeMove(g, { area: 'grid', i: sp[2] }, { area: 'grid', i: sp[3] }); G.mergeMove(g, { area: 'grid', i: sp[1] }, { area: 'grid', i: sp[3] }); sync();
  G.debugSkip(g, 125); if (g.run.event) G.resolveEvent(g, 0);
  G.harvest(g, gh.id, 0); G.harvest(g, gh.id, 1); sync();
  while (!G.canAfford(g.run, DATA.buildings.find((b) => b.id === 'alchemy_lab')!.cost)) win('r1');
  G.placeBuilding(g, 'alchemy_lab', 8, 14); sync();
  G.brew(g, ['basil', 'nightshade'], false); sync();
  G.tick(g, 0.1); if (g.run.event) G.resolveEvent(g, 0); sync();
  win('r3'); G.fillOrder(g, 'mothman_1'); G.fillOrder(g, 'mothman_2'); sync();
  g.run.flags.away_done = true; sync(); g.run.flags.ascension_viewed = true; sync();
  return g;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const results = [
  simulate('focused (3-star, no waiting)', { seed: 11, idleBetween: 0, ritualStars: 3, failFirstTry: false }),
  simulate('casual (1-star, fails hard rituals once, dawdles)', { seed: 12, idleBetween: 30, ritualStars: 1, failFirstTry: true }),
  simulate('slow reader (1-star, long pauses)', { seed: 13, idleBetween: 90, ritualStars: 1, failFirstTry: true }),
];

let failed = false;
let md = `# Economy sim — vertical slice\n\nGenerated by \`npm run sim\`. Times are estimated active play (rituals cost par moves x ${SEC_PER_MOVE}s + 15s).\n\n`;
md += `Ritual validator (200 playouts): ${DATA.rituals.map((l) => `${l.id} win ${(levelStats[l.id].winRate * 100).toFixed(0)}% par ${levelStats[l.id].par}`).join(' · ')}\n\n`;
for (const r of results) {
  const active = Object.entries(r.actions).filter(([k]) => k !== 'idle' && k !== 'read');
  const activeTotal = active.reduce((n, [, v]) => n + v, 0);
  const top = active.sort((a, b) => b[1] - a[1])[0];
  const share = top[1] / activeTotal;
  const okGap = r.longestGap <= MAX_GAP_SEC;
  const okStuck = !r.stuck;
  if (!okGap || !okStuck) failed = true;
  md += `## ${r.name}\n\n- Slice complete at **${fmt(r.total)}** · longest gap without an unlock **${fmt(r.longestGap)}** (${okGap ? 'ok' : 'FAIL > 10:00'})${r.stuck ? ` · STUCK: ${r.stuck}` : ''}\n`;
  md += `- Time by action: ${Object.entries(r.actions).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}\n`;
  md += `- Largest active share: ${top[0]} ${(share * 100).toFixed(0)}% ${share > 0.6 ? '(note: rituals dominate the slice by design; the >60% check applies to the full game loop, not the tutorial)' : ''}\n\n`;
  md += `| time | unlock | Devotion | Donations | Suspicion | Lv |\n|---|---|---|---|---|---|\n`;
  for (const row of r.rows) md += `| ${fmt(row.t)} | ${row.what} | ${row.devotion} | ${row.donations} | ${row.suspicion} | ${row.level} |\n`;
  md += '\n';
  console.log(`${okGap && okStuck ? 'PASS' : 'FAIL'}  ${r.name}: done ${fmt(r.total)}, longest gap ${fmt(r.longestGap)}, top action ${top[0]} ${(share * 100).toFixed(0)}%${r.stuck ? ', STUCK ' + r.stuck : ''}`);
}
// ---- long run report
const LONG_MIN = 150;
const longs = [simulateLong('steady player (2-star)', 21, LONG_MIN, 2), simulateLong('careful player (1-star)', 22, LONG_MIN, 1)];
md += `# After the tutorial: ${LONG_MIN} minutes of active play\n\nA simple bot fills orders, upgrades, summons and recruits. Times are minutes after the tutorial ends.\n\n`;
for (const r of longs) {
  const okGap = r.earlyGap <= MAX_GAP_SEC;
  const l3 = r.levelAt[3] ?? Infinity;
  const l5 = r.levelAt[5] ?? Infinity;
  const active = Object.entries(r.actions).filter(([k]) => !['wait', 'visits'].includes(k)).reduce((n, [, v]) => n + v, 0);
  const share = (r.actions.ritual ?? 0) / Math.max(1, active);
  const okShare = share >= 0.2 && share <= 0.6;
  const okPace = l3 >= 5 * 60 && l3 <= 30 * 60 && l5 >= 30 * 60 && l5 <= 110 * 60; // not a sprint, not a slog
  if (!okGap || !okPace || !okShare) failed = true;
  md += `## ${r.name}\n\n- Ends at: ${r.final}\n- ${r.unlocks} new things in ${LONG_MIN} min. Longest wait for one in the first ${CHECK_MIN} min: **${fmt(r.earlyGap)}** (ending at ${fmt(r.earlyGapAt)}) ${okGap ? 'ok' : 'FAIL > 10:00'}. Longest overall: ${fmt(r.longestGap)} (ending at ${fmt(r.gapAt)}).\n`;
  md += `- Rituals are ${(share * 100).toFixed(0)}% of active time ${okShare ? 'ok' : 'FAIL (want 20-60%)'}; inspections: ${r.actions.visits ?? 0}\n`;
  md += `- Pace: Lv3 at ${fmt(l3)}, Lv5 at ${fmt(l5)} ${okPace ? 'ok' : 'FAIL (want Lv3 in 5-30 min and Lv5 in 30-110 min)'}\n`;
  md += `- Compound levels reached at: ${Object.entries(r.levelAt).map(([l, tm]) => `Lv${l} ${fmt(tm)}`).join(', ')}\n- Entities met at: ${Object.entries(r.metAt).map(([e, tm]) => `${e} ${fmt(tm)}`).join(', ')}\n`;
  md += `- Time by action: ${Object.entries(r.actions).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fmt(v)}`).join(', ')}\n\n`;
  console.log(`${okGap && okPace && okShare ? 'PASS' : 'FAIL'}  long run, ${r.name}: rituals ${(share * 100).toFixed(0)}%, visits ${r.actions.visits ?? 0}; ${r.final}; longest early wait ${fmt(r.earlyGap)} (at ${fmt(r.earlyGapAt)}), overall ${fmt(r.longestGap)}; Lv3@${fmt(l3)} Lv4@${fmt(r.levelAt[4] ?? 0)} Lv5@${fmt(l5)} Lv6@${fmt(r.levelAt[6] ?? 0)}; last new thing @${fmt(r.lastNewAt)}; met ${Object.entries(r.metAt).map(([e, tm]) => `${e}@${fmt(tm)}`).join(' ')}`);
}
mkdirSync('docs/sim', { recursive: true });
writeFileSync('docs/sim/latest.md', md);
console.log('report: docs/sim/latest.md');
process.exit(failed ? 1 : 0);
