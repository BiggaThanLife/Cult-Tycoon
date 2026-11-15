// Garden plots and the Alchemy Lab.
import type Phaser from 'phaser';
import type { App } from '../app';
import { PAL } from '../art/palette';
import { DATA, cropDef } from '../core/data';
import { brew, cropUnlocked, harvest, hasBuilding, inv, plant, plotProgress, plotReady, recipeHinted } from '../core/game';
import { openGrimoire } from './modals';
import { t } from '../core/text';
import type { BuildingState } from '../core/types';
import { bar, button, hit, img, panel, rect, textHeight, txt, type C } from '../ui/kit';
import { dialog, frame, modalWidth } from '../ui/modal';
import { Screen } from './screen';

export class AlchemyScreen extends Screen {
  private pot: string[] = [];
  private plots: { b: BuildingState; slot: number; fill: Phaser.GameObjects.Rectangle; w: number; label: Phaser.GameObjects.BitmapText; ready: boolean }[] = [];

  rebuild(): void {
    this.clear();
    this.plots = [];
    const app = this.app;
    const L = app.L;
    const B = L.body;
    const st = app.store.state;
    const run = st.run;
    rect(app, this.c, B.x, B.y, B.w, B.h, PAL.grassL);
    this.dockBg();
    let y = B.y + 3;

    // ----- garden -----
    const gh = run.buildings.find((b) => b.type === 'greenhouse');
    txt(app, this.c, B.x + 5, y, t('garden.title'), { color: 'irony' });
    y += 10;
    if (gh && gh.plots) {
      const n = gh.plots.length;
      const perRow = 4;
      const pw = Math.min(42, Math.floor((B.w - 8 - (perRow - 1) * 3) / perRow));
      const x0 = B.x + Math.floor((B.w - (perRow * pw + (perRow - 1) * 3)) / 2);
      const rows = Math.ceil(n / perRow);
      const ph = rows > 1 ? 40 : 46; // two rows of plots are slightly shorter so everything still fits a small phone
      gh.plots.forEach((p, i) => {
        const x = x0 + (i % perRow) * (pw + 3);
        const py = y + Math.floor(i / perRow) * (ph + 2);
        panel(app, this.c, x, py, pw, ph, PAL.sand);
        img(app, this.c, x + Math.floor((pw - 24) / 2), py + ph - 35, 'plot_empty');
        if (p.crop) {
          const ready = plotReady(run, gh, i);
          img(app, this.c, x + Math.floor((pw - 16) / 2), py + ph - 43, ready ? `i_${p.crop}` : 'sprout');
          const fill = bar(app, this.c, x + 3, py + ph - 17, pw - 6, 5, plotProgress(run, gh, i), PAL.grass);
          const label = txt(app, this.c, x + Math.floor(pw / 2), py + ph - 10, '', { align: 'center', color: ready ? 'gain' : 'dim' });
          this.plots.push({ b: gh, slot: i, fill, w: pw - 8, label, ready });
          if (ready) hit(app, this.c, x, py, pw, ph, () => { app.store.act((g, emit) => harvest(g, gh.id, i, emit)); }).setName(`plot_${i}`);
        } else {
          if (ph > 40) txt(app, this.c, x + Math.floor(pw / 2), py + 2, t('garden.empty'), { align: 'center', color: 'dim' });
          txt(app, this.c, x + Math.floor(pw / 2), py + ph - 10, t('garden.plant'), { align: 'center', color: 'gold' });
          hit(app, this.c, x, py, pw, ph, () => this.openSeeds(gh.id, i)).setName(`plot_${i}`);
        }
      });
      y += rows * (ph + 2) + 2;
    } else {
      txt(app, this.c, B.x + 5, y, t('garden.none'), { width: B.w - 10 });
      y += 20;
    }

    // ----- lab -----
    const lab = hasBuilding(run, 'alchemy_lab');
    const R = DATA.recipes;
    txt(app, this.c, B.x + 5, y, t('lab.title'), { color: 'irony' });
    y += 10;
    if (!lab) {
      txt(app, this.c, B.x + 5, y, t('lab.none'), { width: B.w - 10 });
    } else {
      this.pot = this.pot.filter((id, idx) => this.pot.slice(0, idx + 1).filter((x) => x === id).length <= inv(run, id));
      // ingredient chips
      const ingredients = DATA.items.filter((it) => it.kind === 'ingredient' && (cropUnlocked(run, it.id) || inv(run, it.id) > 0));
      const chipW = Math.min(44, Math.floor((B.w - 10 - (ingredients.length - 1) * 2) / Math.max(1, ingredients.length)));
      let x = B.x + 5;
      for (const it of ingredients) {
        const left = inv(run, it.id) - this.pot.filter((p) => p === it.id).length;
        panel(app, this.c, x, y, chipW, 22, left > 0 ? PAL.white : PAL.robe);
        img(app, this.c, x + 2, y + 3, `i_${it.id}`);
        txt(app, this.c, x + 20, y + 7, `x${left}`, { color: left > 0 ? 'ink' : 'dim' });
        if (left > 0 && this.pot.length < R.maxIngredients) hit(app, this.c, x, y, chipW, 22, () => { this.pot.push(it.id); this.rebuild(); }).setName(`chip_${it.id}`);
        x += chipW + 2;
      }
      y += 25;
      // cauldron + pot contents
      img(app, this.c, B.x + 5, y + 1, 'cauldron');
      for (let i = 0; i < R.maxIngredients; i++) {
        const sx = B.x + 42 + i * 20;
        panel(app, this.c, sx, y + 3, 19, 19, PAL.robe);
        const id = this.pot[i];
        if (id) {
          img(app, this.c, sx + 2, y + 5, `i_${id}`);
          hit(app, this.c, sx, y + 3, 19, 19, () => { this.pot.splice(i, 1); this.rebuild(); });
        }
      }
      const can = this.pot.length >= R.minIngredients;
      button(app, this.c, B.x + 42 + R.maxIngredients * 20 + 3, y + 3, Math.max(34, Math.min(44, B.x + B.w - (B.x + 42 + R.maxIngredients * 20 + 3) - 4)), 19, t('lab.brew'), () => this.openStir(), { disabled: !can, fill: PAL.purple, name: 'btn_brew' });
      y += 27;
      if (!L.dock) y = this.shelf(B.x + 5, y, B.w - 10);
    }
    if (L.dock) this.shelf(L.dock.x + 5, L.dock.y + 4, L.dock.w - 9);
  }

