# Design brief: replacing the merge puzzle ("The Reliquary")

Owner: game-designer · Status: **proposal, owner to choose** · Date: 2026-11-15
Read with: `docs/reviews/2026-11-15-loop-audit.md` §1.3 (what merge items feed), `docs/sim/latest.md`, D-107, D-149.

## 0. Why change, and what any replacement must do
- **Evidence.** In the 150-minute post-tutorial sim, merge is **38% of active time** (57:47) and rituals, the headline verb, only 9.5%.
  Merge is tap-generator, drag-pair busywork: a Forbidden Tome is 16 Pamphlets and 15 drags. It is the biggest time sink and the least decision-rich mode.
- **Contract the replacement must keep:** produce the same 10 items (paper 1-5: Pamphlet → Forbidden Tome; candle 1-5:
  Candle Stub → Eternal Flame) so the **17 consumer slots** (10 order needs, 7 upgrade steps) and the Sanctum room upgrades
  keep working with a data rename only. Pure TS in `src/puzzle/`, seeded, validator-checked, fixed tile size, board ≤ 168×168
  (the merge region, D-107/D-122), no timers, shape-coded, distinct from match-3 (no swapping, no gravity, no cascades).

## 1. The shared layer: Commissions (same for every candidate)
The Reliquary tab keeps its name and becomes a **commission desk**. The puzzle under it is swappable, which lowers the risk of this decision.
- **Verb:** pick a chain (Paper or Candle) and a tier → solve one board → receive that item in the inventory.
- **Board size and features scale with tier** (T1 tiny, T5 the hardest). One board = one item. Solving at or under par adds one free T1 of that chain ("Neat").
- **Inputs without energy:** T1 boards are always free. A T2-T5 commission consumes **one item of the tier below** (a Holy Scripture is a Manifesto someone took seriously). That keeps the chain fantasy and the Codex, and means play is never gated by a meter.
- **Other sources of T1 items (arrows into the mode):** the Donation Box keeps producing Pamphlets passively (6 charges, as now), the Ritual Brazier Candle Stubs, the Sanctum Pamphlet Press room Pamphlets, and the **Candle Vigil** Rite converts ritual Candle tiles into Candle Stubs (loop audit §2.4). So rituals and rooms let a player skip the T1 boards.
- **Determinism and no rerolling:** board seed = next value of a new `workshop` RNG stream per chain and tier. Abandoning refunds the input item and keeps the same board for next time (no seed-scumming). An unfinished board is saved and survives rotation and reload.
- **Value check for the balancer:** today a tier-t item costs 2^(t−1) generator taps of time. Under commissions it costs one board per tier climbed. Target solve times are in each option; the balancer replaces the sim's merge model with "seconds per tier" and keeps order rewards (ECONOMY §6) unchanged in the first pass.

```json
// data/workshop.json (shared)
{ "puzzle": "leylines",
  "tiers": [ { "tier": 1, "board": { "w": 4, "h": 4 }, "features": [], "input": null, "parTarget": 6 },
             { "tier": 3, "board": { "w": 6, "h": 6 }, "features": ["fixed"], "input": { "tier": 2 } } ],
  "neatBonus": { "tier": 1, "count": 1 }, "skins": { "paper": "ink", "candle": "glow" } }
```

## 2. Candidates
### Option 1: Ley Lines (rotate tiles to connect the network) · **Recommended**
- **Core loop:** tap tiles to rotate them until every line runs from the altar to every standing candle, with no loose ends.
- **Generate and validate:** seeded random spanning tree over W×H cells from the altar (randomised Prim for branchy, Wilson for even trees); tile types fall out of each cell's degree (end, straight, corner, tee, cross); every non-fixed tile gets a random rotation, rerolled if the board starts solved. Solvable by construction. The win check accepts **any** fully connected, closed configuration, not only the generator's. Validator (in `npm run validate-levels`): 1,000 seeds per tier; a propagation solver (border edges closed, fixed tiles, ends never pair up with ends) must solve T1-T3 with **no guessing** and T4-T5 with **≤ 2 guesses**; par = minimal rotations to the generator's solution (shown as "Par ~N" because other solutions may exist).
- **Tiers:** T1 4×4 (≈ 20 s) · T2 5×5 (≈ 40 s) · T3 6×6 + pinned tiles (≈ 75 s) · T4 7×7 + two networks that must not touch (≈ 2.5 min) · T5 7×7, two networks + linked tiles that rotate in pairs (≈ 3.5 min). Cells 24×24 px: the exact 168 px merge grid at T4-T5, smaller boards centred at the same tile size.
- **Skins:** Paper chain = lines of ink across an illuminated page; Candle chain = teal glow lines (Night Glow palette) that light each candle on arrival. **Not incense:** smoke routed through pipes into rooms of followers reads too close to the banned gas imagery (CLAUDE.md, D-149 §1.3).
- **Produces:** the commissioned item; covers all 17 consumer slots and the Sanctum L2/L3 items.
- **Why replay:** endless seeded boards; the tier ladder; patron modifiers (data-driven, each needs lore review): Mothman night boards (only tiles next to lit lines are visible; off in relaxed mode), Vorl "deep" tiles (rotating one also turns a neighbour), Anansi web tile (fixed, connects all four sides). Heralds: *Mercury in Retrograde* = tiles turn counter-clockwise.
- **Accessibility:** tap only, no drag, no precision (24 px = ≥ 48 CSS). Undo, and a toggle for counter-clockwise. Connected lines change **shape** (dotted → solid 3 px), not just colour; the second network is double-line. Unlimited free hints (lock one correct tile; using one voids Neat). No timer. Reduced motion: no glow travel.
- **Art cost: low.** 5 line glyphs × 2 states × 2 skins, altar, candle-end, pin, link marker. ≈ 25 small sprites.
- **Engineering: S** for engine + generator + validator (≈ 300 lines, all pure). Plus the shared Commissions layer (M) and migration.
- **Risks:** rotation puzzles get samey; the T4-T5 features carry the depth. Measure with a 10-board playtest before data is final.

