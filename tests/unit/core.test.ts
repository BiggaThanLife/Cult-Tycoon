import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DATA } from '../../src/core/data';
import * as G from '../../src/core/game';
import { applyOffline } from '../../src/core/offline';
import { deriveSeed, makeRng } from '../../src/core/rng';
import { exportCode, importCode, KEYS, loadGame, memoryKV, parse, saveGame, serialize } from '../../src/core/save';
import { Store } from '../../src/core/store';
import { hasText } from '../../src/core/text';
import type { GameState } from '../../src/core/types';
import { countItems, createMerge, moveItem, tapGenerator, tickMerge } from '../../src/puzzle/merge';
import type { Match3State } from '../../src/puzzle/match3';
import { layoutFor } from '../../src/ui/layout';
import * as S from '../../src/core/sanctum';
import * as I from '../../src/core/inspection';
import { spriteKeys } from '../../src/art/sprites';

const T0 = 1_700_000_000_000;
const win = (g: GameState, id: string, stars = 3) => {
  const st = G.startRitual(g, id) as Match3State;
  st.status = 'won';
  st.score = st.level.starScores[stars - 1];
  return G.finishRitual(g);
};

/** Plays the whole vertical slice through core actions only. */
function playSlice(seed = 42): GameState {
  const g = G.newGame(seed, T0);
  const step = () => { G.advanceTutorial(g); G.ensureDraft(g); };
  g.run.flags.welcomed = true; step();
  expect(G.placeBuilding(g, 'sermon_hall', 8, 10)).toBe(true); step();
  G.debugSkip(g, 60);
  expect(G.collect(g, g.run.buildings.find((b) => b.type === 'sermon_hall')!.id)).toBeGreaterThan(0); step();
  win(g, 'r1'); step();
  expect(g.run.draft).toHaveLength(3);
  G.draftPick(g, 0); step();
  win(g, 'r2'); step();
  G.draftPick(g, 1); G.draftPick(g, 2); step();
  expect(g.run.followers).toHaveLength(3);
  expect(G.placeBuilding(g, 'greenhouse', 12, 10)).toBe(true); step();
  const gh = g.run.buildings.find((b) => b.type === 'greenhouse')!;
  expect(G.plant(g, gh.id, 0, 'basil')).toBe(true);
  expect(G.plant(g, gh.id, 1, 'nightshade')).toBe(true); step();
  // merge four pamphlets into a manifesto
  const gen = g.run.reliquary.cells.findIndex((c) => c?.kind === 'gen');
  const spots: number[] = [];
  for (let i = 0; i < 4; i++) spots.push(G.mergeTap(g, gen));
  G.mergeMove(g, { area: 'grid', i: spots[0] }, { area: 'grid', i: spots[1] });
  G.mergeMove(g, { area: 'grid', i: spots[2] }, { area: 'grid', i: spots[3] });
  expect(G.mergeMove(g, { area: 'grid', i: spots[1] }, { area: 'grid', i: spots[3] }).kind).toBe('merge'); step();
  G.debugSkip(g, 121);
  g.run.event = null; // the cat may have wandered in
  expect(G.harvest(g, gh.id, 0)).toBeGreaterThanOrEqual(3);
  expect(G.harvest(g, gh.id, 1)).toBeGreaterThanOrEqual(2); step();
  expect(G.placeBuilding(g, 'alchemy_lab', 8, 14)).toBe(true); step();
  const brewed = G.brew(g, ['basil', 'nightshade'], false);
  expect(brewed).toMatchObject({ ok: true, output: 'amnesia_brew', discovered: true }); step();
  G.tick(g, 0.1);
  expect((g.run.event as { id: string } | null)?.id).toBe('reporter');
  expect(G.resolveEvent(g, 0)).toBe(true); step();
  expect(win(g, 'r3').entity).toBe('mothman'); step();
  expect(G.fillOrder(g, 'mothman_1').ok).toBe(true);
  expect(G.fillOrder(g, 'mothman_2').ok).toBe(true); step();
  return g;
}

describe('rng', () => {
  it('is deterministic and resumable from its state', () => {
    const a = makeRng(123);
    const first = [a.next(), a.next(), a.next()];
    const b = makeRng(123);
    expect([b.next(), b.next(), b.next()]).toEqual(first);
    const c = makeRng(a.state);
    expect(c.next()).toBe(a.next());
    expect(deriveSeed(1, 'recruits')).not.toBe(deriveSeed(1, 'events'));
  });
});

describe('vertical slice (headless)', () => {
  it('can be completed start to finish through core actions', () => {
    const g = playSlice();
    expect(g.run.tutorial).toBe('away');
    expect(g.run.level).toBeGreaterThanOrEqual(2);
    expect(g.run.favor.mothman).toBe(40);
    expect(g.run.met).toEqual(['mothman']);
    expect(G.boonsUnlocked(g.run, 'mothman')).toBe(1); // 20 for the summon + 10 + 10: first boon at 40
    expect(g.meta.grimoire).toContain('amnesia_brew');
    expect(g.meta.mergeCodex.paper).toBe(3);
    expect(g.meta.bestiary).toContain('mothman');
  });
  it('is reproducible for the same seed', () => {
    expect(JSON.stringify(playSlice(7))).toBe(JSON.stringify(playSlice(7)));
    expect(JSON.stringify(playSlice(7).run.followers)).not.toBe(JSON.stringify(playSlice(8).run.followers));
  });
  it('suspicion rises with recruits and falls with the Amnesia Brew sample', () => {
    const g = G.newGame(1, T0);
    g.run.pendingDrafts = 1; G.ensureDraft(g); G.draftPick(g, 0);
    expect(g.run.suspicion).toBeGreaterThanOrEqual(6);
    g.run.suspicion = 20; g.run.inventory.amnesia_brew = 1;
    G.triggerEvent(g, 'reporter'); G.resolveEvent(g, 0);
    expect(g.run.suspicion).toBe(5);
    expect(g.run.inventory.amnesia_brew).toBe(0);
    G.triggerEvent(g, 'reporter');
    expect(G.resolveEvent(g, 0)).toBe(false); // no brew left: the sample option is unavailable
    expect(G.resolveEvent(g, 1)).toBe(true);
    expect(g.run.suspicion).toBe(10);
  });
  it('buildings cannot overlap or leave the cleared land', () => {
    const g = G.newGame(1, T0);
    g.run.tutorial = 'build_lab';
    expect(G.canPlace(g.run, 'sermon_hall', 0, 0)).toBe(false);
    expect(G.placeBuilding(g, 'sermon_hall', 8, 10)).toBe(true);
    expect(G.canPlace(g.run, 'greenhouse', 9, 10)).toBe(false);
    expect(G.placeBuilding(g, 'sermon_hall', 8, 14)).toBe(false); // max 1
  });
  it('brewing: unknown combos make sludge, fine batches give a bonus bottle', () => {
    const g = G.newGame(1, T0);
    g.run.buildings.push({ id: 99, type: 'alchemy_lab', x: 8, y: 10, level: 1, stored: 0 });
    g.run.inventory = { basil: 6, nightshade: 3 };
    expect(G.brew(g, ['nightshade', 'nightshade'], false).output).toBe('sludge');
    expect(G.brew(g, ['nightshade', 'basil'], true)).toMatchObject({ output: 'amnesia_brew', count: 2, discovered: true });
    expect(G.brew(g, ['basil'], false).ok).toBe(false);
    expect(G.brew(g, ['basil', 'basil', 'basil', 'basil', 'basil'], false).ok).toBe(false);
  });
});

