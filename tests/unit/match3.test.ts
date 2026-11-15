import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TILE_KINDS,
  __hasMatch,
  __reshuffle,
  __setBoard,
  createGame,
  findHint,
  goalProgress,
  hasMoves,
  starsFor,
  trySwap,
  validateLevel,
  type Cell,
  type Goal,
  type LevelDef,
  type Match3State,
  type Snapshot,
} from '../../src/puzzle/match3';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function level(over: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    seed: 1,
    width: 8,
    height: 8,
    moves: 20,
    tileTypes: 5,
    goals: [{ kind: 'score', target: 1_000_000 }],
    starScores: [100, 200, 300],
    par: 0,
    purpose: 'sermon',
    nameKey: 'ritual.test.name',
    ...over,
  };
}

/** game with a hand-built board (see __setBoard for the row format) */
function board(rows: string[], over: Partial<LevelDef> = {}, opts?: { relaxed?: boolean }): Match3State {
  const width = rows[0].trim().split(/\s+/).length;
  const state = createGame(level({ width, height: rows.length, tileTypes: 6, ...over }), opts);
  __setBoard(state, rows);
  return state;
}

const P = (x: number, y: number) => ({ x, y });
const firstClear = (steps: Snapshot[]): Snapshot => steps.find((s) => s.kind === 'clear') as Snapshot;
const clearedAt = (snap: Snapshot): string[] => snap.cleared.map((c) => `${c.x},${c.y}`).sort();
const at = (snap: Snapshot, x: number, y: number): Cell | null => snap.cells[y][x];

/** FNV-1a over the serialized state: a compact determinism fingerprint */
function hash(state: Match3State): string {
  const s = JSON.stringify(state);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function assertStable(state: Match3State): void {
  expect(__hasMatch(state)).toBe(false);
  const ids = state.cells.flat().filter((c): c is Cell => c !== null).map((c) => c.id);
  expect(new Set(ids).size).toBe(ids.length);
}

/** play hint moves; returns the swaps that were made */
function autoplay(state: Match3State, maxMoves: number): { a: { x: number; y: number }; b: { x: number; y: number } }[] {
  const swaps = [];
  for (let i = 0; i < maxMoves && state.status === 'playing'; i++) {
    const hint = findHint(state);
    if (!hint) break;
    expect(trySwap(state, hint.a, hint.b).valid).toBe(true);
    swaps.push(hint);
  }
  return swaps;
}

// A quiet 6x6 filler pattern with no matches and (on its own) no possible moves:
// tiles differ from every neighbour within distance 2 in each row/column.
const QUIET = ['0 1 2 3 4 5', '2 3 4 5 0 1', '4 5 0 1 2 3', '1 2 3 4 5 0', '3 4 5 0 1 2', '5 0 1 2 3 4'];

// ---------------------------------------------------------------------------

describe('board generation', () => {
  it('has six tile kinds', () => {
    expect(TILE_KINDS).toEqual(['candle', 'skull', 'eye', 'rune', 'herb', 'coin']);
  });

  it('starts with no matches and at least one move, for many seeds and sizes', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const tileTypes = 4 + (seed % 3);
      const state = createGame(level({ seed, tileTypes, width: 6 + (seed % 3), height: 6 + (seed % 4) }));
      assertStable(state);
      expect(hasMoves(state)).toBe(true);
      expect(state.cells.length).toBe(state.level.height);
      for (const row of state.cells) {
        expect(row.length).toBe(state.level.width);
        for (const c of row) {
          expect(c).not.toBeNull();
          expect(c!.type).toBeGreaterThanOrEqual(0);
          expect(c!.type).toBeLessThan(tileTypes);
        }
      }
    }
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(JSON.stringify(createGame(level({ seed: 7 })))).toBe(JSON.stringify(createGame(level({ seed: 7 }))));
    expect(JSON.stringify(createGame(level({ seed: 7 })).cells)).not.toBe(JSON.stringify(createGame(level({ seed: 8 })).cells));
  });

  it('applies moves, extraMoves, relaxed and initial counters', () => {
    const s = createGame(level({ moves: 12 }), { extraMoves: 3, relaxed: true });
    expect(s.movesLeft).toBe(15);
    expect(s.movesUsed).toBe(0);
    expect(s.relaxed).toBe(true);
    expect(s.status).toBe('playing');
    expect(s.collected).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('places webs from the level and the first relics in the top row', () => {
    const webs = [
      { x: 1, y: 1, layers: 1 },
      { x: 4, y: 3, layers: 2 },
    ];
    for (let seed = 1; seed <= 40; seed++) {
      const s = createGame(level({ seed, webs, relics: 3 }));
      expect(s.cells[1][1]!.web).toBe(1);
      expect(s.cells[3][4]!.web).toBe(2);
      const relics = s.cells.flatMap((row, y) => row.filter((c) => c!.relic).map(() => y));
      expect(relics).toEqual([0, 0]); // ceil(3/2) start on the board, both in the top row
      assertStable(s);
      expect(hasMoves(s)).toBe(true);
    }
  });

  it('rejects malformed levels', () => {
    expect(() => createGame(level({ tileTypes: 9 }))).toThrow();
    expect(() => createGame(level({ webs: [{ x: 99, y: 0, layers: 1 }] }))).toThrow();
  });
});

describe('__setBoard', () => {
  it('parses types, specials, webs, relics and holes', () => {
    const s = board(['0 1h 2* R', '. 3b** 4s 5v']);
    expect(s.cells[0][0]).toMatchObject({ type: 0, special: 'none', web: 0, relic: false });
    expect(s.cells[0][1]).toMatchObject({ type: 1, special: 'lineH' });
    expect(s.cells[0][2]).toMatchObject({ type: 2, web: 1 });
    expect(s.cells[0][3]).toMatchObject({ type: -1, relic: true });
    expect(s.cells[1][0]).toBeNull();
    expect(s.cells[1][1]).toMatchObject({ type: 3, special: 'bomb', web: 2 });
    expect(s.cells[1][2]).toMatchObject({ type: 4, special: 'sigil' });
    expect(s.cells[1][3]).toMatchObject({ type: 5, special: 'lineV' });
    expect(() => __setBoard(s, ['0 1 2 3'])).toThrow();
    expect(() => __setBoard(s, ['0 1 2 x', '0 1 2 3'])).toThrow();
  });
});

describe('basic matches', () => {
  it('clears a horizontal 3-match', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0 0 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const before = s.movesLeft;
    const { valid, steps } = trySwap(s, P(2, 3), P(2, 2));
    expect(valid).toBe(true);
    expect(steps[0].kind).toBe('swap');
    expect(steps[0].combo).toBe(0);
    expect(at(steps[0], 2, 2)!.type).toBe(0);
    expect(at(steps[0], 2, 3)!.type).toBe(1);
    const clear = steps[1];
    expect(clear.kind).toBe('clear');
    expect(clear.combo).toBe(1);
    expect(clearedAt(clear)).toEqual(['0,2', '1,2', '2,2']);
    expect(clear.cleared.every((c) => c.type === 0)).toBe(true);
    expect(clear.scoreDelta).toBe(30);
    expect(at(clear, 0, 2)).toBeNull();
    expect(steps[2].kind).toBe('fall');
    expect(s.movesLeft).toBe(before - 1);
    expect(s.movesUsed).toBe(1);
    expect(s.collected[0]).toBeGreaterThanOrEqual(3);
    expect(s.score).toBe(steps.reduce((sum, st) => sum + st.scoreDelta, 0));
    assertStable(s);
  });

  it('clears a vertical 3-match', () => {
    const s = board(['1 2 3 4 5 1', '0 3 4 5 1 2', '0 4 5 1 2 3', '3 0 1 2 3 4', '4 5 2 3 4 5', '5 1 3 4 5 1']);
    const { valid, steps } = trySwap(s, P(1, 3), P(0, 3));
    expect(valid).toBe(true);
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['0,1', '0,2', '0,3']);
    expect(clear.scoreDelta).toBe(30);
    expect(at(clear, 0, 1)).toBeNull();
    expect(at(clear, 0, 0)!.type).toBe(1);
  });

  it('ids of cleared tiles match the tiles that were on the board', () => {
    const s = board(['1 2 3 4 5 1', '0 3 4 5 1 2', '0 4 5 1 2 3', '3 0 1 2 3 4', '4 5 2 3 4 5', '5 1 3 4 5 1']);
    const ids = [s.cells[1][0]!.id, s.cells[2][0]!.id, s.cells[3][1]!.id].sort();
    const { steps } = trySwap(s, P(1, 3), P(0, 3));
    expect(firstClear(steps).cleared.map((c) => c.id).sort()).toEqual(ids);
  });
});

