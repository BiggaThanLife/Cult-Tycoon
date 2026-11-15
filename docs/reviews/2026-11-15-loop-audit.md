# Review 2026-11-15: loop audit (do all modes feed each other?)

Reviewer: game-designer. Requested by: owner (as producer).
Read: CLAUDE.md, docs/GDD.md, docs/ECONOMY.md, docs/specs/expansion-1.md, docs/sim/latest.md, docs/DECISIONS.md,
data/*.json, data/levels/rituals.json, src/core/game.ts (all payout rules), src/puzzle/match3.ts (tile kinds), tools/sim/run.ts (bot priorities).
Status: findings + proposals. Nothing in data or code was changed. Numbers marked "start" are for the economy-balancer to tune with `npm run sim`.

Vocabulary (D-149, `docs/reviews/2026-11-15-raids-guardrails.md`): "raid" and `defense` are internal words only. Player-facing,
a raid is an **inspection** by the Office of Mild Concern, the defense ritual is **"Look Busy"** (inspection prep), and the
Raided ending is **"Closed Pending Review"**. Every Suspicion proposal below follows that guardrail: civil visits, fines in
Donations, rooms sealed "Pending Review" for a short while, followers who leave by choice, no countdowns, no "defend" framing.

## 0. Summary for the lead

The early game (tutorial to about 55 minutes) is well connected. After that **every currency runs out of sinks at the same time**,
and the ritual mode is the first thing to lose its purpose:

- Devotion, the main ritual payout, has a **lifetime sink of 1,780** in the whole game (two buildings for 90, seven upgrades for 1,690).
  Once upgrades are bought (sim: buildings 3/3/3/2 by about 60 to 75 min) every point of Devotion is wasted.
- Rituals give two things nothing else gives (followers and entity meetings), and both are one-shot: followers cap at **8 beds**, entities at **5**.
- Suspicion has **no consequence at all** after the tutorial reporter (no band events, no inspections); three of fifteen boons, one trait and the Doubt stat only modify it.
- Compound levels 7 to 10 **unlock nothing** (`unlocksAt` returns empty above Lv6); the sim counts them as "new things" but they are hollow.
- In the 150-minute sim the headline mode is the least played: **ritual 14:16 (9.5%)** vs merge 57:47 (38%) and orders 45:28 (30%).
  The bot only preaches when Devotion is below 80% of the cap (`tools/sim/run.ts:217`), that is, rituals are filler.

The "content runs thin at 65 to 75 minutes" note (expansion-1 Known limit, D-147) is not only a content-count problem. It is a
sink problem: more entities and levels would hit the same wall. Fix the sinks and the ritual's role first, then add content.

---

## 1. Resource and item flow

Counting rule: "Orders" = number of order definitions in `data/orders.json` that ask for the item (22 orders total, 2 of them
tutorial-only, marked T). "Upg" = building upgrade steps in `data/buildings.json` that need it (7 steps total).

Verdicts: **healthy** (2+ repeating consumers and a steady source) · **thin** (one repeating consumer, or only consumers that appear late)
· **dead end** (produced but nothing, or almost nothing, consumes it) · **dead start** (consumed but hard or impossible to produce).

### 1.1 Crops / ingredients
| Item | Sources | Sinks | Orders | Upg | Verdict |
|---|---|---|---|---|---|
| Basil | crop (30 s, yield 3, 1 Don); ritual Herb tiles (0.2 each, floored, needs Greenhouse) | recipes Amnesia, Pesto (x2), Calm; orders mothman_1 T, mothman_4, baba_yaga_1 (4), jersey_devil_2 (5) | 4 (1 T) | 0 | healthy |
| Nightshade | crop (120 s, yield 2, 3 Don) | recipes Amnesia, Moonlight, Zeal; orders mothman_1 T, mothman_3, baba_yaga_2 (3), anansi_2 | 4 (1 T) | 0 | healthy |
| Graveyard Moss | crop Lv2 (90 s, yield 3, 2 Don) | recipes Calm, Zeal; orders baba_yaga_1 (4), baba_yaga_4 (3), jersey_devil_4 | 3 | 0 | healthy |
| Moonpetal | crop Lv4 (240 s, yield 2, 5 Don) | recipes Moonlight, Zeal; orders anansi_2, vorl_2 (4) | 2 | 0 | healthy (late) |

Note: the ritual Herb payout is negligible. r8's 12-Herb goal pays floor(12 x 0.2) = 2 Basil first time, 1 on replay; one 30 s Basil plot pays 3.

### 1.2 Potions
| Item | Sources | Sinks | Orders | Upg | Verdict |
|---|---|---|---|---|---|
| Amnesia Brew | Basil + Nightshade (hinted from start) | reporter event choice, which fires **once**, in the tutorial (`game.ts:682`) | 0 | 0 | **dead end** after the tutorial |
| Pesto | Basil + Basil, **not hinted, no entity hints it** | jersey_devil_1 only, and that order is only offered once Pesto is in the Grimoire (`producible`) | 1 | 0 | **dead start** for its order (sim ends with grimoire 4/5: Pesto never found), dead end otherwise |
| Calm Draught | Moss + Basil (Baba Yaga hint) | baba_yaga_3 (2), vorl_3 | 2 | 0 | thin |
| Moonlight Tincture | Moonpetal + Nightshade (Mothman hint) | mothman_5, vorl_3 | 2 | 0 | thin (needs Lv4 Moonpetal) |
| Zeal Tonic | Moss + Moonpetal + Nightshade (Anansi hint) | anansi_3 | 1 | 0 | **thin** (one consumer, met at about 36 min) |
| Inert Sludge | any invalid combo | jersey_devil_4 | 1 | 0 | thin; becomes the only reason to brew "wrong" once the Grimoire is full |

Fine brews add a bottle and Lab Lv2 adds another (`brewBonus`), so a single brew yields 2 to 3 bottles of potions that have 1 or 2 consumers: surplus piles up.
Potions on followers are parked (D-144), so no potion has a non-order use.

### 1.3 Reliquary (merge) tiers
| Item | Sources | Sinks | Orders | Upg | Verdict |
|---|---|---|---|---|---|
| Pamphlet (paper 1) | Donation Box (8 s, 6 charges) | merging only | 0 | 0 | healthy (input) |
| Brochure (paper 2) | merge | mothman_6 (2), anansi_4; Dorm->2, Greenhouse->2 | 2 | 2 | healthy |
| Manifesto (paper 3) | merge | mothman_2 T, baba_yaga_2; Hall->2 | 2 (1 T) | 1 | thin |
| Holy Scripture (paper 4) | merge | anansi_1; Hall->3 | 1 | 1 | thin |
| Forbidden Tome (paper 5) | merge | vorl_4 (1 of Vorl's 4 orders; Vorl met at about 54 min) | 1 | 0 | **dead end** (rare consumer) |
| Candle Stub (candle 1) | Ritual Brazier Lv3 (10 s, 6 charges) | merging only | 0 | 0 | healthy (input) |
| Taper (candle 2) | merge | mothman_4, jersey_devil_3 (2), anansi_4; Greenhouse->3 | 3 | 1 | healthy |
| Votive (candle 3) | merge | baba_yaga_4; Dorm->3, Lab->2 | 1 | 2 | thin (upgrades are one-shot) |
| Altar Candle (candle 4) | merge | vorl_1 only | 1 | 0 | **dead end** (rare consumer) |
| Eternal Flame (candle 5) | merge | **nothing** | 0 | 0 | **dead end** (codex trophy only) |

The merge mode currently carries 10 order needs and all 7 upgrade steps. Any replacement puzzle must cover those 17 consumer slots.

### 1.4 Currencies, meta and stats
| Resource | Sources | Sinks | Verdict |
|---|---|---|---|
| Devotion | Sermon Hall (6/min base), every ritual, all 22 orders (45 to 400), cat (+5) | Greenhouse 30, Lab 60, upgrades 1,690. **Lifetime total 1,780.** Cap 500/1.5k/4k | **dead end** from about 60 min (after upgrades). Focused sim already sits at the 500 cap at tutorial end (`sim/latest.md`, step "away"), so overflow is wasted from minute 8 |
| Donations | orders (12 to 80), ritual flat 6 (3 on replay), Wealthy +1/min, boons (Jersey Devil 2, Anansi 2 + 3 per min) | seeds 1 to 5, Greenhouse 10, Lab 25, upgrades 590 total; cap 500 | **dead start** right after the tutorial (about 44 Don, D-148; cheapest upgrade asks 40), **dead end** late (only seeds) |
| Coin tile Donations | `game.ts:453` pays 1 per Coin | Coin tile never spawns: every level has `tileTypes: 5`, Coin is index 5 (D-125) | dead code |
| Compound XP | orders (15 + 3 x Lv) x 1.5; build 10; upgrade 15; recipe 10; ritual star 2 | levels; **Lv7 to Lv10 unlock nothing**; Ascension not built | hollow after Lv6 |
| Favor (per entity) | orders 10 to 30; summon 20 once | thresholds 40/100/200, never spent | dead end past 200 per entity (about 13 orders each) |
| Relics (meta) | **no source in code**; ECONOMY §5 promises 1 per first 3-star, not implemented | Prophecies (not built) | dead start (not built) |
| Suspicion | recruit +6 (+3 with an Influencer); refusing the reporter +5 | decay 0.5/min; Amnesia -15 (once) | **dead**: nothing reads it except the tutorial reporter. No band events or inspections exist |
| Followers | ritual drafts only (no Recruitment Booth) | none (no defection) | capped at 8 beds; after that recruit rituals pay 0 drafts (`game.ts:464`) |
| Productivity, Sanity | fixed at recruitment | Sermon Hall output only (the only building with workers) | static; fine but narrow |
| Follower Devotion stat | fixed at recruitment | +0.1% ritual Devotion per point | feeds a dead currency late |
| Doubt | fixed at recruitment (Skeptic +25, Gossip +10) | slows Suspicion decay, which does nothing | **dead** |
| Stars | ritual score | x1.25 / x1.5 Devotion; 2 XP each (54 XP max across 9 levels; Lv6 to 7 needs 3,059) | near worthless |

### 1.5 Boons (15 total) by what they actually feed
| Field | Boons | Feeds | Live late? |
|---|---|---|---|
| ritualDevotionPct | Mothman 10, 15; Vorl 20 | Devotion | no |
| outputPct | Baba Yaga 15; Jersey Devil 15; Vorl 20, 20 | Sermon Hall Devotion (only producer) | no |
| donationsPerMin | Jersey Devil 2; Anansi 2, 3 | Donations | barely (cap 500, only seeds) |
| cropYieldBonus | Baba Yaga 1, 1 | crops | yes |
| suspicionDecayPct | Mothman 20; Jersey Devil 15; Anansi 25 | Suspicion | **no, inert from day one** |

Only 2 of 15 boons still matter in the late game. Favor (the reward for orders) mostly buys more of dead currencies.

---

## 2. Ritual deep dive

### 2.1 What a ritual pays today (`finishRitual`, `balance.ritual`)
Devotion `(40 + 10 x index) x starMult`, Sermon x2, then x(1 + flock% + boon%); Donations flat 6 + Coins (never spawn); Basil 0.2 per Herb;
replays x0.5. XP 2 per new star. Purpose bonus: sermon = 1 draft on first win; recruit = 2 drafts first, 1 on replay, clamped to free beds;
summon = meet the entity + 20 Favor on first win only.

| Level | Purpose | 3-star Devotion first / replay (before flock and boons) | Est. time (par x 4 s + 15 s) |
|---|---|---|---|
| r1 | sermon | 120 / 60 | 51 s |
| r2 | recruit | 75 / 37 | 67 s |
| r3 | summon Mothman | 90 / 45 | 59 s |
| r4 | summon Baba Yaga | 105 / 52 | 51 s |
| r5 | sermon | 240 / 120 | 67 s |
| r6 | summon Jersey Devil | 135 / 67 | 67 s |
| r7 | recruit | 150 / 75 | 67 s |
| r8 | summon Anansi | 165 / 82 | 67 s |
| r9 | summon Vorl | 180 / 90 | 75 s |

### 2.2 The owner's questions, answered
1. **Does every purpose matter after its first win?** No.
   - *Summon* (r3, r4, r6, r8, r9: 5 of 9 levels): after the first win the entity is already met, no Favor is paid (`game.ts:470`). Replays pay only half Devotion and 3 Donations.
   - *Recruit* (r2, r7): 1 draft per replay until 8 beds are full (Dorm 4 / 6 / 8), then nothing. That is 5 replays in a whole run.
   - *Sermon* (r1, r5): x2 Devotion. Matters only while an upgrade still needs Devotion (lifetime 1,690).
2. **Is `defense` used anywhere?** No. No level has `purpose: "defense"`, `finishRitual` has no branch for it, and ECONOMY §5's "event loss x (1 - 0.25 per star)" has no code. The ECONOMY diagram arrow `SUS -->|events/raids| M3` is fictional today. (Only the unused string `ritual.purpose.defense` exists, and D-149 requires its text to change before it ships.)
3. **Do tile types collected matter outside goals?** Almost not. Herb pays 0.2 Basil (rounded down). Coin would pay 1 Donation but cannot spawn (D-125). Candle, Skull, Eye and Rune pay nothing. Which colour you match has no consequence outside the goal bar, so in-board strategy is score-only.
4. **Why would a player replay a ritual at Compound Lv6?** Only to top up Devotion for the next upgrade (Hall Lv3 needs 450, Dorm Lv3 350). r5 replay at 3 stars pays about 120 x (1 + about 30% flock + 25% Mothman boons) = about 186 Devotion per 67 s. Once upgrades are bought, there is no reason at all. Recruit replays stop at 8 followers.
5. **What does a ritual give that nothing else gives?** Followers (drafts) and entity meetings. Both are finite (8 and 5). Devotion also comes from the Hall and every order; Donations and Basil are better from orders and plots.
6. **Any reason to play rituals in the mid game other than Devotion?** No. The sim bot confirms it: after summons and beds it preaches only when Devotion is under 80% of the cap.
7. **Does Suspicion ever reach rituals?** No. Suspicion only exists as a number; no band events, no inspections, no "Look Busy" rituals.
8. **Are stars worth anything?** Very little: +25% / +50% of a currency that is dead late, and 2 XP per star (all 27 stars = 54 XP, under 2% of Lv6 to 7). The promised Relic for a first 3-star is not built. Par moves and the star reveal (D-130) are pure feel.

### 2.3 Root causes
- **Purpose is welded to the board.** Each level has one purpose forever, and 5 of 9 purposes are one-shot summons. A player who wants "more followers" or "more Favor" cannot choose a ritual for that.
- **One output currency.** Every ritual converts into Devotion, the currency with the smallest sink.
- **No pressure system to answer.** Suspicion, the system rituals were designed to answer (GDD 3.11), has no teeth.

### 2.4 Proposal: Rites (rituals as the central verb)

**Purpose.** Every ritual run is aimed at a **target** the player picks before the board loads. The board is the level (difficulty and
variety); the target is the reason. The target names one **focus tile**; focus tiles collected convert into what that target's system needs.
Every win also pays **Omens**, a currency that only rituals produce.

**Player verbs.** Choose target -> choose board (any unlocked level) -> play -> see conversion summary ("31 Skulls -> 12 Favor with Baba Yaga").

**Targets (data-driven, `data/rites.json`).** Rates are starting points; the balancer measures typical focus-tile counts per level from validator playouts (`Match3State.collected`) and tunes so one rite (about 60 to 75 s) is worth about one order of the same kind, never more than 1.2x.

| Target | Unlocks | Focus tile | Converts to (start rate) | Feeds |
|---|---|---|---|---|
| The Flock (Sermon) | tutorial r1 | Eye | Devotion x2 (as now) **and** -1 Doubt on every follower per 8 Eyes | Followers, Suspicion (via Doubt) |
| Recruitment Drive | tutorial r2 | Rune | 1 draft; every 15 Runes adds a 4th card to that draft. Disabled with a reason when beds are full (D-148 rule) | Followers |
| Communion (one met entity) | first meeting with that entity | Skull ("resin, decorative") | 0.4 Favor per Skull with that entity (about 12 per run) | Orders/Entities, boons |
| Harvest Rite (Greenhouse) | Greenhouse built | Herb | 1 ingredient per 3 Herbs, player picks the crop among unlocked ones (about 10) | Garden, Alchemy, Orders |
| Candle Vigil (Reliquary) | Ritual Brazier (Lv3) | Candle | 1 Candle Stub per 4 Candles onto the shelf/grid, overflow becomes Brazier charges (about 7) | Reliquary, upgrades |
| "Look Busy" (internal `defense`; only while an inspection is announced) | first band event | none; stars. Uses its own office-object boards per D-149 §4 (forms, stamps, receipts; blockers are red tape, coffee stains) | fine and seal time x (1 - 0.25 per star) (ECONOMY §5); a win also takes -5 Suspicion | Suspicion |
| Tithe (later, needs 6-type boards) | Merch Tent / Coin boards | Coin | 1 Donation per Coin | Donations |

Summoning stays exactly as today: a level's first win meets its entity. After that the level is just a board.

**Omens (ritual-only currency).** Earned: stars on every win (1 to 3), +2 on a level's first 3-star. Relaxed mode (no stars, D-014) earns a flat 1 per win so accessibility players are never locked out.
Spent on (start costs):
- The **last** upgrade step of each building needs Omens as well (Hall->3: 6, Dorm->3: 4, Greenhouse->3: 4, Lab->2: 4). The middle steps keep merge items.
- A 4th boon per entity, "Audience", at 200 Favor + 10 Omens (5 new boons; fields chosen so they are live late: crop yield, Omen gain, order reroll discount, Favor per order).
- Re-roll one open order: 1 Omen (no wait, no FOMO, just choice).
- Mothman-flavoured "Read the Omens": 2 Omens to see the next Suspicion visit as an appointment card ("Tuesday, between 9 and 4:30"), never as a clock (D-149 §4, GDD Mothman boon as a verb).
- 3-star first-time Relic (ECONOMY §5) is restored separately; Relics stay meta.

**Daily Rite (GDD §4.7).** One date-seeded board per day from the unlocked level pool, any target, with a personal best. Bonus: +3 Omens on the first win of the day. Missed days **bank** up to 3 bonuses, so nothing is lost by skipping (no FOMO); no streak counter.

**Suspicion that reaches rituals.** Implement ECONOMY §7 bands: event chance per minute 0 / 3% / 6% / 12% (online only, daytime business hours in game, queued so it never interrupts a ritual, D-145).
Events (all civil, D-149): nosy neighbour (Murmurs), Auditor visit about merch receipts (Scrutiny), exposé reporter (Scrutiny, offered Amnesia Brew openly again), Building Inspector appointment (Heat, announced like an appointment, no countdown). Each card offers: hand over an item (Amnesia Brew, Calm Draught for the inspector's thermos), accept a soft outcome (a fine of 15% Donations, or one building sealed "Pending Review" for 10 min, or a follower leaves by choice "to help with the inquiry" and comes back later), or **play Look Busy**. At 100 Suspicion: a full inspection with a Look Busy board; a loss means a fine plus a short seal and Suspicion resets to 50. The "Closed Pending Review" ending (internal: Raided, D-008) waits until Ascension exists, so no run ends without meta progress to keep.

**Data schema sketch.**
```json
// data/rites.json
{ "rites": [
  { "id": "communion", "target": "entity", "focusTile": "skull",
    "pays": { "favorPerTile": 0.4 }, "unlock": { "metAny": true }, "nameKey": "rite.communion.name" },
  { "id": "harvest", "target": "building:greenhouse", "focusTile": "herb",
    "pays": { "ingredientPerTiles": 3, "choose": "crop" }, "unlock": { "building": "greenhouse" } }
],
  "omens": { "perStar": 1, "firstThreeStar": 2, "relaxedFlat": 1, "dailyBonus": 3, "dailyBank": 3 } }
```
`rituals.json` keeps `purpose` only for tutorial levels and summon levels (`"summons": "baba_yaga"`); `balance.ritual.replayMult` applies to Devotion only, not to target conversions. Save: `run.omens`, `run.dailyBank`, `run.lastDaily` (migration v3 -> v4).

**UI states.** Portrait: the Rituals tab shows a target strip (icons, scrollable) above the level list; the selected target shows its focus tile and the expected payout; disabled targets say why. In the board, the focus tile gets a small halo and a counter in the goal bar ("Skulls -> Favor: 9"). Landscape: target list docks in the left panel, conversion preview in the right dock (D-122 regions), board stays centred at fixed tile size. Rotation keeps the chosen target (it lives in `activeRitual`).

**Edge cases.** Housing full: Recruitment disabled with a reason. Entity met but already at max boons: Communion still pays Favor toward Audience. Greenhouse missing: Harvest hidden. No inspection announced: Look Busy hidden. Ritual lost: nothing paid, as now; a lost Look Busy applies the normal outcome (never a worse one, and never "they got in"). Followers who cooperated with an inquiry are never penalised (D-149 §4). Abandoned rite on reload: target is discarded, no payout. Offline: no events, no rites. Devotion at cap: conversion summary shows the overflow (no silent waste).

**Acceptance criteria (testable).**
1. Every won ritual pays at least one non-Devotion output when a target is chosen (unit test per rite id).
2. Focus-tile counts are converted exactly per `rites.json` (unit test with a scripted `Match3State.collected`).
3. Replaying any level at Lv6 with Communion raises that entity's Favor; with Recruitment and full beds the button is disabled and names the reason.
4. Omens have no source outside `finishRitual` and the Daily Rite (grep test on `run.omens +=`).
5. Look Busy at 3 stars cuts an inspection's fine and seal time by 75% (unit test); no event triggers while `activeRitual` is set or offline; no inspection event or string has a timer field (data test), and the D-149 §6 checklist passes in sensitivity review.
6. Sim: in the 150-minute long run, ritual share of active time is between 20% and 45%, no single action exceeds 60% in any 30-minute window, and no resource sits at its cap for more than 10 consecutive minutes.
7. Portrait and landscape screenshots of the target picker at 390x844, 844x390, 360x640; rotating mid-rite keeps target and board.

**Why would a player do this differently next run?** The target mix *is* the build. A Baba Yaga garden run spends rites on Harvest (her trials eat crops); a Mothman run spends them on Communion and Read the Omens; a high-Doubt draft (Skeptics, Gossips) forces Sermons; a greedy, high-Suspicion run lives on Look Busy boards. Heralds change focus rates (e.g. *Solar Eclipse*: Communion x2, Suspicion gain x2), so the best target shifts week to week.

**Tutorial.** One system per beat: r1 Sermon, r2 Recruitment, r3 summon are already fixed targets. The target picker is its own beat right after the tutorial (Lv2, "Harvest Rite" first because the Greenhouse exists). Omens are taught at the first upgrade that needs them. Suspicion events are taught by the first band event.

---

## 3. Dead ends and soft locks

| # | Problem | Evidence | Real? | Severity |
|---|---|---|---|---|
| 1 | Devotion has nowhere to go after upgrades | lifetime sink 1,780; sim maxes buildings by about 60 to 75 min | yes | **critical** (kills rituals, boons and orders' main reward) |
| 2 | Suspicion has no consequence | only the tutorial reporter reads it; no bands or inspections in code | yes | **high** (removes the game's only pressure; 3 boons, Ex-Accountant, Doubt inert) |
| 3 | Compound Lv7 to 10 unlock nothing | `unlocksAt` data stops at Lv6 (r9); Ascension not built | yes | **high** (XP grind with no goal, violates "always a visible goal", GDD 3.16) |
| 4 | Rituals have no mid-game purpose | section 2 | yes | **high** |
| 5 | Content thin at 65 to 75 min | sim longest wait 38:20 at 147 min | yes, symptom of 1 to 4 | high |
| 6 | Donations scarce right after the tutorial | about 44 Don (D-148); cheapest upgrades 40 Don + a Brochure; Hall needs a Manifesto the tutorial just consumed (mothman_2); post-tutorial Mothman pool at Lv2 is only mothman_3 (12 Don) and mothman_6 (14 Don); seeds also cost Donations | yes; UI explains it now (D-148) but the economy still stalls the first upgrade | medium |
| 7 | Followers have one job | Sermon Hall is the only building with `produces`, so `assignJobs` puts all 8 there; Greenhouse, Lab and Reliquary take no workers | yes | medium (draft choice is weak: only Green Thumb (max, not sum) and Wealthy matter outside the Hall) |
| 8 | Doubt does nothing | it only slows Suspicion decay, which does nothing; no defections | yes | medium (resolves with fix 3) |
| 9 | Recruit rituals stop paying at 8 followers | `game.ts:464` clamps drafts to free beds | yes | medium |
| 10 | Amnesia Brew dead after tutorial | 0 orders, reporter fires once | yes | low (resolves with fix 3) |
| 11 | Pesto undiscoverable in practice | not hinted, no entity hints it; jersey_devil_1 never offered until discovered by chance | yes | low |
| 12 | Merge top tiers | Eternal Flame 0 uses; Altar Candle and Tome one Vorl order each | yes | low to medium (they also occupy 7x7 grid cells) |
| 13 | Favor stops mattering at 200 | thresholds only, never spent | yes | medium (late orders feel pointless) |
| 14 | Devotion at cap during the tutorial | focused sim at 500/500 at step "away" | yes | low (early but visible "wasted" floaters) |
| 15 | Sermon Hall storage caps offline | `storageMin: 10` = 60 Devotion at Lv1, so an 8 h absence yields 10 min of Hall output | intended? check with owner | low (GDD 3.15 implies 8 h at 60%) |
| 16 | Relics have no source | `meta.relics` never increases; ECONOMY §5 3-star Relic not built | yes (meta not built yet) | low now, high at Ascension |

No hard soft-lock exists: replays (D-123) and repeating orders always offer an action, and `producible` never posts an impossible order.
The problem is that the actions stop leading anywhere.

---

## 4. Mode-by-mode "what does it feed?" matrix

Row = producer, column = consumer. **EMPTY!** = should not be empty; "-" = empty is fine.

| Produces for -> | Rituals | Reliquary | Garden | Alchemy | Orders/Entities | Followers | Buildings | Suspicion |
|---|---|---|---|---|---|---|---|---|
| **Rituals** | - | **EMPTY!** (Candle tiles do nothing) | Basil, 0.2/Herb (token) | **EMPTY!** | summon + 20 Favor, first win only | drafts (capped at 8) | Devotion, 6 Donations | **EMPTY!** (no Look Busy, no PR sermon) |
| **Reliquary** | - | - | - | - | 10 order needs | - | 7 upgrade items | - |
| **Garden** | - | - | - | ingredients | 13 order needs | - (Kitchen not built) | - | - |
| **Alchemy** | - | - | - | - | 8 order needs | **EMPTY!** (D-144, parked) | - | Amnesia, tutorial only (**EMPTY!** after) |
| **Orders/Entities** | ritual Devotion boons; unlock summon levels by XP | - | crop yield boons | recipe hints | - | **EMPTY!** | Devotion, Donations, output boons | decay boons (inert) |
| **Followers** | +0.1% ritual Devotion per point | **EMPTY!** (no Crafty job) | Green Thumb (one counts) | **EMPTY!** | - | - | Hall work only | recruit heat, Doubt (inert) |
| **Buildings** | **EMPTY!** (Ritual Circle not built) | - (Pamphlet Press not built) | plots | bottles | - | beds | - | - |
| **Suspicion** | **EMPTY!** (inspections / Look Busy) | - | - | **EMPTY!** (Amnesia demand) | **EMPTY!** (outsider orders) | **EMPTY!** (followers leaving by choice) | **EMPTY!** (fines, rooms sealed Pending Review) | - |

Reading it: the Suspicion row is entirely empty, the Rituals row has three holes, and nothing feeds Rituals except two Devotion modifiers.
Garden and Reliquary are the best-connected modes; that matches the sim, where merge and orders take 68% of play.

---

## 5. Top 10 fixes (ranked by player impact)

Columns: **Merge swap** = still applies if the Reliquary is replaced by another puzzle. **Side-view** = still applies if the compound
becomes a side-view base with rooms.

| # | Problem | Change | Touches | Size | Merge swap | Side-view |
|---|---|---|---|---|---|---|
| 1 | Devotion (and late Donations) have no sink; ritual and order rewards are wasted | Add repeatable sinks: **Offerings** at each met entity (spend Devotion for Favor, start 25:1, and Donations for Favor, start 5:1, with a soft per-hour diminishing rate), plus land parcels (planned next) priced in Devotion. Show overflow at cap | `data/entities.json` (offering rates), `balance.json`, `game.ts` (new `makeOffering`), Orders screen | M | yes | yes (offering shrine room) |
| 2 | Rituals have no mid-game purpose; tiles don't matter | **Rites**: target picked per run, focus tile converts to that system's input (section 2.4). Drop the x0.5 replay penalty on conversions | new `data/rites.json`, `rituals.json` (purpose only for tutorial/summon), `finishRitual`, Rituals screen, save v4 | L | yes (Candle Vigil retargets to whatever the new puzzle consumes) | yes (targets are rooms instead of buildings) |
| 3 | Suspicion, Doubt, Amnesia Brew and 3 boons are inert | Civil band events per ECONOMY §7 and D-149 (neighbour, auditor, reporter, building inspection), soft outcomes (fines in Donations, short "Pending Review" seals, followers leaving by choice), **Look Busy** boards (stars cut fine and seal 25% each), Doubt > 70 -> a follower may leave by choice, reporter reusable so Amnesia Brew has demand | `data/events.json` (band, weight, choices), `tick` (event roll online only, queued), `finishRitual` (`defense` branch), Look Busy tile skin (`src/art/`), event modal; sensitivity review against D-149 §6 | L | yes | yes (inspectors walking floor to floor with a clipboard reads well in a side view; cellars are storage, never bunkers, D-149 §4) |
| 4 | No ritual-only output; stars worthless | **Omens**: stars -> Omens; sinks = final upgrade step, Audience boon, order reroll, Read the Omens. Restore first-3-star Relic | `balance.json` (`omens`), `buildings.json` (omen cost on last step), `entities.json` (4th boon), `game.ts` | M | yes | yes |
| 5 | Compound Lv7 to 10 unlock nothing; XP becomes a grind | Fill the unlock table: Kitchen (Lv7, Basil/Moss -> Stew for Sanity; Pesto gets a use), Merch Tent (Lv7, Donations + heat), Ritual Circle (Lv8, +10% rite conversions), Recruitment Booth (Lv8), more ritual boards r10 to r14 (Lv7 to 10), and a visible Ascension goal at 10 | `buildings.json`, `crops.json`, `rituals.json`, `unlocksAt`, level-up screen | L (content) | yes | yes (each becomes a room) |
| 6 | Donations stall the first upgrade after the tutorial | Tutorial end grants a Brochure (or mothman_2 pays 40 Don instead of 20); cheapest upgrade Don 40 -> 30; ritual flat Donations 6 -> 8; add one Lv2 Mothman order paying Donations for Basil | `orders.json`, `buildings.json`, `balance.json` | S | partly (Brochure must map to the new puzzle's item) | yes |
| 7 | Followers have one job; draft choice is weak; recruiting dead at 8 | Worker slots on Greenhouse (Green Thumb, growth speed), Lab (bottle chance), Reliquary/generator (Crafty, recharge); per-building slot cap; Pamphlet-Reading Room as a Doubt job. Full beds: Recruitment rite offers "swap one follower" | `buildings.json` (`workerSlots`, `workerEffect`), `assignJobs`, `followers.json`, Flock screen | M | partly (Reliquary job retargets) | **yes, stronger** (rooms with worker slots is the side-view genre's core) |
| 8 | Dead and thin items | Eternal Flame -> Ritual Circle upgrade + a Mothman order; Altar Candle -> Hall Lv4 or Audience; Tome -> second Anansi trial; Jersey Devil hints Pesto; Zeal Tonic -> a Vorl order; Amnesia Brew -> reporter events (fix 3) | `orders.json`, `entities.json` (`hintsRecipe`), `buildings.json` | S (data only) | no for merge tiers (must remap), yes for potions | yes |
| 9 | Boons reward dead currencies | Retune the 3 suspicion boons only after fix 3 lands; swap one ritualDevotionPct boon each on Mothman and Vorl for live fields (Omen gain +1 per win, Favor per order +2) | `entities.json`, `BoonField` type | S | yes | yes |
| 10 | No daily reason to open the ritual tab; GDD §4.7 promise unbuilt | **Daily Rite**: date-seeded board, personal best, +3 Omens, bank up to 3 missed days, no streak | `balance.json` (`omens.daily*`), seeding from ISO date (RNG stream `daily`), Rituals screen, save v4 | M | yes | yes |

Order of work I recommend: 6 (quick relief) -> 1 -> 3 -> 2 + 4 together (one spec, `docs/specs/rites.md`) -> 9 -> 8 -> 7 -> 10 -> 5.
Fixes 1 to 4 must land before any new entity or level content, or the new content will hit the same wall.

### For the economy-balancer
- Measure average collected count per tile type per level from validator playouts (to set focus rates; the table assumes about 25 to 35 per type).
- Targets: one rite about one order's value; Offerings must not beat orders per minute (orders also give XP).
- Add sim checks: resource at cap > 10 consecutive minutes = fail; ritual share of active time 20% to 45% in the long run.
- Re-run the 150-minute long run after fixes 1 to 4 and report the longest wait after minute 60.

### For the owner (decisions needed, to log in DECISIONS.md)
1. Approve decoupling purpose from level (Rites). It changes the meaning of r1 to r9 for existing saves (migration only adds fields).
2. Approve Suspicion soft outcomes (fines in Donations, short "Pending Review" seals, followers leaving by choice and returning later). A lost full inspection does not end the run until Ascension ships.
3. Offline storage cap (#15 in section 3): intended?
3b. The GDD's **Compound Wall** (a wall that lowers Suspicion) conflicts with D-149 §1.6 (no walls or fortifications in inspection content). Suggest replacing it with a non-fortification Suspicion reducer, e.g. a "Community Garden Fence" with flower boxes or a "Permit Office" kiosk. Needs the lore reviewer.
4. If the merge puzzle is replaced: fixes 1 to 7, 9, 10 survive as written. The replacement must supply 17 consumer slots (10 order needs, 7 upgrade items) or the Candle Vigil rite can produce those items directly.