describe('follower stats do what the follower sheet says', () => {
  const mk = (stats: Partial<Record<'devotion' | 'sanity' | 'productivity' | 'doubt', number>>, traits: string[] = []) =>
    ({ id: 1, name: 'Test', traits, stats: { devotion: 50, sanity: 50, productivity: 50, doubt: 0, ...stats }, skin: 0, robe: 0, job: null });
  it('Productivity sets work speed, Sanity nudges it, Zealous multiplies it', () => {
    expect(G.followerWork(mk({}))).toBeCloseTo(0.5, 5);                       // 0.5 x (0.5 + 50/100)
    expect(G.followerWork(mk({ productivity: 100 }))).toBeCloseTo(0.75, 5);
    expect(G.followerWork(mk({ sanity: 100 }))).toBeCloseTo(0.625, 5);        // +25 points of effort x 0.5
    expect(G.followerWork(mk({ sanity: 0 }))).toBeCloseTo(0.375, 5);
    expect(G.followerWork(mk({}, ['zealous']))).toBeCloseTo(0.6, 5);
    expect(G.sanityWorkPart(mk({ sanity: 70 }))).toBeCloseTo(0.05, 5);
    const g = G.newGame(1, T0);
    g.run.tutorial = 'build_hall';
    G.placeBuilding(g, 'sermon_hall', 8, 10);
    const hall = g.run.buildings.find((b) => b.type === 'sermon_hall')!;
    const base = G.productionRate(g.run, hall);
    g.run.followers.push({ ...mk({ productivity: 100 }), job: hall.id });
    expect(G.productionRate(g.run, hall)).toBeCloseTo(base * 1.75, 5);
  });
  it('Devotion raises ritual Devotion rewards', () => {
    const plain = G.newGame(3, T0); plain.run.tutorial = 'ritual1';
    const flock = G.newGame(3, T0); flock.run.tutorial = 'ritual1';
    flock.run.followers.push(mk({ devotion: 100 }), { ...mk({ devotion: 50 }), id: 2 });
    expect(G.ritualDevotionPct(flock.run)).toBeCloseTo(15, 5);
    const a = win(plain, 'r1');
    const b = win(flock, 'r1');
    expect(b.flockPct).toBe(15);
    expect(b.devotion).toBe(Math.round(a.devotion * 1.15));
  });
  it('Doubt slows how fast Suspicion fades', () => {
    const calm = G.newGame(1, T0); const doubting = G.newGame(1, T0);
    calm.run.followers.push(mk({ doubt: 0 }));
    doubting.run.followers.push(mk({ doubt: 80 }));
    expect(G.doubtDecayPenalty(doubting.run)).toBeCloseTo(0.4, 5);
    calm.run.suspicion = 50; doubting.run.suspicion = 50;
    G.tick(calm, 600); G.tick(doubting, 600);
    expect(50 - calm.run.suspicion).toBeCloseTo(5, 5);
    expect(50 - doubting.run.suspicion).toBeCloseTo(3, 5);
  });
});

describe('expansion: orders, boons, upgrades, unlocks', () => {
  it('after the tutorial orders, the Mothman keeps two requests open from things you can make', () => {
    const g = playSlice();
    expect(g.run.orders).toHaveLength(0);
    G.tick(g, DATA.balance.orders.refillSec + 1);
    const open = G.activeOrders(g.run, 'mothman');
    expect(open).toHaveLength(1); // one slot refills per timer
    G.tick(g, DATA.balance.orders.refillSec + 1);
    expect(G.activeOrders(g.run, 'mothman')).toHaveLength(2);
    for (const o of g.run.orders) {
      const def = DATA.orders.find((x) => x.id === o.id)!;
      expect(def.tutorial).toBeFalsy();
      expect(def.needs.every((n) => G.producible(g, n))).toBe(true);
    }
    // candle items and level-3 crops are out of reach at level 2
    expect(G.producible(g, { merge: 'candle', tier: 2, count: 1 })).toBe(false);
    expect(G.producible(g, { item: 'moonpetal', count: 1 })).toBe(false);
    expect(G.producible(g, { item: 'moonlight_tincture', count: 1 })).toBe(false); // hinted, but moonpetal is locked
  });
  it('every order pool only asks for items that exist, and every entity has a pool and a summoning ritual', () => {
    for (const e of DATA.entities) {
      expect(DATA.orders.filter((o) => o.from === e.id && !o.tutorial).length).toBeGreaterThanOrEqual(3);
      const lv = DATA.rituals.find((r) => r.id === e.summonRitual);
      expect(lv?.purpose).toBe('summon');
      expect(e.boons.map((b) => b.favor)).toEqual([...e.boons.map((b) => b.favor)].sort((a, b) => a - b));
      if (e.hintsRecipe) expect(DATA.recipes.recipes.some((r) => r.id === e.hintsRecipe)).toBe(true);
    }
    const summons = DATA.rituals.filter((r) => r.purpose === 'summon').map((r) => r.id).sort();
    expect(DATA.entities.map((e) => e.summonRitual).sort()).toEqual(summons);
  });
  it('gamble orders roll between half and 2.5x, deterministically for a seed', () => {
    const roll = (seed: number) => {
      const g = playSlice(seed);
      g.run.met.push('anansi');
      g.run.devotion = 0; g.run.donations = 0;
      g.run.orders.push({ id: 'anansi_4' });
      g.run.reliquary.cells[0] = { id: 800, kind: 'item', chain: 'paper', tier: 2 };
      g.run.reliquary.cells[1] = { id: 801, kind: 'item', chain: 'candle', tier: 2 };
      return G.fillOrder(g, 'anansi_4');
    };
    const a = roll(5);
    expect(a.ok).toBe(true);
    expect(DATA.balance.orders.gamble).toContain(a.mult);
    expect(a.devotion).toBe(Math.round(90 * a.mult));
    expect(roll(5).mult).toBe(a.mult);
    const mean = DATA.balance.orders.gamble.reduce((x, y) => x + y, 0) / DATA.balance.orders.gamble.length;
    expect(mean).toBeGreaterThan(1);
    expect(Math.min(...DATA.balance.orders.gamble)).toBeGreaterThanOrEqual(0.5);
  });
  it('Favor unlocks boons, and boons change the numbers they claim to', () => {
    const g = playSlice();
    const hall = g.run.buildings.find((b) => b.type === 'sermon_hall')!;
    const before = { rate: G.productionRate(g.run, hall), ritual: G.boon(g.run, 'ritualDevotionPct') };
    expect(before.ritual).toBe(10); // Mothman's first boon
    g.run.met.push('vorl');
    g.run.favor.vorl = 100;
    expect(G.boonsUnlocked(g.run, 'vorl')).toBe(2);
    expect(G.boon(g.run, 'outputPct')).toBe(40);
    expect(G.productionRate(g.run, hall)).toBeCloseTo(before.rate + (6 / 60) * 0.4, 6);
    g.run.met.push('baba_yaga');
    g.run.favor.baba_yaga = 40;
    const gh = g.run.buildings.find((b) => b.type === 'greenhouse')!;
    G.plant(g, gh.id, 0, 'basil'); G.tick(g, 31);
    const base = DATA.crops.find((c) => c.id === 'basil')!.yield;
    expect(G.harvest(g, gh.id, 0)).toBeGreaterThanOrEqual(base + 1);
    const events: string[] = [];
    g.run.favor.mothman = 95; g.run.orders.push({ id: 'mothman_3' }); g.run.inventory.nightshade = 2;
    G.fillOrder(g, 'mothman_3', (e) => { if (e.type === 'boon') events.push(`${e.entity}:${e.index}`); });
    expect(events).toEqual(['mothman:1']);
  });
  it('upgrades cost resources and a merge item, and deliver what the card promises', () => {
    const g = playSlice();
    const dorm = g.run.buildings.find((b) => b.type === 'dormitory')!;
    const gh = g.run.buildings.find((b) => b.type === 'greenhouse')!;
    const hall = g.run.buildings.find((b) => b.type === 'sermon_hall')!;
    g.run.devotion = 500; g.run.donations = 500;
    expect(G.canUpgrade(g.run, dorm)).toBe(false); // no Brochure yet
    g.run.reliquary.cells[0] = { id: 900, kind: 'item', chain: 'paper', tier: 2 };
    expect(G.housing(g.run)).toBe(4);
    expect(G.upgradeBuilding(g, dorm.id)).toBe(true);
    expect(G.housing(g.run)).toBe(6);
    expect(g.run.reliquary.cells[0]).toBeNull();
    expect(g.run.devotion).toBe(380);
    g.run.reliquary.cells[0] = { id: 901, kind: 'item', chain: 'paper', tier: 2 };
    expect(G.upgradeBuilding(g, gh.id)).toBe(true);
    expect(gh.plots).toHaveLength(6);
    const rate = G.productionRate(g.run, hall);
    g.run.reliquary.cells[0] = { id: 902, kind: 'item', chain: 'paper', tier: 3 };
    g.run.devotion = 500;
    expect(G.devotionCap(g.run)).toBe(500);
    expect(G.upgradeBuilding(g, hall.id)).toBe(true);
    expect(G.productionRate(g.run, hall)).toBeCloseTo(rate + (6 / 60) * 0.6, 6);
    expect(G.devotionCap(g.run)).toBe(1500);
    expect(G.storageCap(hall)).toBe(96);
    expect(G.maxLevel('sermon_hall')).toBe(3);
  });
  it('compound levels unlock crops, the brazier and rituals', () => {
    const g = playSlice();
    expect(g.run.level).toBe(2);
    expect(G.cropUnlocked(g.run, 'graveyard_moss')).toBe(true);
    expect(G.cropUnlocked(g.run, 'moonpetal')).toBe(false);
    expect(G.ritualUnlocked(g.run, 'r5')).toBe(true);
    expect(G.ritualUnlocked(g.run, 'r4')).toBe(false);
    const levels: number[] = [];
    G.addXp(g, G.xpNeeded(2) - g.run.xp, (e) => { if (e.type === 'levelUp') levels.push(e.level); });
    expect(levels).toEqual([3]);
    expect(g.run.reliquary.cells.some((c) => c?.kind === 'gen' && c.gen === 'ritual_brazier')).toBe(true);
    expect(G.unlocksAt(3).map((u) => u.id)).toEqual(expect.arrayContaining(['r4', 'ritual_brazier']));
    expect(G.cropUnlocked(g.run, 'moonpetal')).toBe(false);
    expect(G.ritualUnlocked(g.run, 'r4')).toBe(true);
    expect(G.producible(g, { merge: 'candle', tier: 2, count: 1 })).toBe(true);
    // summoning a second entity hints its recipe and opens its board
    const st = G.startRitual(g, 'r4') as Match3State;
    st.status = 'won'; st.score = st.level.starScores[0];
    expect(G.finishRitual(g).entity).toBe('baba_yaga');
    expect(g.run.met).toContain('baba_yaga');
    expect(G.recipeHinted(g.run, 'calm_draught')).toBe(true);
    expect(G.activeOrders(g.run, 'baba_yaga').length).toBeGreaterThanOrEqual(1);
  });
});