describe('invalid swaps', () => {
  it('adjacent swap without a match returns swap + swapBack and costs no move', () => {
    const s = board(QUIET);
    const before = JSON.stringify(s);
    const { valid, steps } = trySwap(s, P(0, 0), P(1, 0));
    expect(valid).toBe(false);
    expect(steps.map((st) => st.kind)).toEqual(['swap', 'swapBack']);
    expect(at(steps[0], 0, 0)!.type).toBe(1);
    expect(at(steps[0], 1, 0)!.type).toBe(0);
    expect(at(steps[1], 0, 0)!.type).toBe(0);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('non-adjacent, diagonal, same-cell and out-of-bounds swaps return no steps', () => {
    const s = board(QUIET);
    const before = JSON.stringify(s);
    for (const [a, b] of [
      [P(0, 0), P(2, 0)],
      [P(0, 0), P(1, 1)],
      [P(0, 0), P(0, 0)],
      [P(0, 0), P(-1, 0)],
      [P(5, 5), P(6, 5)],
      [P(0, 5), P(0, 6)],
    ]) {
      expect(trySwap(s, a, b)).toEqual({ valid: false, steps: [] });
    }
    expect(JSON.stringify(s)).toBe(before);
  });

  it('swaps into an empty hole are locked', () => {
    const s = board(['0 0 1 2', '3 4* 5 0', '5 . 0 1', '1 2 3 4']);
    expect(trySwap(s, P(0, 2), P(1, 2))).toEqual({ valid: false, steps: [] });
  });

  it('no swaps once the game is over', () => {
    const s = board(['1 2 3 4 5 1', '0 3 4 5 1 2', '0 4 5 1 2 3', '3 0 1 2 3 4', '4 5 2 3 4 5', '5 1 3 4 5 1'], { goals: [{ kind: 'score', target: 10 }] });
    expect(trySwap(s, P(1, 3), P(0, 3)).valid).toBe(true);
    expect(s.status).toBe('won');
    const hint = findHint(s);
    if (hint) expect(trySwap(s, hint.a, hint.b)).toEqual({ valid: false, steps: [] });
  });
});

describe('special creation', () => {
  it('horizontal 4-match creates lineH at the swapped tile', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0 0 1 0 2 3', '3 4 0 1 3 4', '5 1 2 3 4 5', '1 2 3 4 5 1']);
    const moved = s.cells[3][2]!.id;
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['0,2', '1,2', '3,2']);
    expect(at(clear, 2, 2)).toMatchObject({ id: moved, type: 0, special: 'lineH' });
    expect(clear.scoreDelta).toBe(3 * 10 + 20);
  });

  it('vertical 4-match creates lineV at the swapped tile', () => {
    const s = board(['0 2 3 4 5 1', '0 3 4 5 1 2', '1 0 5 1 2 3', '0 4 1 2 3 4', '4 5 2 3 4 5', '5 1 3 4 5 1']);
    const { steps } = trySwap(s, P(1, 2), P(0, 2));
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['0,0', '0,1', '0,3']);
    expect(at(clear, 0, 2)).toMatchObject({ type: 0, special: 'lineV' });
  });

  it('5 in a line creates a sigil that keeps its type', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0 0 1 0 0 3', '3 4 0 1 3 4', '5 1 2 3 4 5', '1 2 3 4 5 1']);
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['0,2', '1,2', '3,2', '4,2']);
    expect(at(clear, 2, 2)).toMatchObject({ type: 0, special: 'sigil' });
    expect(clear.scoreDelta).toBe(4 * 10 + 20);
  });

  it('L shape creates a bomb at the swapped corner', () => {
    const s = board(['0 2 3 4 5 1', '0 3 4 5 1 2', '1 0 0 1 2 3', '0 4 1 2 3 4', '4 5 2 3 4 5', '5 1 3 4 5 1']);
    // moving (0,3) up to (0,2): column 0 rows 0..2 + row 2 cols 0..2
    const { steps } = trySwap(s, P(0, 3), P(0, 2));
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['0,0', '0,1', '1,2', '2,2']);
    expect(at(clear, 0, 2)).toMatchObject({ type: 0, special: 'bomb' });
  });

  it('T shape creates a bomb', () => {
    const s = board(['1 0 3 4 5 1', '2 0 4 5 1 2', '0 1 0 1 2 3', '3 0 1 2 3 4', '4 5 2 3 4 5', '5 1 3 4 5 1']);
    // moving (1,3) up to (1,2): row 2 cols 0..2 + column 1 rows 0..2
    const { steps } = trySwap(s, P(1, 3), P(1, 2));
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['0,2', '1,0', '1,1', '2,2']);
    expect(at(clear, 1, 2)).toMatchObject({ type: 0, special: 'bomb' });
  });

  it('a cascade match of 4 creates the special at a deterministic cell (first in reading order)', () => {
    // (2,5)<->(3,5) lines up 1 1 1 in column 2; the 0 at (2,1) then drops into row 4: 0 0 0 0
    const s = board(['1 2 3 4 5 2', '2 3 0 5 1 3', '3 4 5 1 2 4', '4 5 1 2 3 5', '0 0 1 0 4 1', '1 2 4 1 5 2']);
    const { steps } = trySwap(s, P(2, 5), P(3, 5));
    const clears = steps.filter((st) => st.kind === 'clear');
    expect(clearedAt(clears[0])).toEqual(['2,3', '2,4', '2,5']);
    expect(clears[1].combo).toBe(2);
    expect(clearedAt(clears[1])).toEqual(['1,4', '2,4', '3,4']);
    expect(at(clears[1], 0, 4)).toMatchObject({ type: 0, special: 'lineH' });
    expect(clears[1].scoreDelta).toBe(3 * 10 * 2 + 20);
  });
});

