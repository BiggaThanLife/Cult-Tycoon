// The compound map: build, collect, watch followers mill about.
import type Phaser from 'phaser';
import type { App } from '../app';
import { ATLAS } from '../art/sprites';
import { PAL } from '../art/palette';
import { DATA, buildingDef } from '../core/data';
import { buildable, canAfford, canPlace, canUpgrade, collect, nextUpgrade, placeBuilding, reached, storageCap } from '../core/game';
import { t } from '../core/text';
import { button, img, inRect, panel, rect, txt, type C } from '../ui/kit';
import { frame, modalWidth } from '../ui/modal';
import { openBuilding, openFollower, openRoster } from './modals';
import { Screen } from './screen';

const TILE = 16;

interface Walker { x: number; y: number; tx: number; ty: number; wait: number; frame: number; sprite?: Phaser.GameObjects.Image }

export class CompoundScreen extends Screen {
  private world!: C;
  private cam = { x: 0, y: 0, init: false };
  private drag: { sx: number; sy: number; cx: number; cy: number; moved: boolean } | null = null;
  private placing: { type: string; x: number; y: number } | null = null;
  private walkers = new Map<number, Walker>();
  private cat: Walker | null = null;
  private bubbles = new Map<number, { c: C; label: Phaser.GameObjects.BitmapText; last: number }>();
  private anim = 0;

  private get size(): number { return DATA.balance.map.size * TILE; }

  rebuild(): void {
    this.clear();
    this.bubbles.clear();
    const app = this.app;
    const L = app.L;
    const run = app.store.state.run;
    const u = DATA.balance.map.usable;
    if (!this.cam.init) {
      this.cam.x = (u.x + u.w / 2) * TILE;
      this.cam.y = (u.y + u.h / 2) * TILE;
      this.cam.init = true;
    }
    rect(app, this.c, 0, 0, L.w, L.h, PAL.grassD);
    this.world = app.add.container(0, 0);
    this.c.add(this.world);

    // ground
    const n = DATA.balance.map.size;
    for (let ty = 0; ty < n; ty++) for (let tx = 0; tx < n; tx++) {
      const inside = tx >= u.x && ty >= u.y && tx < u.x + u.w && ty < u.y + u.h;
      const h = (tx * 7 + ty * 13 + tx * ty) % 9;
      const key = inside ? (h < 5 ? 'grass_0' : h < 8 ? 'grass_1' : 'grass_2') : 'bramble';
      this.world.add(app.add.image(tx * TILE, ty * TILE, ATLAS, key).setOrigin(0, 0));
    }

    // placement ghost tiles (under buildings)
    if (this.placing) {
      const def = buildingDef(this.placing.type);
      const ok = canPlace(run, this.placing.type, this.placing.x, this.placing.y);
      for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) {
        this.world.add(app.add.image((this.placing.x + i) * TILE, (this.placing.y + j) * TILE, ATLAS, ok ? 'ghost_ok' : 'ghost_bad').setOrigin(0, 0).setAlpha(0.8));
      }
    }

    // buildings, back to front
    const sorted = [...run.buildings].sort((a, b) => a.y + buildingDef(a.type).h - (b.y + buildingDef(b.type).h));
    for (const b of sorted) {
      const def = buildingDef(b.type);
      const s = app.add.image(b.x * TILE, (b.y + def.h) * TILE, ATLAS, `b_${b.type}`).setOrigin(0, 1);
      this.world.add(s);
    }
    if (this.placing) {
      const def = buildingDef(this.placing.type);
      this.world.add(app.add.image(this.placing.x * TILE, (this.placing.y + def.h) * TILE, ATLAS, `b_${this.placing.type}`).setOrigin(0, 1).setAlpha(0.75));
    }

    // followers
    const alive = new Set(run.followers.map((f) => f.id));
    for (const id of [...this.walkers.keys()]) if (!alive.has(id)) this.walkers.delete(id);
    for (const f of run.followers) {
      let w = this.walkers.get(f.id);
      if (!w) {
        const p = this.spotFor(f.job);
        w = { x: p.x, y: p.y, tx: p.x, ty: p.y, wait: Math.random() * 2, frame: 0 };
        this.walkers.set(f.id, w);
      }
      w.sprite = app.add.image(Math.round(w.x), Math.round(w.y), ATLAS, `fol_${f.skin}_${f.robe}_0`).setOrigin(0.5, 1);
      this.world.add(w.sprite);
    }
    if (run.flags.cat_adopted) {
      if (!this.cat) {
        const p = this.spotFor(null);
        this.cat = { x: p.x, y: p.y, tx: p.x, ty: p.y, wait: 1, frame: 0 };
      }
      this.cat.sprite = app.add.image(Math.round(this.cat.x), Math.round(this.cat.y), ATLAS, 'cat').setOrigin(0.5, 1);
      this.world.add(this.cat.sprite);
    }

