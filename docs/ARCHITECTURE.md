# Architecture

Owner: systems-engineer · Status: v0.1, to be confirmed during the Phase 2 scaffold.

## 1. Layers
```
src/
  core/        pure TS, no Phaser. Imported by the game, tests and tools/sim.
    state/     GameState types, reducers (applyAction), selectors
    sim/       tick(state, dtSeconds) — production, crops, Suspicion, timers
    rng/       seeded PRNG + named streams
    time/      clock, offline calculation, clock-cheat guards
    save/      serialize, migrations, storage adapter, export/import code
    events/    typed event bus (game → UI notifications)
    data/      JSON loaders + schema validation (zod)
    stats/     local stats log (time per mode, stall detector)
  puzzle/      pure match-3 and merge engines (no Phaser)
  scenes/      Phaser scenes: Boot, Compound, Ritual, Reliquary, Alchemy, Orders, Ascension, Debug
  ui/          layout system, HUD, panels, bitmap text, input helpers
  main.ts
data/          balance/, buildings/, crops/, recipes/, entities/, orders/, events/, levels/, text/en.json
tools/         sim/, art/, levels/
tests/         unit/ (mirrors src), e2e/ (Playwright)
```
**Rule:** scenes dispatch actions (`dispatch({type:'build', buildingId, x, y})`) and render from state. They never mutate state directly.
This keeps the sim, tests and replays on exactly the same code path.

## 2. State & actions
- One serializable `GameState` (plain JSON, no class instances) holding `meta` (kept across Ascension) and `run` (reset on Ascension).
- `applyAction(state, action, ctx) → state` is pure; `ctx` carries data tables and RNG streams.
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
- Key `ct.save.v` (current) and `ct.save.backup` in `localStorage`. Write order: serialize → write `ct.save.tmp` → verify parse → copy current to backup → write current → delete tmp.
- `{ saveVersion: number, savedAt, data }`. Migrations are an ordered array `migrations[n]: (v_n) → v_{n+1}`, each with a unit test fixture.
- Load fallback: current → backup → tmp → new game (and keep the broken blob under `ct.save.corrupt.<ts>` for debugging).
- Export code = base64(deflate(JSON)) with a checksum prefix. Import validates schema and version before replacing anything.
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
Every content type has a zod schema; `npm run validate-data` checks referential integrity (every item, text key, sprite key exists).
Text: `t('key', params)` with `{name}` interpolation; missing keys render `⟦key⟧` in dev and fail tests.

## 8. Debug panel
Toggle with a 3-finger tap or the backtick key (dev builds and `?debug=1`): time skip (+1m/+10m/+1h/+8h offline), add resources,
set Suspicion, force event by id, reset save, export/import, stats log view, RNG stream inspector, toggle speed up to 16×.

## 9. Testing
- Unit (Vitest): core reducers, tick, offline, save/migrations, puzzle engines, data validation.
- Determinism snapshots: fixed seed + scripted actions → hash of state.
- E2E (Playwright, `--trace off`): boot, each screen in portrait 390×844 and landscape 844×390 + 1280×720, rotate mid-ritual and mid-merge and assert state is unchanged.
- Scripted slice playthrough via `window.__ct.debug` API.
