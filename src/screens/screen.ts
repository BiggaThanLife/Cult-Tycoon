import type Phaser from 'phaser';
import type { App } from '../app';
import { PAL } from '../art/palette';
import { rect, type C } from '../ui/kit';

/** A tab's content. Display objects are throwaway: `rebuild()` redraws everything from game state,
 *  which is what makes rotation and resizing safe. */
export abstract class Screen {
  c: C;
  visible = false;
  constructor(public app: App, layer: C) {
    this.c = app.add.container(0, 0).setVisible(false);
    layer.add(this.c);
  }
  show(): void {
    this.visible = true;
    this.c.setVisible(true);
    this.rebuild();
  }
  hide(): void {
    this.visible = false;
    this.c.setVisible(false);
    this.clear();
  }
  protected clear(): void {
    this.app.tweens.killTweensOf(this.c.list);
    this.c.removeAll(true);
  }
  abstract rebuild(): void;
  /** Landscape: paint the side dock's background. Call after the main content, before dock content. */
  protected dockBg(): void {
    const L = this.app.L;
    if (!L.dock) return;
    rect(this.app, this.c, L.dock.x, 0, L.w - L.dock.x, L.h, PAL.robeL);
    rect(this.app, this.c, L.dock.x, 0, 1, L.h, PAL.ink);
  }
  update(_dt: number): void {}
  /** Game state changed through an action. Default: redraw. */
  onChanged(): void { this.rebuild(); }
  pointerDown(_p: Phaser.Input.Pointer): void {}
  pointerMove(_p: Phaser.Input.Pointer): void {}
  pointerUp(_p: Phaser.Input.Pointer): void {}
  /** True when the screen needs the advisor strip's space too (e.g. the ritual board in landscape). */
  fullHeight(): boolean { return false; }
  /** Screen position for a floaty text about a building/follower, if this screen shows it. */
  floatPos(_at: { building?: number; follower?: number }): { x: number; y: number } | null { return null; }
}