describe('rites, omens, daily rite, inspections (docs/specs/rites.md)', () => {
  /** Win a board with a chosen rite and a scripted tile count. */
  const riteWin = (g: GameState, level: string, rite: { id: string; entity?: string; crop?: string; daily?: boolean }, collected: number[], stars = 2) => {
    const st = G.startRitual(g, level, rite) as Match3State;
    st.status = 'won';
    st.score = st.level.starScores[stars - 1];
    st.collected = collected;
    return G.finishRitual(g);
  };
  const after = () => { const g = playSlice(); g.run.flags.away_done = true; g.run.flags.ascension_viewed = true; G.advanceTutorial(g); return g; };

  it('rites only open after the tutorial; before that a board keeps its fixed purpose', () => {
    const g = G.newGame(1, T0);
    g.run.tutorial = 'ritual1';
    G.startRitual(g, 'r1', { id: 'communion', entity: 'mothman' });
    expect(g.run.activeRite).toBeNull();
    const g2 = after();
    expect(g2.run.tutorial).toBe('done');
    G.startRitual(g2, 'r1', { id: 'harvest', crop: 'basil' });
    expect(g2.run.activeRite).toEqual({ id: 'harvest', crop: 'basil' });
  });
  it('each rite converts its focus tiles exactly as rites.json says', () => {
    const g = after();
    g.run.followers.forEach((f) => (f.stats.doubt = 30));
    let r = riteWin(g, 'r1', { id: 'sermon' }, [0, 0, 17, 0, 0, 0]);
    expect(r.rite).toMatchObject({ id: 'sermon', tiles: 17, amount: 2 });
    expect(g.run.followers.every((f) => f.stats.doubt === 28)).toBe(true);
    const fav = g.run.favor.mothman;
    r = riteWin(g, 'r1', { id: 'communion', entity: 'mothman' }, [0, 30, 0, 0, 0, 0]);
    expect(r.rite!.amount).toBe(12);
    expect(g.run.favor.mothman).toBe(fav + 12);
    const moss = G.inv(g.run, 'graveyard_moss');
    r = riteWin(g, 'r1', { id: 'harvest', crop: 'graveyard_moss' }, [0, 0, 0, 0, 20, 0]);
    expect(r.rite!.amount).toBe(6);
    expect(G.inv(g.run, 'graveyard_moss')).toBe(moss + 6);
    g.run.followers.pop();
    r = riteWin(g, 'r1', { id: 'recruit' }, [0, 0, 0, 16, 0, 0]);
    expect(r.rite!.amount).toBe(4);
    expect(g.run.draft).toHaveLength(4); // 15+ Runes: a 4-card draft
  });
  it('recruitment is blocked with a reason when beds are full, and vigil needs the brazier', () => {
    const g = after();
    expect(g.run.followers).toHaveLength(3);
    expect(G.riteBlocked(g, 'recruit')).toBeNull(); // 3 of 4 beds
    g.run.followers.push({ ...g.run.followers[0], id: 777 });
    expect(G.riteBlocked(g, 'recruit')).toBe('rite.recruit.full');
    expect(G.riteBlocked(g, 'vigil')).toBe('rite.locked'); // brazier arrives at Lv3
    expect(G.riteBlocked(g, 'look_busy')).toBe('rite.look_busy.none');
    // a blocked rite falls back to a sermon rather than starting
    G.startRitual(g, 'r1', { id: 'recruit' });
    expect(g.run.activeRite).toEqual({ id: 'sermon' });
  });
  it('omens come only from rituals: 1 per star, +2 for a first 3-star, relaxed earns 1', () => {
    const g = after();
    const before = g.run.omens;
    const r = riteWin(g, 'r5', { id: 'sermon' }, [0, 0, 0, 0, 0, 0], 3);
    expect(r.omens).toBe(3);
    expect(r.firstThree).toBe(2);
    expect(g.run.omens).toBe(before + 5);
    const again = riteWin(g, 'r5', { id: 'sermon' }, [0, 0, 0, 0, 0, 0], 3);
    expect(again.firstThree).toBe(0);
    g.meta.settings.relaxedPuzzles = true;
    expect(riteWin(g, 'r5', { id: 'sermon' }, [0, 0, 0, 0, 0, 0], 1).omens).toBe(1);
    const src = readFileSync('src/core/game.ts', 'utf8');
    expect(src.match(/run\.omens \+=/g)?.length).toBe(1); // the only source is finishRitual
  });
  it('omens buy the last upgrade step, audiences and order rerolls', () => {
    const g = after();
    const dorm = g.run.buildings.find((b) => b.type === 'dormitory')!;
    dorm.level = 2;
    g.run.devotion = 2000; g.run.donations = 500;
    g.run.reliquary.cells[0] = { id: 990, kind: 'item', chain: 'candle', tier: 3 };
    g.run.omens = 3;
    expect(G.canUpgrade(g.run, dorm)).toBe(false);
    g.run.omens = 4;
    expect(G.upgradeBuilding(g, dorm.id)).toBe(true);
    expect(g.run.omens).toBe(0);
    g.run.favor.mothman = 200; g.run.omens = 10;
    expect(G.grantAudience(g, 'mothman')).toBe(true);
    expect(G.boon(g.run, 'favorPerOrder')).toBe(5);
    g.run.omens = 1;
    G.tick(g, 25);
    const open = G.activeOrders(g.run, 'mothman')[0];
    expect(G.rerollOrder(g, open.id)).toBe(true);
    expect(g.run.omens).toBe(0);
    expect(g.run.orders.some((o) => o.id === open.id)).toBe(false);
  });
  it('the daily rite banks up to 3 days and pays them on its first win', () => {
    const g = after();
    G.updateDaily(g.run, '2026-11-10');
    expect(g.run.daily.bank).toBe(1);
    G.updateDaily(g.run, '2026-11-20');
    expect(g.run.daily.bank).toBe(3);
    G.updateDaily(g.run, '2026-11-01'); // clock moved back: nothing added
    expect(g.run.daily.bank).toBe(3);
    const lv = G.dailyLevel(g.run, '2026-11-20')!;
    expect(DATA.rituals.find((l) => l.id === lv)!.purpose).not.toBe('summon');
    expect(riteWin(g, lv, { id: 'sermon', daily: true }, [0, 0, 0, 0, 0, 0]).daily).toBe(9);
    expect(g.run.daily.bank).toBe(0);
    expect(riteWin(g, lv, { id: 'sermon', daily: true }, [0, 0, 0, 0, 0, 0]).daily).toBe(0);
  });
  it('visits happen only after the tutorial, while idle, by Suspicion band, and always lower Suspicion', () => {
    const g = after();
    g.run.flags.cat_adopted = true; // keep the cat out of this test
    g.run.suspicion = 60;
    G.startRitual(g, 'r1', { id: 'sermon' });
    G.tick(g, 600);
    expect(g.run.event).toBeNull(); // never during a ritual
    G.finishRitual(g);
    for (let i = 0; i < 120 && !g.run.event; i++) G.tick(g, 60);
    const ev = DATA.events.find((e) => e.id === g.run.event!.id)!;
    expect(ev.visitor).toBe(true);
    expect(ev.band).toBe(G.suspicionBand(g.run.suspicion));
    const settle = ev.choices.findIndex((c) => c.id === 'settle' || c.id === 'interview');
    const s0 = g.run.suspicion;
    expect(G.resolveEvent(g, settle)).toBe(true);
    expect(g.run.suspicion).toBeLessThan(s0);
  });
  it('Look Busy: the visitor waits, 3 stars cut the outcome by 75%, a loss applies the normal outcome', () => {
    const run = (stars: number, won: boolean) => {
      const g = after();
      g.run.donations = 400;
      g.run.suspicion = 60;
      g.run.event = { id: 'auditor' };
      G.resolveEvent(g, DATA.events.find((e) => e.id === 'auditor')!.choices.findIndex((c) => c.id === 'look_busy'));
      expect(g.run.inspection).toMatchObject({ event: 'auditor', level: 'lb1' });
      expect(g.run.donations).toBe(400); // nothing applied yet
      expect(G.ritualUnlocked(g.run, 'lb1')).toBe(true);
      const st = G.startRitual(g, 'lb1') as Match3State;
      st.status = won ? 'won' : 'lost';
      st.score = st.level.starScores[Math.max(1, stars) - 1];
      const r = G.finishRitual(g);
      expect(g.run.inspection).toBeNull();
      return { fine: r.rite!.visit!.fine, susp: g.run.suspicion };
    };
    expect(run(0, false).fine).toBe(60);
    expect(run(3, true).fine).toBe(15);
    expect(run(3, true).susp).toBeLessThan(run(0, false).susp);
  });
  it('a sealed building stops producing and cannot be used; an away follower does not work', () => {
    const g = after();
    const hall = g.run.buildings.find((b) => b.type === 'sermon_hall')!;
    const rate = G.productionRate(g.run, hall);
    hall.sealedUntil = g.run.time + 60;
    expect(G.productionRate(g.run, hall)).toBe(0);
    hall.stored = 20;
    expect(G.collect(g, hall.id)).toBe(0);
    G.tick(g, 61);
    expect(G.productionRate(g.run, hall)).toBeCloseTo(rate, 6);
    const f = g.run.followers[0];
    f.job = hall.id;
    const withF = G.productionRate(g.run, hall);
    f.awayUntil = g.run.time + 100;
    expect(G.productionRate(g.run, hall)).toBeLessThan(withF);
  });
  it('visit text follows the guardrails: no timers, no banned words', () => {
    for (const e of DATA.events.filter((x) => x.visitor)) expect(JSON.stringify(e)).not.toMatch(/timer|countdown/i);
    const banned = /\b(siege|standoff|barricade|breach|enemy|raid|swat|arrest|weapon|gun)\b/i;
    const keys = Object.keys(DATA.text).filter((k) => /^(event\.(neighbour|auditor|expose|inspector|full_review)|inspection\.|rite\.look_busy|ritual\.lb)/.test(k));
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((k) => banned.test(DATA.text[k]))).toEqual([]);
    expect(Object.values(DATA.text).filter((v) => /\bOMC\b/.test(v))).toEqual([]);
  });
});