describe('special activation', () => {
  it('lineH clears its row when matched', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0h 0 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['0,2', '1,2', '2,2', '3,2', '4,2', '5,2']);
    expect(clear.scoreDelta).toBe(60);
  });

  it('lineV clears its column when matched', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0v 0 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    expect(clearedAt(firstClear(steps))).toEqual(['0,0', '0,1', '0,2', '0,3', '0,4', '0,5', '1,2', '2,2']);
  });

  it('bomb clears a 3x3 area when matched', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0 0b 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    // match row 2 cols 0..2, bomb at (1,2) adds rows 1..3 x cols 0..2
    expect(clearedAt(firstClear(steps))).toEqual(['0,1', '0,2', '0,3', '1,1', '1,2', '1,3', '2,1', '2,2', '2,3']);
  });

  it('bomb in a corner only clears cells on the board', () => {
    const s = board(['0b 0 1 0 5 1', '2 3 4 5 1 2', '4 5 3 1 2 3', '3 4 0 2 3 4', '5 1 2 3 4 5', '1 2 3 4 5 1']);
    const { steps } = trySwap(s, P(2, 0), P(3, 0));
    expect(clearedAt(firstClear(steps))).toEqual(['0,0', '0,1', '1,0', '1,1', '2,0']);
  });

  it('sigil swapped with a normal tile clears every tile of that type (and itself)', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '4 0s 1 2 3 4', '3 4 5 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const sigilId = s.cells[2][1]!.id;
    const { valid, steps } = trySwap(s, P(1, 2), P(2, 2)); // sigil onto a "1"
    expect(valid).toBe(true);
    const clear = firstClear(steps);
    const ones = clear.cleared.filter((c) => c.type === 1);
    expect(ones.length).toBe(8);
    expect(clear.cleared.length).toBe(9);
    expect(clear.cleared.some((c) => c.id === sigilId && c.type === 0)).toBe(true);
    expect(clear.cells.flat().some((c) => c && c.type === 1)).toBe(false);
    expect(clear.scoreDelta).toBe(90);
    expect(s.movesUsed).toBe(1);
  });

  it('sigil works when the normal tile is the one dragged onto it', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '4 0s 1 2 3 4', '3 4 5 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const { valid, steps } = trySwap(s, P(1, 1), P(1, 2)); // a "3" dragged onto the sigil
    expect(valid).toBe(true);
    const clear = firstClear(steps);
    expect(clear.cleared.filter((c) => c.type === 3).length).toBe(6);
    expect(clear.cells.flat().some((c) => c && c.type === 3)).toBe(false);
  });

  it('a sigil cleared as part of a normal match clears its own type', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0s 0 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 0 1']);
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    const clear = firstClear(steps);
    expect(clear.cleared.filter((c) => c.type === 0).length).toBe(5);
    expect(clear.cleared.length).toBe(5);
  });

  it('chain reaction: a line hits a bomb which hits another line', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0h 0 1 2 3b 4', '3 4 0 1 2 5v', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    const clear = firstClear(steps);
    const got = new Set(clearedAt(clear));
    // row 2 (lineH)
    for (let x = 0; x < 6; x++) expect(got.has(`${x},2`)).toBe(true);
    // bomb at (4,2): rows 1..3, cols 3..5
    for (const k of ['3,1', '4,1', '5,1', '3,3', '4,3', '5,3']) expect(got.has(k)).toBe(true);
    // lineV at (5,3): whole column 5
    for (let y = 0; y < 6; y++) expect(got.has(`5,${y}`)).toBe(true);
    expect(got.size).toBe(6 + 6 + 3);
    expect(steps.filter((st) => st.kind === 'clear')[0]).toBe(clear);
  });
});

