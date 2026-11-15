# Spec — Rites, Omens and Inspections (Increment 1 of the owner-approved plan)

Owner decisions (2026-11-15): full ritual redesign; build order Rites -> Sanctum -> Ley Lines (replaces merge).
Source analysis: `docs/reviews/2026-11-15-loop-audit.md` section 2.4. Content rules: `docs/reviews/2026-11-15-raids-guardrails.md` (D-149).

## 1. Rites: every ritual has a target
After the tutorial (step `away` or later) the Ritual tab shows a **target strip** above the level list. The player picks a
target, then any unlocked board. Tutorial and first-time summon wins keep their fixed purpose; after that a board is just a board.

| Rite id | Shown when | Focus tile | Pays (per run, from `Match3State.collected[focus]`) |
|---|---|---|---|
| `sermon` | always | Eye (2) | Devotion as today, and every follower loses 1 Doubt per 8 Eyes |
| `recruit` | always; disabled with a reason when beds are full | Rune (3) | 1 recruit draft; 15+ Runes make it a 4-card draft |
| `communion` | an entity is met; player picks which | Skull (1) | 0.4 Favor per Skull with that entity |
| `harvest` | Greenhouse built; player picks an unlocked crop | Herb (4) | 1 of that crop per 3 Herbs |
| `vigil` | Ritual Brazier unlocked | Candle (0) | 1 Candle Stub per 4 Candles, placed in the Reliquary (excess lost, shown) |
| `look_busy` | only while an inspection waits for you | (stars) | fine and seal time x (1 - 0.25 per star); -5 Suspicion on a win |

Replays still halve Devotion (`replayMult`); target payouts are never halved. A loss pays nothing.
The result card always lists each conversion ("31 Skulls -> 12 Favor with Baba Yaga"), including anything lost to a cap.

## 2. Omens: the ritual-only currency
- Earned only by winning rituals: 1 per star (relaxed mode: 1 per win), +2 on a level's first 3-star win, and the Daily Rite bonus.
- Spent on: the **last** upgrade step of each building (Hall 6, Dormitory 4, Greenhouse 4, Lab 4); an **Audience** with an entity
  (a 4th boon, needs 200 Favor and 10 Omens); **rerolling** an open order (1 Omen).
- Shown in the HUD once the first Omen is earned. Kept per run (Ascension resets it, like Devotion).

## 3. Daily Rite
One board per calendar day, picked from unlocked non-summon boards by a hash of the date. Its first win that day pays +3 Omens for
every banked day: a bank fills by 1 for each new day and holds at most 3, so nothing is lost by skipping days. No streaks.

## 4. Inspections (Suspicion finally matters)
Only while the game is open, no ritual is running and no other event is showing. Chance per minute by Suspicion band
0 / 3% / 6% / 12%. Visitors are civil (D-149): the nosy neighbour (Murmurs), an auditor from the Office of Mild Concern and an
exposé reporter (Scrutiny), a building inspector (Heat). At 100 Suspicion: a **Full Review**.
Each visit offers, as data-driven choices:
- **Hand something over** openly (Amnesia Brew sample, a Calm Draught for the inspector's thermos): Suspicion falls.
- **Accept the outcome**: a fine (a share of Donations), a building sealed "Pending Review" for a few minutes (no production, no
  harvest, no brewing there), or a follower who chooses to "help with the inquiry" and returns later. Suspicion always falls.
- **Look Busy**: the visit waits; the player plays a Look Busy board (office-object tiles: forms, stamps, receipts, hairnets,
  exit signs; red tape as blockers). Stars cut the fine and seal time; a loss applies the normal outcome, never a worse one.
Every visit lowers Suspicion, so visits never spiral. A Full Review that goes badly fines, seals and resets Suspicion to 50;
the "Closed Pending Review" ending waits for Ascension. No timers, countdowns, weapons, arrests or "defend" wording anywhere.

## 5. Data
- `data/rites.json`: rites (id, focus tile, pays, shown-when), Omen rules, daily rules.
- `data/events.json`: new visit events with `band`, and new effect types `fine` (share of Donations), `seal` (seconds),
  `away` (a follower leaves for seconds), `lookBusy` (starts the inspection board), `suspicion`.
- `data/levels/rituals.json`: Look Busy boards with `"purpose": "defense"` and `"skin": "office"`; hidden from the list.
- `data/buildings.json`: last upgrade steps gain `"omens"`. `data/entities.json`: each entity gains an `audience` boon.
- Save v4: `run.omens`, `run.daily`, `run.audiences`, `run.inspection`, `run.firstThreeStar`, building `sealedUntil`, follower `awayUntil`.

## 6. Acceptance
1. Each rite pays exactly per `rites.json` (unit test per rite with a scripted `collected`).
2. Omens have no source outside `finishRitual` (test).
3. Look Busy at 3 stars cuts an inspection's fine and seal by 75%; no visit starts during a ritual, offline, or while a dialog is open.
4. Recruitment with full beds is disabled and names the reason; Communion still pays Favor past the last boon.
5. Sim long run: ritual share of active time 20-45%; no wait over 10 minutes in the first 60 minutes after the tutorial.
6. Playthrough: pick a target, win, see the conversion; an inspection arrives, Look Busy is played, the fine is reduced; screenshots
   at 4 sizes with the overflow audit clean; rotating mid-rite keeps the target.

## Why play differently next run
The target mix is the build: a Baba Yaga garden run spends rites on Harvest, a Mothman run on Communion, a doubting flock forces
Sermons, a greedy high-Suspicion run lives on Look Busy boards.
