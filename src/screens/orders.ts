// The order board. Pick an entity along the top; each one keeps two requests open and refills from its
// own pool. Filling orders pays Devotion, Donations, XP and Favor; Favor unlocks that entity's boons.
import type { App } from '../app';
import { PAL } from '../art/palette';
import { DATA, entityDef, mergeItemKey, orderDef, ritualDef, type EntityDef } from '../core/data';
import { activeOrders, boonsUnlocked, canAudience, canFill, fillOrder, grantAudience, needHave, rerollOrder, ritualUnlocked } from '../core/game';
import { t } from '../core/text';
import { bar, button, hit, img, panel, rect, txt } from '../ui/kit';
import { dialog } from '../ui/modal';
import { Screen } from './screen';

export class OrdersScreen extends Screen {
  /** Which entity's board is showing (a view choice, not game state). */
  selected: string | null = null;

  private current(): EntityDef {
    const run = this.app.store.state.run;
    const id = this.selected && DATA.entities.some((e) => e.id === this.selected) ? this.selected : run.met[run.met.length - 1] ?? DATA.entities[0].id;
    return entityDef(id);
  }

  rebuild(): void {
    this.clear();
    const app = this.app;
    const L = app.L;
    const B = L.body;
    const run = app.store.state.run;
    rect(app, this.c, B.x, B.y, B.w, B.h, PAL.sand);
    this.dockBg();
    const ent = this.current();
    const met = run.met.includes(ent.id);

    // --- entity selector
    const n = DATA.entities.length;
    const cw = Math.min(36, Math.floor((B.w - 4) / n));
    const x0 = B.x + Math.floor((B.w - cw * n) / 2);
    DATA.entities.forEach((e, i) => {
      const x = x0 + i * cw;
      const known = run.met.includes(e.id);
      panel(app, this.c, x, B.y + 2, cw - 1, 36, e.id === ent.id ? PAL.yellow : known ? PAL.white : PAL.robe);
      img(app, this.c, x + Math.floor((cw - 1 - 32) / 2), B.y + 4, known ? e.id : 'unknown_entity');
      if (known && activeOrders(run, e.id).some((o) => canFill(run, o.id))) img(app, this.c, x + cw - 11, B.y + 4, 'ic_check');
      hit(app, this.c, x, B.y + 2, cw - 1, 36, () => { this.selected = e.id; this.rebuild(); }).setName(`ent_${e.id}`);
    });
    let y = B.y + 41;

    // --- header: favor and boons (dock in landscape)
    const fav = run.favor[ent.id] ?? 0;
    const got = met ? boonsUnlocked(run, ent.id) : 0;
    const next = ent.boons[got];
    const boonText = (b: EntityDef['boons'][number]) => t(`boon.${b.field}`, { n: b.value });
    const audienceDone = run.audiences.includes(ent.id);
    const nextLine = !met ? '' : next ? t('orders.next_boon', { n: next.favor, boon: boonText(next) }) : audienceDone ? `${t('orders.audience.done')}: ${t(`boon.${ent.audience.field}`, { n: ent.audience.value })}` : t('orders.audience.needs', { n: DATA.rites.omens.audienceFavor });
    const audienceButton = (x: number, y: number, w: number) => {
      if (!met || next || audienceDone) return;
      button(app, this.c, x, y, w, 18, t('orders.audience'), () => {
        if (app.store.act((g) => grantAudience(g, ent.id))) dialog(app, { id: 'audience', title: t('audience.title'), sprite: ent.id, body: `${t(`entity.${ent.id}.audience`)}\n${t('audience.body', { name: t(`entity.${ent.id}.name`), boon: t(`boon.${ent.audience.field}`, { n: ent.audience.value }) })}`, buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
      }, { disabled: !canAudience(run, ent.id), fill: PAL.purple, icon: 'ic_omen', name: 'btn_audience' });
    };
    const prevAt = got > 0 ? ent.boons[got - 1].favor : 0;
    const frac = next ? (fav - prevAt) / (next.favor - prevAt) : 1;
    if (L.dock) {
      const D = L.dock;
      img(app, this.c, D.x + Math.floor((D.w - 32) / 2), D.y + 4, met ? ent.id : 'unknown_entity');
      txt(app, this.c, D.x + Math.floor(D.w / 2), D.y + 38, met ? t(`entity.${ent.id}.name`) : t('orders.locked'), { align: 'center', color: 'irony', width: D.w - 6, maxLines: 2 });
      if (met) {
        let dy = D.y + 58;
        img(app, this.c, D.x + 5, dy, 'ic_favor');
        txt(app, this.c, D.x + 16, dy, t('orders.favor', { n: fav }));
        bar(app, this.c, D.x + 5, dy + 10, D.w - 10, 6, frac, PAL.purple);
        dy += 19;
        txt(app, this.c, D.x + 5, dy, nextLine, { width: D.w - 9, maxLines: 4, color: 'ink' });
        dy += 38;
        if (!next && !audienceDone) { audienceButton(D.x + 4, dy - 4, D.w - 8); dy += 18; }
        ent.boons.slice(0, got).forEach((b) => { if (dy < D.y + D.h - 9) { txt(app, this.c, D.x + 5, dy, boonText(b), { color: 'gain', width: D.w - 9, maxLines: 2 }); dy += 19; } });
      }
    } else if (met) {
      panel(app, this.c, B.x + 4, y, B.w - 8, 40, PAL.white);
      txt(app, this.c, B.x + 8, y + 3, t(`entity.${ent.id}.name`), { color: 'irony', width: B.w - 70, maxLines: 1 });
      txt(app, this.c, B.x + B.w - 8, y + 3, t('orders.favor', { n: fav }), { align: 'right' });
      bar(app, this.c, B.x + 8, y + 13, B.w - 16, 6, frac, PAL.purple);
      if (!next && !audienceDone) { txt(app, this.c, B.x + 8, y + 23, t('orders.all_boons'), { color: 'gain', width: B.w - 110, maxLines: 1 }); audienceButton(B.x + B.w - 100, y + 20, 92); }
      else txt(app, this.c, B.x + 8, y + 21, nextLine, { width: B.w - 16, maxLines: 2, color: next ? 'ink' : 'gain' });
      y += 43;
    }

    // --- not met yet: say how
    if (!met) {
      const lv = ritualDef(ent.summonRitual);
      const ready = ritualUnlocked(run, lv.id);
      panel(app, this.c, B.x + 4, y, B.w - 8, 52, PAL.white);
      txt(app, this.c, B.x + 8, y + 4, t('orders.locked'), { color: 'irony' });
      txt(app, this.c, B.x + 8, y + 15, ready ? t('orders.locked.ready', { ritual: t(lv.nameKey) }) : t('orders.locked.hint', { n: lv.unlock?.level ?? 1, ritual: t(lv.nameKey) }), { width: B.w - 16, maxLines: 4 });
      return;
    }

    // --- this entity's open orders
    const orders = activeOrders(run, ent.id);
    if (orders.length === 0) txt(app, this.c, B.x + 6, y + 2, run.time < (run.orderNextAt[ent.id] ?? 0) ? t('orders.waiting') : t('orders.none_possible'), { width: B.w - 12 });
    for (const o of orders) {
      const def = orderDef(o.id);
      const tagged = def.kind !== 'entity';
      const cardH = (L.dock ? 56 : 64) + (tagged ? 9 : 0);
      if (y + cardH > B.y + B.h) break;
      panel(app, this.c, B.x + 4, y, B.w - 8, cardH, PAL.white);
      let ty = y + 3;
      if (tagged) { txt(app, this.c, B.x + 8, ty, t(`orders.kind.${def.kind}`), { color: 'gold', width: B.w - 16, maxLines: 1 }); ty += 9; }
      txt(app, this.c, B.x + 8, ty, t(`order.${o.id}.text`), { width: B.w - 16, maxLines: 3 });
      let nx = B.x + 8;
      const ny = y + cardH - 30;
      for (const need of def.needs) {
        const key = 'item' in need ? `i_${need.item}` : `m_${mergeItemKey(need.merge, need.tier)}`;
        const s = img(app, this.c, nx, ny + ('item' in need ? 3 : 0), key);
        const have = needHave(run, need);
        txt(app, this.c, nx + s.width + 2, ny + 7, `${Math.min(have, need.count)}/${need.count}`, { color: have >= need.count ? 'gain' : 'loss' });
        nx += s.width + 24;
      }
      const rw = def.reward;
      txt(app, this.c, B.x + 8, y + cardH - 10, t('orders.reward', { devotion: rw.devotion ?? 0, donations: rw.donations ?? 0, favor: rw.favor ?? 0 }), { color: 'dim', width: B.w - 84, maxLines: 1 });
      if (run.omens >= DATA.rites.omens.rerollCost) {
        button(app, this.c, B.x + B.w - 76, y + cardH - 23, 22, 19, '', () => dialog(app, {
          id: 'reroll', title: t('orders.reroll.title'), body: t('orders.reroll.body', { name: t(`entity.${def.from}.name`) }),
          buttons: [{ label: t('orders.reroll'), fill: PAL.purple, name: 'btn_reroll_yes', onClick: () => app.store.act((g, e) => rerollOrder(g, o.id, e)) }, { label: t('common.cancel') }],
        }), { fill: PAL.purple, icon: 'ic_omen', name: `btn_reroll_${o.id}` });
      }
      button(app, this.c, B.x + B.w - 52, y + cardH - 23, 44, 19, t('orders.deliver'), () => this.deliver(o.id), { disabled: !canFill(run, o.id), fill: PAL.acid, name: `btn_deliver_${o.id}` });
      y += cardH + 3;
    }
  }

  private deliver(orderId: string): void {
    const app = this.app;
    const def = orderDef(orderId);
    const res = app.store.act((g, emit) => fillOrder(g, orderId, emit));
    if (!res.ok) return;
    const lines = [t(`order.${orderId}.thanks`)];
    if (def.kind === 'gamble') lines.push(t('orders.gamble', { name: t(`entity.${def.from}.name`), n: res.mult }));
    lines.push(t('orders.paid', { devotion: res.devotion, donations: res.donations, favor: res.favor }));
    dialog(app, { id: `order_${orderId}`, title: t(`entity.${def.from}.name`), body: lines.join('\n'), sprite: def.from, buttons: [{ label: t('common.ok'), name: 'btn_ok' }] });
  }

  /** Orders can appear while you watch (the refill timer). */
  private seen = '';
  override update(_dt: number): void {
    if (!this.visible) return;
    const key = this.app.store.state.run.orders.map((o) => o.id).join(',');
    if (key !== this.seen) { this.seen = key; this.rebuild(); }
  }
}
