// The Reliquary: merge grid. Rules live in src/puzzle/merge.ts.
import type Phaser from 'phaser';
import type { App } from '../app';
import { ATLAS } from '../art/sprites';
import { PAL } from '../art/palette';
import { DATA, mergeItemKey } from '../core/data';
import { mergeMove, mergeTap } from '../core/game';
import { t } from '../core/text';
import type { Loc, MergeCell } from '../puzzle/merge';
import { hit, img, inRect, panel, rect, txt } from '../ui/kit';
import { Screen } from './screen';

const CELL = 24;

export class ReliquaryScreen extends Screen {
  private grid = { x: 0, y: 0 };
  private shelf = { x: 0, y: 0, cols: 6 };
  private sprites = new Map<string, Phaser.GameObjects.Image>();
  private charge = new Map<number, { label: Phaser.GameObjects.BitmapText; last: string }>();
  private drag: { from: Loc; sprite: Phaser.GameObjects.Image; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
  private hint: Phaser.GameObjects.BitmapText | null = null;
  private showHelp = true;
  private chainIdx = 0;

  private frameFor(cell: MergeCell): string {
    return cell.kind === 'gen' ? `g_${cell.gen}` : `m_${mergeItemKey(cell.chain, cell.tier)}`;
  }

  private locPos(loc: Loc): { x: number; y: number } {
    const G = DATA.merge.grid;
    if (loc.area === 'grid') return { x: this.grid.x + (loc.i % G.w) * CELL, y: this.grid.y + Math.floor(loc.i / G.w) * CELL };
    return { x: this.shelf.x + (loc.i % this.shelf.cols) * CELL, y: this.shelf.y + Math.floor(loc.i / this.shelf.cols) * CELL };
  }

  private locAt(px: number, py: number): Loc | null {
    const G = DATA.merge.grid;
    if (inRect({ x: this.grid.x, y: this.grid.y, w: G.w * CELL, h: G.h * CELL }, px, py)) {
      return { area: 'grid', i: Math.floor((py - this.grid.y) / CELL) * G.w + Math.floor((px - this.grid.x) / CELL) };
    }
    const rows = Math.ceil(G.shelf / this.shelf.cols);
    if (inRect({ x: this.shelf.x, y: this.shelf.y, w: this.shelf.cols * CELL, h: rows * CELL }, px, py)) {
      const i = Math.floor((py - this.shelf.y) / CELL) * this.shelf.cols + Math.floor((px - this.shelf.x) / CELL);
      return i < G.shelf ? { area: 'shelf', i } : null;
    }
    return null;
  }

  /** On short landscape screens the 7x7 grid needs the advisor strip's space too. */
  override fullHeight(): boolean {
    const L = this.app.L;
    return L.landscape && L.body.h < DATA.merge.grid.h * CELL + 6;
  }

  rebuild(): void {
    this.clear();
    this.sprites.clear();
    this.charge.clear();
    this.drag = null;
    const app = this.app;
    const L = app.L;
    const B = L.body;
    const G = DATA.merge.grid;
    const st = app.store.state;
    const rel = st.run.reliquary;
    rect(app, this.c, B.x, B.y, B.w, B.h, PAL.robeDD);
    this.dockBg();
    const gw = G.w * CELL;
    const gh = G.h * CELL;
    // the codex strip shows one chain at a time; tap it to switch between the chains you have a generator for
    const chains = DATA.merge.chains.filter((ch) => DATA.merge.generators.some((gen) => gen.chain === ch.id && st.run.level >= (gen.unlockLevel ?? 1)));
    const chain = chains[this.chainIdx % Math.max(1, chains.length)] ?? DATA.merge.chains[0];
    const best = st.meta.mergeCodex[chain.id] ?? 1;
    const label = t('merge.codex', { chain: t(`merge.chain.${chain.id}`), n: best, max: chain.tiers.length }) + (chains.length > 1 ? ' >' : '');
    const cycle = () => { this.chainIdx = (this.chainIdx + 1) % chains.length; this.rebuild(); };
    const codex = (x: number, y: number, vertical: boolean) => {
      chain.tiers.forEach((key, i) => {
        const perRow = L.dock ? 3 : chain.tiers.length;
        const cx = vertical ? x : x + (i % perRow) * 24;
        const cy = vertical ? y + i * 24 : y + Math.floor(i / perRow) * 24;
        panel(app, this.c, cx, cy, 24, 24, i < best ? PAL.white : PAL.robe);
        img(app, this.c, cx + 1, cy + 1, i < best ? `m_${key}` : 'm_unknown');
        if (vertical) txt(app, this.c, cx + 27, cy + 8, i < best ? t(`merge.${key}.name`) : t('merge.unknown'), { color: i < best ? 'ink' : 'dim', width: 60, maxLines: 1 });
      });
    };
    if (L.dock) {
      const D = L.dock;
      const full = this.fullHeight();
      const top = full ? L.banner.y : B.y;
      const availH = full ? B.h + L.banner.h : B.h;
      if (full) rect(app, this.c, B.x, L.banner.y, B.w, L.banner.h, PAL.robeDD);
      this.grid = { x: B.x + Math.floor((B.w - gw) / 2), y: top + Math.max(2, Math.floor((availH - gh) / 2)) };
      this.shelf = { x: D.x + Math.floor((D.w - 3 * CELL) / 2), y: D.y + D.h - 2 * CELL - 4, cols: 3 };
      txt(app, this.c, D.x + 5, D.y + 3, label, { color: 'irony' });
      if (chains.length > 1) hit(app, this.c, D.x, D.y, D.w, 64, cycle).setName('btn_chain');
      if (D.h >= 14 + 5 * 24 + 62) codex(D.x + 4, D.y + 14, true);
      else codex(D.x + Math.floor((D.w - 72) / 2), D.y + 14, false);
      txt(app, this.c, D.x + 5, this.shelf.y - 11, t('merge.shelf'), { color: 'dim' });
    } else {
      // stack: codex (40) + grid + shelf label and shelf (13 + 24) + help text if there is room for it
      const top = 40;
      const need = top + gh + 2 + 13 + CELL;
      const spare = B.h - need;
      this.showHelp = spare >= 22;
      const pad = Math.max(0, Math.floor((spare - (this.showHelp ? 22 : 0)) / 2));
      this.grid = { x: B.x + Math.floor((B.w - gw) / 2), y: B.y + top + pad };
      this.shelf = { x: B.x + Math.floor((B.w - G.shelf * CELL) / 2), y: this.grid.y + gh + 13, cols: G.shelf };
      txt(app, this.c, B.x + 5, B.y + 3, label, { color: 'white' });
      if (chains.length > 1) hit(app, this.c, B.x, B.y, B.w, 38, cycle).setName('btn_chain');
      codex(B.x + Math.floor((B.w - chain.tiers.length * 24) / 2), B.y + 13, false);
      txt(app, this.c, this.shelf.x, this.shelf.y - 10, t('merge.shelf'), { color: 'pale' });
    }
    // cells
    rect(app, this.c, this.grid.x - 2, this.grid.y - 2, gw + 4, gh + 4, PAL.ink);
    for (let i = 0; i < G.w * G.h; i++) {
      const p = this.locPos({ area: 'grid', i });
      rect(app, this.c, p.x + 1, p.y + 1, CELL - 2, CELL - 2, (i + Math.floor(i / G.w)) % 2 ? PAL.robe : PAL.robeL);
    }
    for (let i = 0; i < G.shelf; i++) {
      const p = this.locPos({ area: 'shelf', i });
      rect(app, this.c, p.x, p.y, CELL, CELL, PAL.ink);
      rect(app, this.c, p.x + 1, p.y + 1, CELL - 2, CELL - 2, PAL.wood);
    }
    // items
    const place = (cell: MergeCell | null, loc: Loc) => {
      if (!cell) return;
      const p = this.locPos(loc);
      const s = app.add.image(p.x + 1, p.y + 1, ATLAS, this.frameFor(cell)).setOrigin(0, 0);
      this.c.add(s);
      this.sprites.set(`${loc.area}:${loc.i}`, s);
      if (cell.kind === 'gen') {
        rect(app, this.c, p.x + CELL - 9, p.y + CELL - 10, 8, 9, PAL.ink);
        const label = txt(app, this.c, p.x + CELL - 7, p.y + CELL - 9, String(cell.charges), { color: 'glow' });
        this.charge.set(loc.i, { label, last: String(cell.charges) });
      }
    };
    rel.cells.forEach((cell, i) => place(cell, { area: 'grid', i }));
    rel.shelf.forEach((cell, i) => place(cell, { area: 'shelf', i }));
    // help text only where it fits; on short screens it would slide under the tab bar
    this.hint = L.dock || !this.showHelp ? null : txt(app, this.c, B.x + Math.floor(B.w / 2), this.shelf.y + CELL + 3, t('merge.help'), { align: 'center', color: 'pale', width: B.w - 8, maxLines: 2 });
  }

  override onChanged(): void {
    if (!this.drag) this.rebuild();
  }

  // ---------- input ----------

  override pointerDown(p: Phaser.Input.Pointer): void {
    const loc = this.locAt(p.x, p.y);
    if (!loc) return;
    const sprite = this.sprites.get(`${loc.area}:${loc.i}`);
    if (!sprite) return;
    this.drag = { from: loc, sprite, sx: p.x, sy: p.y, ox: sprite.x, oy: sprite.y, moved: false };
  }
  override pointerMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.moved && Math.abs(p.x - d.sx) + Math.abs(p.y - d.sy) < 5) return;
    if (!d.moved) { d.moved = true; this.c.bringToTop(d.sprite); }
    d.sprite.setPosition(Math.round(d.ox + p.x - d.sx), Math.round(d.oy + p.y - d.sy));
  }
  override pointerUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const app = this.app;
    const rel = app.store.state.run.reliquary;
    if (!d.moved) {
      const cell = d.from.area === 'grid' ? rel.cells[d.from.i] : rel.shelf[d.from.i];
      if (cell && cell.kind === 'gen') {
        const at = app.store.act((g) => mergeTap(g, d.from.i));
        if (at < 0) app.float(cell.charges <= 0 ? t('merge.recharging') : t('merge.full'), { x: p.x, y: p.y - 14 }, 'irony');
      } else if (cell && cell.kind === 'item') {
        app.float(t(`merge.${mergeItemKey(cell.chain, cell.tier)}.name`), { x: p.x, y: p.y - 14 }, 'irony');
      }
      this.rebuild();
      return;
    }
    const to = this.locAt(p.x, p.y);
    if (to) {
      const res = app.store.act((g, emit) => mergeMove(g, d.from, to, emit));
      if (res.kind === 'merge') {
        this.chainIdx = Math.max(0, DATA.merge.chains.findIndex((ch) => ch.id === res.chain));
        const pos = this.locPos(to);
        app.float(t('merge.made', { name: t(`merge.${mergeItemKey(res.chain, res.tier)}.name`) }), { x: pos.x + 12, y: pos.y - 4 }, 'gain');
      }
    }
    this.rebuild();
  }

  override update(_dt: number): void {
    if (!this.visible) return;
    const rel = this.app.store.state.run.reliquary;
    for (const [i, c] of this.charge) {
      const cell = rel.cells[i];
      if (!cell || cell.kind !== 'gen') continue;
      const s = String(cell.charges);
      if (s !== c.last) { c.last = s; c.label.setText(s); }
    }
  }
}
