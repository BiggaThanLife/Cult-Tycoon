// State-driven and menu modals: welcome, welcome-back, draft, events, roster, menu, settings, debug, ascension.
import type { App } from '../app';
import { PAL } from '../art/palette';
import { DATA, eventDef } from '../core/data';
import { addResource, addSuspicion, choiceAvailable, debugSkip, draftPick, housing, resolveEvent, triggerEvent } from '../core/game';
import { exportCode, importCode } from '../core/save';
import { t } from '../core/text';
import type { Follower } from '../core/types';
import { bar, button, img, panel, rect, txt, textHeight, type C } from '../ui/kit';
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

function followerCard(app: App, c: C, f: Follower, x: number, y: number, w: number, h: number, onPick?: () => void, detail = true): void {
  panel(app, c, x, y, w, h, PAL.white);
  const narrow = w < 110;
  img(app, c, x + 4, y + 4, `fol_${f.skin}_${f.robe}_0`).setScale(2);
  const st = f.stats;
  const statLine = `${t('stat.devotion.short')}${Math.round(st.devotion)} ${t('stat.sanity.short')}${Math.round(st.sanity)} ${t('stat.productivity.short')}${Math.round(st.productivity)} ${t('stat.doubt.short')}${Math.round(st.doubt)}`;
  if (narrow) {
    // tall card (landscape draft): portrait on top, traits below, button at the bottom
    txt(app, c, x + 40, y + 6, f.name, { width: w - 44, maxLines: 3 });
    let ty = y + 40;
    for (const tr of f.traits) {
      txt(app, c, x + 4, ty, t(`trait.${tr}.name`), { color: 'irony', width: w - 8, maxLines: 1 });
      ty += 9;
      const d = t(`trait.${tr}.desc`);
      txt(app, c, x + 4, ty, d, { color: 'dim', width: w - 8, maxLines: 2 });
      ty += Math.min(2, textHeight(d, w - 8) / 9) * 9 + 2;
    }
    txt(app, c, x + 4, y + h - (onPick ? 31 : 11), statLine, { width: w - 8, maxLines: 1 });
    if (onPick) button(app, c, x + 3, y + h - 21, w - 6, 18, t('draft.pick'), onPick, { name: 'btn_pick' });
    return;
  }
  const tx = x + 40;
  const tw = w - 44 - (onPick ? 40 : 0);
  txt(app, c, tx, y + 4, f.name, { width: tw, maxLines: 1 });
  let ty = y + 14;
  if (detail) {
    for (const tr of f.traits) {
      txt(app, c, tx, ty, t(`trait.${tr}.name`), { color: 'irony', width: w - 44, maxLines: 1 });
      ty += 9;
      txt(app, c, tx, ty, t(`trait.${tr}.desc`), { color: 'dim', width: w - 44, maxLines: 1 });
      ty += 10;
    }
  } else {
    txt(app, c, tx, ty, f.traits.map((tr) => t(`trait.${tr}.name`)).join(', '), { color: 'irony', width: w - 44, maxLines: 2 });
  }
  const sw = Math.floor((w - 12) / 4);
  const sy = y + h - 9;
  stat(app, c, x + 4, sy, sw - 2, 'devotion', st.devotion, PAL.pink);
  stat(app, c, x + 4 + sw, sy, sw - 2, 'sanity', st.sanity, PAL.blue);
  stat(app, c, x + 4 + sw * 2, sy, sw - 2, 'productivity', st.productivity, PAL.yellow);
  stat(app, c, x + 4 + sw * 3, sy, sw - 2, 'doubt', st.doubt, PAL.robeD);
  if (onPick) button(app, c, x + w - 40, y + 2, 38, 18, t('draft.pick'), onPick, { name: 'btn_pick' });
}

