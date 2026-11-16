# Task List (living)

## Phase 0 — Discovery ✅
## Phase 1 — Foundations (current)
- [x] CLAUDE.md, GDD, ECONOMY, TONE_AND_CONTENT, ART_BIBLE, DECISIONS, LATER
- [x] Subagents in `.claude/agents/`
- [x] Self-review pass: content guardrails, layout fit, economy gaps, ARCHITECTURE.md, slice script
- [ ] **Owner approval of GDD summary**

## Phase 2 — Vertical slice (built; awaiting owner playtest)
- [x] Scaffold: Vite + Phaser 3 + TS strict, Vitest, PWA manifest + service worker, `npm run sim`
- [x] Responsive layout: integer scaling, expand-not-stretch, safe areas, per-orientation regions, state kept on rotate
- [x] Core: store, seeded RNG streams, versioned save + migrations + backup + export code, offline calc with clock guards
- [x] Data-driven content (JSON) and all text via keys
- [x] Programmer-art atlas + palette + bitmap font
- [x] Compound: place 3 buildings, followers wander, collect, floaty text
- [x] Recruitment draft (1 of 3) with visible traits
- [x] Greenhouse (2 crops) + Alchemy (recipe, experiments, stir minigame, Grimoire)
- [x] Reliquary: generator, merge to tier 3, shelf, codex
- [x] Match-3 engine (81 tests) + validator; 3 levels; rewards feed the compound
- [x] Mothman: summon, 2 orders, dialogue
- [x] Suspicion up (recruits) and down (Amnesia Brew sample)
- [x] Welcome Back offline summary
- [x] Ascension preview (locked)
- [x] Debug panel: time skip, away, add resources, force events, win ritual, reset
- [x] Playwright playthrough in portrait + landscape + desktop, rotate mid-ritual and mid-merge
- [x] Sensitivity review of slice text (docs/reviews/)

### Known gaps
- [ ] Content runs thin about 65 to 75 minutes after the tutorial (sim): next expansion must extend it
- [ ] Ritual r4 is very easy (validator win rate 100%); tighten moves once more levels exist
- [ ] Colourblind palettes, large-text mode (D-127)
- [ ] Runtime data schema validation (zod)
- [ ] Object pooling for floaty text; asset manifest / PNG export (D-119)
- [ ] Bespoke pixel font (D-120); human pass on Mothman portrait
- [ ] Real-device test on a notched phone (safe areas are unit-tested only)
- [ ] Listen to the sound effects on a real device and tune volumes (they cannot be heard in automated tests)
- [ ] Sim covers the slice only; the 7-day / 3-ascension horizon needs the full loop

## Owner-approved plan (2026-11-15): Rites -> Sanctum -> Ley Lines
- [x] Increment 1: Rites, Omens, Daily Rite, inspections and Look Busy (docs/specs/rites.md)
- [x] Increment 2a: Sanctum side view, storeys, six rooms, merging, workers, Omen costs, Filed Forms and room seals (D-157 to D-161)
- [x] Increment 2b: inspection walkthrough (agenda, findings, stamps, report) (D-163 to D-165)
- [ ] Increment 2c: undeclared items + Storeroom, named officials (after a name search), Room Rites / Blessings, drag-to-assign, landscape Grounds strip
- [ ] Increment 3: Ley Lines replaces the merge Reliquary (docs/specs/puzzle-replacement.md), saves convert relics to inventory
- [ ] Loop audit fixes still open: Devotion sinks (Sanctum storeys), compound levels 7-10 unlocks, worker slots beyond the Hall, Tithe rite with coin boards

## Phase 3+ — Iterate (one system at a time)
- [x] Ritual feel pass (docs/specs/ritual-feel.md) + sound toggle
- [x] PLAYBOOK.md and `npm run check` for handover to other models
- [x] Expansion 1 (docs/specs/expansion-1.md): 4 more entities, repeating orders, Favor boons, building upgrades, more crops/potions/relics, 6 more rituals
- [ ] Next up (proposed): land expansion (brambles, parcels), then patron pledges with banes and questlines
- [ ] Then: Pilgrimage Bus, outsider and follower orders, potions used on followers, the Merch Tent and Kitchen
- [ ] More entities after lore review: Kitsune (folklore only), Kappa, Sphinx
