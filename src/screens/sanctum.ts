// The Sanctum: a Fallout-Shelter-style side view of the Sermon Hall and the storeys built on top of it.
// The tower is always 160 px wide (stairs + 3 bays of 48), centred; it scrolls vertically only.
// Rules live in src/core/sanctum.ts; this file draws state and opens cards.
import type Phaser from 'phaser';
import type { App } from '../app';
import { ATLAS } from '../art/sprites';
import { PAL } from '../art/palette';
import { DATA, eventDef, mergeItemKey, type RoomDef } from '../core/data';
import { inv, isAway } from '../core/game';
import {
  assignFollower, buildRoom, buildStorey, canBuildRoom, canBuildStorey, canUpgradeRoom, demolishRoom, effectOf, fit, formCap,
  groupOf, groupSealed, mergePct, nextStorey, roomAt, roomDef, roomGroups, roomUnlocked, roomUpgradeCost, sanctumHeat,
  slotsOf, upgradeRoom, workersOf, type RoomGroup,
} from '../core/sanctum';
import { t } from '../core/text';
import type { Follower } from '../core/types';
import { countItems } from '../puzzle/merge';
import { button, hit, img, inRect, panel, rect, textHeight, txt, type C } from '../ui/kit';
import { dialog, frame, modalWidth } from '../ui/modal';
import { openBuilding, openFollower } from './modals';
import { Screen } from './screen';

const W = 160;
const STAIR = 16;
const BAY = 48;
const H = 48; // storey height: 4 px slab + 44 px room
const STRIP = 26;

export class SanctumScreen extends Screen {
  private tower!: C;
  private scroll = 0; // pixels scrolled up from the Hall
  private drag: { sy: number; s0: number; moved: boolean } | null = null;
  private view = { x: 0, y: 0, w: 0, h: 0 };
  private anim = 0;
  private bob: Phaser.GameObjects.Image[] = [];

  private get maxScroll(): number {
    const run = this.app.store.state.run;
    const content = (run.sanctum.storeys + 2) * H + 40;
    return Math.max(0, content - this.view.h);
  }

