// Level validator: `npx tsx tools/levels/validate.ts` (or `npm run validate-levels`).
// Runs seeded playouts on every shipped ritual level and fails (exit code 1) when a
// level's win rate is below its target. Flags:
//   --playouts=N   number of playouts per level (default 500)
//   --suggest      also print measured score percentiles (for tuning starScores)
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPlayouts, type LevelDef } from '../../src/puzzle/match3';

const DEFAULT_MIN_WIN_RATE = 0.7;
const MIN_WIN_RATE_BY_ID: Record<string, number> = { r1: 0.9 };

const args = process.argv.slice(2);
const playoutsArg = args.find((a) => a.startsWith('--playouts='));
const playouts = playoutsArg ? Number(playoutsArg.split('=')[1]) : 500;
const suggest = args.includes('--suggest');

const here = dirname(fileURLToPath(import.meta.url));
const file = resolve(here, '../../data/levels/rituals.json');
const { levels } = JSON.parse(readFileSync(file, 'utf8')) as { levels: LevelDef[] };

const percentile = (sorted: number[], p: number): number =>
  sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;

let failed = false;
const rows: string[][] = [['id', 'winRate', 'target', 'par', 'jsonPar', 'avgScore', 'result']];
const notes: string[] = [];

for (const level of levels) {
  const results = runPlayouts(level, playouts);
  const wins = results.filter((r) => r.won);
  const winRate = results.length ? wins.length / results.length : 0;
  const avgMoves = wins.length ? wins.reduce((s, r) => s + r.movesUsed, 0) / wins.length : 0;
  const avgScore = wins.length ? wins.reduce((s, r) => s + r.score, 0) / wins.length : 0;
  const par = Math.round(avgMoves);
  const target = MIN_WIN_RATE_BY_ID[level.id] ?? DEFAULT_MIN_WIN_RATE;
  const ok = winRate >= target;
  if (!ok) failed = true;
  rows.push([
    level.id,
    winRate.toFixed(3),
    target.toFixed(2),
    String(par),
    String(level.par),
    avgScore.toFixed(0),
    ok ? 'ok' : 'FAIL',
  ]);
  if (par !== level.par) notes.push(`note: ${level.id} has par ${level.par} in the JSON, measured ${par}`);
  if (suggest) {
    const scores = wins.map((r) => r.score).sort((a, b) => a - b);
    const pick = [0.1, 0.4, 0.67].map((p) => percentile(scores, p));
    notes.push(`${level.id} winning scores p10/p40/p67: ${pick.join(' / ')} (current starScores ${level.starScores.join(' / ')})`);
  }
}

const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
for (const row of rows) console.log(row.map((cell, i) => cell.padEnd(widths[i])).join('  '));
for (const note of notes) console.log(note);
console.log(failed ? `\nFAILED: at least one level is below its target win rate (${playouts} playouts)` : `\nAll ${levels.length} levels pass (${playouts} playouts each).`);
process.exit(failed ? 1 : 0);
