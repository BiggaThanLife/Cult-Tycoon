// State-driven and menu modals: welcome, welcome-back, draft, events, roster, menu, settings, debug, ascension.
import type { App } from '../app';
import { PAL } from '../art/palette';
import { DATA, buildingDef, entityDef, eventDef, mergeItemKey, ritualDef } from '../core/data';
import { addResource, addSuspicion, addXp, canUpgrade, isAway, isSealed, sealLeft, choiceAvailable, collect, debugSkip, draftPick, followerRitualPct, followerWork, housing, levelBonus, maxLevel, nextUpgrade, recipeHinted, resolveEvent, sanityWorkPart, triggerEvent, unlocksAt, upgradeBuilding, xpNeeded } from '../core/game';
import { countItems } from '../puzzle/merge';
import { sanctumUnlocked } from '../core/sanctum';
import type { BuildingState } from '../core/types';
import { exportCode, importCode } from '../core/save';
import { t } from '../core/text';
import type { Follower } from '../core/types';
import { bar, button, hit, img, panel, rect, txt, textHeight, type C } from '../ui/kit';
import { dialog, frame, modalWidth } from '../ui/modal';
import { sfx } from '../ui/sfx';

/** Open whichever modal the game state calls for. Because these are derived from state,
 *  they survive rotation and reloads. */
export function autoModals(app: App): void {
  if (app.modals.active) return;
  const st = app.store.state;
  const run = st.run;
  if (run.tutorial === 'welcome') {
    dialog(app, {
      id: 'welcome', title: t('welcome.title'), body: t('welcome.body'), sprite: 'advisor',
      buttons: [{ label: t('welcome.ok'), name: 'btn_ok', onClick: () => app.store.act((g) => { g.run.flags.welcomed = true; }) }],
    });
    return;
  }
  const off = app.store.offline;
  if (off && off.show) {
    openOffline(app);
    return;
  }
  if (run.activeRitual && app.tab === 'rituals') return; // don't interrupt a ritual
  const notice = app.notices.shift();
  if (notice) { openNotice(app, notice); return; }
  if (run.draft) { openDraft(app); return; }
  if (run.event) { openEvent(app); return; }
}

function fmtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? t('time.hm', { h, m }) : t('time.m', { m: Math.max(1, m) });
}

function openOffline(app: App): void {
  const off = app.store.offline!;
  const lines = [t('offline.away', { time: fmtTime(off.appliedSec) })];
  if (off.capped) lines.push(t('offline.capped'));
  if (off.devotion > 0) lines.push(t('offline.devotion', { n: off.devotion }));
  if (off.donations > 0) lines.push(t('offline.donations', { n: off.donations }));
  if (off.cropsReady > 0) lines.push(t('offline.crops', { n: off.cropsReady }));
  if (off.charges > 0) lines.push(t('offline.charges', { n: off.charges }));
  if (off.suspicionDrop > 0) lines.push(t('offline.suspicion', { n: off.suspicionDrop }));
  if (lines.length === 1) lines.push(t('offline.nothing'));
  dialog(app, {
    id: 'offline', title: t('offline.title'), body: lines.join('\n'), sprite: 'advisor',
    buttons: [{ label: t('offline.ok'), name: 'btn_ok', onClick: () => { app.store.offline = null; app.store.act(() => {}); } }],
  });
}

const STAT_COLORS = { devotion: PAL.pink, sanity: PAL.blue, productivity: PAL.yellow, doubt: PAL.robeD } as const;
type StatKey = keyof typeof STAT_COLORS;
const STAT_ORDER: StatKey[] = ['productivity', 'sanity', 'devotion', 'doubt'];

