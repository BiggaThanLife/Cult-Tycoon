// Rituals: level list and the match-3 board. All rules live in src/puzzle/match3.ts;
// this file only draws snapshots and turns swipes into swaps.
import type Phaser from 'phaser';
import type { App } from '../app';
import { ATLAS } from '../art/sprites';
import { hex, PAL } from '../art/palette';
import { DATA } from '../core/data';
import { finishRitual, ritualUnlocked, startRitual, type RitualReward } from '../core/game';
import { t } from '../core/text';
import { findHint, goalProgress, trySwap, type Cell, type Match3State, type Snapshot } from '../puzzle/match3';
import { button, img, inRect, panel, rect, txt, type C } from '../ui/kit';
import { dialog } from '../ui/modal';
import { Screen } from './screen';

const T = 20;

export class RitualScreen extends Screen {
  private board: C | null = null;
  private origin = { x: 0, y: 0 };
  private sprites = new Map<number, C>();
  private queue: Snapshot[] = [];
  private busy = false;
  private press: { x: number; y: number; px: number; py: number } | null = null;
  private selected: { x: number; y: number } | null = null;
  private selectFx: Phaser.GameObjects.Image | null = null;
  private hintFx: Phaser.GameObjects.Image[] = [];
  private idle = 0;
  private ending = false;
  private info: { moves?: Phaser.GameObjects.BitmapText; score?: Phaser.GameObjects.BitmapText; goals: Phaser.GameObjects.BitmapText[] } = { goals: [] };

  private get game(): Match3State | null { return this.app.store.state.run.activeRitual as Match3State | null; }
  private get reduced(): boolean { return this.app.store.state.meta.settings.reducedMotion; }

  rebuild(): void {
    this.app.tweens.killTweensOf([...this.sprites.values()]);
    this.clear();
    this.sprites.clear();
    this.queue = [];
    this.busy = false;
    this.board = null;
    this.selectFx = null;
    this.hintFx = [];
    this.info = { goals: [] };
    const L = this.app.L;
    rect(this.app, this.c, L.body.x, L.body.y, L.body.w, L.body.h, PAL.night);
    this.dockBg();
    if (this.game) this.buildPlay(this.game);
    else this.buildList();
  }

  override onChanged(): void {
    // don't tear the board down for unrelated state changes while playing
    if (this.game && this.board && !this.ending) { this.refreshInfo(); return; }
    this.rebuild();
  }

  override fullHeight(): boolean { return !!this.game && this.app.L.landscape; }

  // ---------- level list ----------