  rebuild(): void {
    this.clear();
    this.bob = [];
    const app = this.app;
    const L = app.L;
    const B = L.body;
    const run = app.store.state.run;
    // sky and brick behind everything
    rect(app, this.c, B.x, B.y, B.w, B.h, PAL.night);
    this.view = { x: B.x, y: B.y, w: B.w, h: B.h - STRIP };
    const x0 = B.x + Math.floor((B.w - W) / 2);
    for (let x = B.x; x < B.x + B.w; x += 16) {
      for (let y = B.y; y < B.y + this.view.h; y += 16) {
        const inTower = x + 16 > x0 && x < x0 + W;
        if (!inTower) this.c.add(app.add.image(x, y, ATLAS, 'brick').setOrigin(0, 0).setAlpha(0.35));
      }
    }
    this.tower = app.add.container(0, 0);
    this.c.add(this.tower);
    this.scroll = Math.max(0, Math.min(this.maxScroll, this.scroll));
    const floorY = (s: number) => B.y + this.view.h - (s + 1) * H + this.scroll; // top of storey s (0 = Hall)

    // ground floor: the Main Hall (the Sermon Hall's interior)
    const hall = run.buildings.find((b) => b.type === 'sermon_hall');
    this.drawStorey(0, x0, floorY(0));
    for (let b = 0; b < 3; b++) this.tower.add(app.add.image(x0 + STAIR + b * BAY, floorY(0) + 4, ATLAS, 'room_main_hall').setOrigin(0, 0));
    txt(app, this.tower, x0 + STAIR + 2, floorY(0) + 6, t('sanctum.hall'), { color: 'white' });
    if (hall) {
      const hw = run.followers.filter((f) => f.job === hall.id && !isAway(run, f));
      this.drawWorkers(hw, x0 + STAIR, floorY(0), 3 * BAY);
      hit(app, this.tower, x0 + STAIR, floorY(0), 3 * BAY, H, () => openBuilding(app, hall.id)).setName('room_hall');
    }
    // a visitor waiting in the lobby
    if (run.inspection) {
      const ev = eventDef(run.inspection.event);
      this.tower.add(app.add.image(x0 + W - 18, floorY(0) + H - 17, ATLAS, ev.sprite).setOrigin(0, 0));
    }

    // storeys
    for (let s = 1; s <= run.sanctum.storeys; s++) {
      const y = floorY(s);
      this.drawStorey(s, x0, y);
      for (let bay = 0; bay < 3; bay++) {
        const r = roomAt(run, s, bay);
        const bx = x0 + STAIR + bay * BAY;
        this.tower.add(app.add.image(bx, y + 4, ATLAS, r ? `room_${r.type}` : 'room_empty').setOrigin(0, 0));
        if (!r) {
          rect(app, this.tower, bx + 3, y + 16, BAY - 6, 20, PAL.ink, 0.6);
          txt(app, this.tower, bx + 24, y + 17, t('sanctum.empty_bay'), { align: 'center', color: 'white', width: 42, maxLines: 2 });
          hit(app, this.tower, bx, y, BAY, H, () => this.openBuildRoom(s, bay)).setName(`bay_${s}_${bay}`);
        }
      }
      for (const grp of roomGroups(run).filter((gg) => gg.storey === s)) this.drawGroup(grp, x0, y);
    }

    // roof cap above the highest finished storey (scaffolding sits on top of it)
    this.tower.add(app.add.image(x0, floorY(run.sanctum.storeys) - 16, ATLAS, 'roof_cap').setOrigin(0, 0));

    // the next storey: scaffolding, a build button, or a locked note
    const top = run.sanctum.storeys + 1;
    const ty = run.sanctum.building ? floorY(top) : floorY(top) - 18; // above the roof line
    const next = nextStorey(run);
    const building = run.sanctum.building;
    if (building) {
      this.drawStorey(top, x0, ty - 16);
      for (let b = 0; b < 3; b++) this.tower.add(app.add.image(x0 + STAIR + b * BAY, ty - 12, ATLAS, 'room_scaffold').setOrigin(0, 0));
      const secs = Math.max(1, Math.ceil(building.doneAt - run.time));
      panel(app, this.tower, x0 + 20, ty - 6, W - 24, 24, PAL.white);
      txt(app, this.tower, x0 + W / 2 + 8, ty - 2, t('sanctum.storey.building', { s: secs }), { align: 'center', width: W - 30, maxLines: 2 });
    } else if (next) {
      panel(app, this.tower, x0 + STAIR, ty + 6, W - STAIR, H - 8, PAL.robeD);
      const ok = run.level >= next.level;
      txt(app, this.tower, x0 + STAIR + 4, ty + 9, ok ? t('sanctum.storey.title', { n: top }) : t('sanctum.storey.next', { lv: next.level }), { color: 'pale', width: W - STAIR - 8, maxLines: 1 });
      if (ok) {
        let cx = x0 + STAIR + 4;
        const cy = ty + 21;
        if (next.cost.devotion) { img(app, this.tower, cx, cy, 'ic_devotion'); txt(app, this.tower, cx + 9, cy, String(next.cost.devotion), { color: run.devotion >= next.cost.devotion ? 'white' : 'loss' }); cx += 34; }
        if (next.omens) { img(app, this.tower, cx, cy, 'ic_omen'); txt(app, this.tower, cx + 9, cy, String(next.omens), { color: run.omens >= next.omens ? 'white' : 'loss' }); }
        button(app, this.tower, x0 + W - 78, ty + 20, 74, 19, t('sanctum.build_storey'), () => {
          app.store.act((g, e) => buildStorey(g, e));
          this.rebuild();
        }, { disabled: !canBuildStorey(run), fill: PAL.acid, name: 'btn_storey' });
      }
    } else {
      txt(app, this.tower, x0 + W / 2, ty + 18, t('sanctum.storey.max'), { align: 'center', color: 'pale', width: W - 8, maxLines: 3 });
    }
    // roof cap above the highest storey
    const roofY = (building ? floorY(top) : floorY(run.sanctum.storeys)) - 16;
    void roofY;

    // bottom action strip (fixed, not scrolled)
    const sy = B.y + B.h - STRIP;
    rect(app, this.c, B.x, sy, B.w, STRIP, PAL.robeDD);
    rect(app, this.c, B.x, sy, B.w, 1, PAL.ink);
    button(app, this.c, B.x + 3, sy + 3, 58, 20, t('sanctum.go_out'), () => app.setCompoundView('grounds'), { fill: PAL.blue, name: 'btn_grounds' });
    if (formCap(run) > 0) { img(app, this.c, B.x + 66, sy + 9, 'ic_form'); txt(app, this.c, B.x + 76, sy + 9, `${inv(run, 'filed_form')}/${formCap(run)}`, { color: 'white' }); }
    const heat = sanctumHeat(run);
    if (heat > 0) { img(app, this.c, B.x + B.w - 96, sy + 9, 'ic_suspicion'); txt(app, this.c, B.x + B.w - 86, sy + 9, `+${heat.toFixed(2)}`, { color: 'loss' }); }
    if (!L.dock) button(app, this.c, B.x + B.w - 46, sy + 3, 43, 20, '', () => this.scrollTo(0), { fill: PAL.robe, icon: 'tab_compound', name: 'btn_hall' });
    if (L.dock) this.buildDock();
  }