describe('special + special swaps', () => {
  const kinds = (steps: Snapshot[]) => steps.map((st) => st.kind);

  it('line + line clears the row and column through the destination', () => {
    const s = board(QUIET);
    s.cells[2][2]!.special = 'lineH';
    s.cells[2][3]!.special = 'lineH';
    const { valid, steps } = trySwap(s, P(2, 2), P(3, 2));
    expect(valid).toBe(true);
    expect(kinds(steps).slice(0, 2)).toEqual(['swap', 'clear']);
    const got = clearedAt(steps[1]);
    const want = new Set<string>();
    for (let i = 0; i < 6; i++) {
      want.add(`${i},2`);
      want.add(`3,${i}`);
    }
    expect(got).toEqual([...want].sort());
    expect(steps[1].scoreDelta).toBe(110);
    expect(s.movesUsed).toBe(1);
  });

  it('line + bomb clears 3 rows and 3 columns', () => {
    const s = board(QUIET);
    s.cells[2][2]!.special = 'lineV';
    s.cells[2][3]!.special = 'bomb';
    const { valid, steps } = trySwap(s, P(2, 2), P(3, 2));
    expect(valid).toBe(true);
    const want = new Set<string>();
    for (let i = 0; i < 6; i++) {
      for (const d of [-1, 0, 1]) {
        want.add(`${i},${2 + d}`);
        want.add(`${3 + d},${i}`);
      }
    }
    expect(clearedAt(steps[1])).toEqual([...want].sort());
    expect(want.size).toBe(27);
  });

  it('bomb + line works in the other order too', () => {
    const s = board(QUIET);
    s.cells[2][2]!.special = 'bomb';
    s.cells[3][2]!.special = 'lineH';
    const { valid, steps } = trySwap(s, P(2, 2), P(2, 3));
    expect(valid).toBe(true);
    expect(steps[1].cleared.length).toBe(27);
  });

  it('bomb + bomb clears 5x5', () => {
    const s = board(QUIET);
    s.cells[2][2]!.special = 'bomb';
    s.cells[2][3]!.special = 'bomb';
    const { valid, steps } = trySwap(s, P(2, 2), P(3, 2));
    expect(valid).toBe(true);
    const want: string[] = [];
    for (let y = 0; y <= 4; y++) for (let x = 1; x <= 5; x++) want.push(`${x},${y}`);
    expect(clearedAt(steps[1])).toEqual(want.sort());
  });

  it('sigil + line turns every tile of that type into a line and triggers them all', () => {
    const s = board(QUIET);
    s.cells[2][2]!.special = 'sigil'; // type 0
    s.cells[2][3]!.special = 'lineH'; // type 1
    const { valid, steps } = trySwap(s, P(2, 2), P(3, 2));
    expect(valid).toBe(true);
    // 1s after the swap: (1,0) (5,1) (2,2) (0,3) (4,4) (2,5). The original keeps lineH; the
    // converted ones alternate: (x+y) even -> lineH, odd -> lineV. Rows 1,2,4 and columns 0,1,2.
    const want = new Set<string>();
    for (let i = 0; i < 6; i++) {
      for (const row of [1, 2, 4]) want.add(`${i},${row}`);
      for (const col of [0, 1, 2]) want.add(`${col},${i}`);
    }
    expect(clearedAt(steps[1])).toEqual([...want].sort());
    expect(steps[1].cleared.filter((c) => c.type === 1).length).toBe(6);
  });

  it('sigil + bomb turns every tile of that type into a bomb and triggers them all', () => {
    const s = board(QUIET);
    s.cells[2][2]!.special = 'sigil'; // type 0, lands on (3,2)
    s.cells[2][3]!.special = 'bomb'; // type 1, lands on (2,2)
    const { valid, steps } = trySwap(s, P(2, 2), P(3, 2));
    expect(valid).toBe(true);
    // 1s (after the swap) at (1,0) (5,1) (2,2) (0,3) (4,4) (2,5): each clears its 3x3
    const want = new Set<string>(['3,2']); // the sigil itself
    for (const [cx, cy] of [[1, 0], [5, 1], [2, 2], [0, 3], [4, 4], [2, 5]]) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x >= 0 && x < 6 && y >= 0 && y < 6) want.add(`${x},${y}`);
        }
      }
    }
    expect(clearedAt(steps[1])).toEqual([...want].sort());
    expect(want.has('3,0')).toBe(false); // a cell outside every blast survives
    expect(at(steps[1], 3, 0)).not.toBeNull();
  });

  it('sigil + sigil clears the whole board', () => {
    const s = board(QUIET);
    s.cells[2][2]!.special = 'sigil';
    s.cells[2][3]!.special = 'sigil';
    const { valid, steps } = trySwap(s, P(2, 2), P(3, 2));
    expect(valid).toBe(true);
    expect(steps[1].cleared.length).toBe(36);
    expect(steps[1].scoreDelta).toBe(360);
    expect(steps[2].kind).toBe('fall');
    expect(steps[2].cells.flat().every((c) => c !== null)).toBe(true);
  });

  it('a special next to a normal tile still needs a match', () => {
    const s = board(QUIET);
    s.cells[2][2]!.special = 'bomb';
    expect(trySwap(s, P(2, 2), P(3, 2)).valid).toBe(false);
    expect(s.movesUsed).toBe(0);
  });

  it('special pairs count as available moves', () => {
    const s = board(QUIET);
    expect(hasMoves(s)).toBe(false);
    s.cells[0][0]!.special = 'lineH';
    expect(hasMoves(s)).toBe(false);
    s.cells[0][1]!.special = 'bomb';
    expect(hasMoves(s)).toBe(true);
    expect(findHint(s)).toEqual({ a: P(0, 0), b: P(1, 0) });
    const t = board(QUIET);
    t.cells[4][4]!.special = 'sigil';
    expect(hasMoves(t)).toBe(true);
  });
});