/** Compact follower card. Minimum height 48 in the wide layout so the portrait never covers the stat row. */
function followerCard(app: App, c: C, f: Follower, x: number, y: number, w: number, h: number, opts: { onPick?: () => void; onOpen?: () => void; detail?: boolean } = {}): void {
  panel(app, c, x, y, w, h, PAL.white);
  if (opts.onOpen) hit(app, c, x, y, w, h, opts.onOpen).setName('card_open');
  const narrow = w < 110;
  img(app, c, x + 4, y + 4, `fol_${f.skin}_${f.robe}_0`).setScale(2);
  const st = f.stats;
  if (narrow) {
    // tall card (landscape draft): portrait on top, traits below, stats, button at the bottom
    txt(app, c, x + 40, y + 6, f.name, { width: w - 44, maxLines: 3 });
    let ty = y + 40;
    for (const tr of f.traits) {
      txt(app, c, x + 4, ty, t(`trait.${tr}.name`), { color: 'irony', width: w - 8, maxLines: 1 });
      ty += 9;
      const d = t(`trait.${tr}.desc`);
      const lines = f.traits.length > 1 ? 1 : 2;
      txt(app, c, x + 4, ty, d, { color: 'dim', width: w - 8, maxLines: lines });
      ty += Math.min(lines, textHeight(d, w - 8) / 9) * 9 + 2;
    }
    const sw = Math.floor((w - 8) / 2);
    const sy = y + h - (opts.onPick ? 41 : 21);
    STAT_ORDER.forEach((k, i) => stat(app, c, x + 4 + (i % 2) * sw, sy + Math.floor(i / 2) * 9, sw - 3, k, st[k]));
    if (opts.onPick) button(app, c, x + 3, y + h - 21, w - 6, 18, t('draft.pick'), opts.onPick, { name: 'btn_pick' });
    return;
  }
  const tx = x + 40;
  const tw = w - 44 - (opts.onPick ? 40 : 0);
  txt(app, c, tx, y + 4, f.name, { width: tw, maxLines: 1 });
  let ty = y + 14;
  if (opts.detail !== false) {
    for (const tr of f.traits) {
      txt(app, c, tx, ty, t(`trait.${tr}.name`), { color: 'irony', width: w - 44, maxLines: 1 });
      ty += 9;
      txt(app, c, tx, ty, t(`trait.${tr}.desc`), { color: 'dim', width: w - 44, maxLines: 1 });
      ty += 10;
    }
  } else {
    txt(app, c, tx, ty, f.traits.map((tr) => t(`trait.${tr}.name`)).join(', '), { color: 'irony', width: w - 44, maxLines: 2 });
  }
  // stat row sits below the 32px portrait (y+4 .. y+36)
  const sw = Math.floor((w - 8) / 4);
  const sy = Math.max(y + 38, y + h - 10);
  STAT_ORDER.forEach((k, i) => stat(app, c, x + 4 + i * sw, sy, sw - 3, k, st[k]));
  if (opts.onPick) button(app, c, x + w - 40, y + 2, 38, 18, t('draft.pick'), opts.onPick, { name: 'btn_pick' });
}

function stat(app: App, c: C, x: number, y: number, w: number, key: StatKey, value: number): void {
  txt(app, c, x, y - 1, t(`stat.${key}.short`), { color: 'dim' });
  bar(app, c, x + 8, y, Math.max(8, w - 22), 6, value / 100, STAT_COLORS[key]);
  txt(app, c, x + w, y - 1, String(Math.round(value)), { align: 'right' });
}

