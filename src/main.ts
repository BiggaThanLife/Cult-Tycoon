import Phaser from 'phaser';
import { App } from './app';
import { PAL } from './art/palette';
import { DATA } from './core/data';
import { browserKV } from './core/save';
import { Store } from './core/store';
import { computeLayout } from './ui/layout';
import * as core from './core/game';
import { findHint } from './puzzle/match3';

const store = new Store(browserKV());
// ?seed=N starts a new game with a fixed seed (used by automated tests so random events are repeatable)
const seedParam = Number(new URLSearchParams(location.search).get('seed'));
store.boot(Number.isFinite(seedParam) && seedParam > 0 ? seedParam : undefined);

const first = computeLayout();
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: first.w,
  height: first.h,
  backgroundColor: PAL.night,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.NONE, zoom: first.cssScale },
  input: { activePointers: 2 },
  banner: false,
  disableContextMenu: true,
});
game.scene.add('app', App, true, { store });

/** Resize the canvas in place. No reload, no scene restart: game state is untouched. */
function relayout(): void {
  const L = computeLayout();
  game.scale.setZoom(L.cssScale);
  game.scale.resize(L.w, L.h);
  const app = game.scene.getScene('app') as App | undefined;
  if (app && app.sys.isActive()) app.relayout();
}
let pending = 0;
const queueRelayout = () => {
  cancelAnimationFrame(pending);
  pending = requestAnimationFrame(relayout);
};
window.addEventListener('resize', queueRelayout);
window.addEventListener('orientationchange', queueRelayout);
window.visualViewport?.addEventListener('resize', queueRelayout);

// Save when hidden; treat long gaps as time away (goes through the offline path with its clock guards).
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    store.save();
  } else if (hiddenAt && Date.now() - hiddenAt >= DATA.balance.offline.summaryMinSec * 1000) {
    store.resume();
  }
});
window.addEventListener('pagehide', () => store.save());

// Debug / test hook (also used by the Playwright smoke test).
/** Find a named tap target and return its centre in CSS pixels (for automated tests). */
function find(name: string): { x: number; y: number } | null {
  const app = game.scene.getScene('app') as App;
  const walk = (list: Phaser.GameObjects.GameObject[]): Phaser.GameObjects.Zone | null => {
    for (const o of list) {
      if (o.name === name && o instanceof Phaser.GameObjects.Zone) return o;
      if (o instanceof Phaser.GameObjects.Container) {
        if (!o.visible) continue;
        const hit = walk(o.list);
        if (hit) return hit;
      }
    }
    return null;
  };
  const z = walk(app.children.list);
  if (!z) return null;
  const m = z.getWorldTransformMatrix();
  const r = game.canvas.getBoundingClientRect();
  const k = r.width / game.canvas.width;
  return { x: r.left + (m.tx + z.width / 2) * k, y: r.top + (m.ty + z.height / 2) * k };
}
/** Layout audit for tests: texts in the current screen that poke outside the body/dock, and texts in the
 *  open modal that poke outside the canvas. Returns short descriptions; empty means clean. */
function audit(): string[] {
  const app = game.scene.getScene('app') as App;
  const L = app.L;
  const out: string[] = [];
  const texts = (list: Phaser.GameObjects.GameObject[], acc: Phaser.GameObjects.BitmapText[] = []) => {
    for (const o of list) {
      if (o instanceof Phaser.GameObjects.BitmapText && o.visible && o.alpha > 0.5 && o.text) acc.push(o);
      else if (o instanceof Phaser.GameObjects.Container && o.visible && o.name !== 'fx') texts(o.list, acc);
    }
    return acc;
  };
  const screen = app.screens[app.tab];
  const full = screen.fullHeight();
  const top = full ? L.banner.y : L.body.y;
  const bottom = L.body.y + L.body.h;
  type Box = { l: number; t: number; r: number; b: number };
  const inside = (b: { x: number; y: number; width: number; height: number }, box: Box) => b.x >= box.l - 1 && b.y >= box.t - 1 && b.x + b.width <= box.r + 1 && b.y + b.height <= box.b + 1;
  const check = (list: Phaser.GameObjects.GameObject[], boxes: Box[], where: string) => {
    for (const tx of texts(list)) {
      const b = tx.getTextBounds(true).global;
      if (!boxes.some((box) => inside(b, box))) out.push(`${where}: "${tx.text.slice(0, 24).replace(/\n/g, ' ')}" at ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}`);
    }
  };
  const bodyBox: Box = { l: L.body.x, t: top, r: L.body.x + L.body.w, b: bottom };
  const boxes = L.dock ? [bodyBox, { l: L.dock.x, t: L.dock.y, r: L.dock.x + L.dock.w, b: L.dock.y + L.dock.h }] : [bodyBox];
  // text drawn on top of other text (the audit above only checks edges)
  const overlapCheck = (list: Phaser.GameObjects.GameObject[], where: string) => {
    const bs = texts(list).map((tx) => ({ tx, b: tx.getTextBounds(true).global }));
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i].b; const b = bs[j].b;
      const ox = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
      if (ox > 2 && oy > 2) out.push(`${where}: "${bs[i].tx.text.slice(0, 16)}" overlaps "${bs[j].tx.text.slice(0, 16)}"`);
    }
  };
  if (app.modals.active) overlapCheck((app as unknown as { modalLayer: Phaser.GameObjects.Container }).modalLayer.list, `modal ${app.modals.active.id}`);
  else if (app.tab !== 'compound') overlapCheck(screen.c.list, `${app.tab} overlap`);
  if (app.modals.active) check((app as unknown as { modalLayer: Phaser.GameObjects.Container }).modalLayer.list, [{ l: 0, t: 0, r: L.w, b: L.h }], `modal ${app.modals.active.id}`);
  else if (app.tab !== 'compound') check(screen.c.list, boxes, app.tab);
  return out;
}
(window as unknown as { __ct: unknown }).__ct = { audit,  store, game, relayout, find, core, findHint, app: () => game.scene.getScene('app') };

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:' && !document.documentElement.dataset.single) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
}