describe('gravity, refill and cascades', () => {
  it('tiles fall straight down, refills get new ids and valid types', () => {
    const s = board(['1 2 3 4 5 1', '0 3 4 5 1 2', '0 4 5 1 2 3', '3 0 1 2 3 4', '4 5 2 3 4 5', '5 1 3 4 5 1'], { tileTypes: 6 });
    const topId = s.cells[0][0]!.id;
    const maxId = s.nextId - 1;
    const { steps } = trySwap(s, P(1, 3), P(0, 3));
    const fall = steps[2];
    expect(fall.kind).toBe('fall');
    expect(fall.combo).toBe(1);
    expect(at(fall, 0, 3)!.id).toBe(topId); // the "1" dropped three rows
    for (let y = 0; y < 3; y++) {
      const c = at(fall, 0, y)!;
      expect(c.id).toBeGreaterThan(maxId);
      expect(c.type).toBeGreaterThanOrEqual(0);
      expect(c.type).toBeLessThan(6);
      expect(c.special).toBe('none');
    }
    // untouched columns keep their tiles
    expect(at(fall, 3, 3)!.type).toBe(2);
    expect(fall.cells.flat().every((c) => c !== null)).toBe(true);
    assertStable(s);
  });

  it('cascades increase the combo index and the score multiplier', () => {
    // (2,5)<->(3,5) lines up 1 1 1 in column 2; the 0 at (2,1) then drops into row 4: 0 0 0
    const s = board(['1 2 3 4 5 2', '2 3 0 5 1 3', '3 4 5 1 2 4', '4 5 1 2 3 5', '0 0 1 3 4 1', '1 2 4 1 5 2']);
    const { steps } = trySwap(s, P(2, 5), P(3, 5));
    const clears = steps.filter((st) => st.kind === 'clear');
    expect(clears.length).toBeGreaterThanOrEqual(2);
    expect(clears[0].combo).toBe(1);
    expect(clears[0].scoreDelta).toBe(30);
    expect(clears[1].combo).toBe(2);
    expect(clears[1].cleared.filter((c) => c.type === 0 && c.y === 4).length).toBe(3);
    expect(clears[1].scoreDelta).toBeGreaterThanOrEqual(60);
    expect(steps.map((st) => st.kind).slice(0, 5)).toEqual(['swap', 'clear', 'fall', 'clear', 'fall']);
    clears.forEach((c, i) => expect(c.combo).toBe(i + 1));
    expect(s.score).toBe(steps.reduce((sum, st) => sum + st.scoreDelta, 0));
    assertStable(s);
  });

  it('the board is always stable and full after a move (many seeds, hint autoplay)', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const s = createGame(level({ seed, tileTypes: 4 + (seed % 3) }));
      for (let i = 0; i < 12 && s.status === 'playing'; i++) {
        const hint = findHint(s)!;
        const { valid, steps } = trySwap(s, hint.a, hint.b);
        expect(valid).toBe(true);
        assertStable(s);
        expect(s.cells.flat().every((c) => c !== null)).toBe(true);
        expect(hasMoves(s)).toBe(true);
        // the last snapshot is the final board
        expect(JSON.stringify(steps[steps.length - 1].cells)).toBe(JSON.stringify(s.cells));
        // snapshots are deep copies
        steps[0].cells[0][0] = null;
        expect(s.cells[0][0]).not.toBeNull();
      }
      const total = s.collected.reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});

describe('cobwebs', () => {
  it('webbed tiles cannot be swapped', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0 0 1 2 3 4', '3 4 0* 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    expect(trySwap(s, P(2, 3), P(2, 2))).toEqual({ valid: false, steps: [] });
    expect(trySwap(s, P(2, 2), P(2, 3))).toEqual({ valid: false, steps: [] });
    expect(s.movesUsed).toBe(0);
    expect(hasMoves(s)).toBe(false);
  });

  it('a match including a webbed tile removes one layer and keeps the tile', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0** 0 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const webbed = s.cells[2][0]!.id;
    const { valid, steps } = trySwap(s, P(2, 3), P(2, 2));
    expect(valid).toBe(true);
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['1,2', '2,2']);
    expect(clear.scoreDelta).toBe(20);
    expect(at(clear, 0, 2)).toMatchObject({ id: webbed, type: 0, web: 1 });
    expect(s.cells[2][0]).toMatchObject({ id: webbed, web: 1 });
  });

  it('a special clear on a webbed tile removes one layer only', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0h 0 1 2 3* 4**', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['0,2', '1,2', '2,2', '3,2']);
    expect(at(clear, 4, 2)).toMatchObject({ type: 3, web: 0 });
    expect(at(clear, 5, 2)).toMatchObject({ type: 4, web: 1 });
  });

  it('a webbed special does not trigger while it is webbed', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0b* 0 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const { steps } = trySwap(s, P(2, 3), P(2, 2));
    const clear = firstClear(steps);
    expect(clearedAt(clear)).toEqual(['1,2', '2,2']);
    expect(at(clear, 0, 2)).toMatchObject({ special: 'bomb', web: 0 });
  });

  it('webbed tiles do not fall and block the column above them', () => {
    const s = board(['1 2 3 4 5 1', '2 3* 4 5 1 2', '4 5 3 1 2 3', '3 0 0 2 3 4', '0 1 2 3 4 5', '5 2 3 4 5 1']);
    const webbed = s.cells[1][1]!.id;
    const above = s.cells[0][1]!.id;
    const under = s.cells[2][1]!.id;
    // (0,4) up to (0,3): row 3 = 0 0 0
    const { valid, steps } = trySwap(s, P(0, 4), P(0, 3));
    expect(valid).toBe(true);
    const fall = steps[2];
    expect(fall.kind).toBe('fall');
    expect(at(fall, 1, 1)!.id).toBe(webbed);
    expect(at(fall, 1, 0)!.id).toBe(above);
    expect(at(fall, 1, 3)!.id).toBe(under); // fell one row inside its segment
    expect(at(fall, 1, 2)).toBeNull(); // hole under the web is not refilled
    expect(at(fall, 0, 0)).not.toBeNull(); // open columns refill
    expect(at(fall, 2, 0)).not.toBeNull();
    expect(s.cells[1][1]!.web).toBe(1);
  });

  it('once the web is gone the column falls and refills again', () => {
    const s = board(['1 2 4 3 5 1', '2 3* 3 5 1 2', '4 . 0 1 2 3', '3 5 4 2 3 4', '0 1 2 4 4 5', '5 2 3 1 5 1']);
    // (3,0) down to (3,1): row 1 = 2 3* 3 3 -> web removed, tile stays
    const first = trySwap(s, P(3, 0), P(3, 1));
    expect(first.valid).toBe(true);
    expect(firstClear(first.steps).cleared.length).toBe(2);
    // the un-webbed tile now falls into the hole and the column refills from the top
    const lastFall = first.steps.filter((st) => st.kind === 'fall').pop()!;
    expect(lastFall.cells.every((row) => row[1] !== null)).toBe(true);
    expect(s.cells.flat().every((c) => c !== null && c.web === 0)).toBe(true);
  });

  it('clearWebs goal tracks layers and wins when all are gone', () => {
    const rows = ['1 2 3 4 5 1', '2 3 4 5 1 2', '0* 0 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1'];
    const s = board(rows, { goals: [{ kind: 'clearWebs' }], webs: [{ x: 0, y: 2, layers: 1 }] });
    expect(goalProgress(s)).toEqual([{ goal: { kind: 'clearWebs' }, current: 0, target: 1, done: false }]);
    trySwap(s, P(2, 3), P(2, 2));
    expect(goalProgress(s)[0]).toMatchObject({ current: 1, target: 1, done: true });
    expect(s.status).toBe('won');
  });
});

describe('relics', () => {
  it('relics never match', () => {
    const s = board(['R R R 4 5 1', '2 3 4 5 1 2', '4 5 3 1 2 3', '3 4 5 2 3 4', '5 1 2 3 4 5', '1 2 3 4 5 0']);
    expect(__hasMatch(s)).toBe(false);
    expect(hasMoves(s)).toBe(false);
  });

  it('a relic that reaches the bottom row is collected', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '4 5 3 1 2 3', '3 4 5 2 3 4', '5 R 2 3 4 5', '0 1 0 0 5 2'], {
      goals: [{ kind: 'dropRelics', count: 1 }],
      relics: 1,
    });
    const rid = s.cells[4][1]!.id;
    // (1,5)<->(0,5): row 5 = 1 0 0 0 -> clears, relic drops to the bottom row
    const { valid, steps } = trySwap(s, P(0, 5), P(1, 5));
    expect(valid).toBe(true);
    expect(steps.map((st) => st.kind).slice(0, 4)).toEqual(['swap', 'clear', 'fall', 'clear']);
    expect(at(steps[2], 1, 5)).toMatchObject({ id: rid, relic: true, type: -1 });
    const drop = steps[3];
    expect(drop.cleared).toContainEqual({ x: 1, y: 5, type: -1, id: rid });
    expect(drop.scoreDelta).toBeGreaterThanOrEqual(100);
    expect(s.relicsDropped).toBe(1);
    expect(s.status).toBe('won');
    expect(s.cells.flat().some((c) => c?.relic)).toBe(false);
    expect(goalProgress(s)[0]).toMatchObject({ current: 1, target: 1, done: true });
  });

  it('relics survive bombs, lines and sigil board clears', () => {
    const s = board(['0 1 2 3 4 5', '2 3 4 5 0 1', '4 5 0s 1s R 3', '1 2 3 4 5 0', '3 4 5 0 1 2', '5 0 1 2 3 4']);
    const rid = s.cells[2][4]!.id;
    const { steps } = trySwap(s, P(2, 2), P(3, 2));
    expect(steps[1].cleared.length).toBe(35);
    expect(steps[1].cleared.some((c) => c.id === rid)).toBe(false);
    // everything under it is gone, so it falls to the bottom and is collected
    expect(s.relicsDropped).toBe(1);
  });

  it('a relic can be swapped when the other tile makes a match', () => {
    const s = board(['1 2 3 4 5 1', '2 3 4 5 1 2', '0 0 R 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1']);
    const { valid, steps } = trySwap(s, P(2, 3), P(2, 2));
    expect(valid).toBe(true);
    expect(at(steps[0], 2, 3)!.relic).toBe(true);
    expect(clearedAt(firstClear(steps))).toEqual(['0,2', '1,2', '2,2']);
  });

  it('late relics spawn from the top, at most one per 3 moves, and all can be dropped', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = createGame(level({ seed, relics: 3, moves: 200, goals: [{ kind: 'dropRelics', count: 3 }] }));
      const count = () => s.cells.flat().filter((c) => c?.relic).length + s.relicsDropped;
      expect(count()).toBe(2);
      let prev = count();
      while (s.status === 'playing') {
        const hint = findHint(s)!;
        const { steps } = trySwap(s, hint.a, hint.b);
        const now = count();
        expect(now - prev).toBeLessThanOrEqual(1);
        if (s.movesUsed < 3) expect(now).toBe(2);
        if (now > prev) {
          // the new relic entered in the top row of a fall step
          const fallWithNew = steps.find((st) => st.kind === 'fall' && st.cells[0].some((c) => c?.relic));
          expect(fallWithNew).toBeDefined();
        }
        expect(now).toBeLessThanOrEqual(3);
        prev = now;
      }
      expect(s.status).toBe('won');
      expect(s.relicsDropped).toBe(3);
    }
  });
});