function stat(app: App, c: C, x: number, y: number, w: number, key: string, value: number, color: string): void {
  txt(app, c, x, y - 1, t(`stat.${key}.short`), { color: 'dim' });
  bar(app, c, x + 10, y, Math.max(8, w - 24), 6, value / 100, color);
  txt(app, c, x + w, y - 1, String(Math.round(value)), { align: 'right' });
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
      if (land) {
        const w = Math.min(app.L.w - 8, 330);
        const r = frame(app, c, w, 172, t('draft.title'));
        txt(app, c, r.x, r.y, t('draft.body'), { width: r.w, maxLines: 2 });
        const cw = Math.min(104, Math.floor((r.w - 8) / 3));
        const x0 = r.x + Math.floor((r.w - (cw * 3 + 8)) / 2);
        draft.forEach((f, i) => followerCard(app, c, f, x0 + i * (cw + 4), r.y + 20, cw, 130, pick(i)));
      } else {
        const w = modalWidth(app);
        const r = frame(app, c, w, 16 + 28 + 3 * 67 + 2, t('draft.title'));
        txt(app, c, r.x, r.y, t('draft.body'), { width: r.w, maxLines: 3 });
        draft.forEach((f, i) => followerCard(app, c, f, r.x, r.y + 28 + i * 67, r.w, 64, pick(i)));
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
        dialog(app, { id: 'event_result', title: t(`event.${ev.id}.title`), body: t(`event.${ev.id}.result.${ch.id}`), sprite: def.sprite, buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
      },
    })),
  });
}

export function openRoster(app: App): void {
  app.modals.open({
    id: 'roster',
    build(c, _a, close) {
      const run = app.store.state.run;
      const w = modalWidth(app);
      const land = app.L.landscape;
      const list = run.followers;
      const rowH = 40;
      const cols = land ? 2 : 1;
      const fw = land ? Math.min(app.L.w - 8, 320) : w;
      const rows = Math.max(1, Math.ceil(list.length / cols));
      const r = frame(app, c, fw, 16 + 12 + rows * (rowH + 2) + 24, t('roster.title', { n: list.length, cap: housing(run) }));
      if (list.length === 0) txt(app, c, r.x, r.y, t('roster.empty'), { width: r.w });
      const cw = Math.floor((r.w - (cols - 1) * 4) / cols);
      list.forEach((f, i) => followerCard(app, c, f, r.x + (i % cols) * (cw + 4), r.y + 2 + Math.floor(i / cols) * (rowH + 2), Math.max(cw, 110), rowH, undefined, false));
      button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
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
      const relics = 5 + 2 * run.level + (run.favor.mothman ? 1 : 0) + Math.floor(Object.values(run.rituals).filter((s) => s >= 3).length / 5);
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
        [t('debug.reporter'), () => { close(); app.store.act((g, e) => triggerEvent(g, 'reporter', e)); }],
        [t('debug.cat'), () => { close(); app.store.act((g, e) => triggerEvent(g, 'cat', e)); }],
        [t('debug.win'), () => { close(); app.store.act((g) => { const r = g.run.activeRitual as { status: string; score: number; level: { starScores: number[] } } | null; if (r) { r.status = 'won'; r.score = Math.max(r.score, r.level.starScores[2]); } }); }],
        [t('debug.reset'), () => { app.modals.closeAll(); app.store.reset(); app.goto('compound'); }],
        [t('common.close'), close],
      ];
      const land = app.L.landscape;
      const cols = land ? 3 : 2;
      const w = land ? Math.min(app.L.w - 8, 310) : modalWidth(app);
      const rows = Math.ceil(items.length / cols);
      const s = st.meta.stats;
      const info = t('debug.stats', { play: Math.round(s.playSec), gap: Math.round(Math.max(s.longestGapSec, s.playSec - s.lastUnlockAt)), step: st.run.tutorial, v: st.saveVersion });
      const r = frame(app, c, w, 16 + rows * 20 + textHeight(info, w - 10) + 8, t('debug.title'));
      const bw = Math.floor((r.w - (cols - 1) * 3) / cols);
      items.forEach(([label, fn], i) => button(app, c, r.x + (i % cols) * (bw + 3), r.y + Math.floor(i / cols) * 20, bw, 18, label, fn, { fill: i === items.length - 2 ? PAL.pink : PAL.blue, name: `debug_${i}` }));
      txt(app, c, r.x, r.y + rows * 20 + 2, info, { color: 'dim', width: r.w });
    },
  });
}

export { rect, DATA };
