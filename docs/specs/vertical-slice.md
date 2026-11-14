# Spec — Vertical Slice (Phase 2)

Goal: in ~15 minutes, touch every system once. Each beat teaches one thing. Times are targets for a first-time player.

| # | Time | Beat | What the player does | Systems proven | Acceptance |
|---|---|---|---|---|---|
| 1 | 0:00 | Arrival | Title → the Spiritual Advisor (a talking pamphlet) greets "Prophet". Empty 12×12 compound. | boot, layout, text keys | Works in both orientations |
| 2 | 0:30 | Build | Place **Sermon Hall** (free). Tap to collect Devotion; floaty `+6 Devotion`. | grid placement, production, floaty text | Can't overlap; collect works |
| 3 | 1:30 | Recruit | Ritual 1 "First Sermon" (collect 12 candles, 15 moves) → **draft 1 of 3** converts with visible traits. Repeat via ritual 2 (Recruitment Drive) for 2 more. Each recruit **+6 Suspicion**; meter appears. | match-3 → meta link, followers, traits, Suspicion up | 3 followers on map with traits shown |
| 4 | 5:00 | Grow | Place **Greenhouse**, plant Basil (30s) and Nightshade (2 min, or debug skip). Harvest both. | crops, timers | Ingredients in inventory |
| 5 | 6:30 | Merge | Reliquary opens with a Donation Box generator. Merge Pamphlet → Brochure → **Manifesto (tier 3)**. | merge engine, generator cooldown | Manifesto in inventory, Codex shows tier 3 |
| 6 | 8:00 | Brew | Place **Alchemy Lab** (upgrade path shows Manifesto cost later). Brew **Amnesia Brew** (Basil + Nightshade) with the stir minigame. | alchemy, Grimoire | Grimoire entry #1 |
| 7 | 9:30 | Heat | A **reporter** visits (scripted event at Suspicion ≥ 15). Choice: offer Amnesia Brew free sample (−15 Suspicion) or "No comment" (+5). | events, Suspicion down | Suspicion drops visibly |
| 8 | 10:30 | Orders | Ritual 3 "Moth to a Flame" (Summoning; drop the relic) brings **The Mothman** to the order board. Order 1: 1 Nightshade + 2 Basil (exactly what's left after brewing: Basil ×3, Nightshade ×2, brew uses 1 of each). Order 2: 1 Manifesto ("He wants something to read. Near a lamp."). Dark-humor dialogue. | orders, entity, Favor, XP | Both orders fill; Favor +20; Compound Lv 2 |
| 9 | 13:00 | Away | Prompt: "Close the game. We'll keep the candles lit." Player closes; reopens (or debug +1h offline). **Welcome back, Prophet** summary. | save/load, offline, clock guards | Summary lists gains; state identical otherwise |
| 10 | 14:00 | Tease | **Ascension** screen, locked: shows the three flavors greyed, "Requires Compound Lv 10" and the Relic preview. | prestige UI | Locked, readable, both orientations |

Debug panel available throughout (ARCHITECTURE §8).

## Content needed
- Buildings: Sermon Hall, Greenhouse, Alchemy Lab, Dormitory (auto-placed, holds the first 4)
- Crops: Suspiciously Normal Basil, Nightshade · Recipe: Amnesia Brew
- Merge chain: Pamphlet → Brochure → Manifesto (tiers 4–5 visible as silhouettes)
- Ritual levels: 3 (collect, collect + cobwebs, drop-a-relic); all validator-passed
- Entity: The Mothman (portrait, 2 orders, ~8 lines; D-111 guardrail)
- Traits shown: at least 6 of 10 can appear in drafts
- Events: reporter (scripted), curious cat (random, harmless)
- Text: all via `data/text/en.json`, reviewed by lore-and-sensitivity-reviewer

## Out of scope for the slice
Land expansion, patrons' rule changes, upgrades, Pilgrimage Bus, Heralds, schisms, tactics, Field Notes, audio.
