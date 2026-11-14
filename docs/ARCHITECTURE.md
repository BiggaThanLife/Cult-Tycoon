# Architecture

Owner: systems-engineer · Status: v0.2, updated to match the vertical slice as built (see DECISIONS D-118 to D-122).

## 1. Layers
```
src/
  core/        pure TS, no Phaser. Imported by the game, tests and tools/sim.
    game.ts    new game, actions (build, collect, plant, brew, merge, ritual, draft, orders, events), tick, tutorial
    types.ts   GameState (meta = kept across Ascension, run = reset)
    rng.ts     seeded PRNG + derived streams
    offline.ts offline calculation with clock guards
    save.ts    serialize, migrations, atomic write + backup, export/import code
    store.ts   holds state, runs actions, autosaves, notifies the UI
    data.ts    typed access to /data JSON · text.ts  t(key, params)
  puzzle/      pure match-3 (match3.ts) and merge (merge.ts) engines
  art/         palette, bitmap font, runtime sprite atlas (programmer art)
  ui/          layout.ts (integer scale, regions), kit.ts (text, panels, buttons), modal.ts
  screens/     one Screen per tab (compound, rituals, reliquary, alchemy, orders) + modals.ts
  app.ts       the single Phaser scene: HUD, tab routing, floaty text, per-frame update
  main.ts      boot, resize/rotate handling, visibility/offline, test hook (window.__ct)
data/          balance.json, buildings, crops, recipes, items, merge, entities, orders, events, followers, levels/, text/en.json
tools/         sim/run.ts, levels/validate.ts
tests/         unit/ (Vitest), e2e/smoke.cjs (Playwright playthrough + screenshots)
```
**Rule:** screens call `store.act((g, emit) => someAction(g, ...))` and render from state. Display objects never hold game state; `rebuild()` redraws everything.
This keeps the sim, tests and replays on exactly the same code path.

## 2. State & actions
- One serializable `GameState` (plain JSON, no class instances) holding `meta` (kept across Ascension) and `run` (reset on Ascension).
- Actions are plain functions `(g: GameState, ...args, emit)` in `core/game.ts`. They mutate the state object in place (the Store owns the only copy) and are deterministic given the state's RNG streams.
- `tick(state, dt, ctx)` advances time. The game calls it per frame with `dt × speed`; the sim and offline catch-up call it in coarse steps (≤ 60s).

## 3. RNG streams (D-108)
`runSeed` → `deriveSeed(runSeed, name)` for each stream: `recruits`, `events`, `orders`, `boards`, `anansi`, `heralds`.
Each stream stores its own state in the save, so loading mid-run reproduces the same future rolls (no save-scumming a draft by reloading).
Daily ritual seed = hash(ISO date); Herald seed = hash(ISO week).

## 4. Time & offline
- Save stores `lastSeenWall` (Date.now at last save) and `highWater` (max wall time ever seen).
- On load: `elapsed = now − max(lastSeenWall, highWater)`. If `elapsed < 0` → 0 (clock rolled back; nothing lost, nothing gained).
  If `elapsed > 30 days` → treat as 8h and log. Otherwise clamp to 8h, run `tick` in 60s steps with offline multipliers, and build the Welcome Back summary from the diff.
- While running, use `performance.now()` deltas, clamped to 1s per frame (a background tab doesn't become a time machine; the visibility-change handler routes long gaps through the offline path).

## 5. Save
- Keys `ct.save` (current), `ct.save.backup`, `ct.save.tmp` in `localStorage` (falls back to memory if storage is blocked). Write order: serialize → write `ct.save.tmp` → verify parse → copy current to backup → write current → delete tmp.
- `{ saveVersion: number, savedAt, data }`. Migrations are an ordered array `migrations[n]: (v_n) → v_{n+1}`, each with a unit test fixture.
- Load fallback: current → backup → tmp → new game (and keep the broken blob under `ct.save.corrupt.<ts>` for debugging).
- Export code = `CT1.<checksum>.<base64 JSON>` (D-121). Import validates schema and version before replacing anything.
- Autosave every 15s, on visibility hidden, and after any purchase.

## 6. Layout system (orientation)
```
s       = max(1, floor(min(deviceW / minW, deviceH / minH)))   // minW/minH = 180/320 portrait, 320/180 landscape
logical = (floor(deviceW / s), floor(deviceH / s))
safe    = env(safe-area-inset-*) × devicePixelRatio / s, rounded up
```
- The Phaser canvas is sized to `logical`, CSS-scaled by exactly `s / devicePixelRatio` with `image-rendering: pixelated`.
- Each scene declares anchors per orientation: `{ portrait: Anchor[], landscape: Anchor[] }`, where an anchor pins a panel to an edge/corner of the safe rect with a size.
- On `resize`/`orientationchange`: recompute, call `scene.relayout(layout)`. No scene restart, no state reset. Cameras keep their world center.
- Puzzle boards are positioned, never scaled. Landscape moves goals/boosters to side panels.

## 7. Data
Content is typed in `core/data.ts`; unit tests check referential integrity (text keys, order items, entity review status). Runtime schema validation (zod) is still to do.
Text: `t('key', params)` with `{name}` interpolation; missing keys render `⟦key⟧` in dev and fail tests.

## 8. Debug panel
Menu → Debug, or the backtick key: time skip (+1m/+10m/+1h/+8h offline), add resources,
set Suspicion, force event by id, reset save, export/import, stats log view, RNG stream inspector, toggle speed up to 16×.

## 9. Testing
- Unit (Vitest): core reducers, tick, offline, save/migrations, puzzle engines, data validation.
- Determinism snapshots: fixed seed + scripted actions → hash of state.
- E2E (Playwright, `--trace off`): boot, each screen in portrait 390×844 and landscape 844×390 + 1280×720, rotate mid-ritual and mid-merge and assert state is unchanged.
- Scripted slice playthrough via `window.__ct.debug` API.