  private scrollTo(v: number): void {
    this.scroll = Math.max(0, Math.min(this.maxScroll, v));
    this.rebuild();
  }

  private drawStorey(s: number, x0: number, y: number): void {
    const app = this.app;
    rect(app, this.tower, x0, y, W, H, PAL.ink2);
    for (let x = x0; x < x0 + W; x += 16) this.tower.add(app.add.image(x, y, ATLAS, 'slab').setOrigin(0, 0));
    this.tower.add(app.add.image(x0, y, ATLAS, 'stairs').setOrigin(0, 0));
    if (s > 0) txt(app, this.tower, x0 + 2, y + 6, String(s), { color: 'pale' });
  }

  private drawGroup(grp: RoomGroup, x0: number, y: number): void {
    const app = this.app;
    const run = app.store.state.run;
    const bx = x0 + STAIR + grp.bays[0].bay * BAY;
    const w = grp.bays.length * BAY;
    // name plate and level
    const name = t(`room.${grp.type}.name`);
    rect(app, this.tower, bx + 1, y + 5, w - 2, 10, PAL.ink, 0.55);
    txt(app, this.tower, bx + 3, y + 6, name, { color: 'white', width: w - 22, maxLines: 1 });
    txt(app, this.tower, bx + w - 3, y + 6, `L${grp.level}`, { align: 'right', color: 'glow' });
    // merged rooms: hide the inner walls with a light band so they read as one room
    if (grp.bays.length > 1) for (let i = 1; i < grp.bays.length; i++) rect(app, this.tower, bx + i * BAY - 1, y + 16, 2, H - 18, PAL.robeL, 0.25);
    const workers = workersOf(run, grp).filter((f) => !isAway(run, f));
    this.drawWorkers(workers, bx, y, w);
    // empty worker slots as small pips
    const slots = slotsOf(grp);
    for (let i = 0; i < slots; i++) rect(app, this.tower, bx + 3 + i * 5, y + H - 5, 3, 2, i < workers.length ? PAL.acid : PAL.robeD);
    if (groupSealed(run, grp)) {
      const tape = app.add.image(bx + w / 2, y + H / 2 + 4, ATLAS, 'seal_tape').setOrigin(0.5, 0.5);
      tape.setDisplaySize(w - 4, 14);
      this.tower.add(tape);
    }
    hit(app, this.tower, bx, y, w, H, () => this.openRoom(grp.bays[0].id)).setName(`room_${grp.type}_${grp.storey}`);
  }

  private drawWorkers(list: Follower[], bx: number, y: number, w: number): void {
    const app = this.app;
    const step = Math.max(10, Math.min(18, Math.floor((w - 8) / Math.max(1, list.length))));
    list.forEach((f, i) => {
      const s = app.add.image(bx + 6 + i * step, y + H - 1, ATLAS, `fol_${f.skin}_${f.robe}_0`).setOrigin(0, 1);
      s.setData('f', f);
      this.tower.add(s);
      this.bob.push(s);
    });
  }

  /** Landscape side panel: totals. */
  private buildDock(): void {
    const app = this.app;
    const D = app.L.dock!;
    const run = app.store.state.run;
    this.dockBg();
    let y = D.y + 4;
    txt(app, this.c, D.x + 5, y, t('sanctum.title'), { color: 'irony' });
    y += 12;
    for (const grp of roomGroups(run)) {
      if (y > D.y + D.h - 20) break;
      txt(app, this.c, D.x + 5, y, `${t(`room.${grp.type}.name`)} L${grp.level}`, { width: D.w - 9, maxLines: 1 });
      y += 9;
    }
    button(app, this.c, D.x + 4, D.y + D.h - 22, D.w - 8, 18, t('sanctum.go_out'), () => app.setCompoundView('grounds'), { fill: PAL.blue, name: 'btn_grounds_dock' });
  }

  // ---------- cards ----------

