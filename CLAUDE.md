# CLAUDE.md — Cult Tycoon (working title)

Project rules for every Claude Code session. Read this first, then `docs/TASKS.md`.

## What this is
A cozy-looking, pitch-black-funny pixel-art management sim: you run a cult compound (tycoon spine), and three
action modes feed it: **Rituals** (match-3), **The Reliquary** (merge) and **Alchemy** (grow → brew).
Personal project. **No monetization of any kind.**

## Stack
- Phaser 3 + TypeScript (strict) + Vite, shipped as a web-first PWA.
- Vitest for unit tests; Playwright (pre-installed Chromium) for screenshot/orientation smoke tests.
- Pure game logic lives in `src/core/` and `src/puzzle/` and **must not import Phaser**. Rendering lives in `src/app.ts`, `src/screens/` and `src/ui/`; art is generated in `src/art/`.
- Headless economy sim lives in `tools/sim/` and imports the same `src/core/` code.

## Commands
`npm run dev` · `npm test` (Vitest) · `npm run build` · `npm run e2e` (Playwright playthrough + screenshots; build first) · `npm run sim` · `npm run validate-levels` · `npm run build:single` (one self-contained HTML file)

Architecture, layout algorithm, save format and RNG streams: `docs/ARCHITECTURE.md`. Slice script: `docs/specs/vertical-slice.md`.

## Folder ownership
| Path | Owner agent |
|---|---|
| `docs/GDD.md`, system specs | game-designer |
| `docs/ECONOMY.md`, `data/balance.json`, `tools/sim/` | economy-balancer |
| `src/puzzle/`, `data/levels/` | puzzle-engineer |
| `src/core/` (state, save, time, events) | systems-engineer |
| `docs/ART_BIBLE.md`, `src/art/` | pixel-artist |
| `src/ui/`, `src/screens/`, `src/app.ts` layout, onboarding | ui-ux-designer |
| `data/text/` | narrative-writer |
| `docs/TONE_AND_CONTENT.md`, `docs/FIELD_NOTES_SOURCES.md` | lore-and-sensitivity-reviewer |
| `tests/`, `docs/playtests/` | qa-tester |
| `docs/AUDIO.md` (later) | audio-designer |

Workflow: **designer spec → engineer build → QA test → sensitivity review (content) → lead merges.**

## Content boundaries (non-negotiable)
- No jokes whose target is real victims, real deaths or real survivors.
- No real living people by name. No real cult or group names **anywhere**, including the Field Notes codex
  (player decision: parody/generalized descriptions everywhere).
- No mechanics that reward or depict self-harm, suicide, sexual abuse, child abuse or mass violence.
  Explicitly banned: "drinking the Kool-Aid", poisoned drinks for followers, gas attacks, mass suicide, comet/ship-departure deaths.
- Followers can *leave*, *defect*, *get suspicious* or be sent to the *Pamphlet-Reading Room*. Nobody is harmed on screen.
- Potions are openly offered, clearly magical and harmless. Nobody is ever dosed covertly. They never sicken,
  sedate, poison, or erase anyone's doubts or memories against their will (D-110).
- Low Sanity is played as comedy (talking to houseplants, seeing the cat as a prophet), never as distress or breakdown.
- The Mothman legend is linked to a real 1967 bridge collapse. Never reference bridges, collapses or that town (D-111).
- Mythology: no slurs, no sacred content from closed traditions, no caricatures of living cultures. Mock the
  leader's ignorance, never the source culture. New entities need lore-reviewer sign-off.
- Target rating **Teen / PEGI 12**. Flag anything that pushes higher.
- The satire punches **up**: at the leader's vanity, grift, hypocrisy and manipulation tactics. Followers are
  sympathetic marks, not the joke.

## Design rules
- **No grind walls, no energy, no FOMO.** Timers only where waiting adds anticipation, and they stay short.
- **Every mode produces something another mode needs.** Keep the resource-flow diagram in `docs/ECONOMY.md`
  current; reject features that don't plug into it.
- **"Why would a player do this differently next run?"** must have an answer in the GDD for every system.
- Prefer **additive** bonuses over multiplicative stacking. Run `npm run sim` before and after any balance change.
- **Data-drive everything**: buildings, crops, recipes, entities, orders, levels, events and text live in `data/`.
  No player-facing string literals in code; use keys from `data/text/en.json`.
- One new system per tutorial beat. Never teach two systems at once.
- Missing days never resets progress harshly.

## Engineering rules
- Save schema is versioned (`saveVersion`) with ordered migrations in `src/core/save.ts` (`MIGRATIONS`).
  Autosave atomically (write temp → swap) and keep one backup slot. Export/import as a base64 save code.
- Time: never trust raw `Date.now()` deltas. Clamp offline time to the cap (8h), ignore negative deltas
  (clock moved back), and store a monotonic "last seen" high-water mark.
- Puzzle logic is pure and seeded (`mulberry32`/similar). Same seed + same inputs = same board, always.
  Every shipped level passes the solvability validator.
- Layout: integer pixel scaling, logical canvas expands (never stretches) to fill the screen, safe areas respected.
  Portrait is primary; landscape shows **more** (wider map, side-docked panels), never **bigger**.
  Puzzle boards keep a fixed tile size and stay centered. Rotating keeps state with no reload.
- Text: the 5×8 font is the minimum for words. The font is ASCII only; keep `data/text` ASCII (a unit test enforces it).
- Screens are throwaway views: `rebuild()` redraws from state. Never keep game state in display objects.
- Performance: texture atlases, object pooling for floaty text and particles, 60fps target on mid-range phones.
- Local stats log only (time per mode, stall detection). No network telemetry, ever.

## Definition of done (every task)
- [ ] Spec exists in docs, or the change is logged in `docs/DECISIONS.md`
- [ ] `npm test` passes; new logic has tests
- [ ] `npm run sim` re-run if any numbers changed
- [ ] Player-facing text checked against `docs/TONE_AND_CONTENT.md`
- [ ] No hard-coded content
- [ ] Works in portrait **and** landscape; rotating mid-play keeps state
- [ ] `CHANGELOG.md` entry + 3-line summary to the player-owner

## Housekeeping
- Living task list: `docs/TASKS.md`. Parking lot: `docs/LATER.md`. Decisions: `docs/DECISIONS.md`.
- Commit after each working milestone with clear messages. Ask the owner before ambiguous, expensive-to-reverse calls.
- Original art and names only. "Kairosoft-like" and "Township-like" describe feel and mechanics, never assets, UI or names.