/** What the four stats do, in general. */
function openStatGuide(app: App): void {
  dialog(app, { id: 'stat_guide', title: t('stats.guide.title'), body: STAT_ORDER.map((k) => `${t(`stat.${k}.short`)} = ${t(`stat.${k}.name`)}: ${t(`stat.${k}.guide`)}`).join('\n'), sprite: 'advisor', buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
}

/** Full follower sheet: every stat by name, with what it is doing for you right now. `candidate` = not recruited yet. */
export function openFollower(app: App, f: Follower, candidate = false): void {
  app.modals.open({
    id: 'follower',
    build(c, _a, close) {
      const run = app.store.state.run;
      const land = app.L.landscape;
      const w = land ? Math.min(app.L.w - 8, 320) : modalWidth(app);
      const colW = land ? Math.floor((w - 16) / 2) : w - 10;
      const job = run.buildings.find((b) => b.id === f.job);
      const size = run.followers.length + (candidate ? 1 : 0);
      const signed = (n: number) => (n >= 0 ? `+${n}` : String(n));
      const effects: Record<StatKey, string> = {
        productivity: t('stat.productivity.effect', { n: Math.round(DATA.balance.worker.bonusPerWorker * (0.5 + f.stats.productivity / 100) * 100) }),
        sanity: t('stat.sanity.effect', { n: signed(Math.round(sanityWorkPart(f) * 100)) }),
        devotion: t('stat.devotion.effect', { n: Math.round(followerRitualPct(f)) }),
        doubt: t('stat.doubt.effect', { n: Math.round((f.stats.doubt * DATA.balance.stats.doubtDecayPenaltyPerPoint * 100) / Math.max(1, size)) }),
      };
      const total = t('follower.total', { n: Math.round(followerWork(f) * 100) });
      const statsH = STAT_ORDER.reduce((n, k) => n + 10 + textHeight(effects[k], colW) + 3, 0) + textHeight(total, colW) + 2;
      const traitsH = f.traits.reduce((n, tr) => n + 10 + textHeight(t(`trait.${tr}.desc`), colW) + 3, 11);
      const headH = 38;
      const bodyH = land ? Math.max(statsH, headH + traitsH) : headH + statsH + traitsH;
      const r = frame(app, c, w, 16 + bodyH + 24, f.name);
      // header
      img(app, c, r.x, r.y, `fol_${f.skin}_${f.robe}_0`).setScale(2);
      const where = !candidate && isAway(app.store.state.run, f) ? t('follower.away', { m: Math.max(1, Math.ceil(((f.awayUntil ?? 0) - app.store.state.run.time) / 60)) }) : candidate ? t('follower.candidate') : job ? t('follower.job', { building: t(`building.${job.type}.name`) }) : t('follower.idle');
      txt(app, c, r.x + 38, r.y + 2, where, { width: colW - 38, maxLines: 2 });
      txt(app, c, r.x + 38, r.y + 22, t('float.follower_fine', { name: f.name }), { color: 'irony', width: colW - 38, maxLines: 1 });
      // stats
      let x = land ? r.x + colW + 6 : r.x;
      let y = land ? r.y : r.y + headH;
      for (const k of STAT_ORDER) {
        txt(app, c, x, y, t(`stat.${k}.name`));
        bar(app, c, x + 72, y + 1, colW - 72 - 18, 6, f.stats[k] / 100, STAT_COLORS[k]);
        txt(app, c, x + colW, y, String(Math.round(f.stats[k])), { align: 'right' });
        txt(app, c, x, y + 10, effects[k], { color: 'dim', width: colW });
        y += 10 + textHeight(effects[k], colW) + 3;
      }
      txt(app, c, x, y, total, { color: 'gain', width: colW });
      y += textHeight(total, colW) + 2;
      // traits
      x = r.x;
      y = land ? r.y + headH : y;
      txt(app, c, x, y, t('follower.traits'), { color: 'irony' });
      y += 11;
      for (const tr of f.traits) {
        txt(app, c, x, y, t(`trait.${tr}.name`));
        const d = t(`trait.${tr}.desc`);
        txt(app, c, x, y + 10, d, { color: 'dim', width: colW });
        y += 10 + textHeight(d, colW) + 3;
      }
      button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
    },
  });
}

function openDraft(app: App): void {
  app.modals.open({
    id: 'draft',
    build(c) {
      const draft = app.store.state.run.draft;
      if (!draft) return;
      const land = app.L.landscape;
      const pick = (i: number) => () => {
        const f = app.store.act((g, emit) => draftPick(g, i, emit));
        app.modals.close('draft');
        if (f) app.float(t('float.joined', { name: f.name }), undefined, 'irony');
      };
      const open = (f: Follower) => () => openFollower(app, f, true);
      if (land) {
        const w = Math.min(app.L.w - 8, 330);
        const r = frame(app, c, w, 172, t('draft.title'));
        txt(app, c, r.x, r.y, t('draft.body'), { width: r.w - 24, maxLines: 2 });
        button(app, c, r.x + r.w - 20, r.y, 20, 18, '?', () => openStatGuide(app), { fill: PAL.blue, name: 'btn_stat_guide' });
        const cw = Math.min(104, Math.floor((r.w - 8) / 3));
        const x0 = r.x + Math.floor((r.w - (cw * 3 + 8)) / 2);
        draft.forEach((f, i) => followerCard(app, c, f, x0 + i * (cw + 4), r.y + 20, cw, 130, { onPick: pick(i), onOpen: open(f) }));
      } else {
        const w = modalWidth(app);
        const r = frame(app, c, w, 16 + 28 + 3 * 67 + 2, t('draft.title'));
        txt(app, c, r.x, r.y, t('draft.body'), { width: r.w - 24, maxLines: 3 });
        button(app, c, r.x + r.w - 20, r.y, 20, 18, '?', () => openStatGuide(app), { fill: PAL.blue, name: 'btn_stat_guide' });
        draft.forEach((f, i) => followerCard(app, c, f, r.x, r.y + 28 + i * 67, r.w, 64, { onPick: pick(i), onOpen: open(f) }));
      }
    },
  });
}

function openEvent(app: App): void {
  const ev = app.store.state.run.event;
  if (!ev) return;
  const def = eventDef(ev.id);
  dialog(app, {
    id: `event_${ev.id}`,
    title: t(`event.${ev.id}.title`),
    body: t(`event.${ev.id}.body`),
    sprite: def.sprite,
    buttons: def.choices.map((ch, i) => ({
      label: t(`event.${ev.id}.choice.${ch.id}`),
      name: `btn_choice_${ch.id}`,
      disabled: !choiceAvailable(app.store.state.run, ev.id, i),
      onClick: () => {
        app.store.act((g, emit) => resolveEvent(g, i, emit));
        const waiting = !!app.store.state.run.inspection;
        dialog(app, { id: 'event_result', title: t(`event.${ev.id}.title`), body: t(`event.${ev.id}.result.${ch.id}`), sprite: def.sprite, buttons: [{ label: t('common.ok'), name: 'btn_ok', onClick: () => { if (waiting) app.goto('rituals'); } }] });
      },
    })),
  });
}

/** Level-up and boon announcements (queued by App so they never interrupt a ritual or another dialog). */
export type Notice = { kind: 'level'; level: number } | { kind: 'boon'; entity: string; index: number };
function openNotice(app: App, n: Notice): void {
  if (n.kind === 'boon') {
    const b = entityDef(n.entity).boons[n.index];
    dialog(app, {
      id: 'notice', title: t('boon.title'), sprite: n.entity,
      body: t('boon.body', { name: t(`entity.${n.entity}.name`), boon: t(`boon.${b.field}`, { n: b.value }) }),
      buttons: [{ label: t('boon.ok'), name: 'btn_ok' }],
    });
    return;
  }
  const lines = [t('levelup.body')];
  const unlocks = unlocksAt(n.level);
  if (unlocks.length) lines.push(t('levelup.unlocks'));
  for (const u of unlocks) {
    if (u.kind === 'crop') lines.push(t('levelup.crop', { name: t(`item.${u.id}.name`) }));
    else if (u.kind === 'generator') lines.push(t('levelup.generator', { name: t(`gen.${u.id}.name`) }));
    else lines.push(t('levelup.ritual', { name: t(ritualDef(u.id).nameKey) }));
  }
  dialog(app, { id: 'notice', title: t('levelup.title', { n: n.level }), body: lines.join('\n'), sprite: 'advisor', buttons: [{ label: t('levelup.ok'), name: 'btn_ok' }] });
}

/** What a building does at a given level, in words. */
export function buildingEffect(type: string, level: number): string {
  const def = buildingDef(type);
  const fake = { id: 0, type, x: 0, y: 0, level, stored: 0 } as BuildingState;
  if (def.produces) {
    const mult = 1 + levelBonus(fake, 'outputPct') / 100;
    const caps = def.devotionCap ?? [DATA.balance.caps.devotion];
    return t(`building.effect.${type}`, { rate: Math.round(def.produces.perMin * mult * 10) / 10, cap: Math.round(def.produces.perMin * (def.storageMin ?? 10) * mult), bank: caps[Math.min(level, caps.length) - 1] });
  }
  if (def.housing) return t(`building.effect.${type}`, { n: def.housing + levelBonus(fake, 'housing') });
  if (def.plots) return t(`building.effect.${type}`, { n: def.plots + levelBonus(fake, 'plots') });
  return t(`building.effect.${type}`, { n: levelBonus(fake, 'brewBonus') });
}

/** What an upgrade still lacks, as plain sentences with where to get each thing. Empty = ready. */
export function upgradeMissing(app: App, b: BuildingState): string[] {
  const run = app.store.state.run;
  const up = nextUpgrade(b);
  if (!up) return [];
  const out: string[] = [];
  if (run.devotion < up.cost.devotion) out.push(t('building.missing.devotion', { n: Math.ceil(up.cost.devotion - run.devotion) }));
  if (run.donations < up.cost.donations) out.push(t('building.missing.donations', { n: Math.ceil(up.cost.donations - run.donations) }));
  if (up.omens && run.omens < up.omens) out.push(t('building.missing.omens', { n: up.omens - run.omens }));
  if (up.merge && countItems(run.reliquary, up.merge.chain, up.merge.tier) < 1) {
    const name = t(`merge.${mergeItemKey(up.merge.chain, up.merge.tier)}.name`);
    const gen = DATA.merge.generators.find((g) => g.chain === up.merge!.chain)!;
    out.push(run.level >= (gen.unlockLevel ?? 1) ? t('building.missing.merge', { name }) : t('building.missing.merge_locked', { name, gen: t(`gen.${gen.id}.name`), n: gen.unlockLevel ?? 1 }));
  }
  return out;
}

/** Building card: what it does now, what the next level adds, what the upgrade costs and what is still missing. */
export function openBuilding(app: App, buildingId: number): void {
  app.modals.open({
    id: 'building',
    build(c, _a, close) {
      const run = app.store.state.run;
      const b = run.buildings.find((x) => x.id === buildingId);
      if (!b) return;
      const def = buildingDef(b.type);
      const up = nextUpgrade(b);
      const w = app.L.landscape ? Math.min(app.L.w - 8, 310) : modalWidth(app); // wider in landscape so the list stays short
      const tw = w - 10;
      const now = (isSealed(run, b) ? `${t('building.sealed')}. ${t('building.sealed.reopens', { m: Math.max(1, Math.ceil(sealLeft(run, b) / 60)) })}\n` : '') + t('building.now', { text: buildingEffect(b.type, b.level) });
      const next = up ? t('building.next', { text: buildingEffect(b.type, b.level + 1) }) : t('building.maxed');
      const missing = upgradeMissing(app, b);
      const status = !up ? '' : missing.length ? [t('building.missing'), ...missing.map((m) => `- ${m}`)].join('\n') : t('building.ready');
      const mergeName = up?.merge ? t(`merge.${mergeItemKey(up.merge.chain, up.merge.tier)}.name`) : '';
      const costH = up ? 12 + (up.merge ? 26 : 0) : 0;
      const h = 16 + 12 + textHeight(now, tw) + 2 + textHeight(next, tw) + 4 + costH + (status ? textHeight(status, tw) + 4 : 0) + 22 + 22;
      const r = frame(app, c, w, h, t(`building.${b.type}.name`));
      let y = r.y;
      txt(app, c, r.x, y, t('building.level', { n: b.level, max: maxLevel(b.type) }), { color: 'irony' });
      y += 12;
      txt(app, c, r.x, y, now, { width: r.w });
      y += textHeight(now, r.w) + 2;
      txt(app, c, r.x, y, next, { width: r.w, color: up ? 'gain' : 'dim' });
      y += textHeight(next, r.w) + 4;
      if (up) {
        // cost line: Devotion and Donations, each red until you have enough
        txt(app, c, r.x, y, t('building.needs'), { color: 'dim' });
        let x = r.x + 36;
        img(app, c, x, y, 'ic_devotion');
        txt(app, c, x + 10, y, String(up.cost.devotion), { color: run.devotion >= up.cost.devotion ? 'gain' : 'loss' });
        x += 40;
        img(app, c, x, y, 'ic_donations');
        txt(app, c, x + 10, y, String(up.cost.donations), { color: run.donations >= up.cost.donations ? 'gain' : 'loss' });
        if (up.omens) {
          x += 34;
          img(app, c, x, y, 'ic_omen');
          txt(app, c, x + 10, y, String(up.omens), { color: run.omens >= up.omens ? 'gain' : 'loss' });
        }
        y += 12;
        if (up.merge) {
          // the relic it needs, by picture and by name
          const have = countItems(run.reliquary, up.merge.chain, up.merge.tier);
          panel(app, c, r.x, y, 24, 24, PAL.white);
          img(app, c, r.x + 1, y + 1, `m_${mergeItemKey(up.merge.chain, up.merge.tier)}`);
          txt(app, c, r.x + 28, y + 3, t('building.relic', { name: mergeName }), { width: r.w - 30, maxLines: 1 });
          txt(app, c, r.x + 28, y + 13, have ? t('building.relic.have') : t('building.relic.none'), { color: have ? 'gain' : 'loss', width: r.w - 30, maxLines: 1 });
          y += 26;
        }
        txt(app, c, r.x, y, status, { width: r.w, color: missing.length ? 'loss' : 'gain' });
        y += textHeight(status, r.w) + 4;
      }
      const bw = Math.floor((r.w - 4) / 2);
      const needsRelic = !!up?.merge && countItems(run.reliquary, up.merge.chain, up.merge.tier) < 1 && run.level >= (DATA.merge.generators.find((g) => g.chain === up.merge!.chain)!.unlockLevel ?? 1);
      if (up && missing.length && needsRelic) {
        // the most useful next step is a trip to the Reliquary, so offer it instead of a dead button
        button(app, c, r.x, y, bw, 19, t('building.goto_relics'), () => { close(); app.goto('reliquary'); }, { fill: PAL.yellow, name: 'btn_goto_relics' });
      } else {
        button(app, c, r.x, y, bw, 19, !up ? t('building.maxed') : missing.length ? t('building.not_yet') : t('building.upgrade'), () => {
          if (app.store.act((g, emit) => upgradeBuilding(g, buildingId, emit))) sfxUpgrade();
          app.modals.rebuild();
        }, { disabled: !up || missing.length > 0, fill: PAL.acid, icon: up && !missing.length ? 'ic_up' : undefined, name: 'btn_upgrade' });
      }
      const side: [string, () => void] = b.type === 'sermon_hall' && sanctumUnlocked(run) && app.cur !== app.sanctum
        ? [t('sanctum.go_inside'), () => { close(); app.setCompoundView('sanctum'); }]
        : def.produces
        ? [`${t('building.collect')} ${Math.floor(b.stored)}`, () => { app.store.act((g, emit) => collect(g, buildingId, emit)); app.modals.rebuild(); }]
        : b.type === 'dormitory' ? [t('building.flock'), () => { close(); openRoster(app); }] : [t('building.goto_brew'), () => { close(); app.goto('alchemy'); }];
      button(app, c, r.x + bw + 4, y, bw, 19, side[0], side[1], { fill: PAL.blue, name: 'btn_building_side' });
      button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
    },
  });
}
function sfxUpgrade(): void { sfx.create(); sfx.buzz(20); }

/** The Grimoire: every recipe, known, hinted or still a mystery. */
export function openGrimoire(app: App): void {
  app.modals.open({
    id: 'grimoire',
    build(c, _a, close) {
      const st = app.store.state;
      const R = DATA.recipes.recipes;
      const land = app.L.landscape;
      const w = land ? Math.min(app.L.w - 8, 320) : modalWidth(app);
      const cols = land ? 2 : 1;
      const cw = Math.floor((w - 10 - (cols - 1) * 6) / cols);
      const rowH = 21;
      const rows = Math.ceil(R.length / cols);
      const r = frame(app, c, w, 16 + rows * rowH + 24, t('grimoire.title', { n: st.meta.grimoire.length, max: R.length }));
      R.forEach((rec, i) => {
        const x = r.x + (i % cols) * (cw + 6);
        const y = r.y + Math.floor(i / cols) * rowH;
        const known = st.meta.grimoire.includes(rec.id);
        const hinted = recipeHinted(st.run, rec.id);
        if (!known && !hinted) { img(app, c, x, y + 1, 'ic_lock'); txt(app, c, x + 11, y + 1, t('grimoire.unknown'), { color: 'dim', width: cw - 11, maxLines: 2 }); return; }
        img(app, c, x, y, `i_${rec.output}`);
        txt(app, c, x + 18, y, t(`item.${rec.output}.name`), { color: known ? 'ink' : 'gold', width: cw - 18, maxLines: 1 });
        txt(app, c, x + 18, y + 9, rec.ingredients.map((id) => t(`item.${id}.name`)).join(' + '), { color: 'dim', width: cw - 18, maxLines: 1 });
      });
      button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
    },
  });
}

export function openRoster(app: App): void {
  app.modals.open({
    id: 'roster',
    build(c, _a, close) {
      const run = app.store.state.run;
      const land = app.L.landscape;
      const list = run.followers;
      const rowH = 50;
      const cols = land ? 2 : 1;
      const fw = land ? Math.min(app.L.w - 8, 320) : modalWidth(app);
      const rows = Math.max(1, Math.ceil(list.length / cols));
      const r = frame(app, c, fw, 16 + rows * (rowH + 2) + 4 + 22, t('roster.title', { n: list.length, cap: housing(run) }));
      if (list.length === 0) txt(app, c, r.x, r.y, t('roster.empty'), { width: r.w });
      const cw = Math.floor((r.w - (cols - 1) * 4) / cols);
      list.forEach((f, i) => followerCard(app, c, f, r.x + (i % cols) * (cw + 4), r.y + Math.floor(i / cols) * (rowH + 2), Math.max(cw, 110), rowH, { detail: false, onOpen: () => openFollower(app, f) }));
      const by = r.y + r.h - 18;
      if (list.length) txt(app, c, r.x, by + 1, t('roster.hint'), { color: 'dim', width: r.w - 80, maxLines: 2 });
      button(app, c, r.x + r.w - 76, by, 22, 18, '?', () => openStatGuide(app), { fill: PAL.blue, name: 'btn_stat_guide' });
      button(app, c, r.x + r.w - 50, by, 50, 18, t('common.close'), close, { name: 'btn_close' });
    },
  });
}

// ---------- menu ----------

export function openMenu(app: App, direct?: 'debug'): void {
  if (direct === 'debug') { openDebug(app); return; }
  app.modals.open({
    id: 'menu',
    build(c, _a, close) {
      const w = Math.min(modalWidth(app), 150);
      const items: [string, () => void][] = [
        [t('menu.ascension'), () => openAscension(app)],
        [t('menu.followers'), () => openRoster(app)],
        [t('menu.settings'), () => openSettings(app)],
        [t('menu.save_code'), () => openSaveCode(app)],
        [t('menu.debug'), () => openDebug(app)],
        [t('common.close'), () => {}],
      ];
      const land = app.L.landscape;
      const cols = land ? 2 : 1;
      const rows = Math.ceil(items.length / cols);
      const fw = land ? 220 : w;
      const r = frame(app, c, fw, 16 + rows * 21 + 6, t('menu.title'));
      const bw = Math.floor((r.w - (cols - 1) * 4) / cols);
      items.forEach(([label, fn], i) => button(app, c, r.x + (i % cols) * (bw + 4), r.y + Math.floor(i / cols) * 21, bw, 18, label, () => { close(); fn(); }, { name: `menu_${i}` }));
    },
  });
}

function openSettings(app: App): void {
  app.modals.open({
    id: 'settings',
    build(c, _a, close) {
      const s = app.store.state.meta.settings;
      const r = frame(app, c, modalWidth(app), 16 + 3 * 34 + 24, t('settings.title'));
      const toggle = (y: number, key: 'reducedMotion' | 'relaxedPuzzles' | 'sound') => {
        txt(app, c, r.x, y, t(`settings.${key}`));
        txt(app, c, r.x, y + 10, t(`settings.${key}.desc`), { color: 'dim', width: r.w - 44, maxLines: 2 });
        button(app, c, r.x + r.w - 38, y + 2, 38, 18, s[key] ? t('common.on') : t('common.off'), () => {
          app.store.act((g) => { g.meta.settings[key] = !g.meta.settings[key]; });
          sfx.setEnabled(app.store.state.meta.settings.sound);
          sfx.unlock();
          sfx.tap();
          app.modals.rebuild();
        }, { fill: s[key] ? PAL.acid : PAL.robe, name: `toggle_${key}` });
      };
      toggle(r.y, 'reducedMotion');
      toggle(r.y + 34, 'relaxedPuzzles');
      toggle(r.y + 68, 'sound');
      button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
    },
  });
}

function openSaveCode(app: App): void {
  dialog(app, {
    id: 'savecode', title: t('savecode.title'), body: t('savecode.body'),
    buttons: [
      { label: t('savecode.export'), onClick: () => {
        const code = exportCode(app.store.state, Date.now());
        try { void navigator.clipboard?.writeText(code); } catch { /* clipboard blocked */ }
        try { window.prompt(t('savecode.copy'), code); } catch { /* prompts blocked */ }
      } },
      { label: t('savecode.import'), onClick: () => {
        let code: string | null = null;
        try { code = window.prompt(t('savecode.paste')); } catch { code = null; }
        if (!code) return;
        try {
          app.store.replace(importCode(code));
          app.float(t('savecode.ok'), undefined, 'gain');
        } catch {
          app.float(t('savecode.bad'), undefined, 'loss');
        }
      } },
      { label: t('common.close') },
    ],
  });
}

export function openAscension(app: App): void {
  app.modals.open({
    id: 'ascension',
    build(c, _a, close) {
      const st = app.store.state;
      const run = st.run;
      const land = app.L.landscape;
      const w = land ? Math.min(app.L.w - 8, 300) : modalWidth(app);
      const flavors = ['fake_death', 'flee', 'beamed'];
      const intro = t('ascension.body');
      const tw = w - 10;
      const introH = textHeight(intro, tw);
      const cw = land ? Math.floor((tw - 8) / 3) : tw;
      const descH = Math.max(...flavors.map((f) => textHeight(t(`ascension.${f}.desc`), cw - 8)));
      const ch = 14 + descH + 2;
      const relics = 5 + 2 * run.level + run.met.length + Math.floor(Object.values(run.rituals).filter((s) => s >= 3).length / 5);
      const notes: [string, 'loss' | 'ink' | 'dim'][] = [
        [t('ascension.requires', { level: 10, now: run.level }), 'loss'],
        [t('ascension.preview', { n: relics }), 'ink'],
        [t('ascension.keeps'), 'dim'],
      ];
      const notesH = notes.reduce((n, [str]) => n + textHeight(str, tw) + 1, 0);
      const rowsH = land ? ch + 3 : flavors.length * (ch + 2) + 1;
      const r = frame(app, c, w, 16 + introH + 3 + rowsH + notesH + 3 + 18 + 4, t('ascension.title'));
      txt(app, c, r.x, r.y, intro, { width: r.w });
      let y = r.y + introH + 3;
      flavors.forEach((f, i) => {
        const x = land ? r.x + i * (cw + 4) : r.x;
        const yy = land ? y : y + i * (ch + 2);
        panel(app, c, x, yy, cw, ch, PAL.robe);
        img(app, c, x + 3, yy + 3, 'ic_lock');
        txt(app, c, x + 14, yy + 3, t(`ascension.${f}.name`), { color: 'irony', width: cw - 16, maxLines: 1 });
        txt(app, c, x + 4, yy + 13, t(`ascension.${f}.desc`), { color: 'ink', width: cw - 8 });
      });
      y += rowsH;
      for (const [str, color] of notes) {
        txt(app, c, r.x, y, str, { color, width: r.w });
        y += textHeight(str, r.w) + 1;
      }
      button(app, c, r.x, r.y + r.h - 18, r.w - 54, 18, t('ascension.locked'), () => {}, { disabled: true });
      button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
    },
    onClose: () => app.store.act((g) => { if (g.run.tutorial === 'ascension') g.run.flags.ascension_viewed = true; }),
  });
}

function openDebug(app: App): void {
  app.modals.open({
    id: 'debug',
    build(c, _a, close) {
      const st = app.store.state;
      const act = (fn: Parameters<typeof app.store.act>[0]) => () => { app.store.act(fn); app.modals.rebuild(); };
      const items: [string, () => void][] = [
        [t('debug.skip1'), act((g, e) => debugSkip(g, 60, e))],
        [t('debug.skip10'), act((g, e) => debugSkip(g, 600, e))],
        [t('debug.away1h'), () => { close(); app.store.simulateAway(3600); }],
        [t('debug.away9h'), () => { close(); app.store.simulateAway(9 * 3600); }],
        [t('debug.devotion'), act((g) => { addResource(g.run, 'devotion', 100); })],
        [t('debug.donations'), act((g) => { addResource(g.run, 'donations', 50); })],
        [t('debug.suspicion'), act((g) => { addSuspicion(g.run, 10); })],
        [t('debug.level'), () => { close(); app.store.act((g, e) => addXp(g, xpNeeded(g.run.level) - g.run.xp, e)); }],
        [t('debug.reporter'), () => { close(); app.store.act((g, e) => triggerEvent(g, 'reporter', e)); }],
        [t('debug.cat'), () => { close(); app.store.act((g, e) => triggerEvent(g, 'cat', e)); }],
        [t('debug.visit'), () => { close(); app.store.act((g, e) => triggerEvent(g, 'auditor', e)); }],
        [t('debug.omens'), act((g) => { g.run.omens += 10; g.run.flags.riteUsed = true; })],
        [t('debug.win'), () => { close(); app.store.act((g) => { const r = g.run.activeRitual as { status: string; score: number; level: { starScores: number[] } } | null; if (r) { r.status = 'won'; r.score = Math.max(r.score, r.level.starScores[2]); } }); }],
        [t('debug.reset'), () => { app.modals.closeAll(); app.store.reset(); app.goto('compound'); }],
        [t('common.close'), close],
      ];
      const land = app.L.landscape;
      const cols = land ? 4 : 2;
      const w = land ? Math.min(app.L.w - 8, 316) : modalWidth(app);
      const rows = Math.ceil(items.length / cols);
      const s = st.meta.stats;
      const info = t('debug.stats', { play: Math.round(s.playSec), gap: Math.round(Math.max(s.longestGapSec, s.playSec - s.lastUnlockAt)), step: st.run.tutorial, v: st.saveVersion });
      const r = frame(app, c, w, 16 + rows * 20 + textHeight(info, w - 10) + 8, t('debug.title'));
      const bw = Math.floor((r.w - (cols - 1) * 3) / cols);
      items.forEach(([label, fn], i) => button(app, c, r.x + (i % cols) * (bw + 3), r.y + Math.floor(i / cols) * 20, bw, 18, label, fn, { fill: label === t('debug.reset') ? PAL.pink : PAL.blue, name: label === t('common.close') ? 'debug_close' : `debug_${i}` }));
      txt(app, c, r.x, r.y + rows * 20 + 2, info, { color: 'dim', width: r.w });
    },
  });
}

export { rect, DATA };