  /** Grimoire button + potion shelf. Returns the next free y. */
  private shelf(x: number, y: number, w: number): number {
    const app = this.app;
    const st = app.store.state;
    const R = DATA.recipes;
    button(app, this.c, x, y, Math.min(w, 96), 18, t('grimoire.open', { n: st.meta.grimoire.length, max: R.recipes.length }), () => openGrimoire(app), { fill: PAL.purple, name: 'btn_grimoire' });
    y += 21;
    // the advisor repeats any recipe you have been told about but not brewed yet
    const hint = R.recipes.find((r) => !st.meta.grimoire.includes(r.id) && recipeHinted(st.run, r.id));
    if (hint) {
      const line = t('grimoire.hint', { recipe: hint.ingredients.map((i) => t(`item.${i}.name`)).join(' + ') });
      txt(app, this.c, x, y, line, { color: 'gold', width: w, maxLines: 2 });
      y += textHeight(line, w) + 2;
    }
    const potions = DATA.items.filter((it) => it.kind === 'potion' && inv(st.run, it.id) > 0);
    let px = x;
    for (const it of potions) {
      if (px + 34 > x + w + 1) { px = x; y += 22; }
      panel(app, this.c, px, y, 34, 20, PAL.white);
      img(app, this.c, px + 2, y + 2, `i_${it.id}`);
      txt(app, this.c, px + 20, y + 6, `x${inv(st.run, it.id)}`);
      hit(app, this.c, px, y, 34, 20, () => dialog(app, { id: 'item', title: t(`item.${it.id}.name`), body: t(`item.${it.id}.desc`), sprite: `i_${it.id}`, buttons: [{ label: t('common.ok') }] }));
      px += 37;
    }
    return y + 22;
  }