describe('the Sanctum (docs/specs/sanctum-view.md)', () => {
  const ready = () => { const g = playSlice(); g.run.level = 4; g.run.devotion = 4000; g.run.donations = 500; g.run.omens = 20; return g; };
  it('opens at compound level 3; storeys cost what rooms.json says and take time', () => {
    const g = playSlice();
    g.run.level = 2;
    expect(S.sanctumUnlocked(g.run)).toBe(false);
    g.run.level = 4; g.run.devotion = 1000; g.run.donations = 200; g.run.omens = 2;
    expect(S.buildStorey(g)).toBe(true); // storey 1 is free and instant
    expect(g.run.sanctum.storeys).toBe(1);
    expect(S.buildStorey(g)).toBe(true); // storey 2: 250 / 60 / 2 Omens, 30 s
    expect(g.run.devotion).toBe(750);
    expect(g.run.omens).toBe(0);
    expect(g.run.sanctum.storeys).toBe(1);
    expect(S.canBuildStorey(g.run)).toBe(false); // one at a time
    G.tick(g, 31);
    expect(g.run.sanctum.storeys).toBe(2);
    expect(S.canBuildStorey(g.run)).toBe(false); // storey 3 needs Lv5
  });
  it('identical neighbours of the same level merge, with a bonus; different levels do not', () => {
    const g = ready();
    S.buildStorey(g);
    const a = S.buildRoom(g, 1, 0, 'kitchen')!;
    const b = S.buildRoom(g, 1, 1, 'kitchen')!;
    const grp = S.groupOf(g.run, a.id)!;
    expect(grp.bays.map((x) => x.id)).toEqual([a.id, b.id]);
    expect(S.mergePct(grp)).toBe(10);
    expect(S.slotsOf(grp)).toBe(4);
    g.run.reliquary.cells[0] = { id: 991, kind: 'item', chain: 'paper', tier: 2 };
    const before = g.run.devotion;
    expect(S.upgradeRoom(g, a.id)).toBe(true); // the whole merged room upgrades, cost x2
    expect(before - g.run.devotion).toBe(500);
    S.buildRoom(g, 1, 2, 'kitchen');
    expect(S.roomGroups(g.run).filter((x) => x.storey === 1).map((x) => x.bays.length)).toEqual([2, 1]); // level 2 + level 1
    expect(S.canBuildRoom(g.run, 1, 0, 'kitchen')).toBe(false); // occupied
    expect(S.canBuildRoom(g.run, 2, 0, 'kitchen')).toBe(false); // storey not built
    expect(S.roomUnlocked(g.run, 'wellness_retreat')).toBe(false);
  });
  it('workers follow the key stat; slots are enforced; demolish refunds half and frees workers', () => {
    const g = ready();
    S.buildStorey(g);
    const r = S.buildRoom(g, 1, 0, 'records_office')!;
    const grp = () => S.groupOf(g.run, r.id)!;
    const [f1, f2, f3] = g.run.followers;
    expect(S.roomWork({ ...f1, stats: { ...f1.stats, doubt: 100, sanity: 50 } }, 'doubt')).toBeCloseTo(0.75, 6);
    expect(S.assignFollower(g, f1.id, r.id)).toBe(true);
    expect(S.assignFollower(g, f2.id, r.id)).toBe(true);
    expect(S.assignFollower(g, f3.id, r.id)).toBe(false); // 2 slots
    expect(S.groupMult(g.run, grp())).toBeGreaterThan(1);
    g.run.devotion = 100; // stay under the storage cap so the refund is visible
    const dev = g.run.devotion;
    expect(S.demolishRoom(g, r.id)).toBe(true);
    expect(g.run.devotion - dev).toBe(60);
    expect(g.run.followers.find((f) => f.id === f1.id)!.job).toBe(g.run.buildings.find((b) => b.type === 'sermon_hall')!.id);
  });
  it('rooms do their jobs: beds, Sanity for Basil, forms that soften visits, Doubt, rite bonus, Donations and heat', () => {
    const g = ready();
    g.run.level = 8;
    for (let i = 0; i < 4; i++) { S.buildStorey(g); G.tick(g, 61); }
    expect(g.run.sanctum.storeys).toBe(4);
    const beds = G.housing(g.run);
    S.buildRoom(g, 1, 0, 'bunk_room');
    expect(G.housing(g.run)).toBe(beds + 3);
    S.buildRoom(g, 1, 1, 'kitchen');
    g.run.followers.forEach((f) => (f.stats.sanity = 40));
    g.run.inventory.basil = 5;
    G.tick(g, 120);
    expect(g.run.followers[0].stats.sanity).toBeGreaterThan(40);
    expect(g.run.inventory.basil).toBeLessThan(5);
    S.buildRoom(g, 2, 0, 'records_office');
    G.tick(g, 600);
    expect(G.inv(g.run, 'filed_form')).toBe(2); // capped at 2 per bay
    g.run.donations = 400; g.run.suspicion = 60;
    g.run.event = { id: 'expose' }; // a reporter is not a walkthrough: forms cut her outcome by 25% each
    const before = g.run.followers.filter((f) => (f.awayUntil ?? 0) > g.run.time).length;
    G.resolveEvent(g, DATA.events.find((e) => e.id === 'expose')!.choices.findIndex((c) => c.id === 'interview'));
    expect(G.inv(g.run, 'filed_form')).toBe(0);
    expect(g.run.followers.filter((f) => (f.awayUntil ?? 0) > g.run.time).length).toBe(before + 1);
    const ch = S.buildRoom(g, 2, 1, 'ritual_chamber')!;
    expect(S.ritePctBonus(g.run)).toBe(5);
    void ch;
    const susp = g.run.suspicion;
    S.buildRoom(g, 3, 0, 'wellness_retreat');
    const don = g.run.donations;
    G.tick(g, 60);
    expect(g.run.donations).toBeGreaterThan(don);
    expect(S.sanctumHeat(g.run)).toBeCloseTo(0.05 + 0.4, 6); // one storey above 3, one retreat bay
    expect(g.run.suspicion).toBeGreaterThan(susp - 1);
  });
  it('a visit can seal a Sanctum room (never a Bunk Room), which then stops working', () => {
    const g = ready();
    S.buildStorey(g);
    const k = S.buildRoom(g, 1, 0, 'kitchen')!;
    S.buildRoom(g, 1, 1, 'bunk_room');
    g.run.buildings = g.run.buildings.filter((b) => b.type === 'dormitory'); // only the kitchen can be sealed
    G.applyVisit(g, { sealSec: 300 }, 0);
    expect(S.groupSealed(g.run, S.groupOf(g.run, k.id)!)).toBe(true);
    expect(S.groupMult(g.run, S.groupOf(g.run, k.id)!)).toBe(0);
  });
  it('nobody keeps reading in a sealed Reading Room', () => {
    const g = ready();
    g.run.level = 5;
    S.buildStorey(g);
    const rr = S.buildRoom(g, 1, 0, 'reading_room')!;
    const f = g.run.followers[0];
    f.stats.doubt = 50;
    S.assignFollower(g, f.id, rr.id);
    rr.sealedUntil = g.run.time + 600;
    G.tick(g, 120);
    expect(f.stats.doubt).toBe(50);
    G.tick(g, 600);
    expect(f.stats.doubt).toBeLessThan(50);
  });
  it('walkthrough: the agenda starts in the Hall, picks the most exposed rooms, and findings follow staffing', () => {
    const g = ready();
    g.run.level = 8;
    for (let i = 0; i < 3; i++) { S.buildStorey(g); G.tick(g, 61); }
    const retreat = S.buildRoom(g, 1, 0, 'wellness_retreat')!;
    const records = S.buildRoom(g, 2, 0, 'records_office')!;
    S.buildRoom(g, 3, 0, 'kitchen');
    const ag = I.agenda(g.run, 'auditor'); // tax, 3 places
    expect(ag.map((x) => x.type)).toEqual(['main_hall', 'wellness_retreat', 'records_office']);
    const r = ag[1];
    expect(r.reasons).toEqual(expect.arrayContaining([{ key: 'tax', n: 2 }, { key: 'empty', n: 1 }]));
    // staffing the empty room with calm workers removes 'empty' and earns 'calm'
    g.run.followers.forEach((f) => (f.stats.doubt = 10));
    S.assignFollower(g, g.run.followers[0].id, retreat.id);
    S.assignFollower(g, g.run.followers[1].id, retreat.id);
    const r2 = I.agenda(g.run, 'auditor')[1];
    expect(r2.reasons.map((x) => x.key)).toEqual(expect.arrayContaining(['tax', 'calm']));
    expect(r2.findings).toBe(1);
    // a doubtful worker is 'very helpful'
    g.run.followers[0].stats.doubt = 80;
    expect(I.agenda(g.run, 'auditor')[1].reasons.map((x) => x.key)).toContain('doubt');
    void records;
  });
  it('walkthrough: fines per finding (capped at 25%), forms cancel findings, seals the worst room, always lowers Suspicion', () => {
    const g = ready();
    g.run.level = 8;
    for (let i = 0; i < 3; i++) { S.buildStorey(g); G.tick(g, 61); }
    S.buildRoom(g, 1, 0, 'kitchen'); S.buildRoom(g, 1, 1, 'reading_room'); S.buildRoom(g, 2, 0, 'ritual_chamber'); S.buildRoom(g, 2, 1, 'bunk_room');
    g.run.followers.forEach((f) => (f.job = null));
    g.run.donations = 400; g.run.suspicion = 80; g.run.flags.cat_adopted = true;
    const projected = I.projectedFindings(g.run, 'inspector');
    expect(projected).toBeGreaterThanOrEqual(4);
    g.run.inventory.filed_form = 1;
    g.run.event = { id: 'inspector' };
    G.resolveEvent(g, DATA.events.find((e) => e.id === 'inspector')!.choices.findIndex((c) => c.id === 'settle'));
    const w = g.run.walk!;
    expect(w.forms).toBe(1);
    expect(w.total).toBe(projected - 1);
    expect(w.fine).toBe(Math.min(8 * w.total, 100));
    expect(w.sealed).not.toBeNull();
    expect(w.sealed).not.toBe('bunk_room');
    expect(w.suspicion).toBeLessThan(0);
    expect(g.run.inspection).toBeNull();
    I.clearWalk(g);
    expect(g.run.walk).toBeNull();
  });
  it('walkthrough with Look Busy: the visitor waits; 3 stars cut the fine and seal by 75%', () => {
    const play = (won: boolean) => {
      const g = ready();
      g.run.level = 8;
      S.buildStorey(g);
      S.buildRoom(g, 1, 0, 'wellness_retreat'); S.buildRoom(g, 1, 1, 'kitchen');
      g.run.followers.forEach((f) => (f.job = null));
      g.run.donations = 400; g.run.suspicion = 60;
      g.run.event = { id: 'auditor' };
      G.resolveEvent(g, DATA.events.find((e) => e.id === 'auditor')!.choices.findIndex((c) => c.id === 'look_busy'));
      expect(g.run.walk).toBeNull();
      const st = G.startRitual(g, 'lb1') as Match3State;
      st.status = won ? 'won' : 'lost';
      st.score = st.level.starScores[2];
      G.finishRitual(g);
      return g.run.walk!;
    };
    const lost = play(false);
    const won = play(true);
    expect(won.cutPct).toBe(75);
    expect(won.fine).toBe(Math.floor(lost.fine * 0.25));
    expect(won.suspicion).toBeLessThan(lost.suspicion);
  });
  it('without any Sanctum rooms a visit uses the simple outcome (no walkthrough)', () => {
    const g = ready();
    g.run.donations = 400; g.run.suspicion = 60;
    g.run.event = { id: 'auditor' };
    G.resolveEvent(g, DATA.events.find((e) => e.id === 'auditor')!.choices.findIndex((c) => c.id === 'settle'));
    expect(g.run.walk).toBeNull();
    expect(g.run.donations).toBe(340);
  });
  it('migrates a v4 save to an empty Sanctum without moving anything', () => {
    const g = playSlice();
    const env = JSON.parse(serialize(g, T0));
    env.saveVersion = 4; env.data.saveVersion = 4;
    delete env.data.run.sanctum;
    delete env.data.run.walk;
    const out = parse(JSON.stringify(env));
    expect(out.run.walk).toBeNull();
    expect(out.run.sanctum).toEqual({ storeys: 0, building: null, rooms: [] });
    expect(out.run.buildings).toEqual(g.run.buildings);
  });
});