  private openBuildRoom(storey: number, bay: number): void {
    const app = this.app;
    app.modals.open({
      id: 'build_room',
      build: (c, _a, close) => {
        const run = app.store.state.run;
        const list = DATA.rooms.rooms;
        const land = app.L.landscape;
        const w = land ? Math.min(app.L.w - 8, 316) : modalWidth(app);
        const cols = land ? 2 : 1;
        const rowH = 30;
        const cw = Math.floor((w - 10 - (cols - 1) * 4) / cols);
        const r = frame(app, c, w, 16 + Math.ceil(list.length / cols) * (rowH + 2) + 22, t('sanctum.build_room'));
        list.forEach((def: RoomDef, i) => {
          const x = r.x + (i % cols) * (cw + 4);
          const y = r.y + Math.floor(i / cols) * (rowH + 2);
          const open = roomUnlocked(run, def.id);
          panel(app, c, x, y, cw, rowH, open ? PAL.white : PAL.robe);
          txt(app, c, x + 3, y + 2, t(`room.${def.id}.name`), { width: cw - 46, maxLines: 1, color: open ? 'ink' : 'dim' });
          if (open) {
            txt(app, c, x + 3, y + 11, `${def.cost.devotion}`, { color: run.devotion >= def.cost.devotion ? 'ink' : 'loss' });
            img(app, c, x + 3 + 6 * String(def.cost.devotion).length, y + 11, 'ic_devotion');
            txt(app, c, x + 3, y + 20, t(`room.${def.id}.desc`), { color: 'dim', width: cw - 46, maxLines: 1 });
            button(app, c, x + cw - 40, y + 6, 37, 18, t('build.pick'), () => {
              if (app.store.act((g, e) => buildRoom(g, storey, bay, def.id, e))) { close(); this.rebuild(); }
            }, { disabled: !canBuildRoom(run, storey, bay, def.id), name: `btn_room_${def.id}` });
          } else {
            img(app, c, x + 3, y + 13, 'ic_lock');
            txt(app, c, x + 13, y + 13, t('sanctum.room.locked', { n: def.unlockLevel }), { color: 'dim' });
          }
        });
        button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
      },
    });
  }

  private effectText(grp: RoomGroup, level: number): string {
    const g2 = { ...grp, level };
    const n = (v: number) => Math.round(v * 10) / 10;
    switch (grp.type) {
      case 'bunk_room': return t('room.bunk_room.effect', { n: effectOf(g2, 'beds') * grp.bays.length });
      case 'kitchen': return t('room.kitchen.effect', { n: n(effectOf(g2, 'sanityPerMin') * grp.bays.length), b: n(effectOf(g2, 'basilPerMin') * grp.bays.length) });
      case 'records_office': return t('room.records_office.effect', { m: n(effectOf(g2, 'formEverySec') / 60), cap: effectOf(g2, 'formCapPerBay') * grp.bays.length });
      case 'reading_room': return t('room.reading_room.effect', { n: n(effectOf(g2, 'doubtPerMin')) });
      case 'ritual_chamber': return effectOf(g2, 'omenPerWin') ? t('room.ritual_chamber.effect3', { n: n(effectOf(g2, 'ritePct') * grp.bays.length) }) : t('room.ritual_chamber.effect', { n: n(effectOf(g2, 'ritePct') * grp.bays.length) });
      case 'wellness_retreat': return t('room.wellness_retreat.effect', { n: n(effectOf(g2, 'donationsPerMin') * grp.bays.length), s: n(effectOf(g2, 'suspicionPerMin') * grp.bays.length) });
      default: return '';
    }
  }

