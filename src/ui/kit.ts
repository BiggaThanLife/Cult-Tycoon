// Small UI toolkit: pixel text, panels, buttons, bars. Everything is positioned on integer pixels.
import Phaser from 'phaser';
import { ATLAS } from '../art/sprites';
import { fontKey, FONT_SIZE, LINE_HEIGHT, textWidth, wrapText } from '../art/font';
import { hex, PAL, type FontColor } from '../art/palette';

export type C = Phaser.GameObjects.Container;
type Scene = Phaser.Scene;

const ASCII: Record<string, string> = { '’': "'", '‘': "'", '“': '"', '”': '"', '—': '-', '–': '-', '×': 'x', '…': '...' };
export const ascii = (s: string) => s.replace(/[‘’“”–—×…]/g, (ch) => ASCII[ch] ?? '?');

export interface TextOpts { color?: FontColor; width?: number; align?: 'left' | 'center' | 'right'; maxLines?: number }

/** Bitmap text. (x, y) is the top-left, top-centre or top-right depending on `align`. Returns the object and its height. */
export function txt(scene: Scene, parent: C, x: number, y: number, str: string, opts: TextOpts = {}): Phaser.GameObjects.BitmapText {
  let lines = opts.width ? wrapText(ascii(str), opts.width) : ascii(str).split('\n');
  if (opts.maxLines && lines.length > opts.maxLines) lines = lines.slice(0, opts.maxLines);
  const t = scene.add.bitmapText(Math.round(x), Math.round(y), fontKey(opts.color ?? 'ink'), lines.join('\n'), FONT_SIZE);
  const align = opts.align ?? 'left';
  if (align === 'center') t.setOrigin(0.5, 0).setCenterAlign();
  else if (align === 'right') t.setOrigin(1, 0).setRightAlign();
  else t.setOrigin(0, 0);
  // origins on odd widths can land on half pixels; snap
  if (align === 'center') t.x = Math.round(x) + ((Math.max(...lines.map(textWidth)) % 2) ? 0.5 : 0);
  parent.add(t);
  return t;
}
export const textHeight = (str: string, width?: number) => (width ? wrapText(ascii(str), width).length : ascii(str).split('\n').length) * LINE_HEIGHT;
export { textWidth, LINE_HEIGHT };

export function img(scene: Scene, parent: C, x: number, y: number, frame: string): Phaser.GameObjects.Image {
  const i = scene.add.image(Math.round(x), Math.round(y), ATLAS, frame).setOrigin(0, 0);
  parent.add(i);
  return i;
}

export function rect(scene: Scene, parent: C, x: number, y: number, w: number, h: number, color: string, alpha = 1): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)), hex(color), alpha).setOrigin(0, 0);
  parent.add(r);
  return r;
}

export function panel(scene: Scene, parent: C, x: number, y: number, w: number, h: number, fill: string = PAL.robeL, line: string = PAL.ink): void {
  rect(scene, parent, x, y, w, h, line);
  rect(scene, parent, x + 1, y + 1, w - 2, h - 2, fill);
  rect(scene, parent, x + 1, y + 1, w - 2, 1, PAL.white, 0.5);
}

/** Invisible tap target. Fires only when press and release both happen on it. */
export function hit(scene: Scene, parent: C, x: number, y: number, w: number, h: number, onClick: () => void): Phaser.GameObjects.Zone {
  const z = scene.add.zone(Math.round(x), Math.round(y), w, h).setOrigin(0, 0).setInteractive();
  let armed = false;
  z.on('pointerdown', () => { armed = true; });
  z.on('pointerout', () => { armed = false; });
  z.on('pointerup', () => { if (armed) { armed = false; onClick(); } });
  parent.add(z);
  return z;
}

export interface ButtonOpts { disabled?: boolean; fill?: string; icon?: string; color?: FontColor; name?: string }

export function button(scene: Scene, parent: C, x: number, y: number, w: number, h: number, label: string, onClick: () => void, opts: ButtonOpts = {}): void {
  const disabled = !!opts.disabled;
  const fill = disabled ? PAL.robe : opts.fill ?? PAL.yellow;
  rect(scene, parent, x, y, w, h, PAL.ink);
  rect(scene, parent, x + 1, y + 1, w - 2, h - 2, fill);
  rect(scene, parent, x + 1, y + h - 3, w - 2, 2, PAL.ink, 0.18);
  rect(scene, parent, x + 1, y + 1, w - 2, 1, PAL.white, 0.6);
  const lines = wrapText(ascii(label), w - 4 - (opts.icon ? 12 : 0));
  const th = lines.length * LINE_HEIGHT - 1;
  const tx = x + Math.floor(w / 2) + (opts.icon ? 5 : 0);
  if (opts.icon) {
    const lw = Math.max(...lines.map(textWidth));
    img(scene, parent, tx - Math.floor(lw / 2) - 11, y + Math.floor((h - 8) / 2), opts.icon);
  }
  txt(scene, parent, tx, y + Math.floor((h - th) / 2), lines.join('\n'), { align: 'center', color: disabled ? 'dim' : opts.color ?? 'ink' });
  if (!disabled) {
    const z = hit(scene, parent, x, y, w, h, onClick);
    if (opts.name) z.setName(opts.name);
  }
}

export function bar(scene: Scene, parent: C, x: number, y: number, w: number, h: number, frac: number, fill: string, bg: string = PAL.ink2): Phaser.GameObjects.Rectangle {
  rect(scene, parent, x, y, w, h, PAL.ink);
  rect(scene, parent, x + 1, y + 1, w - 2, h - 2, bg);
  return rect(scene, parent, x + 1, y + 1, Math.round((w - 2) * Math.max(0, Math.min(1, frac))), h - 2, fill);
}

export const inRect = (r: { x: number; y: number; w: number; h: number }, px: number, py: number) => px >= r.x && py >= r.y && px < r.x + r.w && py < r.y + r.h;
