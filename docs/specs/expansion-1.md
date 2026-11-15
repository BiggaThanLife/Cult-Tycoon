# Spec — Expansion 1: creatures, repeating orders, boons, upgrades

Owner: game-designer. Status: built (0.3.0). Goal: turn the 15-minute slice into a loop that keeps going.

## What the player gets
1. **Five entities.** The Mothman, Baba Yaga, the Jersey Devil, Anansi and Vorl. Each is summoned by its own ritual, which
   unlocks at a compound level (3, 4, 5, 6). The sim meets them about 10, 24, 36 and 54 minutes after the tutorial. Unmet entities show as silhouettes with the exact step to meet them.
2. **Repeating orders.** Each met entity keeps two requests open and posts a new one 20 seconds after one is filled.
   Requests come from that entity's pool and are only offered if the player can make everything in them right now.
3. **Order styles** (the first taste of patron archetypes): Baba Yaga sets *trials* (large asks, about triple pay);
   Anansi's are *gambles* (pay is rolled on delivery from x0.5, x0.75, x1, x1.5, x2.5: average 1.25, never below half);
   the others are plain.
4. **Favor and boons.** Every order pays Favor with that entity. At 40, 100 and 200 Favor the entity grants a permanent
   boon for this run (additive): ritual Devotion, building output, harvest size, Donations per minute or faster Suspicion fade.
5. **Building upgrades.** Sermon Hall (3 levels: output and Devotion storage), Dormitory (3: beds), Greenhouse (3: plots),
   Alchemy Lab (2: bonus bottles). Each costs Devotion, Donations and one merge item, so the Reliquary has a purpose.
6. **More to make.** Crops: Graveyard Moss (Lv2), Moonpetal (Lv4). Potions: Calm Draught, Moonlight Tincture, Zeal Tonic.
   A second merge chain (candles) from the Ritual Brazier (Lv3). Entities hint a recipe when first met.
7. **Level-ups that say what changed**, and an advisor strip that names the next unlock.

## Resource flow (additions to ECONOMY §1)
Orders -> Favor -> boons -> (rituals, buildings, garden, Suspicion). Reliquary items -> upgrades -> (output, beds, plots, bottles).
Compound level -> crops, generators, rituals -> new entities -> new order pools.

## Why play differently next run
Which entities you court first decides which boons you stack (a Vorl-and-Baba-Yaga production run plays differently from a
Mothman ritual run), Anansi's dice change the pace of a run, and upgrade order (beds first for more workers, or the hall
first for storage) is a real choice because both want the same merge items.

## Rules worth knowing
- Favor from the summoning itself is 20. Tutorial orders (`"tutorial": true`) are handed out once, on first meeting.
- An order needing a potion is only offered once its recipe is known or hinted.
- Upgrades open once the tutorial reaches the "close the game" step. Tap a building's arrow badge (or the building, when
  there is nothing to collect) for its card.
- Devotion is capped by the Sermon Hall level (500 / 1500 / 4000); Donations at 500.

## Not in this pass
Pledging to a patron (rule-changing archetypes), banes, entity questlines, potion use on followers, land expansion,
the Pilgrimage Bus, outsider and follower orders, Kitsune / Kappa / Sphinx (need lore review).

## Acceptance
Unit tests in "expansion: orders, boons, upgrades, unlocks"; the playthrough upgrades a building from its card, levels up,
summons Baba Yaga and fills a gamble order; the sim's long run shows no wait over 10 minutes for something new during the first hour after the tutorial.

## Known limit
The sim bot runs out of new things about 65 to 75 minutes after the tutorial (all five entities met, buildings maxed, most boons earned). Waits then stretch past 20 minutes. The next expansion (land, pledges, questlines) has to extend that.
