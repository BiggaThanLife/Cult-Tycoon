// The single Phaser scene. Owns layout, HUD, the screen for the active tab, modals and floaty text.
import Phaser from 'phaser';
import { buildFonts } from './art/font';
import { hex, PAL, type FontColor } from './art/palette';
import { buildAtlas } from './art/sprites';
import { DATA } from './core/data';
import { devotionCap, suspicionBand, tabUnlocked, unlocksAt, xpNeeded, type TabId } from './core/game';
import { ritualDef } from './core/data';
import { sanctumUnlocked } from './core/sanctum';
import type { Store } from './core/store';
import { t } from './core/text';
import type { GameEvent, TutorialStep } from './core/types';
import { bar, button, hit, img, panel, rect, txt, type C } from './ui/kit';
import { computeLayout, type Layout } from './ui/layout';
import { Modals } from './ui/modal';
import { sfx } from './ui/sfx';
import { autoModals, openMenu, type Notice } from './screens/modals';
import type { Screen } from './screens/screen';
import { CompoundScreen } from './screens/compound';
import { SanctumScreen } from './screens/sanctum';
import { RitualScreen } from './screens/rituals';
import { ReliquaryScreen } from './screens/reliquary';
import { AlchemyScreen } from './screens/alchemy';
import { OrdersScreen } from './screens/orders';

export const TABS: TabId[] = ['compound', 'rituals', 'reliquary', 'alchemy', 'orders'];

/** Which tab the tutorial currently wants the player on. */
export function tutorialTab(step: TutorialStep): TabId | null {
  switch (step) {
    case 'build_hall': case 'collect': case 'build_greenhouse': case 'build_lab': return 'compound';
    case 'ritual1': case 'ritual2': case 'ritual3': return 'rituals';
    case 'plant': case 'harvest': case 'brew': return 'alchemy';
    case 'merge': return 'reliquary';
    case 'orders': return 'orders';
    default: return null;
  }
}

export class App extends Phaser.Scene {
  store!: Store;
  L!: Layout;
  tab: TabId = 'compound';
  modals!: Modals;
  screens!: Record<TabId, Screen>;
  sanctum!: SanctumScreen;
  /** The Compound tab shows the grounds map or the Sanctum side view (a view choice, kept across rotation). */
  compoundView: 'grounds' | 'sanctum' = 'grounds';
  /** The screen currently on show. */
  get cur(): Screen { return this.tab === 'compound' && this.compoundView === 'sanctum' ? this.sanctum : this.screens[this.tab]; }

  setCompoundView(v: 'grounds' | 'sanctum'): void {
    if (v === this.compoundView) return;
    this.cur.hide();
    this.compoundView = v;
    if (v === 'sanctum') this.store.act((g) => { g.run.flags.sanctumSeen = true; });
    this.cur.show();
    this.hudDirty = true;
  }
  private screenLayer!: C;
  private hudLayer!: C;
  private floatLayer!: C;
  private modalLayer!: C;
  private hud!: C;
  private hudDirty = true;
  private screenDirty = true;
  private hudText: { omens?: Phaser.GameObjects.BitmapText; devotion?: Phaser.GameObjects.BitmapText; donations?: Phaser.GameObjects.BitmapText; susp?: Phaser.GameObjects.BitmapText; suspBar?: Phaser.GameObjects.Rectangle; suspW?: number } = {};
  private lastHud = '';
  private floatStack = 0;
  /** Announcements waiting for a quiet moment (level-ups, boons). */
  notices: Notice[] = [];

  constructor() { super('app'); }

  init(data: { store: Store }): void { this.store = data.store; }