  openRoom(roomId: number): void {
    const app = this.app;
    app.modals.open({
      id: 'room',
      build: (c, _a, close) => {
        const run = app.store.state.run;
        const grp = groupOf(run, roomId);
        if (!grp) { close(); return; }
        const def = roomDef(grp.type);
        const maxL = def.upgrades.length + 1;
        const w = app.L.landscape ? Math.min(app.L.w - 8, 316) : modalWidth(app);
        const tw = w - 10;
        const now = t('building.now', { text: this.effectText(grp, grp.level) }) + (grp.type === 'kitchen' && inv(run, 'basil') === 0 ? `\n${t('room.kitchen.no_basil')}` : '');
        const nextText = grp.level < maxL ? t('building.next', { text: this.effectText(grp, grp.level + 1) }) : t('building.maxed');
        const merge = grp.bays.length > 1 ? t('sanctum.merge', { n: mergePct(grp) }) : '';
        const key = def.key ? t('sanctum.key', { stat: t(`stat.${def.key}.name`) }) : '';
        const workers = workersOf(run, grp);
        const slots = slotsOf(grp);
        const slotRows = Math.ceil(slots / 2);
        const cost = roomUpgradeCost(run, roomId);
        const lines = [t(`room.${grp.type}.desc`), now, nextText, merge, key].filter(Boolean).join('\n');
        const linesH = textHeight(lines, tw);
        const h = 16 + 10 + linesH + 4 + (slots ? 10 + slotRows * 20 : 0) + (cost ? 14 : 0) + 22 + 22;
        const r = frame(app, c, w, h, t(`room.${grp.type}.name`));
        let y = r.y;
        txt(app, c, r.x, y, t('sanctum.room_card.level', { n: grp.level, max: maxL }), { color: 'irony' });
        y += 10;
        txt(app, c, r.x, y, lines, { width: tw });
        y += linesH + 4;
        if (slots) {
          txt(app, c, r.x, y, t('sanctum.slots', { n: workers.length, max: slots }), { color: 'dim' });
          y += 10;
          const sw = Math.floor((tw - 4) / 2);
          for (let i = 0; i < slots; i++) {
            const sx = r.x + (i % 2) * (sw + 4);
            const sy = y + Math.floor(i / 2) * 20;
            const f = workers[i];
            panel(app, c, sx, sy, sw, 18, f ? PAL.white : PAL.robe);
            if (f) {
              img(app, c, sx + 1, sy + 1, `fol_${f.skin}_${f.robe}_0`);
              txt(app, c, sx + 18, sy + 1, f.name, { width: sw - 20, maxLines: 1 });
              txt(app, c, sx + 18, sy + 9, t(`sanctum.fit.${fit(f, grp.type)}`), { color: fit(f, grp.type) === 'poor' ? 'loss' : 'gain' });
              hit(app, c, sx, sy, sw, 18, () => { app.store.act((g) => assignFollower(g, f.id, null)); app.modals.rebuild(); }).setName(`slot_remove_${i}`);
            } else {
              txt(app, c, sx + 4, sy + 5, `+ ${t('sanctum.slot.empty')}`, { color: 'dim', width: sw - 6, maxLines: 1 });
              hit(app, c, sx, sy, sw, 18, () => this.openAssign(roomId)).setName(`slot_${i}`);
            }
          }
          y += slotRows * 20;
        }
        if (cost) {
          let x = r.x;
          txt(app, c, x, y + 2, t('building.needs'), { color: 'dim' }); x += 32;
          img(app, c, x, y + 2, 'ic_devotion'); txt(app, c, x + 9, y + 2, String(cost.devotion), { color: run.devotion >= cost.devotion ? 'gain' : 'loss' }); x += 6 * String(cost.devotion).length + 14;
          img(app, c, x, y + 2, 'ic_donations'); txt(app, c, x + 9, y + 2, String(cost.donations), { color: run.donations >= cost.donations ? 'gain' : 'loss' }); x += 6 * String(cost.donations).length + 14;
          if (cost.omens) { img(app, c, x, y + 2, 'ic_omen'); txt(app, c, x + 9, y + 2, String(cost.omens), { color: run.omens >= cost.omens ? 'gain' : 'loss' }); x += 22; }
          if (cost.merge) {
            const have = countItems(run.reliquary, cost.merge.chain, cost.merge.tier) > 0;
            txt(app, c, x, y + 2, t(`merge.${mergeItemKey(cost.merge.chain, cost.merge.tier)}.name`), { color: have ? 'gain' : 'loss', width: r.x + tw - x, maxLines: 1 });
          }
          y += 14;
        }
        const bw = Math.floor((tw - 4) / 2);
        button(app, c, r.x, y, bw, 19, cost ? t('building.upgrade') : t('building.maxed'), () => { app.store.act((g, e) => upgradeRoom(g, roomId, e)); app.modals.rebuild(); }, { disabled: !cost || !canUpgradeRoom(run, roomId), fill: PAL.acid, name: 'btn_room_upgrade' });
        button(app, c, r.x + bw + 4, y, bw, 19, t('sanctum.demolish'), () => dialog(app, {
          id: 'demolish', title: t('sanctum.demolish'), body: t('sanctum.demolish.body'),
          buttons: [{ label: t('sanctum.demolish'), fill: PAL.pink, name: 'btn_demolish_yes', onClick: () => { app.store.act((g) => demolishRoom(g, roomId)); app.modals.close('room'); this.rebuild(); } }, { label: t('common.cancel') }],
        }), { fill: PAL.pink, name: 'btn_demolish' });
        button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.close'), close, { name: 'btn_close' });
      },
    });
  }