describe('big flocks', () => {
  it('a draft can always be drawn, even when nearly every name is taken (used to loop forever)', () => {
    const g = G.newGame(1, T0);
    for (const [i, name] of DATA.followers.names.slice(0, DATA.followers.names.length - 1).entries()) {
      g.run.followers.push({ id: 1000 + i, name, traits: ['gullible'], stats: { devotion: 50, sanity: 50, productivity: 50, doubt: 10 }, skin: 0, robe: 0, job: null });
    }
    g.run.buildings.push({ id: 999, type: 'dormitory', x: 0, y: 0, level: 3, stored: 0 });
    g.run.sanctum.storeys = 1;
    g.run.sanctum.rooms.push({ id: 998, type: 'bunk_room', storey: 1, bay: 0, level: 3, progress: 0 }, { id: 997, type: 'bunk_room', storey: 1, bay: 1, level: 3, progress: 0 }, { id: 996, type: 'bunk_room', storey: 1, bay: 2, level: 3, progress: 0 });
    expect(G.housing(g.run)).toBeGreaterThan(g.run.followers.length);
    g.run.pendingDrafts = 1;
    g.run.draftBonus = 1;
    G.ensureDraft(g);
    expect(g.run.draft).toHaveLength(4);
  });
});

describe('save', () => {
  it('round-trips, keeps a backup and survives corruption', () => {
    const kv = memoryKV();
    const g = playSlice();
    expect(saveGame(kv, g, T0 + 1000)).toBe(true);
    g.run.devotion = 1;
    saveGame(kv, g, T0 + 2000);
    expect(loadGame(kv).state!.run.devotion).toBe(1);
    kv.set(KEYS.current, '{broken');
    const res = loadGame(kv);
    expect(res.source).toBe('backup');
    expect(res.recovered).toBe(true);
    expect(res.state!.run.followers).toHaveLength(3);
    kv.set(KEYS.backup, 'nope');
    expect(loadGame(kv).state).toBeNull();
  });
  it('runs migrations in order and refuses newer saves', () => {
    const g = G.newGame(1, T0);
    const old = JSON.parse(serialize(g, T0));
    old.saveVersion = 1;
    const migrations = {
      1: (d: any) => ({ ...d, run: { ...d.run, mana: 5 } }),
      2: (d: any) => ({ ...d, run: { ...d.run, mana: d.run.mana * 2 } }),
    };
    const out = parse(JSON.stringify(old), migrations, 3) as any;
    expect(out.run.mana).toBe(10);
    expect(out.saveVersion).toBe(3);
    expect(() => parse(JSON.stringify({ ...old, saveVersion: 9 }))).toThrow();
    expect(() => parse(JSON.stringify(old), {}, 3)).toThrow();
  });
  it('migrates a real v1 save to the current version (sound setting added in v2)', () => {
    const g = G.newGame(1, T0);
    const env = JSON.parse(serialize(g, T0));
    env.saveVersion = 1;
    env.data.saveVersion = 1;
    delete env.data.meta.settings.sound;
    const out = parse(JSON.stringify(env));
    expect(out.saveVersion).toBe(G.SAVE_VERSION);
    expect(out.meta.settings.sound).toBe(true);
    expect(out.meta.settings.reducedMotion).toBe(false);
  });
  it('migrates a v2 save: filled orders become counts, met entities and hints appear', () => {
    const g = playSlice();
    const env = JSON.parse(serialize(g, T0));
    env.saveVersion = 2;
    env.data.saveVersion = 2;
    env.data.run.orders = [{ id: 'mothman_1', filled: true }, { id: 'mothman_2', filled: false }];
    for (const k of ['ordersFilled', 'orderNextAt', 'lastOrder', 'met', 'hints']) delete env.data.run[k];
    const out = parse(JSON.stringify(env));
    expect(out.saveVersion).toBe(G.SAVE_VERSION);
    expect(out.run.orders).toEqual([{ id: 'mothman_2' }]);
    expect(out.run.ordersFilled).toEqual({ mothman_1: 1 });
    expect(out.run.met).toEqual(['mothman']);
    expect(out.run.hints).toEqual([]);
  });
  it('migrates a v3 save: rites, omens, daily and inspection state appear', () => {
    const g = playSlice();
    const env = JSON.parse(serialize(g, T0));
    env.saveVersion = 3; env.data.saveVersion = 3;
    for (const k of ['omens', 'audiences', 'activeRite', 'inspection', 'daily', 'visitClock', 'lastVisitAt', 'draftBonus']) delete env.data.run[k];
    const out = parse(JSON.stringify(env));
    expect(out.saveVersion).toBe(G.SAVE_VERSION);
    expect(out.run).toMatchObject({ omens: 0, audiences: [], activeRite: null, inspection: null, daily: { day: '', bank: 0 }, draftBonus: 0 });
  });
  it('export/import code validates its checksum', () => {
    const g = playSlice();
    const code = exportCode(g, T0);
    expect(importCode(code).run.followers).toEqual(g.run.followers);
    expect(() => importCode(code.slice(0, -4) + 'AAAA')).toThrow();
    expect(() => importCode('hello')).toThrow();
  });
});

