// Rituals: level list and the match-3 board. All rules live in src/puzzle/match3.ts; this file
// draws the engine's snapshots, turns swipes into swaps, and adds the "juice": pops, particles,
// beams, squash on landing, rising-pitch chimes, combo callouts, a leftover-moves bonus count and
// a star reveal. See docs/specs/ritual-feel.md for the feedback rules. Reduced motion keeps the
// information (counts, callouts, sounds) and drops the movement.
import type Phaser from 'phaser';
import type { App } from '../app';
import { ATLAS } from '../art/sprites';
import { fontKey } from '../art/font';
import { PAL } from '../art/palette';
import { DATA } from '../core/data';
import { cropUnlocked, dailyLevel, finishRitual, riteBlocked, ritesOpen, ritesVisible, ritualUnlocked, settleInspection, startRitual, updateDaily, type RitualReward, type VisitSummary } from '../core/game';
import { eventDef, ritualDef, riteDef } from '../core/data';
import type { ActiveRite } from '../core/types';
import { t } from '../core/text';
import { findHint, goalProgress, MOVE_BONUS, trySwap, type Cell, type Goal, type Match3State, type Snapshot } from '../puzzle/match3';
import { button, hit, img, inRect, panel, rect, textHeight, txt, type C } from '../ui/kit';
import { dialog, frame, modalWidth } from '../ui/modal';
import { sfx } from '../ui/sfx';
import type { OrdersScreen } from './orders';
import { Screen } from './screen';

const T = 20;
/** Feedback timings in ms. Tune feel here, not in the engine. */
const FEEL = {
  swap: 120, clear: 190, fallBase: 90, fallPerRow: 38, squash: 110, reshuffle: 260,
  flyToGoal: 380, callout: 850, bonusTick: 80, bonusMaxTotal: 1300, celebrate: 900, intro: 520,
  particlesPerTile: 6, maxParticles: 110,
};

type Board = (Cell | null)[][];

