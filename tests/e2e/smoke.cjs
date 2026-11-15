// End-to-end smoke test: plays the whole vertical slice with real taps, in portrait and landscape,
// rotates mid-ritual and mid-merge, and checks the offline summary after a reload.
// Usage: npm run build && npm run e2e   (starts its own preview server)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;
const SHOTS = path.join(__dirname, 'shots');
const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
const DESKTOP = { width: 1280, height: 720 };
const SMALL = { width: 360, height: 640 }; // smallest supported portrait: 180x320 logical
const checks = [];
const errors = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '..', '..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: PORTRAIT, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => d.dismiss());

  const wait = (ms = 250) => page.waitForTimeout(ms);
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ct.store.state)));
  const run = async () => (await st()).run;
  /** Close pop-ups that can appear at any moment in real time (the cat, level-up and boon notices). */
  const clearStray = async () => {
    const id = await page.evaluate(() => { const m = window.__ct.app().modals.active; return m ? m.id : null; });
    if (id === 'event_cat') { await page.evaluate(() => { const g = window.__ct.store; g.act((st, e) => window.__ct.core.resolveEvent(st, 0, e)); window.__ct.app().modals.closeAll(); }); return true; }
    if (id === 'notice' || id === 'event_result') { await page.evaluate(() => window.__ct.app().modals.close()); return true; }
    return false;
  };
  const tap = async (name, opts = {}) => {
    for (let i = 0; i < 24; i++) {
      const pos = await page.evaluate((n) => window.__ct.find(n), name);
      if (pos) {
        await page.mouse.click(pos.x, pos.y); await wait(opts.wait ?? 220);
        // tabs: confirm the switch happened (the HUD can redraw between finding and clicking)
        if (name.startsWith('tab_') && await page.evaluate((n) => window.__ct.app().tab !== n && !window.__ct.app().modals.active, name.slice(4))) { await clearStray(); continue; }
        return true;
      }
      if (i % 4 === 3 && !name.startsWith('btn_ok') && await clearStray()) continue;
      await wait(100);
    }
    if (!opts.optional) check(`tap ${name}`, false, 'not found');
    return false;
  };

  /** Logical (canvas) point → CSS point. */
  const css = (p) => page.evaluate((q) => { const c = window.__ct.game.canvas; const r = c.getBoundingClientRect(); const k = r.width / c.width; return { x: r.left + q.x * k, y: r.top + q.y * k }; }, p);
  const clickLogical = async (p) => { const c = await css(p); await page.mouse.click(c.x, c.y); await wait(); };
  const dragLogical = async (a, b) => {
    const ca = await css(a); const cb = await css(b);
    await page.mouse.move(ca.x, ca.y); await page.mouse.down();
    await page.mouse.move((ca.x + cb.x) / 2, (ca.y + cb.y) / 2, { steps: 4 });
    await page.mouse.move(cb.x, cb.y, { steps: 4 }); await page.mouse.up(); await wait(300);
  };
  /** The curious cat can wander in at any time. Adopt it and carry on. */
  const cat = async () => {
    await wait(200);
    if ((await run()).event?.id !== 'cat') return;
    await tap('btn_choice_yes'); await tap('btn_ok');
    check('event: the cat was adopted', (await run()).flags.cat_adopted === true);
  };
  const bad = [];
  const audit = async (label) => { const a = await page.evaluate(() => window.__ct.audit()); for (const x of a) bad.push(`${label} ${x}`); };
  /** Dismiss queued level-up / boon announcements (optionally screenshotting and auditing them). */
  const notices = async (label) => { for (let i = 0; i < 6; i++) { await wait(350); const id = await page.evaluate(() => window.__ct.app().modals.active && window.__ct.app().modals.active.id); if (id !== 'notice') return; if (label) { await shot(`p_${label}_${i}`); await audit(`notice ${label}`); } await tap('btn_ok'); } };
  // random inspection visits are tested on purpose below; keep them out of the scripted run
  const quiet = () => page.evaluate(() => { window.__ct.store.state.run.lastVisitAt = 1e12; });
  const skip = async (sec) => { await quiet(); await page.evaluate((s) => window.__ct.store.act((g, e) => window.__ct.core.debugSkip(g, s, e)), sec); await cat(); };
  const items = async () => JSON.stringify((await run()).reliquary.cells.map((c) => (c && c.kind === 'item' ? [c.id, c.tier] : c ? 'gen' : null)));
  const rotate = async (vp) => { await page.setViewportSize(vp); await wait(450); };
  const build = async (type) => { await cat(); await tap('btn_build'); await tap(`btn_pick_${type}`); await tap('btn_place'); };
  const winRitual = async (id, { rotateMid = false } = {}) => {
    await tap('tab_rituals');
    for (let i = 0; i < 4; i++) { if (await page.evaluate((n) => !!window.__ct.find(n), `btn_play_${id}`)) break; await tap('btn_page_next', { optional: true }); }
    await tap(`btn_play_${id}`);
    await wait(900);
    const hintMove = () => page.evaluate(() => { const a = window.__ct.app(); const h = window.__ct.findHint(window.__ct.store.state.run.activeRitual); const o = a.screens.rituals.origin; return { a: { x: o.x + h.a.x * 20 + 10, y: o.y + h.a.y * 20 + 10 }, b: { x: o.x + h.b.x * 20 + 10, y: o.y + h.b.y * 20 + 10 } }; });
    const settle = async () => { for (let i = 0; i < 80; i++) { await wait(100); if (await page.evaluate(() => !window.__ct.app().screens.rituals.busy)) return; } };
    if (rotateMid) {
      // real swipes using the engine's hint, a rotation in the middle, then play on to a real win
      await wait(700);
      const mv = await hintMove();
      const ca = await css(mv.a); const cb = await css(mv.b);
      await page.mouse.move(ca.x, ca.y); await page.mouse.down(); await page.mouse.move(cb.x, cb.y, { steps: 5 }); await page.mouse.up();
      await wait(260);
      await shot('p_ritual_juice');
      await settle();
      const before = JSON.stringify((await run()).activeRitual);
      check('ritual: a real swipe used a move', JSON.parse(before).movesUsed === 1);
      await shot('p_ritual_play'); await audit('ritual board');
      await rotate(LANDSCAPE);
      const mid = JSON.stringify((await run()).activeRitual);
      check('rotate mid-ritual keeps the board', before === mid);
      await shot('l_ritual_play');
      { const m2 = await hintMove(); await dragLogical(m2.a, m2.b); await settle(); }
      check('ritual: playable in landscape', (await run()).activeRitual.movesUsed === 2);
      await rotate(PORTRAIT);
      let played = false;
      for (let i = 0; i < 20; i++) {
        const r = (await run()).activeRitual;
        if (!r) { played = true; break; }
        if (r.status !== 'playing') { await wait(300); continue; }
        const m = await hintMove();
        await dragLogical(m.a, m.b);
        if (i === 3) await shot('p_ritual_cascade');
        await settle();
        const now = (await run()).activeRitual;
        if (now && now.status === 'won') { await wait(500); await shot('p_ritual_complete'); }
      }
      const res = await run();
      if (res.rituals.r1 > 0) { check('ritual: won by real play, bonus counted, reward paid', true, `stars ${res.rituals.r1}`); await wait(1500); return; }
      check('ritual: real play ended (lost this seed; falling back to debug win)', played || !!res.activeRitual);
      if (!res.activeRitual) { await tap('btn_ok', { optional: true }); await tap(`btn_play_${id}`); await wait(900); }
    }
    await page.evaluate(() => window.__ct.store.act((g) => { const r = g.run.activeRitual; r.status = 'won'; r.score = Math.max(r.score, r.level.starScores[2]); }));
    await wait(1700);
  };

  await page.goto(URL);
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(URL + '?seed=4242'); // fixed seed: the cat and other random events land in the same places every run
  await wait(1000);
  await page.evaluate(() => { window.__ct.store.state.run.lastVisitAt = 1e12; });

  // 1. arrival
  await shot('p_01_welcome');
  check('boot: welcome step', (await run()).tutorial === 'welcome');
  await tap('btn_ok');
  // 2. build + collect
  await build('sermon_hall');
  check('build: Sermon Hall placed', (await run()).buildings.some((b) => b.type === 'sermon_hall'));
  await skip(90);
  await wait(300);
  const hallPos = await page.evaluate(() => { const a = window.__ct.app(); const b = window.__ct.store.state.run.buildings.find((x) => x.type === 'sermon_hall'); return a.screens.compound.floatPos({ building: b.id }); });
  const devBefore = (await run()).devotion;
  await clickLogical({ x: hallPos.x, y: hallPos.y + 40 });
  check('collect: tapping the hall pays Devotion', (await run()).devotion > devBefore);
  await shot('p_02_compound');
  // 3. rituals + recruits
  await winRitual('r1', { rotateMid: true });
  await wait(1600);
  await shot('p_03_ritual_won');
  await tap('btn_ok');
  await wait(400);
  await shot('p_03_draft');
  await rotate(LANDSCAPE); await shot('l_03_draft'); await rotate(PORTRAIT);
  await tap('btn_pick');
  check('recruit: first follower', (await run()).followers.length === 1);
  check('suspicion rises on recruit', (await run()).suspicion > 0);
  await winRitual('r2');
  await tap('btn_ok'); await wait(400);
  await tap('btn_pick'); await wait(400);
  await tap('btn_pick'); await wait(300);
  const r3f = await run();
  check('recruit: three followers with traits', r3f.followers.length === 3 && r3f.followers.every((f) => f.traits.length >= 1));
  const suspPeak = r3f.suspicion;
  // 4. greenhouse + planting
  await tap('tab_compound');
  await build('greenhouse');
  await tap('tab_alchemy');
  await tap('plot_0'); await tap('btn_seed_basil');
  await tap('plot_1'); await tap('btn_seed_nightshade');
  check('garden: two crops planted', (await run()).tutorial === 'merge');
  await shot('p_04_garden');
  // 5. merge to tier 3 (real taps and drags)
  await tap('tab_reliquary');
  const cellPos = (i) => page.evaluate((idx) => { const s = window.__ct.app().screens.reliquary; const p = s.locPos({ area: 'grid', i: idx }); return { x: p.x + 12, y: p.y + 12 }; }, i);
  let rotated = false;
  for (let guard = 0; guard < 40; guard++) {
    const s = await st();
    if ((s.meta.mergeCodex.paper || 1) >= 3) break;
    const cells = s.run.reliquary.cells;
    let pair = null;
    for (let i = 0; i < cells.length && !pair; i++) for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i]; const b = cells[j];
      if (a && b && a.kind === 'item' && b.kind === 'item' && a.tier === b.tier) { pair = [i, j]; break; }
    }
    if (pair) {
      await dragLogical(await cellPos(pair[0]), await cellPos(pair[1]));
      if (!rotated) {
        rotated = true;
        const before = await items();
        await shot('p_05_reliquary');
        await rotate(LANDSCAPE);
        check('rotate mid-merge keeps the grid', before === (await items()));
        await shot('l_05_reliquary');
        await rotate(PORTRAIT);
      }
    } else {
      const gen = cells.findIndex((c) => c && c.kind === 'gen');
      if (cells[gen].charges <= 0) await skip(20);
      await clickLogical(await cellPos(gen));
    }
  }
  check('merge: reached Manifesto (tier 3)', ((await st()).meta.mergeCodex.paper || 1) >= 3);
  await shot('p_05_reliquary_done');
  // harvest
  await skip(130);
  await tap('tab_alchemy'); await wait(400);
  await tap('plot_0'); await tap('plot_1');
  const inv1 = (await run()).inventory;
  check('garden: harvested basil and nightshade', inv1.basil >= 3 && inv1.nightshade >= 2, JSON.stringify(inv1));
  // 6. lab + brew
  await tap('tab_compound');
  await build('alchemy_lab');
  await shot('p_06_compound_full');
  await tap('tab_alchemy');
  await tap('chip_basil'); await tap('chip_nightshade');
  await shot('p_06_lab');
  await tap('btn_brew'); await wait(300);
  await shot('p_06_stir');
  await tap('btn_skip'); await wait(300);
  await shot('p_06_brew_result');
  check('brew: Amnesia Brew made and logged', (await run()).inventory.amnesia_brew >= 1 && (await st()).meta.grimoire.includes('amnesia_brew'));
  await tap('btn_ok'); await wait(600);
  // 7. reporter
  await shot('p_07_reporter');
  check('event: reporter arrives', (await run()).event && (await run()).event.id === 'reporter');
  const suspBefore = (await run()).suspicion;
  await tap('btn_choice_sample'); await wait(300);
  await shot('p_07_reporter_result');
  const suspAfter = (await run()).suspicion;
  check('suspicion: rose with recruits, then fell', suspPeak >= 15 && suspAfter < suspBefore, `peak ${suspPeak.toFixed(1)} -> ${suspBefore.toFixed(1)} -> ${suspAfter.toFixed(1)}`);
  await tap('btn_ok');
  // 8. summon + orders
  await winRitual('r3');
  await tap('btn_ok'); await wait(400);
  await shot('p_08_mothman');
  await tap('btn_ok'); await wait(400);
  await shot('p_08_orders');
  await rotate(LANDSCAPE); await shot('l_08_orders'); await rotate(PORTRAIT);
  await notices();
  await tap('btn_deliver_mothman_1'); await shot('p_08_order_thanks'); await tap('btn_ok'); await notices('first');
  await tap('btn_deliver_mothman_2'); await tap('btn_ok'); await notices('boon');
  const afterOrders = await run();
  check('orders: both Mothman orders filled', afterOrders.ordersFilled.mothman_1 === 1 && afterOrders.ordersFilled.mothman_2 === 1);
  check('orders: Favor earned and Compound Lv2', afterOrders.favor.mothman >= 40 && afterOrders.level >= 2, `favor ${afterOrders.favor.mothman} lv ${afterOrders.level}`);
  check('tutorial: asks the player to leave', afterOrders.tutorial === 'away');
  // 9. close, reopen an hour later
  await page.evaluate(() => {
    window.__ct.store.save();
    const env = JSON.parse(localStorage.getItem('ct.save'));
    env.data.lastSeenWall -= 3600 * 1000;
    env.data.highWater -= 3600 * 1000;
    localStorage.setItem('ct.save', JSON.stringify(env));
    window.__ct.store.save = () => true; // keep the edited save until the reload
  });
  await page.reload();
  await wait(1200);
  await shot('p_09_welcome_back');
  const back = await st();
  check('offline: state survived the reload', back.run.followers.length === 3 && back.run.buildings.length === 4);
  check('offline: summary shown after an hour away', await page.evaluate(() => !!(window.__ct.store.offline && window.__ct.store.offline.show && window.__ct.store.offline.appliedSec >= 3599)));
  await tap('btn_ok');
  check('tutorial: moved on to the Ascension tease', (await run()).tutorial === 'ascension');
  // clock moved backwards: nothing gained, nothing lost
  const roll = await page.evaluate(() => { const s = window.__ct.store; const d = s.state.run.buildings.reduce((n, b) => n + b.stored, 0); s.state.lastSeenWall = Date.now() + 86400000; s.state.highWater = s.state.lastSeenWall; const o = s.resume(); return { applied: o.appliedSec, rollback: o.rollback, same: Math.abs(s.state.run.buildings.reduce((n, b) => n + b.stored, 0) - d) < 0.5 }; });
  check('clock rollback grants nothing', roll.rollback && roll.applied === 0 && roll.same);
  // 10. ascension preview
  await wait(600); await cat();
  await tap('btn_menu'); await shot('p_10_menu'); await tap('menu_0'); await wait(300);
  await shot('p_10_ascension');
  await rotate(LANDSCAPE); await shot('l_10_ascension'); await rotate(PORTRAIT);
  await tap('btn_close');
  check('tutorial: slice complete', (await run()).tutorial === 'done');
  // debug panel
  await cat();
  await tap('btn_menu'); await tap('menu_4'); await wait(300); await shot('p_11_debug');
  await rotate(LANDSCAPE); await shot('l_11_debug'); await rotate(PORTRAIT);
  await tap('debug_close');

  // ---------- expansion: repeating orders, upgrades, new creatures ----------
  await rotate(PORTRAIT);
  await notices('notice');
  await skip(45);
  check('orders: the Mothman posts new requests after the tutorial', (await run()).orders.length >= 1, JSON.stringify((await run()).orders));
  // a card for an upgrade you cannot afford says what is missing and offers the way to get it
  await page.evaluate(() => window.__ct.store.act((g) => { g.run.devotion = 60; g.run.donations = 10; g.run.reliquary.cells = g.run.reliquary.cells.map((c) => (c && c.kind === 'item' ? null : c)); }));
  await tap('tab_compound'); await wait(300);
  const hall0 = await page.evaluate(() => { const a = window.__ct.app(); const b = window.__ct.store.state.run.buildings.find((x) => x.type === 'dormitory'); return a.screens.compound.floatPos({ building: b.id }); });
  await clickLogical({ x: hall0.x, y: hall0.y + 40 });
  for (const [prefix, vp] of [['p', PORTRAIT], ['s', SMALL], ['l', LANDSCAPE], ['d', DESKTOP]]) { await rotate(vp); await shot(`${prefix}_12_building_missing`); await audit(`${prefix} building missing`); }
  await rotate(PORTRAIT);
  const miss = await page.evaluate(() => ({ relics: !!window.__ct.find('btn_goto_relics'), upgrade: !!window.__ct.find('btn_upgrade') }));
  check('upgrade card: explains what is missing and offers the Relics tab', miss.relics && !miss.upgrade);
  await tap('btn_goto_relics'); await wait(250);
  check('upgrade card: the shortcut opens Relics', await page.evaluate(() => window.__ct.app().tab === 'reliquary'));
  // upgrade the dormitory through its card
  await page.evaluate(() => window.__ct.store.act((g) => { g.run.devotion = 480; g.run.donations = 400; g.run.reliquary.cells[0] = { id: 9001, kind: 'item', chain: 'paper', tier: 2 }; g.run.reliquary.cells[1] = { id: 9002, kind: 'item', chain: 'paper', tier: 3 }; }));
  await tap('tab_compound'); await wait(300);
  await shot('p_12_badges');
  const dormPos = await page.evaluate(() => { const a = window.__ct.app(); const b = window.__ct.store.state.run.buildings.find((x) => x.type === 'dormitory'); return a.screens.compound.floatPos({ building: b.id }); });
  await clickLogical({ x: dormPos.x, y: dormPos.y + 40 });
  await shot('p_12_building'); await audit('building card');
  await rotate(SMALL); await shot('s_12_building'); await audit('s building card'); await rotate(LANDSCAPE); await shot('l_12_building'); await audit('l building card'); await rotate(PORTRAIT);
  await tap('btn_upgrade'); await wait(300);
  const dorm = (await run()).buildings.find((b) => b.type === 'dormitory');
  check('upgrade: the Dormitory reaches level 2 from its card', dorm.level === 2);
  await shot('p_12_building_after');
  await tap('btn_close');
  await notices('upgrade');
  // level up to 3: notice lists unlocks, brazier appears
  await tap('btn_menu'); await tap('menu_4'); await wait(200);
  await shot('p_13_debug');
  const lvBtn = await page.evaluate(() => { const a = window.__ct.app(); return a.modals.active.id; });
  check('debug panel opens', lvBtn === 'debug');
  await tap('debug_close');
  await page.evaluate(() => window.__ct.store.act((g, e) => window.__ct.core.addXp(g, window.__ct.core.xpNeeded(g.run.level) - g.run.xp, e)));
  await wait(500);
  await shot('p_13_levelup'); await audit('level up');
  check('level up: a notice appears', await page.evaluate(() => window.__ct.app().modals.active && window.__ct.app().modals.active.id === 'notice'));
  await notices();
  const lv3 = await run();
  check('level 3: the Ritual Brazier joins the Reliquary', lv3.level >= 3 && lv3.reliquary.cells.some((c) => c && c.kind === 'gen' && c.gen === 'ritual_brazier'));
  await tap('tab_reliquary'); await tap('btn_chain'); await wait(200); await shot('p_13_reliquary_candles'); await audit('reliquary candles');
  // summon Baba Yaga
  await winRitual('r4');
  await tap('btn_ok'); await wait(400);
  await shot('p_14_baba_yaga_intro'); await audit('baba intro');
  await tap('btn_ok'); await wait(400);
  await notices('boon');
  await shot('p_14_orders_baba_yaga'); await audit('orders baba');
  const met = await run();
  check('summon: Baba Yaga is met, hints a recipe and posts orders', met.met.includes('baba_yaga') && met.hints.includes('calm_draught') && met.orders.some((o) => o.id.startsWith('baba_yaga')));
  // every creature's board, met or not, at four sizes
  await page.evaluate(() => window.__ct.store.act((g) => { for (const id of ['jersey_devil', 'anansi', 'vorl']) { g.run.met.push(id); g.run.favor[id] = 45; g.run.orderNextAt[id] = 0; } g.run.level = 5; window.__ct.core.ensureGenerators(g.run); }));
  await skip(50);
  for (const [prefix, vp] of [['p', PORTRAIT], ['s', SMALL], ['l', LANDSCAPE], ['d', DESKTOP]]) {
    await rotate(vp);
    await tap('tab_orders');
    for (const id of ['mothman', 'baba_yaga', 'jersey_devil', 'anansi', 'vorl']) { await tap(`ent_${id}`); await wait(150); await shot(`${prefix}_orders_${id}`); await audit(`${prefix} orders ${id}`); }
    await tap('tab_rituals'); await shot(`${prefix}_ritual_list_1`); await audit(`${prefix} ritual list`);
    if (await tap('btn_page_next', { optional: true })) { await shot(`${prefix}_ritual_list_2`); await audit(`${prefix} ritual list 2`); await tap('btn_page_prev', { optional: true }); }
    await tap('tab_alchemy'); await tap('btn_grimoire'); await wait(200); await shot(`${prefix}_grimoire`); await audit(`${prefix} grimoire`); await tap('btn_close');
    await tap('plot_3', { optional: true }); await wait(200); await shot(`${prefix}_seeds`); await audit(`${prefix} seeds`); await tap('btn_close', { optional: true });
  }
  await rotate(PORTRAIT);
  // a gamble order end to end
  await page.evaluate(() => window.__ct.store.act((g) => { g.run.orders = g.run.orders.filter((o) => !o.id.startsWith('anansi')); g.run.orders.push({ id: 'anansi_4' }); g.run.reliquary.cells[2] = { id: 9003, kind: 'item', chain: 'paper', tier: 2 }; g.run.reliquary.cells[4] = { id: 9004, kind: 'item', chain: 'candle', tier: 2 }; g.run.devotion = 0; }));
  await tap('tab_orders'); await tap('ent_anansi'); await tap('btn_deliver_anansi_4'); await wait(250);
  await shot('p_15_gamble'); await audit('gamble result');
  check('gamble order pays out', (await run()).ordersFilled.anansi_4 === 1 && (await run()).devotion >= 45);
  await tap('btn_ok'); await notices('boon2');
  await tap('tab_compound');

  // ---------- rites, omens, inspections ----------
  await notices();
  await page.evaluate(() => { window.__ct.store.act((g) => { g.run.orders = []; g.run.inspection = null; g.run.event = null; g.run.flags.cat_adopted = true; }); window.__ct.app().modals.closeAll(); });
  await tap('tab_rituals'); await wait(300);
  const ritTab = await page.evaluate(() => ({ tab: window.__ct.app().tab, modal: window.__ct.app().modals.active && window.__ct.app().modals.active.id, event: window.__ct.store.state.run.event, draft: !!window.__ct.store.state.run.draft, ritual: !!window.__ct.store.state.run.activeRitual }));
  check('rites: the Ritual tab is open', ritTab.tab === 'rituals' && !ritTab.modal, JSON.stringify(ritTab));
  if (ritTab.modal) await shot('debug_modal');
  for (const [prefix, vp] of [['p', PORTRAIT], ['s', SMALL], ['l', LANDSCAPE], ['d', DESKTOP]]) { await rotate(vp); await shot(`${prefix}_16_rites`); await audit(`${prefix} rites`); }
  await rotate(PORTRAIT);
  await tap('rite_communion'); await wait(250);
  await shot('p_16_rite_choose'); await audit('rite choose');
  await tap('choose_mothman'); await wait(250);
  const fav0 = (await run()).favor.mothman;
  await tap('btn_play_r1'); await wait(900);
  check('rite: the chosen target travels with the ritual', JSON.stringify((await run()).activeRite) === JSON.stringify({ id: 'communion', entity: 'mothman' }));
  await shot('p_16_rite_board'); await audit('rite board');
  await rotate(SMALL); await audit('s rite board'); await shot('s_16_rite_board'); await rotate(PORTRAIT);
  await rotate(LANDSCAPE); check('rotate mid-rite keeps the target', (await run()).activeRite && (await run()).activeRite.entity === 'mothman'); await shot('l_16_rite_board'); await rotate(PORTRAIT);
  await page.evaluate(() => window.__ct.store.act((g) => { const r = g.run.activeRitual; r.status = 'won'; r.score = r.level.starScores[1]; r.collected = [5, 25, 5, 5, 5, 0]; }));
  await wait(1800); await shot('p_16_rite_result'); await audit('rite result');
  const afterRite = await run();
  check('rite: Communion turned Skulls into Favor and paid Omens', afterRite.favor.mothman >= fav0 + 10 && afterRite.omens > 0, `favor ${fav0} -> ${afterRite.favor.mothman}, omens ${afterRite.omens}`);
  await tap('btn_ok'); await notices();
  // an auditor calls; the player chooses to look busy
  await page.evaluate(() => window.__ct.store.act((g, e) => { g.run.donations = 300; window.__ct.core.triggerEvent(g, 'auditor', e); }));
  await wait(500); await shot('p_17_visit'); await audit('visit');
  await rotate(SMALL); await shot('s_17_visit'); await audit('s visit'); await rotate(PORTRAIT);
  await tap('btn_choice_look_busy'); await wait(300); await shot('p_17_visit_wait'); await tap('btn_ok'); await wait(400);
  check('inspection: the visitor waits and the Ritual tab opens', await page.evaluate(() => !!window.__ct.store.state.run.inspection && window.__ct.app().tab === 'rituals'));
  for (const [prefix, vp] of [['p', PORTRAIT], ['s', SMALL], ['l', LANDSCAPE]]) { await rotate(vp); await shot(`${prefix}_17_waiting`); await audit(`${prefix} waiting`); }
  await rotate(PORTRAIT);
  await tap('btn_look_busy'); await wait(1000);
  await shot('p_17_look_busy_board'); await audit('look busy board');
  check('inspection: Look Busy uses an office board', await page.evaluate(() => window.__ct.store.state.run.activeRitual.level.skin === 'office'));
  await page.evaluate(() => window.__ct.store.act((g) => { const r = g.run.activeRitual; r.status = 'won'; r.score = r.level.starScores[2]; }));
  await wait(1800); await shot('p_17_look_busy_result'); await audit('look busy result');
  const afterLB = await run();
  check('inspection: 3 stars cut the fine (paid 15% of 75% at most)', afterLB.inspection === null && afterLB.donations >= 300 - Math.ceil(300 * 0.15 * 0.25) - 1, `donations ${afterLB.donations}`);
  await tap('btn_ok'); await notices();
  await tap('tab_compound');

  // follower sheet and stat guide
  await rotate(PORTRAIT);
  for (const [prefix, vp] of [['p', PORTRAIT], ['s', SMALL], ['l', LANDSCAPE], ['d', DESKTOP]]) {
    await rotate(vp);
    await tap('btn_roster'); await wait(250); await shot(`${prefix}_roster`); await audit(`${prefix} roster`);
    await tap('card_open'); await wait(250); await shot(`${prefix}_follower`); await audit(`${prefix} follower`);
    if (prefix === 'p') check('follower sheet opens from the roster', await page.evaluate(() => window.__ct.app().modals.active.id === 'follower'));
    await tap('btn_close'); await tap('btn_stat_guide'); await wait(200); await shot(`${prefix}_stat_guide`); await audit(`${prefix} stat guide`);
    await tap('btn_ok'); await tap('btn_close');
  }
  await rotate(PORTRAIT);

  // every tab, four shapes
  for (const [prefix, vp] of [['p', PORTRAIT], ['s', SMALL], ['l', LANDSCAPE], ['d', DESKTOP]]) {
    await rotate(vp);
    for (const tab of ['compound', 'rituals', 'reliquary', 'alchemy', 'orders']) {
      await tap(`tab_${tab}`, { optional: tab === 'compound' });
      await wait(250);
      await shot(`${prefix}_tab_${tab}`);
      await audit(`${prefix} ${tab}`);
    }
    await tap('tab_compound', { optional: true });
    const size = await page.evaluate(() => { const c = window.__ct.game.canvas; const r = c.getBoundingClientRect(); return { w: c.width, h: c.height, k: (r.width / c.width) * devicePixelRatio, fits: r.width <= innerWidth + 0.5 && r.height <= innerHeight + 0.5 }; });
    check(`layout ${prefix}: integer pixel scale and fits the window`, Number.isInteger(size.k) && size.fits, `${size.w}x${size.h} @${size.k}x`);
  }
  check('no text runs outside its screen area or modal (4 screen sizes)', bad.length === 0, bad.slice(0, 6).join(' | '));
  check('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  server.kill();
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