describe('reshuffle', () => {
  it('a hand-built dead board has no moves and no hint', () => {
    const s = board(QUIET);
    expect(__hasMatch(s)).toBe(false);
    expect(hasMoves(s)).toBe(false);
    expect(findHint(s)).toBeNull();
  });

  it('reshuffles a dead board into one with a move and no match, keeping the tiles', () => {
    const s = board(QUIET);
    const idsBefore = s.cells.flat().map((c) => c!.id).sort((a, b) => a - b);
    const typesBefore = s.cells.flat().map((c) => c!.type).sort();
    const snap = __reshuffle(s);
    expect(snap.kind).toBe('reshuffle');
    expect(snap.cleared).toEqual([]);
    expect(snap.scoreDelta).toBe(0);
    expect(JSON.stringify(snap.cells)).toBe(JSON.stringify(s.cells));
    expect(hasMoves(s)).toBe(true);
    expect(__hasMatch(s)).toBe(false);
    expect(s.cells.flat().map((c) => c!.id).sort((a, b) => a - b)).toEqual(idsBefore);
    expect(s.cells.flat().map((c) => c!.type).sort()).toEqual(typesBefore);
  });

  it('keeps relics, webbed tiles, specials and holes in place', () => {
    const rows = ['0 1 2 3 4 5', '2 3* 4 5 0 1', '4 . 0 1b 2 3', '1 2 3 4 5 0', 'R 4 5 0 1** 2', '5 0 1 2 3 4h'];
    const s = board(rows);
    expect(hasMoves(s)).toBe(false);
    const fixed = (st: Match3State) =>
      st.cells.flatMap((row, y) => row.map((c, x) => (c === null ? `${x},${y}:hole` : c.relic || c.web > 0 || c.special !== 'none' ? `${x},${y}:${c.id}` : '')).filter(Boolean));
    const before = fixed(s);
    __reshuffle(s);
    expect(fixed(s)).toEqual(before);
    expect(hasMoves(s)).toBe(true);
    expect(__hasMatch(s)).toBe(false);
  });

  it('is seeded: same state reshuffles the same way', () => {
    const a = board(QUIET);
    const b = board(QUIET);
    __reshuffle(a);
    __reshuffle(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.rngState).not.toBe(createGame(a.level).rngState);
  });

  it('re-rolls types when the tile mix cannot form any move', () => {
    const s = board(['0 1 2 3', '2 3 0 1'], { tileTypes: 4 });
    __setBoard(s, ['0 1 2 3', '4 5 0 1']); // at most two of each type: no arrangement has a move
    expect(hasMoves(s)).toBe(false);
    __reshuffle(s);
    expect(hasMoves(s)).toBe(true);
    expect(__hasMatch(s)).toBe(false);
  });

  it('a move that leaves a dead board emits a reshuffle step', () => {
    // tiny boards with many types go dead after almost every move
    let reshuffles = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = createGame(level({ seed, width: 4, height: 3, tileTypes: 6, moves: 50 }));
      for (let i = 0; i < 8 && s.status === 'playing'; i++) {
        const hint = findHint(s);
        expect(hint).not.toBeNull();
        const { steps } = trySwap(s, hint!.a, hint!.b);
        const idx = steps.findIndex((st) => st.kind === 'reshuffle');
        if (idx >= 0) {
          reshuffles++;
          expect(idx).toBe(steps.length - 1);
          expect(steps[idx].combo).toBe(0);
          // same tiles before and after the reshuffle (ids preserved)
          const ids = (cells: (Cell | null)[][]) => cells.flat().map((c) => c!.id).sort((a, b) => a - b);
          expect(ids(steps[idx].cells)).toEqual(ids(steps[idx - 1].cells));
        }
        expect(hasMoves(s)).toBe(true);
        assertStable(s);
      }
    }
    expect(reshuffles).toBeGreaterThan(5);
  });
});

