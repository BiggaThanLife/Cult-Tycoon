// The order board: entities post requests; filling them pays Favor, XP and resources.
import type { App } from '../app';
import { PAL } from '../art/palette';
import { mergeItemKey, orderDef } from '../core/data';
import { canFill, fillOrder, needHave } from '../core/game';
import { t } from '../core/text';
import { button, img, panel, rect, txt } from '../ui/kit';
import { dialog } from '../ui/modal';
import { Screen } from './screen';

export class OrdersScreen extends Screen {
  rebuild(): void {
    this.clear();
    const app = this.app;
    const L = app.L;
    const B = L.body;
    const run = app.store.state.run;
    rect(app, this.c, B.x, B.y, B.w, B.h, PAL.sand);
    this.dockBg();
    const favor = run.favor.mothman ?? 0;
    let y = B.y + 4;
    if (L.dock) {
      const D = L.dock;
      img(app, this.c, D.x + Math.floor((D.w - 32) / 2), D.y + 6, 'mothman');
      txt(app, this.c, D.x + Math.floor(D.w / 2), D.y + 42, t('entity.mothman.name'), { align: 'center', color: 'irony' });
      img(app, this.c, D.x + 8, D.y + 54, 'ic_favor');
      txt(app, this.c, D.x + 19, D.y + 54, t('orders.favor', { n: favor }));
      txt(app, this.c, D.x + 5, D.y + 68, t('entity.mothman.blurb'), { color: 'dim', width: D.w - 9 });
    } else {
      panel(app, this.c, B.x + 4, y, B.w - 8, 46, PAL.white);
      img(app, this.c, B.x + 8, y + 4, 'mothman');
      txt(app, this.c, B.x + 44, y + 4, t('entity.mothman.name'), { color: 'irony' });
      img(app, this.c, B.x + 44, y + 14, 'ic_favor');
      txt(app, this.c, B.x + 55, y + 14, t('orders.favor', { n: favor }));
      txt(app, this.c, B.x + 44, y + 24, t('entity.mothman.blurb'), { color: 'dim', width: B.w - 54, maxLines: 2 });
      y += 50;
    }
    if (run.orders.length === 0) txt(app, this.c, B.x + 6, y, t('orders.none'), { width: B.w - 12 });
    const cardH = L.dock ? 64 : 72;
    run.orders.forEach((o, i) => {
      const def = orderDef(o.id);
      const cy = y + i * (cardH + 3);
      panel(app, this.c, B.x + 4, cy, B.w - 8, cardH, o.filled ? PAL.grassL : PAL.white);
      txt(app, this.c, B.x + 8, cy + 3, t(`order.${o.id}.text`), { width: B.w - 16, maxLines: 3, color: o.filled ? 'dim' : 'ink' });
      let nx = B.x + 8;
      const ny = cy + cardH - 36;
      def.needs.forEach((n) => {
        const frame = 'item' in n ? `i_${n.item}` : `m_${mergeItemKey(n.merge, n.tier)}`;
        const s = img(app, this.c, nx, ny + ('item' in n ? 4 : 1), frame);
        const have = needHave(run, n);
        txt(app, this.c, nx + s.width + 2, ny + 8, o.filled ? t('orders.done') : `${Math.min(have, n.count)}/${n.count}`, { color: o.filled || have >= n.count ? 'gain' : 'loss' });
        nx += s.width + 26;
      });
      const rw = def.reward;
      txt(app, this.c, B.x + 8, cy + cardH - 10, t('orders.reward', { devotion: rw.devotion ?? 0, donations: rw.donations ?? 0, favor: rw.favor ?? 0 }), { color: 'dim', width: B.w - 60, maxLines: 1 });
      if (!o.filled) {
        button(app, this.c, B.x + B.w - 52, cy + cardH - 23, 44, 19, t('orders.deliver'), () => {
          const ok = app.store.act((g, emit) => fillOrder(g, o.id, emit));
          if (ok) dialog(app, { id: `order_${o.id}`, title: t('entity.mothman.name'), body: t(`order.${o.id}.thanks`), sprite: 'mothman', buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
        }, { disabled: !canFill(run, o.id), fill: PAL.acid, name: `btn_deliver_${o.id}` });
      } else {
        img(app, this.c, B.x + B.w - 18, cy + cardH - 14, 'ic_check');
      }
    });
  }
}