  create(): void {
    buildFonts(this);
    buildAtlas(this);
    this.L = computeLayout();
    this.screenLayer = this.add.container(0, 0).setDepth(0);
    this.hudLayer = this.add.container(0, 0).setDepth(10);
    this.floatLayer = this.add.container(0, 0).setDepth(20);
    this.modalLayer = this.add.container(0, 0).setDepth(30);
    this.hud = this.add.container(0, 0);
    this.hudLayer.add(this.hud);
    this.modals = new Modals(this, this.modalLayer);
    this.screens = {
      compound: new CompoundScreen(this, this.screenLayer),
      rituals: new RitualScreen(this, this.screenLayer),
      reliquary: new ReliquaryScreen(this, this.screenLayer),
      alchemy: new AlchemyScreen(this, this.screenLayer),
      orders: new OrdersScreen(this, this.screenLayer),
    };
    this.sanctum = new SanctumScreen(this, this.screenLayer);
    this.store.on((e) => this.onGameEvent(e));
    this.cur.show();

    const route = (fn: 'pointerDown' | 'pointerMove' | 'pointerUp') => (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.modals.active) return;
      if (fn === 'pointerDown' && over && over.length) return;
      this.cur[fn](p);
    };
    sfx.setEnabled(this.store.state.meta.settings.sound !== false);
    this.input.on('pointerdown', () => sfx.unlock());
    this.input.on('pointerdown', route('pointerDown'));
    this.input.on('pointermove', route('pointerMove'));
    this.input.on('pointerup', route('pointerUp'));
    this.input.keyboard?.on('keydown-BACKTICK', () => openMenu(this, 'debug'));
  }

  // ---------- layout ----------

  /** Called by main.ts after the canvas has been resized. Nothing is reloaded; state is untouched. */
  relayout(): void {
    this.L = computeLayout();
    this.buildHud();
    this.cur.rebuild();
    this.modals.rebuild();
    this.hudDirty = false;
    this.screenDirty = false;
  }

  goto(tab: TabId): void {
    if (tab === this.tab || !tabUnlocked(this.store.state.run, tab)) return;
    this.cur.hide();
    this.tab = tab;
    this.cur.show();
    this.hudDirty = true;
  }

  // ---------- events ----------

  private onGameEvent(e: GameEvent): void {
    switch (e.type) {
      case 'changed':
      case 'tutorial':
        this.hudDirty = true;
        this.screenDirty = true;
        break;
      case 'levelUp':
        this.notices.push({ kind: 'level', level: e.level });
        sfx.win();
        break;
      case 'boon':
        this.notices.push({ kind: 'boon', entity: e.entity, index: e.index });
        break;
      case 'float': {
        const params: Record<string, string | number> = { ...(e.params ?? {}) };
        if (typeof params.item === 'string') params.item = t(params.item);
        const pos = e.at ? this.cur.floatPos(e.at) : null;
        this.float(t(e.textKey, params), pos ?? undefined, e.tone);
        break;
      }
      default:
        break;
    }
  }

  /** Floating text pop (`+3 Devotion`). */
  float(text: string, at?: { x: number; y: number }, tone: 'gain' | 'loss' | 'irony' = 'gain'): void {
    const L = this.L;
    const color: FontColor = tone === 'gain' ? 'gain' : tone === 'loss' ? 'loss' : 'irony';
    const x = at ? at.x : L.body.x + Math.floor(L.body.w / 2);
    const y0 = at ? at.y : L.body.y + 10 + (this.floatStack++ % 4) * 11;
    const c = this.add.container(0, 0);
    this.floatLayer.add(c);
    const label = txt(this, c, 0, 0, text, { align: 'center', color });
    const w = Math.ceil(label.width) + 6;
    const cx = Math.max(L.safe.l + w / 2 + 1, Math.min(L.w - L.safe.r - w / 2 - 1, x));
    c.removeAll(false);
    const bg = this.add.rectangle(0, 0, w, 11, hex(PAL.white), 0.92).setOrigin(0.5, 0).setStrokeStyle(1, hex(PAL.ink));
    c.add(bg);
    c.add(label);
    label.y = 2;
    c.setPosition(Math.round(cx), Math.round(y0));
    const reduced = this.store.state.meta.settings.reducedMotion;
    this.tweens.add({
      targets: c, y: reduced ? y0 : y0 - 12, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.easeIn',
      onComplete: () => c.destroy(),
    });
  }

  // ---------- HUD ----------

  private buildHud(): void {
    const L = this.L;
    const run = this.store.state.run;
    const settings = this.store.state.meta.settings;
    const h = this.hud;
    h.removeAll(true);
    this.hudText = {};
    const speed = DATA.balance.speeds[settings.speedIndex] ?? 1;
    const cycleSpeed = () => this.store.act((g) => { g.meta.settings.speedIndex = (g.meta.settings.speedIndex + 1) % DATA.balance.speeds.length; });
    const suspColor = [PAL.grass, PAL.yellow, PAL.wood, PAL.red][suspicionBand(run.suspicion)];

    if (L.top && L.tabs) {
      // --- portrait: top resource bar ---
      const T = L.top;
      rect(this, h, 0, 0, L.w, T.y + T.h, PAL.robeDD);
      rect(this, h, 0, T.y + T.h - 1, L.w, 1, PAL.ink);
      const rightW = 46;
      img(this, h, T.x + 3, T.y + 3, 'ic_devotion');
      this.hudText.devotion = txt(this, h, T.x + 13, T.y + 3, '', { color: 'white' });
      img(this, h, T.x + 50, T.y + 3, 'ic_donations');
      this.hudText.donations = txt(this, h, T.x + 60, T.y + 3, '', { color: 'white' });
      txt(this, h, T.x + 92, T.y + 3, t('hud.level', { n: run.level }), { color: 'glow' });
      bar(this, h, T.x + 92 + 24, T.y + 4, Math.max(10, T.w - rightW - 92 - 28), 6, run.xp / xpNeeded(run.level), PAL.teal);
      if (run.suspicionSeen) {
        img(this, h, T.x + 3, T.y + 14, 'ic_suspicion');
        const omenW = run.flags.riteUsed || run.omens ? 30 : 0;
        const bw = T.w - rightW - 16 - 26 - omenW;
        if (omenW) {
          img(this, h, T.x + T.w - rightW - omenW - 1, T.y + 14, 'ic_omen');
          this.hudText.omens = txt(this, h, T.x + T.w - rightW - omenW + 9, T.y + 14, '', { color: 'glow' });
        }
        this.hudText.suspW = bw - 2;
        this.hudText.suspBar = bar(this, h, T.x + 13, T.y + 15, bw, 6, run.suspicion / 100, suspColor);
        this.hudText.susp = txt(this, h, T.x + 13 + bw + 3, T.y + 14, '', { color: 'white' });
      } else {
        txt(this, h, T.x + 3, T.y + 14, t('hud.quiet'), { color: 'pale' });
      }
      button(this, h, T.x + T.w - rightW, T.y + 2, 22, 21, `${speed}x`, cycleSpeed, { fill: PAL.blue, name: 'btn_speed' });
      button(this, h, T.x + T.w - 23, T.y + 2, 22, 21, '', () => openMenu(this), { fill: PAL.robe, name: 'btn_menu' });
      img(this, h, T.x + T.w - 18, T.y + 6, 'ic_menu');

      // --- portrait: tab bar ---
      const B = L.tabs;
      rect(this, h, 0, B.y, L.w, L.h - B.y, PAL.robeDD);
      rect(this, h, 0, B.y, L.w, 1, PAL.ink);
      const tw = Math.floor(B.w / TABS.length);
      TABS.forEach((id, i) => this.tabButton(h, id, B.x + i * tw + Math.floor((B.w - tw * TABS.length) / 2), B.y + 2, tw - 1, B.h - 3, false));
    } else if (L.rail && L.dock) {
      // --- landscape: left rail with resources and tabs ---
      const R = L.rail;
      rect(this, h, 0, 0, R.x + R.w, L.h, PAL.robeDD);
      rect(this, h, R.x + R.w - 1, 0, 1, L.h, PAL.ink);
      let y = R.y + 3;
      img(this, h, R.x + 3, y, 'ic_devotion');
      this.hudText.devotion = txt(this, h, R.x + 13, y, '', { color: 'white' });
      if (run.flags.riteUsed || run.omens) {
        img(this, h, R.x + 40, y + 10, 'ic_omen');
        this.hudText.omens = txt(this, h, R.x + 50, y + 10, '', { color: 'glow' });
      }
      y += 10;
      img(this, h, R.x + 3, y, 'ic_donations');
      this.hudText.donations = txt(this, h, R.x + 13, y, '', { color: 'white' });
      y += 10;
      txt(this, h, R.x + 3, y, t('hud.level', { n: run.level }), { color: 'glow' });
      bar(this, h, R.x + 27, y + 1, R.w - 31, 6, run.xp / xpNeeded(run.level), PAL.teal);
      y += 10;
      if (run.suspicionSeen) {
        img(this, h, R.x + 3, y, 'ic_suspicion');
        const bw = R.w - 34;
        this.hudText.suspW = bw - 2;
        this.hudText.suspBar = bar(this, h, R.x + 13, y + 1, bw, 6, run.suspicion / 100, suspColor);
        this.hudText.susp = txt(this, h, R.x + 13 + bw + 2, y, '', { color: 'white' });
      } else {
        txt(this, h, R.x + 3, y, t('hud.quiet'), { color: 'pale' });
      }
      y += 11;
      button(this, h, R.x + 2, y, 28, 17, `${speed}x`, cycleSpeed, { fill: PAL.blue, name: 'btn_speed' });
      button(this, h, R.x + 31, y, 28, 17, '', () => openMenu(this), { fill: PAL.robe, name: 'btn_menu' });
      img(this, h, R.x + 39, y + 3, 'ic_menu');
      y += 19;
      const th = Math.max(16, Math.min(22, Math.floor((R.y + R.h - y - 1) / TABS.length)));
      TABS.forEach((id, i) => this.tabButton(h, id, R.x + 2, y + i * th, R.w - 5, th - 1, true));
    }

    // --- advisor banner ---
    const N = L.banner;
    if (!this.cur.fullHeight()) {
      rect(this, h, N.x, N.y, N.w, N.h, PAL.white);
      rect(this, h, N.x, N.y + N.h - 1, N.w, 1, PAL.ink);
      img(this, h, N.x + 2, N.y + 3, 'advisor');
      txt(this, h, N.x + 21, N.y + 2, this.tipText(), { width: N.w - 24, maxLines: N.h > 24 ? 3 : 2 });
    }
    this.lastHud = '';
    this.refreshHud();
  }

  /** Advisor strip: the tutorial step, then the next concrete goal once the tutorial is over. */
  private tipText(): string {
    const run = this.store.state.run;
    if (run.inspection) return t('inspection.waiting');
    if (run.tutorial !== 'done') return t(`tip.${run.tutorial}`);
    if (!run.flags.riteUsed) return t('tip.rites');
    if (sanctumUnlocked(run) && !run.flags.sanctumSeen) return t('tip.sanctum');
    if (run.sanctum.storeys > 0 && run.sanctum.rooms.length === 0) return t('tip.sanctum.room');
    if (run.devotion >= devotionCap(run)) return t('float.cap');
    for (let lv = run.level + 1; lv <= run.level + 3; lv++) {
      const u = unlocksAt(lv)[0];
      if (!u) continue;
      const what = u.kind === 'crop' ? t(`item.${u.id}.name`) : u.kind === 'generator' ? t(`gen.${u.id}.name`) : t(ritualDef(u.id).nameKey);
      return lv === run.level + 1 ? t('tip.goal.unlock', { n: lv, what }) : t('tip.goal', { n: run.level + 1 });
    }
    return t('tip.done');
  }

  private tabButton(h: C, id: TabId, x: number, y: number, w: number, hh: number, wide: boolean): void {
    const run = this.store.state.run;
    const unlocked = tabUnlocked(run, id);
    const active = this.tab === id;
    const want = tutorialTab(run.tutorial) === id && !active && unlocked;
    panel(this, h, x, y, w, hh, active ? PAL.yellow : unlocked ? PAL.robe : PAL.robeD);
    if (wide) {
      img(this, h, x + 3, y + Math.floor((hh - 12) / 2), unlocked ? `tab_${id}` : 'ic_lock');
      txt(this, h, x + 18, y + Math.floor((hh - 8) / 2), unlocked ? t(`tab.${id}`) : t('tab.locked'), { color: unlocked ? 'ink' : 'pale' });
    } else {
      img(this, h, x + Math.floor((w - (unlocked ? 12 : 8)) / 2), y + 2, unlocked ? `tab_${id}` : 'ic_lock');
      txt(this, h, x + Math.floor(w / 2), y + 15, unlocked ? t(`tab.${id}`) : t('tab.locked'), { align: 'center', color: unlocked ? 'ink' : 'pale' });
    }
    if (want) {
      const glow = this.add.rectangle(x, y, w, hh).setOrigin(0, 0).setStrokeStyle(2, hex(PAL.acid));
      h.add(glow);
      if (!this.store.state.meta.settings.reducedMotion) this.tweens.add({ targets: glow, alpha: 0.25, duration: 500, yoyo: true, repeat: -1 });
    }
    if (unlocked) hit(this, h, x, y, w, hh, () => this.goto(id)).setName(`tab_${id}`);
  }

  private refreshHud(): void {
    const run = this.store.state.run;
    const key = `${Math.floor(run.devotion)}|${Math.floor(run.donations)}|${Math.round(run.suspicion)}|${run.omens}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.hudText.devotion?.setText(String(Math.floor(run.devotion)));
    this.hudText.donations?.setText(String(Math.floor(run.donations)));
    this.hudText.susp?.setText(String(Math.round(run.suspicion)));
    this.hudText.omens?.setText(String(run.omens));
    if (this.hudText.suspBar && this.hudText.suspW) this.hudText.suspBar.width = Math.round(this.hudText.suspW * Math.min(1, run.suspicion / 100));
  }

  // ---------- frame ----------

  override update(_time: number, deltaMs: number): void {
    const dt = Math.min(1, deltaMs / 1000); // a background tab never becomes a time machine
    const st = this.store.state;
    const speed = DATA.balance.speeds[st.meta.settings.speedIndex] ?? 1;
    this.store.update(dt, speed);
    st.meta.stats.modeSec[this.tab] = (st.meta.stats.modeSec[this.tab] ?? 0) + dt;
    if (this.hudDirty) { this.buildHud(); this.hudDirty = false; }
    if (this.screenDirty) { this.cur.onChanged(); this.screenDirty = false; }
    this.refreshHud();
    this.cur.update(dt);
    this.modals.update(dt);
    autoModals(this);
  }
}