  private buildList(): void {
    const app = this.app;
    const L = app.L;
    const B = L.body;
    const run = app.store.state.run;
    const cardH = L.landscape ? 40 : 52;
    txt(app, this.c, B.x + 5, B.y + 4, t('ritual.list.title'), { color: 'white' });
    DATA.rituals.forEach((lv, i) => {
      const y = B.y + 15 + i * (cardH + 3);
      const unlocked = ritualUnlocked(run, lv.id);
      const stars = run.rituals[lv.id] ?? 0;
      panel(app, this.c, B.x + 4, y, B.w - 8, cardH, unlocked ? PAL.robeL : PAL.robeD);
      txt(app, this.c, B.x + 8, y + 3, unlocked ? t(lv.nameKey) : t('ritual.locked'), { color: unlocked ? 'ink' : 'pale', width: B.w - 60, maxLines: 1 });
      for (let s = 0; s < 3; s++) img(app, this.c, B.x + B.w - 36 + s * 9, y + 3, s < stars ? 'ic_star' : 'ic_star_off');
      if (!unlocked) { img(app, this.c, B.x + 8, y + 16, 'ic_lock'); return; }
      txt(app, this.c, B.x + 8, y + 13, t(`ritual.purpose.${lv.purpose}`), { color: 'irony', width: B.w - 62, maxLines: L.landscape ? 1 : 2 });
      txt(app, this.c, B.x + 8, y + cardH - 11, t('ritual.moves_par', { moves: lv.moves, par: lv.par }), { color: 'dim' });
      button(app, this.c, B.x + B.w - 48, y + cardH - 22, 40, 19, stars ? t('ritual.replay') : t('ritual.play'), () => {
        app.store.act((g) => startRitual(g, lv.id));
        this.rebuild();
      }, { name: `btn_play_${lv.id}` });
    });
    if (L.dock) {
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
    let panelRect: { x: number; y: number; w: number; h: number };
    if (L.dock) {
      this.origin = { x: B.x + Math.floor((B.w - bw) / 2), y: L.banner.y + Math.max(0, Math.floor((B.h + L.banner.h - bh) / 2)) };
      panelRect = { x: L.dock.x + 3, y: L.dock.y + 3, w: L.dock.w - 5, h: L.dock.h - 6 };
      // the board needs the full height in landscape, so it covers the advisor strip
      rect(app, this.c, B.x, L.banner.y, B.w, L.banner.h, PAL.night);
    } else {
      const infoH = 44;
      const free = B.h - infoH - bh;
      this.origin = { x: B.x + Math.floor((B.w - bw) / 2), y: B.y + infoH + Math.max(2, Math.floor(free / 2)) };
      panelRect = { x: B.x + 3, y: B.y + 3, w: B.w - 6, h: infoH - 4 };
    }
    rect(app, this.c, this.origin.x - 2, this.origin.y - 2, bw + 4, bh + 4, PAL.ink);
    for (let y = 0; y < g.level.height; y++) for (let x = 0; x < g.level.width; x++) {
      this.c.add(app.add.image(this.origin.x + x * T, this.origin.y + y * T, ATLAS, (x + y) % 2 ? 'cell_a' : 'cell_b').setOrigin(0, 0));
    }
    this.board = app.add.container(this.origin.x, this.origin.y);
    this.c.add(this.board);
    this.sync(g.cells);

    // info panel
    const P = panelRect;
    panel(app, this.c, P.x, P.y, P.w, P.h, PAL.robeL);
    const goals = goalProgress(g);
    if (L.dock) {
      txt(app, this.c, P.x + 4, P.y + 3, t(g.level.nameKey), { width: P.w - 8, maxLines: 2, color: 'irony' });
      let y = P.y + 24;
      goals.forEach((gp) => { this.goalRow(gp, P.x + 4, y); y += 22; });
      this.info.moves = txt(app, this.c, P.x + 4, y + 2, '');
      this.info.score = txt(app, this.c, P.x + 4, y + 12, '');
      button(app, this.c, P.x + 3, P.y + P.h - 21, P.w - 6, 18, t('ritual.quit'), () => this.quit(), { fill: PAL.pink, name: 'btn_quit' });
    } else {
      goals.forEach((gp, i) => this.goalRow(gp, P.x + 4 + i * 50, P.y + 3));
      this.info.moves = txt(app, this.c, P.x + 4, P.y + 26, '');
      this.info.score = txt(app, this.c, P.x + 62, P.y + 26, '');
      button(app, this.c, P.x + P.w - 36, P.y + 3, 33, 18, t('ritual.quit'), () => this.quit(), { fill: PAL.pink, name: 'btn_quit' });
    }
    this.refreshInfo();
    if (g.status !== 'playing') this.end();
  }

  private goalRow(gp: ReturnType<typeof goalProgress>[number], x: number, y: number): void {
    const frame = gp.goal.kind === 'collect' ? `tile_${gp.goal.tile}` : gp.goal.kind === 'clearWebs' ? 'web' : gp.goal.kind === 'dropRelics' ? 'relic' : 'ic_star';
    if (gp.goal.kind === 'clearWebs') rect(this.app, this.c, x, y, 20, 20, PAL.night2);
    img(this.app, this.c, x, y, frame);
    this.info.goals.push(txt(this.app, this.c, x + 22, y + 6, ''));
  }

  private refreshInfo(): void {
    const g = this.game;
    if (!g) return;
    this.info.moves?.setText(g.relaxed ? t('ritual.moves_free') : t('ritual.moves', { n: g.movesLeft }));
    this.info.score?.setText(t('ritual.score', { n: g.score }));
    goalProgress(g).forEach((gp, i) => {
      const left = Math.max(0, gp.target - gp.current);
      this.info.goals[i]?.setText(gp.done ? t('ritual.goal_done') : gp.goal.kind === 'clearWebs' ? String(left) : `${Math.min(gp.current, gp.target)}/${gp.target}`);
    });
  }

  private makeTile(cell: Cell, x: number, y: number): C {
    const c = this.app.add.container(x * T + T / 2, y * T + T / 2);
    c.add(this.app.add.image(0, 0, ATLAS, cell.relic ? 'relic' : `tile_${cell.type}`));
    if (cell.special !== 'none') c.add(this.app.add.image(0, 0, ATLAS, `sp_${cell.special}`));
    if (cell.web > 0) c.add(this.app.add.image(0, 0, ATLAS, 'web').setAlpha(cell.web > 1 ? 1 : 0.85));
    this.board!.add(c);
    return c;
  }

  /** Hard-sync sprites to a board. */
  private sync(cells: (Cell | null)[][]): void {
    if (!this.board) return;
    this.app.tweens.killTweensOf([...this.sprites.values()]);
    this.board.removeAll(true);
    this.sprites.clear();
    this.selectFx = null;
    this.hintFx = [];
    for (let y = 0; y < cells.length; y++) for (let x = 0; x < cells[y].length; x++) {
      const cell = cells[y][x];
      if (cell) this.sprites.set(cell.id, this.makeTile(cell, x, y));
    }
    if (this.selected) this.showSelect();
  }

  private playNext(): void {
    const g = this.game;
    const snap = this.queue.shift();
    if (!snap || !this.board || !g) {
      this.busy = false;
      if (g) {
        this.sync(g.cells);
        this.refreshInfo();
        if (g.status !== 'playing') this.end();
      }
      return;
    }
    const k = this.reduced ? 0.6 : 1;
    const dur = { swap: 110, swapBack: 110, clear: 140, fall: 170, reshuffle: 220 }[snap.kind] * k;
    const next = new Map<number, { x: number; y: number }>();
    for (let y = 0; y < snap.cells.length; y++) for (let x = 0; x < snap.cells[y].length; x++) {
      const cell = snap.cells[y][x];
      if (cell) next.set(cell.id, { x, y });
    }
    const spawnCount: Record<number, number> = {};
    // removed tiles
    for (const [id, sp] of this.sprites) {
      if (next.has(id)) continue;
      this.sprites.delete(id);
      this.app.tweens.add({ targets: sp, scale: this.reduced ? 1 : 0.2, alpha: 0, duration: dur, onComplete: () => sp.destroy() });
    }
    // moved and new tiles
    for (let y = snap.cells.length - 1; y >= 0; y--) for (let x = 0; x < snap.cells[y].length; x++) {
      const cell = snap.cells[y][x];
      if (!cell) continue;
      let sp = this.sprites.get(cell.id);
      if (!sp) {
        spawnCount[x] = (spawnCount[x] ?? 0) + 1;
        sp = this.makeTile(cell, x, -spawnCount[x]);
        sp.setAlpha(0);
        this.sprites.set(cell.id, sp);
      }
      const tx = x * T + T / 2;
      const ty = y * T + T / 2;
      if (sp.x !== tx || sp.y !== ty || sp.alpha < 1) this.app.tweens.add({ targets: sp, x: tx, y: ty, alpha: 1, duration: dur, ease: snap.kind === 'fall' ? 'Quad.easeIn' : 'Sine.easeInOut' });
    }
    if (snap.kind === 'clear' && snap.scoreDelta > 0) {
      const first = snap.cleared[0];
      const at = first ? { x: this.origin.x + first.x * T + 10, y: this.origin.y + first.y * T } : undefined;
      this.app.float(snap.combo > 1 ? t('float.combo', { n: snap.scoreDelta, combo: snap.combo }) : `+${snap.scoreDelta}`, at, 'gain');
    }
    this.app.time.delayedCall(dur + 15, () => {
      if (!this.board || !this.visible) return;
      this.sync(snap.cells);
      this.playNext();
    });
  }

  private attempt(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const g = this.game;
    if (!g || this.busy || g.status !== 'playing') return;
    this.selected = null;
    this.clearFx();
    const res = trySwap(g, a, b);
    this.idle = 0;
    if (res.steps.length === 0) return;
    this.busy = true;
    this.queue = res.steps;
    this.playNext();
  }

  private end(): void {
    if (this.ending) return;
    this.ending = true;
    const app = this.app;
    const won = this.game?.status === 'won';
    const level = this.game!.level;
    const rw = app.store.act((g, emit) => finishRitual(g, emit));
    this.ending = false;
    this.rebuild();
    if (won) this.showReward(rw, level.nameKey);
    else dialog(app, { id: 'ritual_lost', title: t('ritual.lost.title'), body: t('ritual.lost.body'), sprite: 'advisor', buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
  }

  private showReward(rw: RitualReward, nameKey: string): void {
    const app = this.app;
    const lines = [t('ritual.won.stars', { n: rw.stars })];
    if (rw.devotion) lines.push(t('ritual.won.devotion', { n: rw.devotion }));
    if (rw.donations) lines.push(t('ritual.won.donations', { n: rw.donations }));
    if (rw.basil) lines.push(t('ritual.won.basil', { n: rw.basil }));
    if (rw.drafts) lines.push(t('ritual.won.drafts', { n: rw.drafts }));
    if (rw.favor) lines.push(t('ritual.won.favor', { n: rw.favor }));
    if (!rw.firstTime) lines.push(t('ritual.won.replay'));
    dialog(app, {
      id: 'ritual_won', title: t(nameKey), body: lines.join('\n'), sprite: 'advisor',
      buttons: [{ label: t('common.ok'), name: 'btn_ok', onClick: () => {
        if (rw.entity && rw.firstTime) {
          dialog(app, {
            id: 'entity_intro', title: t(`entity.${rw.entity}.name`), body: t(`entity.${rw.entity}.intro`), sprite: rw.entity,
            buttons: [{ label: t(`entity.${rw.entity}.intro.ok`), name: 'btn_ok', onClick: () => app.goto('orders') }],
          });
        }
      } }],
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
      this.showSelect();
    }
  }

  private showSelect(): void {
    this.selectFx?.destroy();
    this.selectFx = null;
    if (!this.selected || !this.board) return;
    this.selectFx = this.app.add.image(this.selected.x * T, this.selected.y * T, ATLAS, 'select').setOrigin(0, 0);
    this.board.add(this.selectFx);
  }
  private clearFx(): void {
    this.selectFx?.destroy();
    this.selectFx = null;
    this.clearHint();
  }
  private clearHint(): void {
    for (const h of this.hintFx) { this.app.tweens.killTweensOf(h); h.destroy(); }
    this.hintFx = [];
  }

  override update(dt: number): void {
    const g = this.game;
    if (!this.visible || !g || !this.board || this.busy) return;
    if (g.status !== 'playing') { this.end(); return; } // e.g. the debug "win" button
    this.idle += dt;
    if (this.idle > 5 && this.hintFx.length === 0) {
      const h = findHint(g);
      if (!h) return;
      for (const pos of [h.a, h.b]) {
        const fx = this.app.add.image(pos.x * T, pos.y * T, ATLAS, 'select').setOrigin(0, 0).setTint(hex(PAL.white));
        this.board.add(fx);
        this.hintFx.push(fx);
        if (!this.reduced) this.app.tweens.add({ targets: fx, alpha: 0.2, duration: 450, yoyo: true, repeat: -1 });
      }
    }
  }
}