describe('offline progress', () => {
  const base = () => { const g = playSlice(); g.lastSeenWall = T0; g.highWater = T0; return g; };
  it('caps at 8 hours', () => {
    const g = base();
    const s = applyOffline(g, T0 + 20 * 3600 * 1000);
    expect(s.appliedSec).toBe(DATA.balance.offline.capSec);
    expect(s.capped).toBe(true);
    expect(s.show).toBe(true);
    expect(g.run.flags.away_done).toBe(true);
  });
  it('produces at the offline rate and never exceeds storage', () => {
    const g = base();
    const hall = g.run.buildings.find((b) => b.type === 'sermon_hall')!;
    hall.stored = 0;
    const s = applyOffline(g, T0 + 120 * 1000);
    const expected = G.productionRate(g.run, hall) * 120 * DATA.balance.offline.productionMult;
    expect(hall.stored).toBeCloseTo(expected, 5);
    expect(s.devotion).toBe(Math.floor(expected));
    applyOffline(g, T0 + 9 * 3600 * 1000);
    expect(hall.stored).toBeLessThanOrEqual(G.storageCap(hall));
  });
  it('ignores a clock that moved backwards, and a later forward jump cannot double-dip', () => {
    const g = base();
    const hall = g.run.buildings.find((b) => b.type === 'sermon_hall')!;
    hall.stored = 0;
    const s = applyOffline(g, T0 - 5 * 3600 * 1000);
    expect(s.rollback).toBe(true);
    expect(s.appliedSec).toBe(0);
    expect(hall.stored).toBe(0);
    expect(g.highWater).toBe(T0); // the high-water mark does not move back
    const s2 = applyOffline(g, T0 + 60 * 1000);
    expect(s2.appliedSec).toBe(60);
  });
  it('treats absurd gaps as the cap', () => {
    const g = base();
    const s = applyOffline(g, T0 + 400 * 86400 * 1000);
    expect(s.insane).toBe(true);
    expect(s.appliedSec).toBe(DATA.balance.offline.capSec);
  });
  it('store boot applies offline time from a saved game', () => {
    const kv = memoryKV();
    let now = T0;
    const a = new Store(kv, () => now);
    a.boot(5);
    a.act((g) => { g.run.flags.welcomed = true; });
    a.act((g, e) => G.placeBuilding(g, 'sermon_hall', 8, 10, e));
    a.save();
    now += 30 * 60 * 1000;
    const b = new Store(kv, () => now);
    b.boot();
    expect(b.offline?.appliedSec).toBe(1800);
    expect(b.state.run.buildings).toHaveLength(2);
  });
});

