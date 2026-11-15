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