### Option 2: File the Forms / Candle Sort (sort stacks by kind)
- **Core loop:** tap a stack, tap another, move the top item onto a matching item or an empty holder until every holder holds one kind.
- **Generate and validate:** start solved, apply N seeded random reverse moves; solvable by construction. BFS/A* solver (state space is small) gives the optimal par and rejects boards with par < tier minimum.
- **Tiers:** kinds 3 → 6, height 3 → 5, spare holders 2 → 1. 30 s to 2 min. 6 holders × 5 items of 20 px fit 168×110.
- **Skins:** Paper = forms into the right filing tray (the bureaucratic satire is a perfect fit and ties to the Records Office); Candle = candles onto the right candelabra.
- **Produces:** as Option 1.
- **Why replay:** seeds and par; Mothman hidden-until-uncovered items; Tax Season "extra form types". Shallower than Option 1: once you know the trick, boards blur.
- **Accessibility:** tap-tap, huge targets, needs 6 **new** item shapes (not the ritual tile shapes, to keep the modes visually distinct). Undo, no timer.
- **Art cost: low.** 12 item sprites (6 per skin), holder, tray. **Engineering: S** (+ shared layer).
- **Risks:** the genre is strongly associated with ad-funded hypercasual games; feels generic.

### Option 3: Decipher the Prophecy (nonogram / picross)
- **Core loop:** fill cells from row and column number clues until a picture appears; the prophecy is always a picture of the item you commissioned ("It foretold a candle. It is a candle.").
- **Generate and validate:** pictures from a library of item icons plus seeded variants; accept only puzzles a line solver finishes with no guessing (unique solution).
- **Fit problem:** at 20 px cells the clue margin leaves room for **6×6 at most** in 168 px; 6×6 nonograms are trivial and larger ones need 16 px cells (32 CSS, under the 44 CSS minimum) or panning. So the tier ladder is short: T1-T3 fine, T4-T5 weak.
- **Session:** 30 s - 2 min. **Why replay:** picture collection (a "Prophecy Gallery" collection). **Accessibility:** good (no colour, deduction only), but drag-painting is needed for comfort.
- **Art cost: medium** (30+ pixel pictures, each hand-checked for uniqueness). **Engineering: M** (line solver, clue layout in the 5×8 font, drag-paint).

### Option 4: Pack the Offering Crate (polyomino packing)
- **Core loop:** drag and rotate goods-shaped pieces until the crate is exactly full.
- **Generate and validate:** cut the crate rectangle into polyominoes by seeded region growing (solvable by construction); an exact-cover solver (DLX) counts solutions to grade difficulty.
- **Fit:** crate 6×5 at 24 px plus a piece tray; landscape puts the tray in the dock. Drag plus a rotate button.
- **Produces:** naturally "a packed crate", which fits the **Pilgrimage Bus** (GDD §3.5) better than item tiers. Tier = crate size.
- **Session:** 1-3 min. **Accessibility:** drag-heavy (the thing we are leaving). **Art cost: medium. Engineering: M.**
- **Better use:** park for the Pilgrimage Bus in LATER rather than as the Reliquary.

### Considered and not recommended
- **Rewrite the Scripture (word/anagram):** locks the game to English (D-013), needs a curated, content-scrubbed word list, weak for dyslexic players, M-L.
- **Who Asked a Question (logic deduction):** text-heavy in a 5×8 font on 180 px, needs a uniqueness solver (L), and the theme rewards hunting down followers who doubt, which makes followers the target instead of the leader. Fails the tone rule.
- **Option 0: keep merge, trim it** (auto-merge pairs, fewer tiers, a "merge all" button). S, but it is not what the owner asked for and keeps the mode decision-poor.