describe('goals, win and lose', () => {
  const rows = ['1 2 3 4 5 1', '2 3 4 5 1 2', '0 0 1 2 3 4', '3 4 0 1 2 5', '5 1 2 3 4 0', '1 2 3 4 5 1'];

  it('collect goal progress and win', () => {
    const goal: Goal = { kind: 'collect', tile: 0, count: 3 };
    const s = board(rows, { goals: [goal], tileTypes: 6 });
    expect(goalProgress(s)).toEqual([{ goal, current: 0, target: 3, done: false }]);
    expect(starsFor(s)).toBe(0);
    trySwap(s, P(2, 3), P(2, 2));
    expect(goalProgress(s)[0]).toMatchObject({ current: 3, target: 3, done: true });
    expect(s.status).toBe('won');
  });

  it('needs every goal to win', () => {
    const s = board(rows, { goals: [{ kind: 'collect', tile: 0, count: 3 }, { kind: 'score', target: 1_000_000 }] });
    trySwap(s, P(2, 3), P(2, 2));
    const progress = goalProgress(s);
    expect(progress[0].done).toBe(true);
    expect(progress[1].done).toBe(false);
    expect(progress[1].current).toBe(s.score);
    expect(s.status).toBe('playing');
  });

  it('score goal wins', () => {
    const s = board(rows, { goals: [{ kind: 'score', target: 30 }] });
    trySwap(s, P(2, 3), P(2, 2));
    expect(s.status).toBe('won');
    expect(goalProgress(s)[0]).toMatchObject({ current: 30, target: 30, done: true });
  });

  it('loses when the moves run out before the goals are met', () => {
    const s = board(rows, { moves: 1 });
    expect(trySwap(s, P(2, 3), P(2, 2)).valid).toBe(true);
    expect(s.movesLeft).toBe(0);
    expect(s.status).toBe('lost');
    expect(starsFor(s)).toBe(0);
  });

  it('winning on the last move is a win', () => {
    const s = board(rows, { moves: 1, goals: [{ kind: 'score', target: 30 }] });
    trySwap(s, P(2, 3), P(2, 2));
    expect(s.movesLeft).toBe(0);
    expect(s.status).toBe('won');
  });

  it('invalid swaps never end the game', () => {
    const s = board(rows, { moves: 1 });
    expect(trySwap(s, P(0, 0), P(1, 0)).valid).toBe(false);
    expect(s.status).toBe('playing');
    expect(s.movesLeft).toBe(1);
  });

  it('stars follow the score thresholds', () => {
    const mk = (starScores: [number, number, number]) => {
      const s = board(rows, { goals: [{ kind: 'score', target: 30 }], starScores });
      trySwap(s, P(2, 3), P(2, 2));
      expect(s.status).toBe('won');
      return starsFor(s);
    };
    expect(mk([10, 20, 30])).toBe(3);
    expect(mk([10, 20, 10_000_000])).toBe(2);
    expect(mk([10, 10_000_000, 20_000_000])).toBe(1);
    expect(mk([5_000_000, 10_000_000, 20_000_000])).toBe(1); // a win is always worth a star
  });
});

describe('relaxed mode', () => {
  it('never runs out of moves and never loses', () => {
    const s = createGame(level({ seed: 5, moves: 2 }), { relaxed: true });
    const swaps = autoplay(s, 30);
    expect(swaps.length).toBe(30);
    expect(s.movesLeft).toBe(2);
    expect(s.movesUsed).toBe(30);
    expect(s.status).toBe('playing');
  });

  it('can still win, capped at one star', () => {
    const s = createGame(level({ seed: 5, moves: 1, goals: [{ kind: 'score', target: 400 }], starScores: [1, 2, 3] }), { relaxed: true });
    autoplay(s, 200);
    expect(s.status).toBe('won');
    expect(starsFor(s)).toBe(1);
  });
});

describe('determinism and serialization', () => {
  const lvl = level({
    seed: 4242,
    moves: 40,
    relics: 2,
    webs: [
      { x: 2, y: 4, layers: 2 },
      { x: 5, y: 4, layers: 1 },
    ],
    goals: [{ kind: 'score', target: 1_000_000 }],
  });

  it('same level + same swaps gives byte-identical state and steps', () => {
    const a = createGame(lvl);
    const b = createGame(lvl);
    const swaps = [];
    for (let i = 0; i < 25; i++) {
      const hint = findHint(a)!;
      swaps.push(hint);
      const ra = trySwap(a, hint.a, hint.b);
      const rb = trySwap(b, hint.a, hint.b);
      expect(JSON.stringify(rb)).toBe(JSON.stringify(ra));
      expect(hash(b)).toBe(hash(a));
    }
    // replaying the recorded swaps on a fresh game lands on the same fingerprint
    const c = createGame(lvl);
    for (const sw of swaps) trySwap(c, sw.a, sw.b);
    expect(hash(c)).toBe(hash(a));
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });

  it('matches the pinned fingerprint (engine or rng changes must be deliberate)', () => {
    const s = createGame(lvl);
    autoplay(s, 20);
    expect({ hash: hash(s), score: s.score, nextId: s.nextId, rngState: s.rngState }).toMatchInlineSnapshot(`
      {
        "hash": "594b81ea",
        "nextId": 333,
        "rngState": 4257090038,
        "score": 5760,
      }
    `);
  });

  it('state is plain JSON: a round-trip mid-game continues identically', () => {
    const straight = createGame(lvl);
    let resumed = createGame(lvl);
    for (let i = 0; i < 30; i++) {
      const hint = findHint(straight)!;
      expect(findHint(resumed)).toEqual(hint);
      const r1 = trySwap(straight, hint.a, hint.b);
      const r2 = trySwap(resumed, hint.a, hint.b);
      expect(JSON.stringify(r2)).toBe(JSON.stringify(r1));
      // serialize and resume after every move
      const json = JSON.stringify(resumed);
      resumed = JSON.parse(json) as Match3State;
      expect(JSON.stringify(resumed)).toBe(json);
      expect(JSON.stringify(resumed)).toBe(JSON.stringify(straight));
    }
  });

  it('invalid swaps and hints do not disturb the rng', () => {
    const a = createGame(lvl);
    const b = createGame(lvl);
    for (let i = 0; i < 10; i++) {
      findHint(b);
      hasMoves(b);
      goalProgress(b);
      for (let x = 0; x < 7; x++) {
        const probe = JSON.parse(JSON.stringify(b)) as Match3State;
        if (!trySwap(probe, P(x, 0), P(x + 1, 0)).valid) trySwap(b, P(x, 0), P(x + 1, 0));
      }
      const hint = findHint(a)!;
      trySwap(a, hint.a, hint.b);
      trySwap(b, hint.a, hint.b);
      expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    }
  });
});

describe('findHint', () => {
  it('always returns a valid move when hasMoves, and is deterministic', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const s = createGame(level({ seed, tileTypes: 4 + (seed % 3), moves: 10 }));
      while (s.status === 'playing') {
        expect(hasMoves(s)).toBe(true);
        const before = JSON.stringify(s);
        const hint = findHint(s);
        expect(hint).not.toBeNull();
        expect(findHint(s)).toEqual(hint);
        expect(JSON.stringify(s)).toBe(before); // hinting does not mutate
        expect(Math.abs(hint!.a.x - hint!.b.x) + Math.abs(hint!.a.y - hint!.b.y)).toBe(1);
        expect(trySwap(s, hint!.a, hint!.b).valid).toBe(true);
      }
      expect(s.status).toBe('lost');
      expect(s.movesUsed).toBe(10);
    }
  });

  it('prefers the move that creates a special', () => {
    // dropping the 0 at (2,2) into row 3 makes 0 0 0 0; the 0 at (2,5) cannot reach row 3
    const s = board(['1 2 3 4 3 1', '2 3 4 5 1 2', '4 5 0 1 2 3', '0 0 3 0 3 4', '3 1 2 3 4 5', '5 2 0 4 5 1']);
    const hint = findHint(s)!;
    expect(hint).toEqual({ a: P(2, 2), b: P(2, 3) });
    const { steps } = trySwap(s, hint.a, hint.b);
    expect(at(firstClear(steps), 2, 3)!.special).toBe('lineH');
  });

  it('prefers the move that advances the goal', () => {
    const rows = ['1 2 3 4 3 1', '2 3 4 5 1 2', '4 5 0 1 2 3', '0 0 3 4 5 4', '3 1 2 5 5 2', '5 2 4 1 3 5'];
    // option A: 0 0 0 in row 3 via (2,2)->(2,3); option B: 5 5 5 in row 4 via (5,5)->(5,4)
    const zero = board(rows, { goals: [{ kind: 'collect', tile: 0, count: 9 }] });
    expect(findHint(zero)).toEqual({ a: P(2, 2), b: P(2, 3) });
    const five = board(rows, { goals: [{ kind: 'collect', tile: 5, count: 9 }] });
    expect(findHint(five)).toEqual({ a: P(5, 4), b: P(5, 5) });
  });
});

