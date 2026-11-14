// Modal stack. Modals are rebuilt from their spec on every relayout, so rotating keeps them open.
import type Phaser from 'phaser';
import { PAL } from '../art/palette';
import { button, img, LINE_HEIGHT, panel, rect, textHeight, txt, type C } from './kit';
import type { App } from '../app';

export interface ModalSpec {
  id: string;
  /** Draw the modal into `c`. Call `close()` to dismiss. */
  build(c: C, app: App, close: () => void): void;
  update?(dt: number, app: App): void;
  onClose?(): void;
}

export interface DialogButton { label: string; onClick?: () => void; disabled?: boolean; fill?: string; keepOpen?: boolean; name?: string }
export interface DialogSpec { id: string; title: string; body: string; sprite?: string; buttons: DialogButton[]; onClose?: () => void }

export class Modals {
  stack: ModalSpec[] = [];
  private c: C;
  constructor(private app: App, layer: C) {
    this.c = app.add.container(0, 0);
    layer.add(this.c);
  }
  get active(): ModalSpec | null { return this.stack[this.stack.length - 1] ?? null; }
  has(id: string): boolean { return this.stack.some((m) => m.id === id); }

  open(spec: ModalSpec): void {
    if (this.has(spec.id)) return;
    this.stack.push(spec);
    this.rebuild();
  }
  close(id?: string): void {
    const i = id ? this.stack.findIndex((m) => m.id === id) : this.stack.length - 1;
    if (i < 0) return;
    const [m] = this.stack.splice(i, 1);
    this.rebuild();
    m.onClose?.();
  }
  closeAll(): void {
    this.stack = [];
    this.rebuild();
  }
  rebuild(): void {
    this.c.removeAll(true);
    const m = this.active;
    if (!m) return;
    const L = this.app.L;
    const dim = rect(this.app, this.c, 0, 0, L.w, L.h, PAL.ink, 0.55);
    dim.setInteractive(); // swallow taps behind the modal
    m.build(this.c, this.app, () => this.close(m.id));
  }
  update(dt: number): void {
    this.active?.update?.(dt, this.app);
  }
}

/** Draw a centred modal frame with a title bar. Returns the inner content rect. */
export function frame(app: App, c: C, w: number, h: number, title: string): { x: number; y: number; w: number; h: number } {
  const L = app.L;
  const availW = L.w - L.safe.l - L.safe.r;
  const availH = L.h - L.safe.t - L.safe.b;
  w = Math.min(w, availW - 6);
  h = Math.min(h, availH - 4);
  const x = L.safe.l + Math.floor((availW - w) / 2);
  const y = L.safe.t + Math.floor((availH - h) / 2);
  panel(app, c, x, y, w, h);
  rect(app, c, x + 1, y + 1, w - 2, 12, PAL.robeDD);
  txt(app, c, x + Math.floor(w / 2), y + 3, title, { align: 'center', color: 'white' });
  return { x: x + 5, y: y + 16, w: w - 10, h: h - 20 };
}

export const modalWidth = (app: App) => Math.min(app.L.w - app.L.safe.l - app.L.safe.r - 8, 190);

/** Standard text dialog with optional sprite and a column (or row) of buttons. */
export function dialog(app: App, d: DialogSpec): void {
  app.modals.open({
    id: d.id,
    onClose: d.onClose,
    build(c, _app, close) {
      const w = modalWidth(app);
      const textW = w - 10 - (d.sprite ? 38 : 0);
      const bodyH = Math.max(textHeight(d.body, textW), d.sprite ? 34 : 0);
      const row = app.L.landscape || d.buttons.length <= 1 || d.buttons.every((b) => b.label.length <= 9);
      const btnH = 18;
      const btnArea = row ? btnH : d.buttons.length * (btnH + 3) - 3;
      const h = 16 + bodyH + 6 + btnArea + 6;
      const r = frame(app, c, w, h, d.title);
      if (d.sprite) {
        const s = img(app, c, r.x, r.y, d.sprite);
        if (s.width <= 16) s.setScale(2);
      }
      txt(app, c, r.x + (d.sprite ? 38 : 0), r.y, d.body, { width: textW });
      const by = r.y + bodyH + 6;
      d.buttons.forEach((b, i) => {
        const click = () => {
          if (!b.keepOpen) close();
          b.onClick?.();
        };
        if (row) {
          const bw = Math.floor((r.w - (d.buttons.length - 1) * 4) / d.buttons.length);
          button(app, c, r.x + i * (bw + 4), by, bw, btnH, b.label, click, { disabled: b.disabled, fill: b.fill, name: b.name });
        } else {
          button(app, c, r.x, by + i * (btnH + 3), r.w, btnH, b.label, click, { disabled: b.disabled, fill: b.fill, name: b.name });
        }
      });
    },
  });
}

export { LINE_HEIGHT };
export type { Phaser };
