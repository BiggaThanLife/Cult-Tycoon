# Playbook — how to change this game safely

Written for any model or person picking the project up cold. Follow the recipe that matches your task **exactly**.
If no recipe matches, or a step fails twice, stop and ask the owner. Do not improvise around a failing check.

## 0. The five rules that prevent most mistakes

1. **Run `npm run check` before you start and before you commit.** It runs, in order: typecheck, unit tests, level
   validator, economy sim, build, and the browser playthrough. It must end with `checks passed` and exit 0.
   If it fails before you changed anything, stop and report that. Never commit with a failing check, and never
   delete, skip or weaken a test to make it pass.
2. **Content goes in `data/`, words go in `data/text/en.json`.** Never type a player-facing sentence into a `.ts` file.
   Text must be plain ASCII (no curly quotes, no long dashes, no accents, no emoji): the pixel font has no other glyphs.
3. **Game rules live in `src/core/` and `src/puzzle/` and must not import Phaser.** Screens (`src/screens/`) only draw
   state and call actions through `app.store.act(...)`. Never store game state on a sprite or in a screen field that
   would be lost on rotate. Screens are rebuilt from state at any time.
4. **Read `docs/TONE_AND_CONTENT.md` before writing any text**, and re-read the "Content boundaries" section of
   `CLAUDE.md`. If a joke's target is a follower, a real person, a real group or a real culture, rewrite it.
5. **Work on a feature branch, commit small, and log anything you decided** in `docs/DECISIONS.md` (next free `D-###`).
   Do not push to `main`. Do not change `package.json` dependencies without asking.

## 1. Where things are

| I want to change... | File |
|---|---|
| Any number (costs, rates, timers, XP, Suspicion) | `data/balance.json`, or the row in `data/buildings.json`, `data/crops.json` |
| Any words the player reads | `data/text/en.json` |
| Buildings, crops, recipes, items | `data/buildings.json`, `crops.json`, `recipes.json`, `items.json` |
| Merge chains and generators | `data/merge.json` |
| Ritual (match-3) levels | `data/levels/rituals.json` |
| Entities, their orders | `data/entities.json`, `data/orders.json` |
| Random/scripted events | `data/events.json` |
| Follower names and traits | `data/followers.json` |
| How a rule works | `src/core/game.ts` (one function per action; `tick` for time) |
| Match-3 rules | `src/puzzle/match3.ts` · merge rules `src/puzzle/merge.ts` |
| How the ritual board *feels* | `src/screens/rituals.ts` (`FEEL` constants) and `src/ui/sfx.ts`; rules in `docs/specs/ritual-feel.md` |
| Pictures | `src/art/sprites.ts` (drawn in code; palette in `src/art/palette.ts`) |
| Screen layout | `src/screens/<tab>.ts`; shared widgets in `src/ui/kit.ts`; regions in `src/ui/layout.ts` |
| Save format | `src/core/types.ts` + a migration in `src/core/save.ts` |

Naming conventions the code relies on (a unit test checks them):
- Sprite keys: building `b_<id>`, item `i_<id>`, merge item `m_<tierKey>`, generator `g_<id>`, entity portrait `<entityId>`, ritual tile `tile_<0-5>`.
- Text keys: `building.<id>.name|desc`, `item.<id>.name|desc`, `trait.<id>.name|desc`, `merge.<tierKey>.name`,
  `order.<id>.text|thanks`, `entity.<id>.name|blurb|intro|intro.ok`, `event.<id>.title|body`, `event.<id>.choice.<choiceId>`,
  `event.<id>.result.<choiceId>`, `tip.<tutorialStep>`, `ritual.<levelId>.name`.

## 2. Recipes

Each recipe ends with **Verify**, which is always `npm run check` plus anything listed.