describe('shipped levels', () => {
  const file = new URL('../../data/levels/rituals.json', import.meta.url);
  const { levels } = JSON.parse(readFileSync(file, 'utf8')) as { levels: LevelDef[] };
  // every level must clear the 0.70 floor; the first two keep their stricter targets
  const WIN_RATE_FLOOR = 0.7;
  const targets: Record<string, number> = { r1: 0.9, r2: 0.75 };
  const PLAYOUTS = 100;

  it('starts with the three slice rituals in their agreed shape', () => {
    const slice = levels.slice(0, 3);
    expect(slice.map((l) => l.id)).toEqual(['r1', 'r2', 'r3']);
    expect(slice.map((l) => l.purpose)).toEqual(['sermon', 'recruit', 'summon']);
    expect(slice.map((l) => l.nameKey)).toEqual(['ritual.r1.name', 'ritual.r2.name', 'ritual.r3.name']);
    expect(slice.map((l) => l.unlock)).toEqual([{ step: 'ritual1' }, { step: 'ritual2' }, { step: 'ritual3' }]);
    for (const l of levels) {
      expect([l.width, l.height, l.tileTypes]).toEqual([8, 8, 5]);
      expect(l.par).toBeGreaterThan(0);
      expect(l.par).toBeLessThanOrEqual(l.moves);
      expect(l.starScores[0]).toBeLessThan(l.starScores[1]);
      expect(l.starScores[1]).toBeLessThan(l.starScores[2]);
    }
    expect(levels[0].goals).toEqual([{ kind: 'collect', tile: 0, count: 12 }]);
    expect(levels[0].moves).toBe(15);
    expect(levels[1].goals).toEqual([{ kind: 'collect', tile: 2, count: 10 }, { kind: 'clearWebs' }]);
    expect(levels[2].goals).toEqual([{ kind: 'dropRelics', count: 2 }]);
    expect(levels[2].relics).toBe(2);
  });

  it('every level has a unique id, a matching name key and an unlock rule', () => {
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
    for (const l of levels) {
      expect(l.nameKey).toBe(`ritual.${l.id}.name`);
      expect(l.unlock, `${l.id} unlock`).toBeDefined();
      const { step, level } = l.unlock!;
      expect(step !== undefined || level !== undefined, `${l.id} unlock is empty`).toBe(true);
      if (step !== undefined) expect(typeof step).toBe('string');
      if (level !== undefined) expect(Number.isInteger(level) && level >= 1).toBe(true);
    }
  });

  it('web layouts are left-right symmetric, in bounds and one or two layers deep', () => {
    for (const l of levels) {
      const webs = l.webs ?? [];
      const keys = new Set(webs.map((w) => `${w.x},${w.y}`));
      expect(keys.size).toBe(webs.length);
      for (const w of webs) {
        expect([1, 2]).toContain(w.layers);
        expect(keys.has(`${l.width - 1 - w.x},${w.y}`)).toBe(true);
      }
    }
  });

  it('r2 webs are 6-8 single layers in a left-right symmetric pattern', () => {
    const webs = levels[1].webs!;
    expect(webs.length).toBeGreaterThanOrEqual(6);
    expect(webs.length).toBeLessThanOrEqual(8);
    const keys = new Set(webs.map((w) => `${w.x},${w.y}`));
    expect(keys.size).toBe(webs.length);
    for (const w of webs) {
      expect(w.layers).toBe(1);
      expect(keys.has(`${7 - w.x},${w.y}`)).toBe(true);
    }
  });

  it('every level starts clean and playable', () => {
    for (const l of levels) {
      const s = createGame(l);
      assertStable(s);
      expect(hasMoves(s)).toBe(true);
      expect(s.movesLeft).toBe(l.moves);
      expect(goalProgress(s).every((g) => !g.done)).toBe(true);
    }
  });

  for (const l of levels) {
    it(`${l.id} validates above its target win rate`, () => {
      const result = validateLevel(l, PLAYOUTS);
      expect(result.winRate).toBeGreaterThanOrEqual(targets[l.id] ?? WIN_RATE_FLOOR);
      expect(result.par).toBe(Math.round(result.avgMovesUsed));
      expect(result.par).toBeGreaterThan(0);
      expect(result.par).toBeLessThanOrEqual(l.moves);
      expect(Math.abs(result.par - l.par)).toBeLessThanOrEqual(1);
      expect(result.avgScore).toBeGreaterThan(0);
    });
  }

  it('validateLevel is deterministic', () => {
    expect(validateLevel(levels[0], 20)).toEqual(validateLevel(levels[0], 20));
  });
});

describe('leftover-moves bonus', () => {
  it('pays MOVE_BONUS per unused move on a win, as its own snapshot, and never in relaxed mode', async () => {
    const m = await import('../../src/puzzle/match3');
    const level = { id: 't', seed: 5, width: 8, height: 8, moves: 10, tileTypes: 5, goals: [{ kind: 'score' as const, target: 1 }], starScores: [1, 2, 3] as [number, number, number], par: 1, purpose: 'sermon' as const, nameKey: 'x' };
    for (const relaxed of [false, true]) {
      const g = m.createGame(level, { relaxed });
      const h = m.findHint(g)!;
      const res = m.trySwap(g, h.a, h.b);
      expect(g.status).toBe('won');
      const bonus = res.steps.filter((s) => s.kind === 'bonus');
      if (relaxed) expect(bonus).toHaveLength(0);
      else {
        expect(bonus).toHaveLength(1);
        expect(bonus[0].scoreDelta).toBe(9 * m.MOVE_BONUS);
        expect(res.steps[res.steps.length - 1].kind).toBe('bonus');
      }
    }
  });
});
