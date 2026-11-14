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
mkdirSync('docs/sim', { recursive: true });
writeFileSync('docs/sim/latest.md', md);
console.log('report: docs/sim/latest.md');
process.exit(failed ? 1 : 0);