  private openSeeds(buildingId: number, slot: number): void {
    const app = this.app;
    app.modals.open({
      id: 'seeds',
      build: (c: C, _a, close) => {
        const run = app.store.state.run;
        const crops = DATA.crops.filter((cr) => cropUnlocked(run, cr.id));
        const r = frame(app, c, modalWidth(app), 16 + crops.length * 34 + 24, t('garden.seeds.title'));
        crops.forEach((crop, i) => {
          const y = r.y + i * 34;
          const afford = run.donations >= crop.seedCost;
          panel(app, c, r.x, y, r.w, 32, PAL.white);
          img(app, c, r.x + 3, y + 3, `i_${crop.id}`);
          txt(app, c, r.x + 22, y + 3, t(`item.${crop.id}.name`), { width: r.w - 66, maxLines: 1 });
          txt(app, c, r.x + 22, y + 12, t('garden.seeds.info', { sec: crop.growSec, n: crop.yield }), { color: 'dim' });
          img(app, c, r.x + 22, y + 22, 'ic_donations');
          txt(app, c, r.x + 32, y + 22, String(crop.seedCost), { color: afford ? 'ink' : 'loss' });
          button(app, c, r.x + r.w - 42, y + 7, 40, 18, t('garden.plant'), () => {
            close();
            app.store.act((g, emit) => plant(g, buildingId, slot, crop.id, emit));
          }, { disabled: !afford, name: `btn_seed_${crop.id}` });
        });
        button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
      },
    });
  }

  /** Stir minigame: stop the marker in the green zone for a Fine batch. Skippable. */
  private openStir(): void {
    const app = this.app;
    const S = DATA.balance.stir;
    let phase = 0;
    let marker: Phaser.GameObjects.Rectangle | null = null;
    let track = { x: 0, w: 0 };
    const pos = () => 0.5 - 0.5 * Math.cos((phase / S.periodSec) * Math.PI * 2); // 0..1..0
    const finish = (fine: boolean) => {
      const pot = [...this.pot];
      this.pot = [];
      app.modals.close('stir');
      const res = app.store.act((g, emit) => brew(g, pot, fine, emit));
      if (!res.ok) return;
      const body = [
        res.output === DATA.recipes.failOutput ? t('lab.result.fail') : res.discovered ? t('lab.result.new') : t('lab.result.known'),
        t('lab.result.got', { n: res.count, name: t(`item.${res.output}.name`) }),
        fine && res.count > 1 ? t('lab.result.fine') : '',
        t(`item.${res.output}.desc`),
      ].filter(Boolean).join('\n');
      dialog(app, { id: 'brew_result', title: t(`item.${res.output}.name`), body, sprite: `i_${res.output}`, buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
    };
    app.modals.open({
      id: 'stir',
      build: (c) => {
        const r = frame(app, c, modalWidth(app), 16 + 20 + 22 + 26, t('lab.stir.title'));
        txt(app, c, r.x, r.y, t('lab.stir.body'), { width: r.w, maxLines: 2 });
        const ty = r.y + 22;
        rect(app, c, r.x, ty, r.w, 12, PAL.ink);
        rect(app, c, r.x + 1, ty + 1, r.w - 2, 10, PAL.night2);
        const zw = Math.round((r.w - 2) * S.zone);
        rect(app, c, r.x + 1 + Math.round((r.w - 2 - zw) / 2), ty + 1, zw, 10, PAL.acid);
        track = { x: r.x + 1, w: r.w - 2 - 3 };
        marker = rect(app, c, track.x + Math.round(track.w * pos()), ty - 2, 3, 16, PAL.white);
        const bw = Math.floor((r.w - 4) / 2);
        button(app, c, r.x, ty + 20, bw, 18, t('lab.stir.go'), () => finish(Math.abs(pos() - 0.5) <= S.zone / 2), { fill: PAL.acid, name: 'btn_stir' });
        button(app, c, r.x + bw + 4, ty + 20, bw, 18, t('lab.stir.skip'), () => finish(false), { fill: PAL.robe, name: 'btn_skip' });
      },
      update: (dt) => {
        phase += dt;
        if (marker && marker.active) marker.x = track.x + Math.round(track.w * pos());
      },
    });
  }

  override update(_dt: number): void {
    if (!this.visible) return;
    const run = this.app.store.state.run;
    let flip = false;
    for (const p of this.plots) {
      const crop = p.b.plots?.[p.slot]?.crop;
      if (!crop) continue;
      const prog = plotProgress(run, p.b, p.slot);
      const ready = prog >= 1;
      if (ready !== p.ready) flip = true;
      p.fill.width = Math.round(p.w * prog);
      const left = Math.ceil(cropDef(crop).growSec * (1 - prog));
      p.label.setText(ready ? t('garden.ready') : t('garden.left', { sec: left }));
    }
    if (flip) this.rebuild();
  }
}
