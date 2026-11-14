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
store.boot();

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
(window as unknown as { __ct: unknown }).__ct = { store, game, relayout, find, core, findHint, app: () => game.scene.getScene('app') };

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:' && !document.documentElement.dataset.single) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline support is optional */ });
}