  private openAssign(roomId: number): void {
    const app = this.app;
    app.modals.open({
      id: 'assign',
      build: (c, _a, close) => {
        const run = app.store.state.run;
        const grp = groupOf(run, roomId);
        if (!grp) { close(); return; }
        // anyone not already in this room and not away; best fit first
        const order = { good: 0, ok: 1, poor: 2 };
        const list = run.followers.filter((f) => !grp.bays.some((b) => b.id === f.job) && !isAway(run, f)).sort((a, b) => order[fit(a, grp.type)] - order[fit(b, grp.type)]);
        const w = modalWidth(app);
        const rowH = 20;
        const shown = list.slice(0, 8);
        const r = frame(app, c, w, 16 + Math.max(1, shown.length) * (rowH + 2) + 24, t('sanctum.assign', { room: t(`room.${grp.type}.name`) }));
        if (!shown.length) txt(app, c, r.x, r.y, t('sanctum.assign.none'), { width: r.w });
        const key = roomDef(grp.type).key;
        shown.forEach((f, i) => {
          const y = r.y + i * (rowH + 2);
          panel(app, c, r.x, y, r.w, rowH, PAL.white);
          img(app, c, r.x + 2, y + 2, `fol_${f.skin}_${f.robe}_0`);
          txt(app, c, r.x + 20, y + 2, f.name, { width: r.w - 70, maxLines: 1 });
          const job = run.buildings.find((b) => b.id === f.job) ?? null;
          const where = job ? t(`building.${job.type}.name`) : run.sanctum.rooms.find((x) => x.id === f.job) ? t(`room.${run.sanctum.rooms.find((x) => x.id === f.job)!.type}.name`) : '';
          txt(app, c, r.x + 20, y + 11, where, { color: 'dim', width: r.w - 70, maxLines: 1 });
          if (key) txt(app, c, r.x + r.w - 46, y + 2, `${t(`stat.${key}.short`)}${Math.round(f.stats[key as keyof Follower['stats']])}`, { align: 'right' });
          txt(app, c, r.x + r.w - 46, y + 11, t(`sanctum.fit.${fit(f, grp.type)}`), { align: 'right', color: fit(f, grp.type) === 'poor' ? 'loss' : 'gain' });
          button(app, c, r.x + r.w - 42, y + 1, 40, 18, t('draft.pick'), () => {
            app.store.act((g) => assignFollower(g, f.id, roomId));
            close();
            app.modals.rebuild();
            this.rebuild();
          }, { name: `assign_${i}` });
          hit(app, c, r.x, y, 18, rowH, () => openFollower(app, f));
        });
        button(app, c, r.x + r.w - 50, r.y + r.h - 18, 50, 18, t('common.cancel'), close, { name: 'btn_close' });
      },
    });
  }

  // ---------- input: vertical drag to scroll ----------

  override pointerDown(p: Phaser.Input.Pointer): void {
    if (!inRect(this.view, p.x, p.y)) return;
    this.drag = { sy: p.y, s0: this.scroll, moved: false };
  }
  override pointerMove(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || !p.isDown) return;
    if (!d.moved && Math.abs(p.y - d.sy) < 5) return;
    d.moved = true;
    const next = Math.max(0, Math.min(this.maxScroll, d.s0 + (p.y - d.sy)));
    if (next !== this.scroll) { this.scroll = next; this.rebuild(); this.drag = { ...d, moved: true }; }
  }
  override pointerUp(): void { this.drag = null; }

  override onChanged(): void { if (!this.drag) this.rebuild(); }

  override update(dt: number): void {
    if (!this.visible) return;
    const run = this.app.store.state.run;
    // scaffolding: redraw once a second so the time left stays honest
    if (run.sanctum.building) {
      this.anim += dt;
      if (this.anim >= 1) { this.anim = 0; this.rebuild(); }
      return;
    }
    if (this.app.store.state.meta.settings.reducedMotion) return;
    this.anim += dt;
    if (this.anim < 0.3) return;
    this.anim = 0;
    for (const s of this.bob) {
      const f = s.getData('f') as Follower;
      if (s.active) s.setFrame(s.frame.name.endsWith('_0') ? `fol_${f.skin}_${f.robe}_1` : `fol_${f.skin}_${f.robe}_0`);
    }
  }
}