describe('merge engine', () => {
  it('spawns, merges two-into-one, recharges and never exceeds the top tier', () => {
    const s = createMerge(DATA.merge, 9);
    const gen = s.cells.findIndex((c) => c?.kind === 'gen');
    const a = tapGenerator(s, DATA.merge, gen);
    const b = tapGenerator(s, DATA.merge, gen);
    expect(a).not.toBe(b);
    expect(moveItem(s, DATA.merge, { area: 'grid', i: a }, { area: 'grid', i: b })).toMatchObject({ kind: 'merge', tier: 2 });
    expect(countItems(s, 'paper', 2)).toBe(1);
    for (let i = 0; i < 10; i++) tapGenerator(s, DATA.merge, gen);
    expect((s.cells[gen] as any).charges).toBe(0);
    expect(tapGenerator(s, DATA.merge, gen)).toBe(-1);
    tickMerge(s, DATA.merge, 8);
    expect((s.cells[gen] as any).charges).toBe(1);
    tickMerge(s, DATA.merge, 1000);
    expect((s.cells[gen] as any).charges).toBe(6);
    // generators cannot be shelved; items can
    expect(moveItem(s, DATA.merge, { area: 'grid', i: gen }, { area: 'shelf', i: 0 }).kind).toBe('none');
    expect(moveItem(s, DATA.merge, { area: 'grid', i: b }, { area: 'shelf', i: 0 }).kind).toBe('move');
    // two top-tier items swap instead of merging
    s.cells[0] = { id: 900, kind: 'item', chain: 'paper', tier: 5 };
    s.cells[1] = { id: 901, kind: 'item', chain: 'paper', tier: 5 };
    expect(moveItem(s, DATA.merge, { area: 'grid', i: 0 }, { area: 'grid', i: 1 }).kind).toBe('swap');
  });
});

