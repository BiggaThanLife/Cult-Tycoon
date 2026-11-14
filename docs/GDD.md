# Game Design Document — Cult Tycoon (working title)

Owner: game-designer · Status: **v0.1 draft, awaiting owner approval**

## 1. Pitch
You are a charismatic, deeply unqualified cult leader. Build a cheerful pixel compound, grow a devoted (and
gullible) following, and court ancient entities who are honestly terrible bosses. The player is the villain and
the game knows it. Satire punches up at the con, never at the conned.

**Pillars**
1. **Everything feeds everything.** Puzzles, merges and potions all produce what the compound needs.
2. **Runs, not grind.** Each run is shaped by patron, recruits and heralds; prestige feels like a new game.
3. **Cute but wrong.** Bright sprites, deadpan bureaucratic evil, nobody actually hurt.
4. **Respect the player's time.** No energy, no FOMO, short anticipatory timers only.

## 2. Core loop
```
          ┌──────────── Orders (entities, outsiders, followers) ────────────┐
          │                                                                  ▼
 Followers ──work──► Buildings ──► Devotion / Donations / Ingredients ──► Fill orders ──► XP, Favor, Relics
     ▲                   ▲                │                                   │
     │                   │                ▼                                   ▼
 Recruit (ritual)   Upgrades (merge items) Greenhouse → Alchemy → Potions   Compound level ──► unlocks
     │                                                                        │
     └──────── Suspicion rises with growth/greed ◄── Raids/Exposés (ritual defense) ◄┘
                                     ▼
                    Ascension (prestige) → Relics, Prophecies, Grimoire carry over
```
- **Check-in (≈2 min):** collect buildings, tap the Welcome Back summary, fill one order, replant crops, start a brew, tap merge generators.
- **Session (≈20 min):** 3–6 ritual levels toward a sermon or recruitment drive, a merge push to tier 4–5, compound re-layout, alchemy experiments, an entity questline step.

## 3. Systems

Each system lists: purpose · inputs → outputs · **why play it differently next run?**

### 3.1 Followers
- Individuals with name, portrait seed, 1–2 traits, stats **Devotion, Sanity, Productivity, Doubt** (0–100) and a job slot.
- **What the stats do** (shown on the follower sheet; numbers in `data/balance.json` `stats`):
  - **Productivity**: work speed. A follower adds `0.5 x (0.5 + P/100)` of their building's base output (P 50 = +50%).
  - **Sanity**: steadiness. Each point above or below 50 adds or removes 0.25% output. Low Sanity is played as comedy.
  - **Devotion**: faith in the leader. Each point adds 0.1% to the Devotion paid by every ritual (flock total).
  - **Doubt**: questions asked. The flock's average Doubt slows how fast Suspicion fades (0.5% per point). Later: schisms and defections.
- Traits (v1, 10): Gullible, Zealous, Skeptic, Wealthy, Influencer, Ex-Accountant, Insomniac, Crafty, Green Thumb, Gossip.
- Synergies (data-driven rules): Influencer + Wealthy in the same building → "Viral Tithe" donation bonus; two Skeptics in one dorm → Schism event; Ex-Accountant in Merch Tent → Suspicion from audits −50%; Gossip + Skeptic → Doubt spreads.
- Recruitment is a **draft: choose 1 of 3 converts**, rolled from the recruit seed and weighted by buildings/patron.
- Doubt above 70 → follower may *defect* (leaves with a small Suspicion spike) or start a schism. "Re-education" sends them to the Pamphlet-Reading Room (job slot, lowers Doubt slowly, produces nothing).
- **Why differently?** The draft and patron weightings give different trait pools; synergy builds (a "viral influencer" run vs. a "quiet accountants" run) change the optimal layout.