    // upgrade badges: a small arrow on any building that can still be upgraded; it glows when you can afford it
    if (!this.placing && reached(run, 'away')) {
      for (const b of run.buildings) {
        if (!nextUpgrade(b)) continue;
        const def = buildingDef(b.type);
        const ready = canUpgrade(run, b);
        const bx = (b.x + def.w) * TILE - 11;
        const by = (b.y + def.h) * TILE - 12;
        const badge = app.add.container(bx, by);
        this.world.add(badge);
        panel(app, badge, 0, 0, 12, 12, ready ? PAL.acid : PAL.robe);
        img(app, badge, 2, 2, 'ic_up');
        if (ready && !app.store.state.meta.settings.reducedMotion) app.tweens.add({ targets: badge, y: by - 2, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }

    // collect bubbles
    for (const b of run.buildings) {
      const def = buildingDef(b.type);
      if (!def.produces) continue;
      const bc = app.add.container((b.x + def.w / 2) * TILE, b.y * TILE - 30);
      this.world.add(bc);
      panel(app, bc, -16, 0, 32, 12, PAL.white);
      img(app, bc, -13, 2, `ic_${def.produces.resource}`);
      const label = txt(app, bc, -3, 2, '0');
      this.bubbles.set(b.id, { c: bc, label, last: -1 });
    }

    this.applyCam();

    // controls
    const B = L.body;
    if (this.placing) {
      const def = buildingDef(this.placing.type);
      const ok = canPlace(run, this.placing.type, this.placing.x, this.placing.y);
      const y = B.y + B.h - 44;
      panel(app, this.c, B.x + 3, y, B.w - 6, 41, PAL.white);
      txt(app, this.c, B.x + 7, y + 3, t('build.placing', { name: t(`building.${def.id}.name`) }), { width: B.w - 14, maxLines: 1 });
      txt(app, this.c, B.x + 7, y + 12, t(ok ? 'build.tap_to_move' : 'build.blocked'), { color: ok ? 'dim' : 'loss', width: B.w - 14, maxLines: 1 });
      const bw = Math.floor((B.w - 18) / 2);
      button(app, this.c, B.x + 7, y + 21, bw, 18, t('build.place'), () => this.confirmPlace(), { disabled: !ok, fill: PAL.acid, name: 'btn_place' });
      button(app, this.c, B.x + 11 + bw, y + 21, bw, 18, t('common.cancel'), () => { this.placing = null; this.rebuild(); }, { fill: PAL.pink, name: 'btn_cancel' });
    } else {
      button(app, this.c, B.x + B.w - 50, B.y + B.h - 24, 46, 21, t('build.button'), () => this.openBuildMenu(), { icon: 'ic_build', name: 'btn_build' });
      button(app, this.c, B.x + 4, B.y + B.h - 24, 46, 21, String(run.followers.length), () => openRoster(app), { icon: 'ic_follower', fill: PAL.robe, name: 'btn_roster' });
    }
    if (L.dock) { this.dockBg(); this.buildDock(); }
    this.refreshBubbles();
  }

  /** Landscape side panel: compound summary. */
  private buildDock(): void {
    const app = this.app;
    const D = app.L.dock!;
    const run = app.store.state.run;
    let y = D.y + 4;
    txt(app, this.c, D.x + 5, y, t('dock.compound'), { color: 'irony' });
    y += 12;
    for (const b of run.buildings) {
      txt(app, this.c, D.x + 5, y, t(`building.${b.type}.name`), { width: D.w - 8, maxLines: 1 });
      y += 9;
    }
    y += 4;
    txt(app, this.c, D.x + 5, y, t('dock.followers', { n: run.followers.length }), { color: 'irony' });
    y += 11;
    for (const f of run.followers.slice(0, 6)) {
      txt(app, this.c, D.x + 5, y, f.name, { width: D.w - 8, maxLines: 1 });
      y += 9;
    }
  }

  private spotFor(job: number | null): { x: number; y: number } {
    const run = this.app.store.state.run;
    const u = DATA.balance.map.usable;
    const b = run.buildings.find((x) => x.id === job) ?? run.buildings[0];
    let x = (u.x + u.w / 2) * TILE;
    let y = (u.y + u.h / 2) * TILE;
    if (b) {
      const def = buildingDef(b.type);
      x = (b.x + Math.random() * def.w) * TILE + (Math.random() * 32 - 16);
      y = (b.y + def.h) * TILE + 6 + Math.random() * 26;
    }
    x = Math.max(u.x * TILE + 8, Math.min((u.x + u.w) * TILE - 8, x));
    y = Math.max(u.y * TILE + 16, Math.min((u.y + u.h) * TILE - 2, y));
    return { x, y };
  }

  private applyCam(): void {
    const B = this.app.L.body;
    const half = { w: B.w / 2, h: B.h / 2 };
    const clamp = (v: number, halfView: number) => (this.size <= halfView * 2 ? this.size / 2 : Math.max(halfView, Math.min(this.size - halfView, v)));
    this.cam.x = clamp(this.cam.x, half.w);
    this.cam.y = clamp(this.cam.y, half.h);
    this.world.setPosition(Math.round(B.x + half.w - this.cam.x), Math.round(B.y + half.h - this.cam.y));
  }

  private toWorld(px: number, py: number): { x: number; y: number } {
    return { x: px - this.world.x, y: py - this.world.y };
  }

  override floatPos(at: { building?: number }): { x: number; y: number } | null {
    const b = this.app.store.state.run.buildings.find((x) => x.id === at.building);
    if (!b || !this.world) return null;
    const def = buildingDef(b.type);
    return { x: this.world.x + (b.x + def.w / 2) * TILE, y: this.world.y + b.y * TILE - 24 };
  }

  // ---------- build flow ----------

  private openBuildMenu(): void {
    const app = this.app;
    app.modals.open({
      id: 'build',
      build: (c, _a, close) => {
        const run = app.store.state.run;
        const types = buildable(run);
        const w = modalWidth(app);
        const rowH = 50;
        const r = frame(app, c, w, 16 + Math.max(1, types.length) * (rowH + 2) + 24, t('build.title'));
        if (types.length === 0) txt(app, c, r.x, r.y, t('build.none'), { width: r.w });
        types.forEach((type, i) => {
          const def = buildingDef(type);
          const y = r.y + i * (rowH + 2);
          const afford = canAfford(run, def.cost);
          panel(app, c, r.x, y, r.w, rowH, PAL.white);
          const s = img(app, c, r.x + 2, y + 3, `b_${type}`);
          s.setCrop(0, 0, 48, 44);
          const tx = r.x + 53;
          txt(app, c, tx, y + 3, t(`building.${type}.name`), { width: r.w - 56, maxLines: 1 });
          txt(app, c, tx, y + 12, t(`building.${type}.desc`), { color: 'dim', width: r.w - 56, maxLines: 2 });
          img(app, c, tx, y + 32, 'ic_devotion');
          txt(app, c, tx + 10, y + 32, def.cost.devotion ? String(def.cost.devotion) : t('build.free'), { color: run.devotion >= def.cost.devotion ? 'ink' : 'loss' });
          if (def.cost.donations) {
            img(app, c, tx + 34, y + 32, 'ic_donations');
            txt(app, c, tx + 44, y + 32, String(def.cost.donations), { color: run.donations >= def.cost.donations ? 'ink' : 'loss' });
          }
          button(app, c, r.x + r.w - 40, y + rowH - 20, 38, 18, afford ? t('build.pick') : t('build.poor'), () => { close(); this.startPlacing(type); }, { disabled: !afford, name: `btn_pick_${type}` });
        });
        button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
      },
    });
  }

  startPlacing(type: string): void {
    const run = this.app.store.state.run;
    const def = buildingDef(type);
    const u = DATA.balance.map.usable;
    // first free spot nearest the camera centre
    const cx = Math.round(this.cam.x / TILE - def.w / 2);
    const cy = Math.round(this.cam.y / TILE - def.h / 2);
    let best = { x: u.x, y: u.y, d: Infinity };
    for (let y = u.y; y <= u.y + u.h - def.h; y++) for (let x = u.x; x <= u.x + u.w - def.w; x++) {
      if (!canPlace(run, type, x, y)) continue;
      // prefer spots with a tile of breathing room so tall sprites don't hide each other
      const roomy = run.buildings.every((b) => { const o = buildingDef(b.type); return x >= b.x + o.w + 1 || x + def.w + 1 <= b.x || y >= b.y + o.h + 1 || y + def.h + 1 <= b.y; });
      const d = (x - cx) ** 2 + (y - cy) ** 2 + (roomy ? 0 : 1000);
      if (d < best.d) best = { x, y, d };
    }
    this.placing = { type, x: best.x, y: best.y };
    this.rebuild();
  }

  private confirmPlace(): void {
    if (!this.placing) return;
    const p = this.placing;
    const ok = this.app.store.act((g, emit) => placeBuilding(g, p.type, p.x, p.y, emit));
    if (ok) this.placing = null;
    this.rebuild();
  }

  // ---------- input ----------

  override pointerDown(p: Phaser.Input.Pointer): void {
    if (!inRect(this.app.L.body, p.x, p.y)) return;
    this.drag = { sx: p.x, sy: p.y, cx: this.cam.x, cy: this.cam.y, moved: false };
  }
  override pointerMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.moved && Math.abs(p.x - d.sx) + Math.abs(p.y - d.sy) < 5) return;
    d.moved = true;
    this.cam.x = d.cx - (p.x - d.sx);
    this.cam.y = d.cy - (p.y - d.sy);
    this.applyCam();
  }
  override pointerUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    this.drag = null;
    if (!d || d.moved) return;
    const w = this.toWorld(p.x, p.y);
    const tx = Math.floor(w.x / TILE);
    const ty = Math.floor(w.y / TILE);
    if (this.placing) {
      const def = buildingDef(this.placing.type);
      this.placing.x = tx - Math.floor((def.w - 1) / 2);
      this.placing.y = ty - Math.floor((def.h - 1) / 2);
      this.rebuild();
      return;
    }
    this.tapWorld(w.x, w.y);
  }

  private tapWorld(wx: number, wy: number): void {
    const app = this.app;
    const run = app.store.state.run;
    // buildings (front-most first); the sprite extends above its footprint
    const sorted = [...run.buildings].sort((a, b) => b.y + buildingDef(b.type).h - (a.y + buildingDef(a.type).h));
    for (const b of sorted) {
      const def = buildingDef(b.type);
      const box = { x: b.x * TILE, y: b.y * TILE - 30, w: def.w * TILE, h: def.h * TILE + 30 };
      if (!inRect(box, wx, wy)) continue;
      // tap the badge corner, or any building with nothing to collect, to open its card
      const onBadge = reached(run, 'away') && nextUpgrade(b) && wx >= (b.x + def.w) * TILE - 14 && wy >= (b.y + def.h) * TILE - 15;
      if (def.produces && !onBadge && Math.floor(b.stored) >= 1) {
        app.store.act((g, emit) => collect(g, b.id, emit));
      } else if (reached(run, 'away')) {
        openBuilding(app, b.id);
      } else if (def.produces) {
        app.float(t('float.nothing_yet'), this.floatPos({ building: b.id }) ?? undefined, 'irony');
      } else if (b.type === 'greenhouse' || b.type === 'alchemy_lab') {
        app.goto('alchemy');
      } else if (b.type === 'dormitory') {
        openRoster(app);
      }
      return;
    }
    for (const f of run.followers) {
      const w = this.walkers.get(f.id);
      if (w && Math.abs(wx - w.x) <= 9 && wy <= w.y + 2 && wy >= w.y - 18) {
        openFollower(app, f);
        return;
      }
    }
    if (this.cat && Math.abs(wx - this.cat.x) <= 9 && wy <= this.cat.y + 2 && wy >= this.cat.y - 16) {
      app.float(t('float.cat'), { x: this.world.x + this.cat.x, y: this.world.y + this.cat.y - 28 }, 'irony');
    }
  }

  // ---------- frame ----------

  private refreshBubbles(): void {
    const run = this.app.store.state.run;
    for (const b of run.buildings) {
      const bub = this.bubbles.get(b.id);
      if (!bub) continue;
      const n = Math.floor(b.stored);
      if (n === bub.last) continue;
      bub.last = n;
      bub.c.setVisible(n >= 1);
      bub.label.setText(n >= storageCap(b) ? t('hud.full', { n }) : String(n));
    }
  }

  private stepWalker(w: Walker, dt: number, job: number | null, speed: number, frames: [string, string] | null): void {
    if (w.wait > 0) {
      w.wait -= dt;
      if (w.wait <= 0) {
        const p = this.spotFor(job);
        w.tx = p.x;
        w.ty = p.y;
      }
    } else {
      const dx = w.tx - w.x;
      const dy = w.ty - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) w.wait = 1 + Math.random() * 3;
      else {
        w.x += (dx / dist) * speed * dt;
        w.y += (dy / dist) * speed * dt;
      }
    }
    if (w.sprite) {
      w.sprite.setPosition(Math.round(w.x), Math.round(w.y));
      if (frames) w.sprite.setFrame(frames[w.frame]);
    }
  }

  override update(dt: number): void {
    if (!this.visible || !this.world) return;
    const st = this.app.store.state;
    const reduced = st.meta.settings.reducedMotion;
    this.anim += dt;
    const flip = this.anim >= 0.25;
    if (flip) this.anim = 0;
    for (const f of st.run.followers) {
      const w = this.walkers.get(f.id);
      if (!w) continue;
      if (flip && !reduced) w.frame = w.frame ? 0 : 1;
      this.stepWalker(w, dt, f.job, 9, [`fol_${f.skin}_${f.robe}_0`, `fol_${f.skin}_${f.robe}_1`]);
    }
    if (this.cat) this.stepWalker(this.cat, dt, null, 14, null);
    this.refreshBubbles();
  }
}