### R1. Change or add text
1. Edit `data/text/en.json`. Keep it ASCII. Keep it short: tips <= 52 characters, descriptions <= 60, pops <= 30.
2. Check the voice against `docs/TONE_AND_CONTENT.md` section 2 (do / don't table).
3. **Verify.** Then open the screenshots in `tests/e2e/shots/` for the screen you touched and confirm nothing is cut off or overlapping, in both `p_*` (portrait) and `l_*` / `d_*` (landscape) files.

### R2. Change a balance number
1. Run `npm run sim` and keep the output.
2. Change the number in `data/`. Prefer adding a flat amount over multiplying.
3. Run `npm run sim` again. It must still print `PASS` for every strategy (no stretch over 10 minutes without an unlock, nobody stuck).
4. Record old value, new value and why in `docs/DECISIONS.md`. **Verify.**

### R3. Add a crop
1. `data/crops.json`: add `{ "id", "growSec", "yield", "seedCost" }`. Keep `growSec` <= 480 (8 minutes is the longest timer allowed).
2. `data/items.json`: add `{ "id": "<same id>", "kind": "ingredient" }`.
3. `data/text/en.json`: add `item.<id>.name` and `item.<id>.desc`.
4. `src/art/sprites.ts`: add a 16x16 sprite with key `i_<id>` (copy the `i_basil` line and change the shapes and colours; use only `PAL` colours).
5. Give it an `unlockLevel` (the compound level that reveals it). The lab shows ingredient chips in one row and shrinks them to fit; more than 5 ingredients gets cramped on a 180-pixel-wide phone, so stop and ask before adding a 6th.
6. **Verify.** Real poisonous plant names need the owner's sign-off first (see DECISIONS D-129).

### R4. Add a potion recipe
1. `data/recipes.json`: add `{ "id", "ingredients": [2-4 item ids], "output": "<item id>", "hinted": false }`. The ingredient multiset must be unique.
2. `data/items.json`: add the output with `"kind": "potion"`. Add its two text keys and an `i_<id>` sprite (use the `potion(...)` helper).
3. The potion does nothing unless something consumes it (an order need, or an event choice `requires`/`consume`). Add that too, or log why not. To have an entity hint the recipe when first met, set that entity's `hintsRecipe`.
4. Potions must be openly offered and harmless (CLAUDE.md, D-110). **Verify.**

### R5. Add a building
1. `data/buildings.json`: add a row. `availableFrom` must be one of the tutorial step names in `src/core/types.ts` (`TUTORIAL_ORDER`). Use `"produces"` + `"storageMin"` for a resource building, `"housing"` for beds, `"plots"` for garden plots.
2. Text: `building.<id>.name`, `building.<id>.desc`. Sprite: `b_<id>`, width = `w*16`, height = `h*16 + 8..12`.
3. Upgrades: add `upgrades` (one entry per extra level: `cost` plus an optional `merge` item) and `perLevel` (what each level adds: `outputPct`, `housing`, `plots` or `brewBonus`). Add a `building.effect.<id>` text line; `buildingEffect` in `src/screens/modals.ts` fills in its numbers.
4. A new *kind* of building behaviour (anything not covered by those fields) is a code change in `src/core/game.ts` and needs a spec in `docs/specs/` first. Stop and ask.
4. **Verify**, and look at `p_tab_compound.png` / `l_tab_compound.png`.

### R6. Add a ritual (match-3) level
1. `data/levels/rituals.json`: copy an existing level, give it a new `id`, `seed`, `nameKey`, goals and moves. Keep `width`/`height` at 8 and `tileTypes` at 5 unless told otherwise.
2. Text: add the `nameKey` and, if it uses a new `purpose`, `ritual.purpose.<purpose>`.
3. Run `npx tsx tools/levels/validate.ts --suggest`. The level must show `ok` (win rate >= 0.70). If not, change `seed` or add moves and run again. Win rate swings a lot between seeds; always re-run after any change.
4. Copy the printed `par` into the level, and set `starScores` to the three printed percentiles (rounded to 50).
5. Unlocking: set `"unlock": { "level": N }` (compound level) and/or `{ "step": "<tutorial step>" }`. A level with purpose `summon` must be named as some entity's `summonRitual` in `data/entities.json` (a test checks the two lists match).
6. **Verify.**

### R7. Add an order
1. `data/orders.json`: add a row with `from` set to an existing entity id and a `kind`: `entity` (plain), `trial` (big ask, roughly triple pay) or `gamble` (pay is rolled on delivery). Needs may be `{ "item", "count" }` or `{ "merge": "<chain id>", "tier", "count" }`.
2. Text: `order.<id>.text` (under about 90 characters) and `order.<id>.thanks` (under about 100), in that entity's voice. Read the entity's existing lines first and match them.
3. Orders are only offered when the player can make everything in them, so you cannot strand anyone; but an order nobody can ever make is dead weight, so check each need against the crop, recipe and generator unlock levels.
4. Do not add `"tutorial": true`; that is for the two scripted Mothman orders.
5. **Verify**, and look at `p_orders_<entity>.png` and `s_orders_<entity>.png`.

### R7b. Add an entity (mythical creature)
This needs sign-off, so start by asking the owner which creature, then:
1. Research it. Folklore figures, cryptids, public-domain literature or original creations only; nothing central to living worship or closed traditions (see `docs/TONE_AND_CONTENT.md` section 5 and DECISIONS D-104).
2. `data/entities.json`: add the entry with `summonRitual`, `hintsRecipe` (or null), three `boons` at rising Favor, `reviewNotes` (guardrails for future writers), real `sources`, and `"reviewStatus": "pending"`.
3. Add its summoning ritual with recipe R6 (purpose `summon`, an `unlock.level`), at least four orders with R7, a 32x32 portrait sprite keyed by the entity id (R10), and text: `entity.<id>.name`, `.blurb` (short), `.intro` (two or three sentences, in its voice), `.intro.ok` (the leader's reply on the button).
4. Run the lore-and-sensitivity-reviewer agent on the batch. Only that review may change `reviewStatus` to `approved`; a unit test fails until it is.
5. **Verify.** The Orders screen fits five portraits across the smallest phone; a sixth needs a layout change (stop and ask).

### R7c. Add or tune a rite
1. `data/rites.json`: each rite has `focus` (tile type 0-4 it converts, -1 for none), `pays` and `show` (when it appears). Payout code is `payRite` in `src/core/game.ts`; a new kind of payout is a code change (R12).
2. Text: `rite.<id>.name`, `rite.<id>.desc`, `rite.result.<id>`; icon `rite_<id>` (12x12, R10).
3. Rebalance with R2: the sim's long run must keep rituals between 20% and 60% of active time.
4. **Verify**, and look at `p_16_rites.png`, `s_16_rites.png`, `l_17_waiting.png`.

### R7d. Add an inspection visit
1. Read `docs/reviews/2026-11-15-raids-guardrails.md` first. Civil officials only; the agency is always "the Office of Mild Concern" in full.
2. `data/events.json`: add an event with `"visitor": true`, a `band` (1-3 by Suspicion, 4 = Full Review) and choices whose `effects` use only `suspicion`, `suspicionTo`, `finePct`, `sealSec`, `awaySec`, `consume`/`requires` and `lookBusy` (the id of a `defense` board). Every choice must lower Suspicion.
3. Text: `event.<id>.title|body`, `event.<id>.choice.<c>`, `event.<id>.result.<c>`. A 16x16 civilian sprite (no badges, uniforms or weapons).
4. Have the lore-and-sensitivity-reviewer check it. **Verify** (a unit test bans siege/raid vocabulary in visit text).

### R8. Add an event
1. `data/events.json`: add `{ "id", "sprite", "choices": [...] }`. Effects supported: `suspicion`, `devotion`, `donations`, `flag`, `consume`. A choice may have `requires`.
2. Text: `event.<id>.title`, `.body`, and for each choice `.choice.<choiceId>` and `.result.<choiceId>`.
3. Events only fire when code calls `triggerEvent` (see the cat in `tick`). Wiring a new trigger is a code change: follow R12, and note it in `docs/TASKS.md`.
4. Nobody is harmed in any outcome. **Verify.**

### R9. Add a follower trait or names
1. `data/followers.json`: add to `traits` (supported fields: `stats`, `outputPct`, `donationsPerMin`, `cropYieldBonus`, `suspicionDecayPct`, `recruitSuspicion`) or to `names` (generic first names only, never a real public figure).
2. Text: `trait.<id>.name`, `trait.<id>.desc` (<= 28 characters so it fits the recruit card). The follower is never the joke.
3. **Verify**, and look at `p_03_draft.png` and `l_03_draft.png`.

### R9b. Change what a follower stat does
1. The four effects live in `src/core/game.ts` under "follower stats" (`followerWork`, `ritualDevotionPct`, `doubtDecayPenalty`); the numbers are in `data/balance.json` `stats`.
2. The follower sheet (`openFollower` in `src/screens/modals.ts`) prints the live effect using those same functions. If you change a formula, change the matching `stat.<key>.effect` and `stat.<key>.guide` text so the sheet never lies.
3. Update the unit tests in "follower stats do what the follower sheet says", and GDD 3.1 / ECONOMY section 3. Follow R2 (sim before and after). **Verify.**

### R10. Add or change a sprite
1. `src/art/sprites.ts`: add `{ key, w, h, draw }` to the list. Draw with the `Pen` helpers (`r`, `box`, `disc`, `ring`, `diamond`, `map`). Colours come from `PAL` only.
2. Keys must be unique (a test checks). Original art only: never imitate another game's sprites.
3. **Verify**, and look at a screenshot that shows it.

### R11. Change the save format (add or rename a saved field)
1. Change the type in `src/core/types.ts` and the default in `newGame` (`src/core/game.ts`).
2. Raise `SAVE_VERSION` by 1 in `src/core/game.ts`.
3. Add a migration in `src/core/save.ts` under the **old** version number that fills the new field for old saves. Never edit or delete an existing migration.
4. Add a unit test next to "migrates a real v1 save" in `tests/unit/core.test.ts` that loads an old-shaped save and checks the new field.
5. **Verify.** If you are unsure whether a field is saved, it is: everything in `GameState` is.

### R12. Add a rule or action (code)
1. Write or update the spec in `docs/specs/<system>.md` first, including what changes for the player next run ("why replay").
2. Add a function in `src/core/game.ts` shaped like the others: `(g: GameState, ...args, emit) => result`. Randomness goes through `withRng(run, '<stream>', ...)`, never `Math.random`.
3. Add unit tests in `tests/unit/core.test.ts`. Extend `playSlice` only if the tutorial changed.
4. Call it from a screen with `app.store.act((g, emit) => yourAction(g, ..., emit))`.
5. Update the resource-flow diagram in `docs/ECONOMY.md` if a resource gained a new source or sink. **Verify.**

### R13. Change a screen or add a modal
1. Build UI only with `src/ui/kit.ts` helpers (`txt`, `panel`, `button`, `bar`, `img`, `hit`) and `dialog`/`frame` from `src/ui/modal.ts`. Integer coordinates only.
2. Everything must be drawn inside `rebuild()` from state, and must handle both `L.dock` present (landscape) and absent (portrait). In landscape call `this.dockBg()` before drawing into the dock.
3. Give tappable things a `name` so the playthrough test can press them; minimum size about 20x18 logical pixels.
   A disabled button must always come with a visible reason and, where possible, a button that takes the player to the fix (see the building card, D-148).
4. Smallest screens to fit: 180x320 portrait, 320x180 landscape. The ritual board (160) and merge grid (168) never scale.
5. The playthrough runs a layout audit at four sizes (`s_` 360x640 is the smallest phone) and fails if any text leaves its area. It cannot see sprites overlapping text, so still open every changed screen's `s_`, `p_`, `l_` and `d_` screenshot.
6. **Verify.**

### R14. Tune how rituals feel
1. Read `docs/specs/ritual-feel.md`. Change timings in `FEEL` (`src/screens/rituals.ts`) and sounds in `src/ui/sfx.ts`.
2. Never change scoring or rules to improve feel; that is `src/puzzle/match3.ts` and needs R6 step 3 re-run for every level.
3. Every effect must have a reduced-motion path that keeps the information. **Verify.**

## 3. When to stop and ask the owner
- A check fails and you cannot explain why after two attempts.
- The task touches things that are still code, not data: outsider or follower orders, patron pledges and banes, questlines, event triggers, potions used on followers, land expansion.
- The task needs a new dependency, a new entity or mythological figure, a real-world reference, or anything near the content boundaries.
- The change is expensive to undo: save format redesigns, renaming ids that saves already contain, engine swaps, projection or resolution changes.
- You are about to make something wait longer than 8 minutes, add a currency, or add anything that pressures the player to come back.

## 4. Finishing a task
1. `npm run check` passes.
2. `CHANGELOG.md` has an entry; `docs/TASKS.md` is ticked or updated; decisions are logged.
3. Commit on the feature branch with a message that says what changed for the player.
4. Tell the owner in three lines: what changed, how it was checked, what is still open.