### 3.2 Resources
| Resource | Role | Main sources | Main sinks |
|---|---|---|---|
| Devotion | soft currency, XP-ish | Sermon Hall, rituals, orders | building, upgrades, recruiting |
| Donations | money | Merch Tent, Wellness Retreat, Wealthy followers | land parcels, upgrades, ingredients |
| Ingredients | crafting input | Greenhouse | Alchemy, orders |
| Relics | meta currency (kept on Ascension) | entity orders, ritual 3-stars, Reliquary top tiers | Prophecies |
| Dark Favor | per-patron favor, earned only through play | entity orders, offerings, questlines | patron boons, entity unlocks, land via appeasement |
| Suspicion | heat 0–100 | growth, greed, defections, tactics | Amnesia Brew, PR rituals, Compound Wall, quiet periods |

### 3.3 Buildings (v1, 10)
Sermon Hall, Commune Kitchen, "Wellness" Retreat, Recruitment Booth, Pamphlet Press, Ritual Circle, Greenhouse,
Alchemy Lab, Merch Tent, Compound Wall. Plus a Dormitory (housing cap) and the Pamphlet-Reading Room.
- **Dormitory** houses 4 followers per level; housing is the soft cap on cult size.
- Sizes 2×2 or 3×2 tiles. Levels 1–5. Upgrades cost Devotion + Donations + one merge item (e.g. Manifesto).
- **Adjacency bonuses** (data-driven): Kitchen next to Dorm = +Sanity; Merch Tent next to Recruitment Booth = +Donations but +Suspicion; Compound Wall segments reduce Suspicion gain from buildings they enclose.
- Production is a per-second rate scaled by assigned followers' Productivity and traits.
- **Why differently?** Patron rules (illusion buildings, walking huts) and the land you unlock first change the layout puzzle each run.

### 3.4 Compound & land
- Start: 12×12 usable tiles of a 24×24 map, the rest covered by **Unholy Brambles**, fog or locked parcels.
- Unlock land by clearing brambles (Devotion + a ≤60s clearing timer; cleared brambles drop a Bramble Pile merge generator), buying parcels (Donations) or appeasing an entity (Favor).
- Portrait shows ~11×16 tiles; landscape shows ~20×11 plus docked panels.

### 3.5 Orders (Township-style)
- **Order board** with 3–6 slots: Entity orders (Favor + Relics), Outsider orders (Donations, may raise or lower Suspicion), Follower requests (Devotion, Sanity).
- Each order lists 1–4 items from any production chain, plus flavor text.
- **Offering Caravan / Pilgrimage Bus**: a crate-filling loop that departs every 20 min of play (bus) or each in-game month (caravan, v1.1). Filling all crates gives a bonus chest.
- Orders are generated from data tables weighted by compound level and patron; no order needs an item you can't currently produce.
- **Why differently?** Patrons skew the order pool (Anansi gambles, Baba Yaga trials), so the chains you invest in change.

### 3.6 Production chains (v1)
- Crops → Ingredients: Nightshade, Mandrake (screams on harvest), Moonpetal, Graveyard Moss, Wolfsbane, Suspiciously Normal Basil.
- Ingredients → Potions (Alchemy Lab).
- Merge chains (Reliquary) → Building upgrades and orders.
- Kitchen: Ingredients → Commune Stew (Sanity), Suspiciously Normal Pesto (sell).
- Pamphlet Press: Donations → Pamphlets (which also seed the Reliquary chain).