describe('layout', () => {
  const cases: [string, number, number, number][] = [
    ['phone portrait', 1170, 2532, 3], ['phone landscape', 2532, 1170, 3], ['small android', 720, 1280, 2],
    ['desktop', 1280, 720, 1], ['big desktop', 2560, 1440, 1], ['tablet', 1536, 2048, 2], ['minimum landscape', 320, 180, 1],
  ];
  it.each(cases)('%s: integer scale, minimum logical size, regions inside the canvas', (_n, w, h, dpr) => {
    const L = layoutFor(w, h, dpr);
    expect(Number.isInteger(L.scale)).toBe(true);
    expect(L.w * L.scale).toBeLessThanOrEqual(w);
    expect(L.h * L.scale).toBeLessThanOrEqual(h);
    expect(L.w).toBeGreaterThanOrEqual(L.landscape ? 320 : 180);
    expect(L.h).toBeGreaterThanOrEqual(L.landscape ? 180 : 320);
    expect(L.body.w).toBeGreaterThanOrEqual(160);
    expect(L.body.y + L.body.h).toBeLessThanOrEqual(L.h);
    if (L.landscape) expect(L.dock && L.rail).toBeTruthy(); else expect(L.top && L.tabs).toBeTruthy();
    // the ritual board (160) and merge grid (168) fit without scaling
    const fullH = L.landscape ? L.h : L.body.h;
    expect(fullH).toBeGreaterThanOrEqual(168);
  });
  it('landscape shows more, not bigger', () => {
    const p = layoutFor(1170, 2532, 3);
    const l = layoutFor(2532, 1170, 3);
    expect(l.scale).toBe(p.scale);
    expect(l.w).toBeGreaterThan(p.w);
  });
  it('respects safe-area insets', () => {
    const L = layoutFor(1170, 2532, 3, { l: 0, t: 47, r: 0, b: 34 });
    expect(L.top!.y).toBe(L.safe.t);
    expect(L.safe.t).toBe(Math.ceil((47 * 3) / L.scale));
    expect(L.tabs!.y + L.tabs!.h).toBe(L.h - L.safe.b);
  });
});

describe('content integrity', () => {
  it('every text key used by data and code exists, and text is plain ASCII for the pixel font', () => {
    const need = new Set<string>();
    for (const b of DATA.buildings) need.add(`building.${b.id}.name`).add(`building.${b.id}.desc`);
    for (const i of DATA.items) need.add(`item.${i.id}.name`).add(`item.${i.id}.desc`);
    for (const tr of DATA.followers.traits) need.add(`trait.${tr.id}.name`).add(`trait.${tr.id}.desc`);
    for (const c of DATA.merge.chains) for (const k of c.tiers) need.add(`merge.${k}.name`);
    for (const o of DATA.orders) need.add(`order.${o.id}.text`).add(`order.${o.id}.thanks`);
    for (const e of DATA.entities) for (const b of e.boons) need.add(`boon.${b.field}`);
    for (const gen of DATA.merge.generators) need.add(`gen.${gen.id}.name`);
    for (const c of DATA.merge.chains) need.add(`merge.chain.${c.id}`);
    for (const b of DATA.buildings) need.add(`building.effect.${b.id}`);
    for (const e of DATA.entities) need.add(`entity.${e.id}.name`).add(`entity.${e.id}.intro`).add(`entity.${e.id}.intro.ok`).add(`entity.${e.id}.blurb`);
    for (const ev of DATA.events) {
      need.add(`event.${ev.id}.title`).add(`event.${ev.id}.body`);
      for (const ch of ev.choices) need.add(`event.${ev.id}.choice.${ch.id}`).add(`event.${ev.id}.result.${ch.id}`);
    }
    for (const r of DATA.rituals) need.add(r.nameKey).add(`ritual.purpose.${r.purpose}`);
    for (const s of ['welcome', 'build_hall', 'collect', 'ritual1', 'draft1', 'ritual2', 'draft2', 'build_greenhouse', 'plant', 'merge', 'harvest', 'build_lab', 'brew', 'reporter', 'ritual3', 'orders', 'away', 'ascension', 'done']) need.add(`tip.${s}`);
    for (const tab of ['compound', 'rituals', 'reliquary', 'alchemy', 'orders']) need.add(`tab.${tab}`);
    // literal keys in source
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
    for (const file of walk('src')) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\bt\('([a-z0-9_.]+)'/gi)) need.add(m[1]);
      for (const m of src.matchAll(/textKey: '([a-z0-9_.]+)'/gi)) need.add(m[1]);
    }
    const missing = [...need].filter((k) => !hasText(k));
    expect(missing).toEqual([]);
    const nonAscii = Object.entries(DATA.text).filter(([, v]) => /[^\x20-\x7e\n]/.test(v)).map(([k]) => k);
    expect(nonAscii).toEqual([]);
  });
  it('every sprite that data refers to exists in the atlas', () => {
    const have = new Set(spriteKeys());
    const need: string[] = [];
    for (const b of DATA.buildings) need.push(`b_${b.id}`);
    for (const i of DATA.items) need.push(`i_${i.id}`);
    for (const c of DATA.merge.chains) for (const k of c.tiers) need.push(`m_${k}`);
    for (const g of DATA.merge.generators) need.push(`g_${g.id}`);
    for (const e of DATA.events) need.push(e.sprite);
    for (const e of DATA.entities) need.push(e.id);
    need.push('unknown_entity', 'ic_up');
    for (let i = 0; i < 6; i++) need.push(`tile_${i}`, `p_${i}`);
    for (let s = 0; s < DATA.followers.skins; s++) for (let r = 0; r < DATA.followers.robes; r++) need.push(`fol_${s}_${r}_0`, `fol_${s}_${r}_1`);
    for (const tab of ['compound', 'rituals', 'reliquary', 'alchemy', 'orders']) need.push(`tab_${tab}`);
    expect(need.filter((k) => !have.has(k))).toEqual([]);
    expect(new Set(spriteKeys()).size).toBe(spriteKeys().length); // no duplicate keys
  });
  it('no player-facing string literals hide in UI code', () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]));
    const offenders: string[] = [];
    for (const file of [...walk('src/screens'), 'src/app.ts']) {
      const src = readFileSync(file, 'utf8');
      // txt(...)/button(...) called with a quoted literal containing two or more words
      for (const m of src.matchAll(/\b(?:txt|button)\([^\n]*?,\s*'([A-Za-z][A-Za-z ]+ [A-Za-z ]+)'/g)) offenders.push(`${file}: ${m[1]}`);
    }
    expect(offenders).toEqual([]);
  });
  it('content guardrails: banned motifs never appear in game text', () => {
    const banned = [/kool-?aid/i, /bridge/i, /point pleasant/i, /jonestown/i, /heaven'?s gate/i, /sarin/i, /suicide/i, /poison/i, /wendigo/i];
    const hits = Object.entries(DATA.text).filter(([, v]) => banned.some((re) => re.test(v))).map(([k]) => k);
    expect(hits).toEqual([]);
  });
  it('orders only ask for things the slice can produce, and entities are reviewed', () => {
    const items = new Set(DATA.items.map((i) => i.id));
    for (const o of DATA.orders) for (const n of o.needs) {
      if ('item' in n) expect(items.has(n.item)).toBe(true);
      else expect(DATA.merge.chains.find((c) => c.id === n.merge)!.tiers.length).toBeGreaterThanOrEqual(n.tier);
    }
    for (const e of DATA.entities) {
      expect(e.reviewStatus).toBe('approved');
      expect(e.sources.length).toBeGreaterThan(0);
    }
  });
});