export class RitualScreen extends Screen {
  private board: C | null = null;
  private fx: C | null = null;
  origin = { x: 0, y: 0 };
  private sprites = new Map<number, C>();
  private lastCells: Board | null = null;
  private queue: Snapshot[] = [];
  private busy = false;
  private timers: Phaser.Time.TimerEvent[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private live = 0;
  private press: { x: number; y: number; px: number; py: number } | null = null;
  private selected: { x: number; y: number } | null = null;
  private selectFx: Phaser.GameObjects.Image | null = null;
  private hintFx: Phaser.GameObjects.Image[] = [];
  private hintTiles: C[] = [];
  private idle = 0;
  private ending = false;
  private celebrated = false;
  private pendingIntro = false;
  /** What the HUD currently shows; it trails the engine state while animations play. */
  private disp = { score: 0, shown: 0, moves: 0, collected: [0, 0, 0, 0, 0, 0], relics: 0, webs: 0 };
  private info: { focus?: Phaser.GameObjects.BitmapText; moves?: Phaser.GameObjects.BitmapText; score?: Phaser.GameObjects.BitmapText; goals: Phaser.GameObjects.BitmapText[]; goalAt: { x: number; y: number }[] } = { goals: [], goalAt: [] };

  private get game(): Match3State | null { return this.app.store.state.run.activeRitual as Match3State | null; }
  private get reduced(): boolean { return this.app.store.state.meta.settings.reducedMotion; }

  rebuild(): void {
    for (const ev of this.timers) ev.remove();
    this.timers = [];
    this.app.tweens.killTweensOf([...this.sprites.values()]);
    if (this.fx) this.app.tweens.killTweensOf(this.fx.list);
    this.clear();
    this.sprites.clear();
    this.pool = [];
    this.live = 0;
    this.queue = [];
    this.busy = false;
    this.board = null;
    this.fx = null;
    this.selectFx = null;
    this.hintFx = [];
    this.hintTiles = [];
    this.info = { goals: [], goalAt: [] };
    const L = this.app.L;
    rect(this.app, this.c, L.body.x, L.body.y, L.body.w, L.body.h, PAL.night);
    this.dockBg();
    if (this.game) this.buildPlay(this.game);
    else this.buildList();
  }

  override onChanged(): void {
    // don't tear the board down for unrelated state changes while playing
    if (this.game && this.board && !this.ending) return;
    this.rebuild();
  }

  override fullHeight(): boolean { return !!this.game && this.app.L.landscape; }

  private later(ms: number, fn: () => void): void {
    this.timers.push(this.app.time.delayedCall(ms, () => { if (this.visible && this.board) fn(); }));
  }

  // ---------- level list ----------

  private page = 0;
  /** The rite the player has picked (view state; it is copied into the save when a ritual starts). */
  rite: ActiveRite = { id: 'sermon' };

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private begin(levelId: string, rite?: ActiveRite): void {
    this.pendingIntro = true;
    this.celebrated = false;
    this.app.store.act((g) => startRitual(g, levelId, rite));
    this.rebuild();
  }

  /** Pick a rite; Communion and Harvest ask which entity or crop first. */
  private chooseRite(id: string): void {
    const app = this.app;
    const def = riteDef(id);
    if (!def.choose) { this.rite = { id }; this.rebuild(); return; }
    const run = app.store.state.run;
    const options = def.choose === 'entity' ? run.met.map((e) => ({ key: e, label: t(`entity.${e}.name`), sprite: e })) : DATA.crops.filter((c) => cropUnlocked(run, c.id)).map((c) => ({ key: c.id, label: t(`item.${c.id}.name`), sprite: `i_${c.id}` }));
    app.modals.open({
      id: 'rite_choose',
      build: (c, _a, close) => {
        const w = Math.min(app.L.w - 8, app.L.landscape ? 300 : 190);
        const cols = app.L.landscape ? 3 : 2;
        const bw = Math.floor((w - 10 - (cols - 1) * 4) / cols);
        const rows = Math.ceil(options.length / cols);
        const r = frame(app, c, w, 16 + rows * 40 + 24, t(def.choose === 'entity' ? 'rite.choose_entity' : 'rite.choose_crop'));
        options.forEach((o, i) => {
          const x = r.x + (i % cols) * (bw + 4);
          const y = r.y + Math.floor(i / cols) * 40;
          panel(app, c, x, y, bw, 37, PAL.white);
          const sp = img(app, c, x + 2, y + 2, o.sprite);
          if (sp.width <= 16) sp.setPosition(x + 10, y + 10);
          txt(app, c, x + 36, y + 6, o.label, { width: bw - 38, maxLines: 3 });
          hit(app, c, x, y, bw, 37, () => { close(); this.rite = def.choose === 'entity' ? { id, entity: o.key } : { id, crop: o.key }; this.rebuild(); }).setName(`choose_${o.key}`);
        });
        button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.cancel'), close, { name: 'btn_close' });
      },
    });
  }

  /** The rite strip, its description and the Daily Rite card. Returns the height used. */
  private buildRitePanel(x: number, y: number, w: number): number {
    const app = this.app;
    const g = app.store.state;
    const run = g.run;
    const y0 = y;
    if (riteBlocked(g, this.rite.id)) this.rite = { id: 'sermon' };
    // a visitor is waiting: that comes first
    if (run.inspection) {
      const ev = eventDef(run.inspection.event);
      // the advisor strip already explains; this panel names the visitor and offers the two ways out
      const title = t(`event.${ev.id}.title`);
      const narrow = w < 120;
      const titleH = textHeight(title, w - 28);
      const bh = Math.max(24, titleH + 4) + (narrow ? 42 : 21);
      panel(app, this.c, x, y, w, bh, PAL.yellow);
      img(app, this.c, x + 3, y + 3, ev.sprite);
      txt(app, this.c, x + 24, y + 4, title, { width: w - 28 });
      const by = y + bh - (narrow ? 41 : 21);
      const bw = narrow ? w - 6 : Math.floor((w - 10) / 2);
      button(app, this.c, x + 3, by, bw, 18, t('rite.look_busy.name'), () => this.begin(run.inspection!.level), { fill: PAL.acid, icon: narrow ? undefined : 'rite_look_busy', name: 'btn_look_busy' });
      button(app, this.c, narrow ? x + 3 : x + 7 + bw, narrow ? by + 20 : by, bw, 18, t('inspection.settle'), () => {
        const sum = app.store.act((gg, e) => settleInspection(gg, e));
        if (sum) dialog(app, { id: 'inspection_result', title: t(`event.${ev.id}.title`), body: t('inspection.result.loss', { summary: summaryText(sum) }), sprite: ev.sprite, buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
        this.rebuild();
      }, { fill: PAL.robe, name: 'btn_settle' });
      y += bh + 3;
    }
    // rite strip
    txt(app, this.c, x + 1, y + 1, t('rite.pick'), { color: app.L.dock ? 'irony' : 'white' });
    y += 10;
    const rites = ritesVisible(g).filter((r) => r.id !== 'look_busy');
    const cell = 22;
    const perRow = Math.max(1, Math.floor((w + 2) / (cell + 2)));
    rites.forEach((r, i) => {
      const cx = x + (i % perRow) * (cell + 2);
      const cy = y + Math.floor(i / perRow) * (cell + 2);
      const blocked = riteBlocked(g, r.id);
      panel(app, this.c, cx, cy, cell, cell, this.rite.id === r.id ? PAL.yellow : blocked ? PAL.robeD : PAL.white);
      img(app, this.c, cx + 5, cy + 5, `rite_${r.id}`).setAlpha(blocked ? 0.45 : 1);
      hit(app, this.c, cx, cy, cell, cell, () => (blocked ? app.float(t(blocked), undefined, 'irony') : this.chooseRite(r.id))).setName(`rite_${r.id}`);
    });
    y += Math.ceil(rites.length / perRow) * (cell + 2) + 1;
    const def = riteDef(this.rite.id);
    const target = this.rite.entity ? t(`entity.${this.rite.entity}.name`) : this.rite.crop ? t(`item.${this.rite.crop}.name`) : '';
    const line = `${t(`rite.${def.id}.name`)}${target ? ` - ${target}` : ''}: ${t(`rite.${def.id}.desc`)}`;
    txt(app, this.c, x + 1, y, line, { width: w - 2, maxLines: 3, color: app.L.dock ? 'ink' : 'pale' });
    y += Math.min(3, textHeight(line, w - 2) / 9) * 9 + 3;
    // daily rite
    updateDaily(run, this.today());
    const lv = dailyLevel(run, this.today());
    const roomLeft = this.app.L.dock ? this.app.L.dock.y + this.app.L.dock.h - y : Infinity;
    if (lv && roomLeft >= 24) {
      const banked = run.daily.bank;
      panel(app, this.c, x, y, w, 22, banked ? PAL.white : PAL.robe);
      img(app, this.c, x + 4, y + 5, 'rite_daily');
      const info = banked ? `${t('daily.title')}: ${t(ritualDef(lv).nameKey)} (${t('daily.banked', { n: banked })})` : t('daily.done');
      txt(app, this.c, x + 19, y + 3, info, { width: w - 19 - (banked ? 40 : 4), maxLines: 2 });
      if (banked) button(app, this.c, x + w - 38, y + 2, 36, 18, t('ritual.play'), () => this.begin(lv, { ...this.rite, daily: true }), { fill: PAL.acid, name: 'btn_daily' });
      y += 25;
    }
    return y - y0;
  }

  private buildList(): void {
    const app = this.app;
    const L = app.L;
    const B = L.body;
    const g = app.store.state;
    const run = g.run;
    const cardH = L.landscape ? 40 : 46;
    const all = DATA.rituals.filter((l) => l.purpose !== 'defense');
    let top = B.y + 2;
    if (!L.dock) txt(app, this.c, B.x + 5, top + 2, t('ritual.list.title'), { color: 'white' });
    top += 13;
    if (ritesOpen(run)) {
      if (L.dock) this.buildRitePanel(L.dock.x + 4, L.dock.y + 4, L.dock.w - 8);
      else top += this.buildRitePanel(B.x + 4, top, B.w - 8);
    }
    const pagerH = 20;
    const room = B.y + B.h - top;
    let perPage = Math.max(1, Math.floor(room / (cardH + 3)));
    if (perPage < all.length) perPage = Math.max(1, Math.floor((room - pagerH) / (cardH + 3)));
    const pages = Math.ceil(all.length / perPage);
    this.page = Math.max(0, Math.min(pages - 1, this.page));
    all.slice(this.page * perPage, (this.page + 1) * perPage).forEach((lv, i) => {
      const y = top + i * (cardH + 3);
      const unlocked = ritualUnlocked(run, lv.id);
      const stars = run.rituals[lv.id] ?? 0;
      panel(app, this.c, B.x + 4, y, B.w - 8, cardH, unlocked ? PAL.robeL : PAL.robeD);
      txt(app, this.c, B.x + 8, y + 3, unlocked ? t(lv.nameKey) : t('ritual.locked'), { color: unlocked ? 'ink' : 'pale', width: B.w - 60, maxLines: 1 });
      for (let s = 0; s < 3; s++) img(app, this.c, B.x + B.w - 36 + s * 9, y + 3, s < stars ? 'ic_star' : 'ic_star_off');
      if (!unlocked) {
        img(app, this.c, B.x + 8, y + 15, 'ic_lock');
        if (lv.unlock?.level) txt(app, this.c, B.x + 19, y + 15, t('ritual.unlock_level', { n: lv.unlock.level }), { color: 'pale' });
        return;
      }
      const purpose = lv.purpose === 'summon' && !run.met.includes(DATA.entities.find((e) => e.summonRitual === lv.id)?.id ?? '') ? t('ritual.purpose.summon') : ritesOpen(run) ? t(`rite.${this.rite.id}.name`) : t(`ritual.purpose.${lv.purpose}`);
      txt(app, this.c, B.x + 8, y + 13, purpose, { color: 'irony', width: B.w - 62, maxLines: 1 });
      txt(app, this.c, B.x + 8, y + cardH - 11, t('ritual.moves_par', { moves: lv.moves, par: lv.par }), { color: 'dim' });
      button(app, this.c, B.x + B.w - 48, y + cardH - 22, 40, 19, stars ? t('ritual.replay') : t('ritual.play'), () => this.begin(lv.id, this.rite), { name: `btn_play_${lv.id}` });
    });
    if (pages > 1) {
      const py = B.y + B.h - pagerH + 1;
      button(app, this.c, B.x + 4, py, 30, 17, '<', () => { this.page--; this.rebuild(); }, { disabled: this.page === 0, fill: PAL.blue, name: 'btn_page_prev' });
      txt(app, this.c, B.x + Math.floor(B.w / 2), py + 4, t('ritual.page', { n: this.page + 1, max: pages }), { align: 'center', color: 'white' });
      button(app, this.c, B.x + B.w - 34, py, 30, 17, '>', () => { this.page++; this.rebuild(); }, { disabled: this.page >= pages - 1, fill: PAL.blue, name: 'btn_page_next' });
    }
    if (L.dock && !ritesOpen(run)) {
      const D = L.dock;
      txt(app, this.c, D.x + 5, D.y + 4, t('ritual.dock.title'), { color: 'irony' });
      txt(app, this.c, D.x + 5, D.y + 16, t('ritual.dock.help'), { width: D.w - 9 });
    }
  }

  // ---------- board ----------

  private buildPlay(g: Match3State): void {
    const app = this.app;
    const L = app.L;
    const B = L.body;
    const bw = g.level.width * T;
    const bh = g.level.height * T;
    let P: { x: number; y: number; w: number; h: number };
    if (L.dock) {
      this.origin = { x: B.x + Math.floor((B.w - bw) / 2), y: L.banner.y + Math.max(0, Math.floor((B.h + L.banner.h - bh) / 2)) };
      P = { x: L.dock.x + 3, y: L.dock.y + 3, w: L.dock.w - 5, h: L.dock.h - 6 };
      // the board needs the full height in landscape, so it covers the advisor strip
      rect(app, this.c, B.x, L.banner.y, B.w, L.banner.h, PAL.night);
    } else {
      const infoH = 44;
      const free = B.h - infoH - bh;
      this.origin = { x: B.x + Math.floor((B.w - bw) / 2), y: B.y + infoH + Math.max(2, Math.floor(free / 2)) };
      P = { x: B.x + 3, y: B.y + 3, w: B.w - 6, h: infoH - 4 };
    }
    rect(app, this.c, this.origin.x - 2, this.origin.y - 2, bw + 4, bh + 4, PAL.ink);
    for (let y = 0; y < g.level.height; y++) for (let x = 0; x < g.level.width; x++) {
      this.c.add(app.add.image(this.origin.x + x * T, this.origin.y + y * T, ATLAS, (x + y) % 2 ? 'cell_a' : 'cell_b').setOrigin(0, 0));
    }
    this.board = app.add.container(this.origin.x, this.origin.y);
    this.c.add(this.board);
    // curtain: new tiles wait above the board, so hide that strip (drawn over the board, under the info panel)
    rect(app, this.c, this.origin.x - 2, this.origin.y - bh - 40, bw + 4, bh + 38, PAL.night);
    rect(app, this.c, this.origin.x - 2, this.origin.y - 2, bw + 4, 2, PAL.ink);

    // info panel
    panel(app, this.c, P.x, P.y, P.w, P.h, PAL.robeL);
    const goals = goalProgress(g);
    if (L.dock) {
      txt(app, this.c, P.x + 4, P.y + 3, t(g.level.nameKey), { width: P.w - 8, maxLines: 2, color: 'irony' });
      let y = P.y + 24;
      goals.forEach((gp) => { this.goalRow(gp.goal, P.x + 4, y); y += 22; });
      this.info.moves = txt(app, this.c, P.x + 4, y + 2, '');
      this.info.score = txt(app, this.c, P.x + 4, y + 12, '');
      this.info.focus = txt(app, this.c, P.x + 4, y + 24, '', { color: 'gain' });
      button(app, this.c, P.x + 3, P.y + P.h - 21, P.w - 6, 18, t('ritual.quit'), () => this.quit(), { fill: PAL.pink, name: 'btn_quit' });
    } else {
      goals.forEach((gp, i) => this.goalRow(gp.goal, P.x + 4 + i * 50, P.y + 3));
      this.info.moves = txt(app, this.c, P.x + 4, P.y + 26, '');
      this.info.score = txt(app, this.c, P.x + 62, P.y + 26, '');
      this.info.focus = txt(app, this.c, P.x + P.w - 40, P.y + 26, '', { align: 'right', color: 'gain' });
      button(app, this.c, P.x + P.w - 36, P.y + 3, 33, 18, t('ritual.quit'), () => this.quit(), { fill: PAL.pink, name: 'btn_quit' });
    }
    // effects sit above the board and the info panel, in board-local coordinates
    this.fx = app.add.container(this.origin.x, this.origin.y);
    this.c.add(this.fx);

    this.sync(g.cells);
    this.syncDisp(g);
    this.disp.shown = this.disp.score;
    this.refreshInfo();
    if (g.status !== 'playing') { this.end(); return; }
    if (this.pendingIntro) {
      this.pendingIntro = false;
      this.playIntro();
    }
  }

  /** The tile type the current rite converts (-1 = none). */
  private focusTile(): number {
    const r = this.app.store.state.run.activeRite;
    return r ? riteDef(r.id).focus : -1;
  }

  private goalRow(goal: Goal, x: number, y: number): void {
    const office = this.game?.level.skin === 'office';
    const key = goal.kind === 'collect' ? (office ? `tile_office_${goal.tile}` : `tile_${goal.tile}`) : goal.kind === 'clearWebs' ? (office ? 'web_office' : 'web') : goal.kind === 'dropRelics' ? 'relic' : 'ic_star';
    if (goal.kind === 'clearWebs') rect(this.app, this.c, x, y, 20, 20, PAL.night2);
    img(this.app, this.c, x, y, key);
    this.info.goalAt.push({ x: x + 10, y: y + 10 });
    this.info.goals.push(txt(this.app, this.c, x + 22, y + 6, ''));
  }

  private countWebs(cells: Board): number {
    let n = 0;
    for (const row of cells) for (const c of row) if (c) n += c.web;
    return n;
  }

  /** Make the HUD numbers match the engine exactly. */
  private syncDisp(g: Match3State): void {
    this.disp.score = g.score;
    this.disp.moves = g.movesLeft;
    this.disp.collected = [...g.collected];
    this.disp.relics = g.relicsDropped;
    this.disp.webs = this.countWebs(g.cells);
  }

  private refreshInfo(): void {
    const g = this.game;
    if (!g) return;
    const d = this.disp;
    const low = !g.relaxed && d.moves <= 3;
    this.info.moves?.setFont(fontKey(low ? 'loss' : 'ink')).setText(g.relaxed ? t('ritual.moves_free') : t('ritual.moves', { n: d.moves }));
    this.info.score?.setText(t('ritual.score', { n: Math.round(d.shown) }));
    const ft = this.focusTile();
    this.info.focus?.setText(ft >= 0 ? t('ritual.focus.short', { tile: t(`tile.${ft}`), n: d.collected[ft] ?? 0 }) : '');
    g.level.goals.forEach((goal, i) => {
      let cur = 0;
      let target = 0;
      if (goal.kind === 'collect') { cur = d.collected[goal.tile] ?? 0; target = goal.count; }
      else if (goal.kind === 'dropRelics') { cur = d.relics; target = goal.count; }
      else if (goal.kind === 'score') { cur = d.score; target = goal.target; }
      const done = goal.kind === 'clearWebs' ? d.webs === 0 : cur >= target;
      this.info.goals[i]?.setFont(fontKey(done ? 'gain' : 'ink')).setText(done ? t('ritual.goal_done') : goal.kind === 'clearWebs' ? String(d.webs) : `${Math.min(cur, target)}/${target}`);
    });
  }

  /** Small pop on a HUD text to draw the eye when its number changes. */
  private bump(obj?: Phaser.GameObjects.BitmapText): void {
    if (!obj || this.reduced) return;
    this.app.tweens.killTweensOf(obj);
    obj.setScale(1);
    this.app.tweens.add({ targets: obj, scale: 1.35, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
  }

  private makeTile(cell: Cell, x: number, y: number): C {
    const c = this.app.add.container(x * T + T / 2, y * T + T / 2);
    const office = this.game?.level.skin === 'office';
    if (!cell.relic && cell.type === this.focusTile()) c.add(this.app.add.rectangle(0, 0, T - 2, T - 2, parseInt(PAL.acid.slice(1), 16), 0.22));
    c.add(this.app.add.image(0, 0, ATLAS, cell.relic ? 'relic' : office ? `tile_office_${cell.type}` : `tile_${cell.type}`));
    if (cell.special !== 'none') {
      const s = this.app.add.image(0, 0, ATLAS, `sp_${cell.special}`);
      c.add(s);
      // specials breathe so they read as "loaded"
      if (!this.reduced) this.app.tweens.add({ targets: s, alpha: 0.55, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    if (cell.web > 0) c.add(this.app.add.image(0, 0, ATLAS, office ? 'web_office' : 'web').setAlpha(cell.web > 1 ? 1 : 0.85));
    this.board!.add(c);
    return c;
  }

  /** Hard-sync sprites to a board. */
  private sync(cells: Board): void {
    if (!this.board) return;
    for (const sp of this.sprites.values()) { this.app.tweens.killTweensOf(sp); this.app.tweens.killTweensOf(sp.list); }
    this.board.removeAll(true);
    this.sprites.clear();
    this.selectFx = null;
    this.hintFx = [];
    this.hintTiles = [];
    for (let y = 0; y < cells.length; y++) for (let x = 0; x < cells[y].length; x++) {
      const cell = cells[y][x];
      if (cell) this.sprites.set(cell.id, this.makeTile(cell, x, y));
    }
    this.lastCells = cells;
    if (this.selected) this.showSelect();
  }

  // ---------- effects ----------

  private burst(x: number, y: number, key: string, n: number, spread = 16): void {
    if (this.reduced || !this.fx) return;
    for (let i = 0; i < n && this.live < FEEL.maxParticles; i++) {
      const p = this.pool.pop() ?? this.app.add.image(0, 0, ATLAS, key);
      if (!p.parentContainer) this.fx.add(p);
      p.setFrame(key).setPosition(x, y).setAlpha(1).setScale(1).setVisible(true);
      this.live++;
      const ang = Math.random() * Math.PI * 2;
      const dist = spread * (0.5 + Math.random() * 0.7);
      this.app.tweens.add({
        targets: p, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist + 6, alpha: 0, duration: 260 + Math.random() * 160, ease: 'Quad.easeOut',
        onComplete: () => { p.setVisible(false); this.pool.push(p); this.live--; },
      });
    }
  }

  private flash(x: number, y: number, w: number, h: number, color: string, ms = 220): void {
    if (!this.fx) return;
    const r = this.app.add.rectangle(x, y, w, h, parseInt(color.slice(1), 16), this.reduced ? 0.5 : 0.9).setOrigin(0, 0);
    this.fx.add(r);
    this.app.tweens.add({ targets: r, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  }

  private shake(strength: number): void {
    if (this.reduced) return;
    this.app.cameras.main.shake(140, strength);
  }

  /** Big word over the board: combo callouts and "Ritual Complete!". */
  private callout(text: string, fill: string, hold = FEEL.callout): void {
    if (!this.fx || !this.game) return;
    const g = this.game;
    const c = this.app.add.container((g.level.width * T) / 2, (g.level.height * T) / 2);
    this.fx.add(c);
    const label = txt(this.app, c, 0, -4, text, { align: 'center', color: 'ink' });
    const w = Math.ceil(label.width) + 10;
    c.removeAll(false);
    c.add(this.app.add.rectangle(0, 0, w + 2, 15, parseInt(PAL.ink.slice(1), 16)));
    c.add(this.app.add.rectangle(0, 0, w, 13, parseInt(fill.slice(1), 16)));
    c.add(label);
    if (this.reduced) c.setScale(2);
    else {
      c.setScale(0.4);
      this.app.tweens.add({ targets: c, scale: 2, duration: 200, ease: 'Back.easeOut' });
      this.burst(c.x, c.y, 'spark_gold', 10, 44);
    }
    this.app.tweens.add({ targets: c, alpha: 0, y: c.y - (this.reduced ? 0 : 10), delay: hold - 220, duration: 220, onComplete: () => c.destroy() });
  }

  private scorePop(x: number, y: number, amount: number, combo: number): void {
    if (!this.fx) return;
    const label = txt(this.app, this.fx, x, y, `+${amount}`, { align: 'center', color: combo >= 3 ? 'glow' : 'white' });
    if (combo >= 2 && !this.reduced) label.setScale(2);
    this.app.tweens.add({ targets: label, y: y - (this.reduced ? 0 : 14), alpha: 0, duration: 700, ease: 'Quad.easeIn', onComplete: () => label.destroy() });
  }

  /** Board intro: tiles rain in column by column. */
  private playIntro(): void {
    if (this.reduced || !this.board) return;
    this.busy = true;
    sfx.intro();
    const h = (this.game?.level.height ?? 8) * T;
    for (const sp of this.sprites.values()) {
      const ty = sp.y;
      const col = Math.floor(sp.x / T);
      sp.y = ty - h - 20;
      this.app.tweens.add({ targets: sp, y: ty, duration: 280, delay: col * 28 + ((h - ty) / T) * 6, ease: 'Quad.easeIn', onComplete: () => this.squash(sp) });
    }
    this.later(FEEL.intro, () => { this.busy = false; if (this.game) this.sync(this.game.cells); });
  }

  private squash(sp: C): void {
    if (this.reduced || !sp.active) return;
    sp.setScale(1.14, 0.84);
    this.app.tweens.add({ targets: sp, scaleX: 1, scaleY: 1, duration: FEEL.squash, ease: 'Back.easeOut' });
  }

  // ---------- snapshot playback ----------

  private playNext(): void {
    const g = this.game;
    const snap = this.queue.shift();
    if (!snap || !this.board || !g) {
      this.finishQueue();
      return;
    }
    if (snap.kind === 'bonus') { this.playBonus(snap); return; }

    const k = this.reduced ? 0.6 : 1;
    const prev = new Map<number, Cell>();
    if (this.lastCells) for (const row of this.lastCells) for (const c of row) if (c) prev.set(c.id, c);
    const next = new Map<number, { x: number; y: number; cell: Cell }>();
    for (let y = 0; y < snap.cells.length; y++) for (let x = 0; x < snap.cells[y].length; x++) {
      const cell = snap.cells[y][x];
      if (cell) next.set(cell.id, { x, y, cell });
    }
    let dur = (snap.kind === 'clear' ? FEEL.clear : snap.kind === 'reshuffle' ? FEEL.reshuffle : FEEL.swap) * k;

    // --- tiles that left the board
    for (const [id, sp] of this.sprites) {
      if (next.has(id)) continue;
      this.sprites.delete(id);
      this.app.tweens.killTweensOf(sp.list);
      if (this.reduced) this.app.tweens.add({ targets: sp, alpha: 0, duration: dur, onComplete: () => sp.destroy() });
      else this.app.tweens.add({ targets: sp, scale: { from: 1.3, to: 0 }, alpha: { from: 1, to: 0.2 }, duration: dur, ease: 'Back.easeIn', onComplete: () => sp.destroy() });
    }

    // --- tiles that moved or arrived
    const spawnCount: Record<number, number> = {};
    let maxFall = 0;
    for (let y = snap.cells.length - 1; y >= 0; y--) for (let x = 0; x < snap.cells[y].length; x++) {
      const cell = snap.cells[y][x];
      if (!cell) continue;
      let sp = this.sprites.get(cell.id);
      if (!sp) {
        spawnCount[x] = (spawnCount[x] ?? 0) + 1;
        sp = this.makeTile(cell, x, -spawnCount[x]);
        this.sprites.set(cell.id, sp);
      }
      const tx = x * T + T / 2;
      const ty = y * T + T / 2;
      if (sp.x === tx && sp.y === ty) continue;
      if (snap.kind === 'fall') {
        const rows = Math.abs(ty - sp.y) / T;
        const d = (FEEL.fallBase + FEEL.fallPerRow * rows) * k;
        maxFall = Math.max(maxFall, d);
        const target = sp;
        this.app.tweens.add({ targets: sp, x: tx, y: ty, duration: d, ease: 'Quad.easeIn', onComplete: () => this.squash(target) });
      } else {
        this.app.tweens.add({ targets: sp, x: tx, y: ty, duration: dur, ease: snap.kind === 'reshuffle' ? 'Cubic.easeInOut' : 'Back.easeOut' });
      }
    }

    // --- per-kind feedback
    if (snap.kind === 'swap') sfx.swap();
    else if (snap.kind === 'swapBack') { sfx.invalid(); sfx.buzz(12); }
    else if (snap.kind === 'reshuffle') { sfx.reshuffle(); this.callout(t('ritual.reshuffle'), PAL.blue, 700); dur = Math.max(dur, 700); }
    else if (snap.kind === 'fall') {
      dur = maxFall + (this.reduced ? 20 : FEEL.squash);
      if (maxFall > 0) this.later(maxFall, () => sfx.land());
    } else if (snap.kind === 'clear') {
      this.clearFeedback(snap, prev, next);
    }

    this.later(dur + 15, () => {
      this.sync(snap.cells);
      this.playNext();
    });
  }

  private clearFeedback(snap: Snapshot, prev: Map<number, Cell>, next: Map<number, { x: number; y: number; cell: Cell }>): void {
    const g = this.game!;
    const bw = g.level.width * T;
    const bh = g.level.height * T;
    let biggest: 'none' | 'line' | 'bomb' | 'sigil' = 'none';

    // special tiles that went off in this step
    for (const cl of snap.cleared) {
      const was = prev.get(cl.id);
      if (!was || was.special === 'none') continue;
      const cx = cl.x * T;
      const cy = cl.y * T;
      if (was.special === 'lineH') { this.flash(0, cy + 5, bw, 10, PAL.white); if (biggest === 'none') biggest = 'line'; }
      else if (was.special === 'lineV') { this.flash(cx + 5, 0, 10, bh, PAL.white); if (biggest === 'none') biggest = 'line'; }
      else if (was.special === 'bomb') { this.flash(cx - T, cy - T, T * 3, T * 3, PAL.yellow, 280); this.burst(cx + 10, cy + 10, 'spark_gold', 12, 34); if (biggest !== 'sigil') biggest = 'bomb'; }
      else if (was.special === 'sigil') { this.flash(0, 0, bw, bh, PAL.acid, 360); biggest = 'sigil'; }
    }
    if (biggest === 'line') { sfx.line(); this.shake(0.006); sfx.buzz(20); }
    else if (biggest === 'bomb') { sfx.bomb(); this.shake(0.012); sfx.buzz(35); }
    else if (biggest === 'sigil') { sfx.sigil(); this.shake(0.016); sfx.buzz(50); }
    else if (snap.cleared.length) { sfx.match(Math.max(1, snap.combo)); sfx.buzz(8); }

    // particles, and collected tiles flying to their goal counter
    const flyers: Record<number, number> = {};
    let sx = 0;
    let sy = 0;
    for (const cl of snap.cleared) {
      const px = cl.x * T + T / 2;
      const py = cl.y * T + T / 2;
      sx += px; sy += py;
      this.flash(cl.x * T + 1, cl.y * T + 1, T - 2, T - 2, PAL.white, 150);
      this.burst(px, py, cl.type >= 0 ? `p_${cl.type}` : 'spark_gold', FEEL.particlesPerTile);
      const gi = g.level.goals.findIndex((goal) => (goal.kind === 'collect' && goal.tile === cl.type) || (goal.kind === 'dropRelics' && cl.type === -1));
      if (gi < 0) { if (cl.type >= 0) this.disp.collected[cl.type]++; continue; }
      flyers[gi] = (flyers[gi] ?? 0) + 1;
      const n = flyers[gi];
      const at = this.info.goalAt[gi];
      const arrive = () => {
        if (cl.type >= 0) this.disp.collected[cl.type]++; else this.disp.relics++;
        this.refreshInfo();
        this.bump(this.info.goals[gi]);
        sfx.collect();
      };
      if (this.reduced || !this.fx || !at || n > 8) { this.later(this.reduced ? 0 : FEEL.flyToGoal, arrive); continue; }
      const f = this.app.add.image(px, py, ATLAS, cl.type >= 0 ? `tile_${cl.type}` : 'relic');
      this.fx.add(f);
      this.app.tweens.add({
        targets: f, x: at.x - this.origin.x, y: at.y - this.origin.y, scale: 0.6, duration: FEEL.flyToGoal, delay: (n - 1) * 35, ease: 'Cubic.easeIn',
        onComplete: () => { f.destroy(); if (this.visible && this.board) arrive(); },
      });
    }
    this.disp.webs = this.countWebs(snap.cells);

    // newly forged specials pop and sparkle
    let forged = false;
    for (const { x, y, cell } of next.values()) {
      const was = prev.get(cell.id);
      if (cell.special === 'none' || !was || was.special !== 'none') continue;
      forged = true;
      this.burst(x * T + 10, y * T + 10, 'spark', 8, 20);
      const sp = this.sprites.get(cell.id);
      if (sp && !this.reduced) this.later(FEEL.clear, () => { const now = this.sprites.get(cell.id); if (now) { now.setScale(1.6); this.app.tweens.add({ targets: now, scale: 1, duration: 220, ease: 'Back.easeOut' }); } });
    }
    if (forged) this.later(90, () => sfx.create());

    // score
    if (snap.scoreDelta > 0) {
      this.disp.score += snap.scoreDelta;
      const n = Math.max(1, snap.cleared.length);
      this.scorePop(snap.cleared.length ? sx / n : bw / 2, snap.cleared.length ? sy / n - 6 : bh / 2, snap.scoreDelta, snap.combo);
      this.bump(this.info.score);
    }
    // cascade callouts: the chain is the reward, so name it
    if (snap.combo >= 2) {
      const tier = Math.min(5, snap.combo);
      this.callout(t(`ritual.combo.${tier}`), [PAL.yellow, PAL.yellow, PAL.pink, PAL.purple, PAL.acid][tier - 1]);
      this.later(60, () => sfx.combo(snap.combo));
      if (snap.combo >= 3) this.shake(0.004 * snap.combo);
    }
    this.refreshInfo();
  }

  /** Win: leftover moves count down into score, one chime each. */
  private playBonus(snap: Snapshot): void {
    const g = this.game!;
    this.celebrated = true;
    this.callout(t('ritual.complete'), PAL.acid, FEEL.celebrate);
    sfx.win();
    sfx.buzz(40);
    const n = Math.max(1, Math.round(snap.scoreDelta / MOVE_BONUS));
    const step = Math.min(FEEL.bonusTick, FEEL.bonusMaxTotal / n);
    const ids = [...this.sprites.keys()];
    for (let i = 0; i < n; i++) {
      this.later(FEEL.celebrate * 0.6 + i * step, () => {
        this.disp.moves = Math.max(0, this.disp.moves - 1);
        this.disp.score += MOVE_BONUS;
        sfx.tick(i);
        this.bump(this.info.moves);
        const sp = this.sprites.get(ids[Math.floor(Math.random() * ids.length)]);
        if (sp) {
          this.burst(sp.x, sp.y, 'spark_gold', 4, 14);
          if (!this.reduced) this.app.tweens.add({ targets: sp, y: sp.y - 4, duration: 70, yoyo: true });
        }
        this.refreshInfo();
      });
    }
    this.later(FEEL.celebrate * 0.6 + n * step + 450, () => this.playNext());
  }

  private finishQueue(): void {
    const g = this.game;
    this.busy = false;
    if (!g) return;
    this.sync(g.cells);
    this.syncDisp(g);
    this.refreshInfo();
    if (g.status === 'playing') return;
    if (g.status === 'won' && !this.celebrated) {
      this.celebrated = true;
      this.busy = true;
      this.callout(t('ritual.complete'), PAL.acid, FEEL.celebrate);
      sfx.win();
      this.later(FEEL.celebrate, () => this.end());
    } else if (g.status === 'lost') {
      this.busy = true;
      sfx.lose();
      for (const sp of this.sprites.values()) this.app.tweens.add({ targets: sp, alpha: 0.45, duration: 300 });
      this.later(550, () => this.end());
    } else this.end();
  }

  private attempt(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const g = this.game;
    if (!g || this.busy || g.status !== 'playing') return;
    this.selected = null;
    this.clearFx();
    const res = trySwap(g, a, b);
    this.idle = 0;
    if (res.steps.length === 0) {
      // not adjacent, or stuck under a web: a little "no" shake
      const sp = this.lastCells?.[a.y]?.[a.x] ? this.sprites.get(this.lastCells[a.y][a.x]!.id) : undefined;
      sfx.invalid();
      if (sp && !this.reduced) this.app.tweens.add({ targets: sp, x: sp.x + 2, duration: 40, yoyo: true, repeat: 2 });
      return;
    }
    if (res.valid && !g.relaxed) { this.disp.moves = Math.max(0, this.disp.moves - 1); this.refreshInfo(); this.bump(this.info.moves); }
    this.busy = true;
    this.queue = res.steps;
    this.playNext();
  }

  private end(): void {
    if (this.ending) return;
    this.ending = true;
    const app = this.app;
    const st = this.game!;
    const won = st.status === 'won';
    const level = st.level;
    const score = st.score;
    const rw = app.store.act((g, emit) => finishRitual(g, emit));
    this.ending = false;
    this.rebuild();
    if (rw.rite?.id === 'look_busy' && rw.rite.visit) {
      const v = rw.rite.visit;
      dialog(app, { id: 'inspection_result', title: t(level.nameKey), body: won ? t('inspection.result.win', { stars: rw.stars, summary: summaryText(v) }) + '\n' + t('rite.result.look_busy', { stars: rw.stars, pct: rw.rite.cutPct ?? 0 }) + (rw.omens ? '\n' + t('ritual.won.omens', { n: rw.omens + rw.firstThree }) : '') : t('inspection.result.loss', { summary: summaryText(v) }), sprite: 'advisor', buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
    } else if (won) this.showReward(rw, level.nameKey, score);
    else dialog(app, { id: 'ritual_lost', title: t('ritual.lost.title'), body: t('ritual.lost.body'), sprite: 'advisor', buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
  }

  /** Result card: stars land one at a time, each with its own chime. */
  private showReward(rw: RitualReward, nameKey: string, score: number): void {
    const app = this.app;
    const lines = [t('ritual.won.score', { n: score })];
    if (rw.devotion) lines.push(t('ritual.won.devotion', { n: rw.devotion }));
    if (rw.flockPct) lines.push(t('ritual.won.flock', { n: rw.flockPct }));
    if (rw.boonPct) lines.push(t('ritual.won.boon', { n: rw.boonPct }));
    if (rw.donations) lines.push(t('ritual.won.donations', { n: rw.donations }));
    if (rw.basil) lines.push(t('ritual.won.basil', { n: rw.basil }));
    if (rw.drafts) lines.push(t('ritual.won.drafts', { n: rw.drafts }));
    if (rw.favor) lines.push(t('ritual.won.favor', { n: rw.favor }));
    if (!rw.firstTime) lines.push(t('ritual.won.replay'));
    if (rw.rite && rw.rite.id !== 'look_busy') lines.push(riteLine(rw));
    if (rw.omens) lines.push(t('ritual.won.omens', { n: rw.omens }));
    if (rw.firstThree) lines.push(t('ritual.won.omens_first3', { n: rw.firstThree }));
    if (rw.daily) lines.push(t('ritual.won.daily', { n: rw.daily }));
    const reduced = this.reduced;
    let elapsed = 0;
    let shown = reduced ? rw.stars : 0;
    let stars: Phaser.GameObjects.Image[] = [];
    const after = () => {
      if (rw.entity && rw.firstTime) {
        dialog(app, {
          id: 'entity_intro', title: t(`entity.${rw.entity}.name`), body: t(`entity.${rw.entity}.intro`), sprite: rw.entity,
          buttons: [{ label: t(`entity.${rw.entity}.intro.ok`), name: 'btn_ok', onClick: () => { (app.screens.orders as OrdersScreen).selected = rw.entity; app.goto('orders'); } }],
        });
      }
    };
    app.modals.open({
      id: 'ritual_won',
      onClose: after,
      build: (c, _a, close) => {
        const w = Math.min(modalWidth(app), 170);
        const r = frame(app, c, w, 16 + 30 + textHeight(lines.join('\n'), w - 10) + 4 + 18 + 6, t(nameKey));
        stars = [];
        for (let i = 0; i < 3; i++) {
          const s = app.add.image(r.x + Math.floor(r.w / 2) + (i - 1) * 26, r.y + 13 + (i === 1 ? -2 : 0), ATLAS, i < shown ? 'ic_star' : 'ic_star_off').setScale(3);
          c.add(s);
          stars.push(s);
        }
        txt(app, c, r.x + Math.floor(r.w / 2), r.y + 30, lines.join('\n'), { align: 'center', width: r.w });
        button(app, c, r.x, r.y + r.h - 18, r.w, 18, t('common.ok'), close, { name: 'btn_ok', fill: PAL.acid });
      },
      update: (dt) => {
        if (shown >= rw.stars) return;
        elapsed += dt;
        if (elapsed < 0.35 + shown * 0.38) return;
        const s = stars[shown];
        sfx.star(shown);
        sfx.buzz(15);
        shown++;
        if (s && s.active) {
          s.setFrame('ic_star').setScale(6);
          app.tweens.add({ targets: s, scale: 3, duration: 240, ease: 'Back.easeOut' });
        }
      },
    });
  }

  private quit(): void {
    const app = this.app;
    dialog(app, {
      id: 'ritual_quit', title: t('ritual.quit.title'), body: t('ritual.quit.body'),
      buttons: [
        { label: t('ritual.quit.yes'), fill: PAL.pink, name: 'btn_quit_yes', onClick: () => { app.store.act((g, emit) => finishRitual(g, emit)); this.rebuild(); } },
        { label: t('ritual.quit.no'), name: 'btn_quit_no' },
      ],
    });
  }

  // ---------- input ----------

  private cellAt(px: number, py: number): { x: number; y: number } | null {
    const g = this.game;
    if (!g) return null;
    const r = { x: this.origin.x, y: this.origin.y, w: g.level.width * T, h: g.level.height * T };
    if (!inRect(r, px, py)) return null;
    return { x: Math.floor((px - r.x) / T), y: Math.floor((py - r.y) / T) };
  }

  override pointerDown(p: Phaser.Input.Pointer): void {
    this.idle = 0;
    this.clearHint();
    if (this.busy || !this.game) return;
    const cell = this.cellAt(p.x, p.y);
    this.press = cell ? { ...cell, px: p.x, py: p.y } : null;
  }
  override pointerMove(p: Phaser.Input.Pointer): void {
    const s = this.press;
    if (!s || !p.isDown) return;
    const dx = p.x - s.px;
    const dy = p.y - s.py;
    if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
    this.press = null;
    const to = Math.abs(dx) > Math.abs(dy) ? { x: s.x + Math.sign(dx), y: s.y } : { x: s.x, y: s.y + Math.sign(dy) };
    this.attempt({ x: s.x, y: s.y }, to);
  }
  override pointerUp(_p: Phaser.Input.Pointer): void {
    const s = this.press;
    this.press = null;
    if (!s || this.busy) return;
    const sel = this.selected;
    if (sel && Math.abs(sel.x - s.x) + Math.abs(sel.y - s.y) === 1) {
      this.attempt(sel, { x: s.x, y: s.y });
    } else if (sel && sel.x === s.x && sel.y === s.y) {
      this.selected = null;
      this.clearFx();
    } else {
      this.selected = { x: s.x, y: s.y };
      sfx.tap();
      this.showSelect();
    }
  }

  private spriteAt(pos: { x: number; y: number }): C | undefined {
    const cell = this.lastCells?.[pos.y]?.[pos.x];
    return cell ? this.sprites.get(cell.id) : undefined;
  }

  private showSelect(): void {
    this.selectFx?.destroy();
    this.selectFx = null;
    if (!this.selected || !this.board) return;
    this.selectFx = this.app.add.image(this.selected.x * T, this.selected.y * T, ATLAS, 'select').setOrigin(0, 0);
    this.board.add(this.selectFx);
    const sp = this.spriteAt(this.selected);
    if (sp && !this.reduced) {
      this.board.bringToTop(sp);
      this.app.tweens.add({ targets: sp, scale: 1.15, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }
  private clearFx(): void {
    if (this.selectFx) {
      for (const sp of this.sprites.values()) if (sp.scale !== 1 && !this.busy) { this.app.tweens.killTweensOf(sp); sp.setScale(1); }
    }
    this.selectFx?.destroy();
    this.selectFx = null;
    this.clearHint();
  }
  private clearHint(): void {
    for (const sp of this.hintTiles) { this.app.tweens.killTweensOf(sp); if (sp.active) sp.setAngle(0); }
    for (const h of this.hintFx) h.destroy();
    this.hintTiles = [];
    this.hintFx = [];
  }

  override update(dt: number): void {
    const g = this.game;
    if (!this.visible || !g || !this.board) return;
    // score rolls up instead of jumping
    if (this.disp.shown !== this.disp.score) {
      const gap = this.disp.score - this.disp.shown;
      this.disp.shown = Math.abs(gap) < 2 ? this.disp.score : this.disp.shown + gap * Math.min(1, dt * 10);
      this.info.score?.setText(t('ritual.score', { n: Math.round(this.disp.shown) }));
    }
    if (this.busy) return;
    if (g.status !== 'playing') { this.finishQueue(); return; } // e.g. the debug "win" button
    this.idle += dt;
    if (this.idle > 5 && this.hintFx.length === 0 && this.hintTiles.length === 0) {
      const h = findHint(g);
      if (!h) return;
      for (const pos of [h.a, h.b]) {
        const sp = this.spriteAt(pos);
        if (!sp) continue;
        if (this.reduced) {
          const fx = this.app.add.image(pos.x * T, pos.y * T, ATLAS, 'select').setOrigin(0, 0);
          this.board.add(fx);
          this.hintFx.push(fx);
        } else {
          // the two tiles wiggle, pause, wiggle again
          this.hintTiles.push(sp);
          this.app.tweens.add({ targets: sp, angle: { from: -8, to: 8 }, duration: 110, yoyo: true, repeat: 3, loop: -1, loopDelay: 900, onLoop: () => sp.setAngle(0) });
        }
      }
    }
  }
}

/** One line describing what a rite converted. */
export function riteLine(rw: RitualReward): string {
  const r = rw.rite!;
  const n = r.tiles;
  switch (r.id) {
    case 'sermon': return t('rite.result.sermon', { n, doubt: r.amount });
    case 'recruit': return t('rite.result.recruit', { n, k: r.amount });
    case 'communion': return t('rite.result.communion', { n, favor: r.amount, name: r.entity ? t(`entity.${r.entity}.name`) : '' });
    case 'harvest': return t('rite.result.harvest', { n, k: r.amount, crop: r.crop ? t(`item.${r.crop}.name`) : '' });
    case 'vigil': return t('rite.result.vigil', { n, k: r.amount }) + (r.lost ? ` ${t('rite.result.vigil_lost', { k: r.lost })}` : '');
    default: return '';
  }
}

/** "120 Donations in fines, the Greenhouse sealed Pending Review for 3 min" etc. */
export function summaryText(s: VisitSummary): string {
  const parts: string[] = [];
  if (s.fine) parts.push(t('inspection.summary.fine', { n: s.fine }));
  if (s.sealed) parts.push(t('inspection.summary.seal', { building: t(`building.${s.sealed}.name`), m: s.sealMin }));
  if (s.away) parts.push(t('inspection.summary.away', { name: s.away, m: s.awayMin }));
  return parts.length ? parts.join(', ') : t('inspection.summary.none');
}