### 3.7 Rituals (match-3)
- 8×8 board, 6 tile types: Candle, Skull, Eye, Rune, Herb, Coin. Each has a unique **shape and color** (colorblind-safe).
- Specials: 4-in-line → **Rune Line** (clears row/col); L/T → **Hex Bomb** (3×3); 5-in-line → **Summoning Sigil** (clears all of one type). Special+special combos (Line+Line = cross, Line+Bomb = 3-wide cross, Bomb+Bomb = 5×5, Sigil+X = converts all of X's color to X's special, Sigil+Sigil = clear board).
- Goals: collect X, clear blockers (Chains, Cobwebs, Salt Circles: 2-hit), drop a Relic to the bottom, reach score.
- Move-limited; 3 stars by score; **par moves** shown. Relaxed mode = unlimited moves, no stars.
- Engine: pure TS, seeded generation with no starting matches, cascade resolution with gravity, "no moves → reshuffle", hint after 5s idle, solvability validator (greedy + random playouts, must win ≥ X% of 500 seeded playouts).
- **Meta link:** each ritual is attached to a compound action: *Sermon* (Devotion burst), *Recruitment Drive* (unlocks a 1-of-3 draft), *Raid Defense* (reduces a Suspicion event's damage), *Summoning* (meet/court an entity). Tiles collected also pay out small resources (Herbs → Ingredients, Coins → Donations).
- **Why differently?** Patron modifiers alter boards (Mothman: dark tiles reveal at night; Vorl: tentacle blockers spread), and hard-mode remixes appear after Ascension.

### 3.8 The Reliquary (merge)
- 7×7 grid + 6-slot shelf (fits portrait and landscape at a fixed tile size). Merge **two** identical items → next tier (D-107).
- Chains (v1): **Pamphlet → Brochure → Manifesto → Holy Scripture → Forbidden Tome**; **Pebble → Crystal → Geode → Eye of the Void**; **Candle Stub → Taper → Votive → Altar Candle → Eternal Flame**.
- Generators: Donation Box (paper chain), Ritual Brazier (candle chain), Bramble Pile (pebble chain, appears when clearing land). Cooldown: 5–30s, holds up to 6 charges. No energy.
- Items are consumed by orders, building upgrades, and entity offerings. Merge Codex tracks the highest tier reached.
- **Why differently?** Patron changes generator weights and which top-tier item their questline wants.

### 3.9 Greenhouse & Alchemy
- Plots: plant → grow (30s–8 min real time) → harvest. Quality: Normal / Fine / Cursed-Perfect, from fertilizer (Graveyard Moss compost) and follower Green Thumb.
- **Alchemy Lab:** choose 2–4 ingredients. Known recipes brew instantly; unknown combos are **experiments**: valid → new Grimoire entry; invalid → "Inert Sludge" (sellable as "artisanal").
- Quality minigame: a 3-second stir timing bar (skippable; skip = Normal quality). Reduced-motion friendly.
- Potions (v1, ~12): Zeal Tonic (Devotion), Calm Draught (Sanity), Motivational Kombucha (Productivity; a placebo, and everyone knows it), Amnesia Brew (a free sample reporters happily drink; they forget the last hour and leave with a tote bag; −Suspicion), Glamour Mist (Merch prices up), Moonlight Tincture (Mothman orders), Night-Owl Brew, etc.
- Potions are openly offered, clearly magical and harmless. **Nobody is dosed covertly; nothing sickens, sedates, poisons or erases doubt** (D-110).
- **Why differently?** The Grimoire persists, so later runs skip discovery and instead chase quality and patron-specific recipes.

### 3.10 Entities (patrons and visitors)
Each: personality, favorite offerings, **boon**, **bane**, questline (5 steps v1), and an ending hook.
| Entity | Source | Archetype | Boon | Bane |
|---|---|---|---|---|
| **The Mothman** | modern American cryptid | Omens | Upcoming in-game events are telegraphed a few minutes early; night rituals +50% rewards | Demands lamps and candles; followers sleep less (Sanity −). Guardrail: D-111 |
| **Baba Yaga** | Slavic folklore | Trials | Buildings can "walk" to a new tile once per day for free; trial orders pay triple | Fail a trial and she borrows a building for an hour |
| **Anansi** | Akan & Caribbean folk tales | Gambles | Order rewards become dice rolls with a higher average; stories turn Doubt into Devotion | Variance; occasionally swaps two orders' requirements |
| **Vorl, the Patient Deep** | original | Hunger | Building production ×1.6 (additive +60%) | Sanity decays fast; Kitchen and Calm Draught become essential |
Pledge 1 patron in run 1; 2 patrons from Ascension 2. Other entities visit and post orders even when not pledged.
- **Why differently?** This is the main build-archetype lever.

### 3.11 Suspicion
- 0–100 meter, 4 bands: Quiet (0–24), Murmurs (25–49), Scrutiny (50–74), Heat (75–100).
- Rises from: production rate spikes, greedy Merch prices, defections, certain tactics, outsider orders.
- Falls from: Amnesia Brew, PR Sermons, Compound Wall, quiet time, outsider charity orders.
- Band events: reporters, tax auditors, a nosy neighbor, a raid. Each event offers choices; some can be resolved with a **Raid Defense** ritual for reduced loss.
- Setbacks are soft: lose some Donations, a building goes offline for 10 min, a follower defects.
- At 100 a **Raid** starts a final defense ritual; failing ends the run in the **Raided** ending (meta kept).
- **Why differently?** Different patrons and trait builds make greed safer or riskier; Heat-farming runs are viable for some patrons.

### 3.12 Events (Kairosoft-style)
Data-driven deck with weights by band, time of day and patron: random visitor, reporter, defector, tax auditor, rival
cult leader, the curious cat (adoptable, does nothing, beloved), door-to-door salesman, a lost hiker. Each event: text, 2–3 choices, effects.

### 3.13 Tactics (satire layer)
Unlockable "leader tactics" that satirize real manipulation patterns: Love-Bombing Brunch, Sacred Tithe,
Mandatory Joy Schedule, the NDA Scroll, Celebrity Outreach, Apocalypse Date (and its rescheduling).
Each gives a short-term gain **with a visible cost** (Suspicion, Doubt over time) and unlocks the matching Field Notes entry.

### 3.14 Field Notes codex
Short, factual, non-sensational entries on manipulation tactics and warning signs, unlocked by using the matching tactic.
No real group names in game text (D-010). Each entry: "What it looks like", "Why it works", "Warning signs", and a
"Where to learn more" link page. Sources live in `docs/FIELD_NOTES_SOURCES.md`, verified by the lore reviewer.

### 3.15 Offline progress
- Cap **8h**. Buildings produce at 60% of online rate while away (crops grow at 100%).
- **"Welcome back, Prophet"** summary lists gains, events that "happened" (pre-rolled, low-stakes only; no raids offline), and a recommended next action.
- Clock-safety rules in CLAUDE.md.

### 3.16 Compound XP & levels
XP from filling orders (main source), first-time builds and upgrades, ritual stars and questline steps (D-113). Each level shows exactly what it unlocks next, so there's always a visible goal.

## 4. Replayability layers
1. **Ascension (prestige):** triggered after reaching Compound Level 10 and completing your patron's questline step 3.
   Choose a flavor: *Fake Your Death*, *Flee Abroad*, *Get Beamed Up*. Each gives a different starting perk for the next run.
   Keeps: Relics, Prophecies, Grimoire, collections, endings. Resets: compound, followers, resources, Suspicion.
   Each ascension unlocks new entities, buildings and Heralds.
2. **Patrons** change rules (3.10).
3. **Recruit draft + trait synergies** (3.1).
4. **Schisms & rival cults:** at high average Doubt a splinter faction forms and poaches; rival AI leaders appear from Ascension 1. Quarterly **Faith-off** (match-3 vs AI) is v1.1 (LATER.md).
5. **Heralds** (weekly mutators, seeded by ISO week): e.g. *Solar Eclipse — ritual rewards ×2, Suspicion gain ×2*; *Mercury in Retrograde — orders swap at random*; *Tax Season — auditors ×3, Ex-Accountants ×2 output*.
6. **Collections** with completion %: Bestiary, Grimoire, Merge Codex, Field Notes, Follower Yearbook, Endings Gallery.
7. **Daily/weekly rhythm without punishment:** Daily Ritual (date-seeded, personal best), weekly entity questline step. Streaks never reset; they pause.
8. **Endings (v1, 4 + secret):** *Escaped with the Money*, *True Believer* (you started believing it), *Raided*, *Devoured* (your patron eats you, politely), secret: *The Cat Was the Real Prophet*. Credits after the 3rd ascension.
9. **Puzzle mastery:** 3 stars, par moves, hard-mode remixes with entity modifiers after Ascension 1.
10. **Anti-staleness checks:** sim flags single-action optimal strategies and >10 min of active play without an unlock.

### 4.1 Replayability matrix (what changes next run)
| System | Patron | Recruit draft | Heralds | Prophecies | Ascension flavor | Hard mode |
|---|---|---|---|---|---|---|
| Followers | trait weights | ● | ● (trait buffs) | +draft choice | starting follower | — |
| Buildings & layout | rule changes (walk, ×prod) | adjacency synergies | — | starting Devotion | starting building | — |
| Orders | order pool & reward shape | — | ● (swaps) | — | — | — |
| Rituals | board modifiers | — | ● (×rewards) | +moves | — | remixed levels |
| Reliquary | generator weights, quest item | — | — | +charges | — | — |
| Alchemy | patron recipes | Green Thumb | — | known recipes | — | quality chase |
| Suspicion | heat tolerance | Ex-Accountant etc. | ● (×gain) | −gain | Low Profile start | — |
| Endings | ending hook per patron | True Believer via Zealots | — | — | — | — |
Every row needs at least three filled columns; a system below that needs a new replay lever before it ships.

## 5. Progression (v1 target pacing)
| Compound Lv | Unlocks | Target active time |
|---|---|---|
| 1 | Sermon Hall, Greenhouse, Dorm, rituals 1–3 | 0–5 min |
| 2 | Alchemy Lab, Recruitment Booth, Reliquary | 5–15 min |
| 3 | Mothman orders, Suspicion meter visible | 15–30 min |
| 4 | Kitchen, Merch Tent, Pilgrimage Bus | 30–60 min |
| 5 | Patron pledge, Pamphlet Press, tactics | 1–2 h |
| 6–9 | Retreat, Ritual Circle, Wall, land, events, rival leader | 2–6 h |
| 10 | Ascension available | ~6–8 h active |
Second and third runs target 4–5h each thanks to Prophecies.

## 6. Onboarding
One system per beat: Build → Collect → Recruit (first ritual) → Grow → Brew → Merge → Orders → Suspicion → Patron.
A pushy but incompetent "Spiritual Advisor" (a talking pamphlet) guides you.

## 7. UI & layout (summary; full rules in ART_BIBLE.md)
- Portrait: top resource bar, compound camera center, bottom tab bar (Compound, Rituals, Reliquary, Alchemy, Orders).
- Landscape: same camera wider; order board docks right, follower list/inventory docks left; tab bar becomes a left rail.
- Puzzle boards fixed-size and centered; landscape puts goals/boosters in side panels.
- Accessibility: reduced motion, large text, colorblind palettes, relaxed puzzle mode, one-handed portrait reach (primary buttons in bottom 40%).

## 8. v1 content budget
10+2 buildings · 4 patrons (+3 visitor-only NPC types) · 40 ritual levels · 3 merge chains (14 items) · 6 crops · 12 potions ·
10 traits · ~30 events · 6 tactics/Field Notes · 4+1 endings · 6 Heralds · 8 Prophecies.

## 9. Vertical slice (Phase 2) — full script in docs/specs/vertical-slice.md
Empty compound → place Sermon Hall, Greenhouse, Alchemy Lab → recruit 3 (draft) → plant/harvest 2 crops → brew 1 potion →
merge to tier 3 → 3 ritual levels → 2 Mothman orders → Suspicion up and down → offline summary → locked Ascension preview.
Debug panel: time skip, add resources, reset save, force event.