## 3. Comparison
| | Ley Lines | Sort | Nonogram | Packing |
|---|---|---|---|---|
| Distinct from match-3 | high | high | high | high |
| Depth across 5 tiers | good | fair | short ladder | good |
| Fits 180 px, tap ≥ 44 CSS | yes | yes | only ≤ 6×6 | yes (drag) |
| Input | tap | tap-tap | drag-paint | drag + rotate |
| Solvable by construction | yes | yes | no (needs solver filter) | yes |
| Art / Eng (puzzle only) | low / S | low / S | medium / M | medium / M |
| Theme fit | magic lines, illuminated pages | bureaucracy satire | prophecy gag | Pilgrimage Bus |

**Recommendation: Ley Lines**, with File the Forms as the fallback if a 10-board paper playtest finds rotation boards samey. Because the Commissions layer is shared, a second puzzle (Sort as a Paper-only "Filing" desk) could be added later without touching the economy.

## 4. Economy flow (replaces the Reliquary lines in ECONOMY §1; balancer to merge)
`GEN (Donation Box, Brazier) -->|T1| RQ` · `PP (Press room) -->|Pamphlets| RQ` · `M3 -->|Candle Vigil: Candle Stubs| RQ` ·
`RQ -->|tier t item, consumes t-1| RQ` · `RQ -->|items| UP & ORD & ROOMS`. Target share of active time: Reliquary 15-25%, rituals 20-45% (loop audit criterion).

## 5. Migration of existing saves (save migration: yes; take the next free `saveVersion`)
1. Every merge item on the 7×7 grid and the 6-slot shelf becomes `inventory[itemId] += 1` (tier ids already exist in `merge.json`: pamphlet … eternal_flame). Nothing is lost; nothing is auto-merged.
2. Generators keep their charges and become passive T1 sources (no grid cells).
3. `run.reliquary` (MergeState) is replaced by `run.workshop = { active: null | { chain, tier, seed, rotations[] }, seq: { paper: [0,0,0,0,0], candle: [...] } }`.
4. `meta.mergeCodex` stays as is, shown as the "Reliquary Codex" (highest tier made). GDD §4 collection renamed.
5. Tutorial step `merge` becomes `craft`; a save sitting on that step gets a handcrafted 4×4 "first commission is on the house" board that yields the Manifesto the tutorial Mothman order needs.
6. Data: orders and upgrades change `{ "merge": "paper", "tier": 3 }` to `{ "item": "manifesto" }`; the ten items are added to `data/items.json` with `kind: "craft"`. Saves store order ids only, so open orders survive.
Fixture test: a pre-migration save with a full grid, a full shelf and both generators loads with identical item counts.

## 6. Acceptance criteria (for Ley Lines; adapt names for another option)
1. Same seed → identical board (determinism test); 1,000 seeds per tier all solvable by construction, not pre-solved, and within the validator's guess limits.
2. Any closed, fully connected configuration wins (test with a board that has two solutions).
3. Starting a T2-T5 commission consumes one item of the tier below; abandoning refunds it and the next board for that chain and tier is the same one.
4. Data test: every order need and upgrade step references an item a commission can produce (17 slots now, plus Sanctum rooms).
5. Migration fixture as in §5.
6. Tap targets 24 logical px; screenshots at 390×844, 844×390, 360×640, 1280×720; rotating mid-board keeps rotations; no timer field in `workshop.json`; reduced motion removes glow travel.
7. Sim: Reliquary 15-25% and rituals 20-45% of active time in the 150-minute run; no single action > 60% in any 30-minute window.

## 7. Why would a player do this differently next run?
Which chain you climb follows the patron's order pool (Vorl wants Altar Candles and Tomes; Baba Yaga's trials want Manifestos). How you source T1 is a build choice: Press rooms and Candle Vigil rites (a ritual-and-rooms run) or playing T1 boards (a puzzle run). Patron modifiers change the boards themselves, Heralds twist them weekly, and the Codex carries over: tiers you have made before start unlocked next run, so later runs open on harder boards with bigger payouts.
**Replay-matrix row (replaces "Reliquary"):** Patron: board modifiers, quest item | Draft: Crafty workers in the Press | Heralds: board twists | Prophecies: "Steady Hand" (+2 par) | Ascension: — | Hard mode: T5+ "remix" boards (5 of 6 filled).

## 8. Decisions to log once the owner chooses
Replace merge with Commissions + chosen puzzle; one item of the tier below as input (no energy); incense/smoke skin rejected (gas association); merge items migrate one-to-one into inventory; Packing parked for the Pilgrimage Bus; word and deduction puzzles rejected (localisation; tone).
