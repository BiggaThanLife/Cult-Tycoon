# Changelog

## 0.5.0 — The Sanctum
- From Compound Level 3, tap "Go inside" (or the Sermon Hall's card) for a side view of the Hall. Build storeys upward and fill bays with rooms: Bunk Room, Kitchen, Records Office, Reading Room, Ritual Chamber, Wellness Retreat.
- Matching rooms side by side merge into bigger rooms with a bonus. Assign followers to rooms; each room cares about one stat.
- Rooms feed the rest: beds, Sanity, Filed Forms that soften inspections, less Doubt, stronger rites, Donations. Tall buildings and spas draw Suspicion.
- Fixed: a recruit draft could freeze the game once the flock was very large.

## 0.4.1
- Fixed: the rite counter on the ritual board was drawn over the score. The playthrough now also fails on text drawn over other text.

## 0.4.0 — Rites, Omens and inspections
- Every ritual now has a target you pick first (Sermon, Recruitment, Communion with a creature, Harvest a crop, Candle Vigil). One tile type turns into what that target needs; the board shows the count live.
- Omens: a currency only rituals make. They pay for top upgrades, an Audience (a 4th creature boon) and swapping an order.
- Daily Rite: one board a day with bonus Omens; missed days bank up to three. No streaks.
- Inspections: neighbours, auditors, reporters and building inspectors from the Office of Mild Concern visit when Suspicion rises. Hand something over, settle (a fine, a room sealed Pending Review, a follower helping with the inquiry), or play a Look Busy board to cut the outcome by stars.

## 0.3.1 — Upgrade card explains itself
- The building card names the relic an upgrade needs, lists what is still missing and where to get it, and links to the Relics tab.

## 0.3.0 — Expansion 1: creatures, orders, boons, upgrades
- Four new entities to summon (Baba Yaga, the Jersey Devil, Anansi, Vorl), each with a ritual, a voice and an order pool.
- Orders now repeat: every entity keeps two requests open. Favor unlocks three permanent boons per entity.
- Building upgrades, two new crops, three new potions, a candle merge chain, six new ritual levels, a Grimoire screen.
- Level-ups list what they unlocked; the advisor names the next goal. Save format v3 (old saves migrate).

## 0.2.1 — Follower stats explained
- Every follower stat now does something, and a follower sheet says exactly what (tap a follower, a Flock card or a recruit card). A "?" button explains the letters.
- Fixed: portrait covering a stat in the Flock list; Relics help text cut off by the tab bar on short screens.
- Tests: stat effects, and a text-overflow audit at four screen sizes.

## 0.2.0 — Ritual feel
- Rituals now have match feedback: tile pops and particles, line/bomb/sigil effects with shake, squash on landing, chimes that climb with each cascade, combo callouts, goal tiles that fly to their counter, a leftover-moves bonus count and a star-by-star result card.
- Sound and haptics toggle in Settings (save format v2, old saves migrate). Reduced motion keeps the information and drops the movement.
- `docs/PLAYBOOK.md` with step-by-step recipes, `npm run check` as one gate, and a sprite-integrity test.

## 0.1.0 — Vertical slice
- Playable slice: build, collect, 3 ritual levels, recruit draft, garden, merge, brew, reporter event, Mothman orders, offline summary, locked Ascension preview, debug panel.
- Portrait-first responsive layout with a landscape mode that shows more (side rail + dock); rotation keeps all state.
- 109 unit tests, a 29-check automated playthrough, level validator and slice economy sim.

## 0.0.1 — Phase 1 foundations
- Design docs, project rules and subagent team. No game code yet.
- Review pass: added ARCHITECTURE.md and the vertical-slice script; replayability matrix; potion consent and Mothman guardrails;
  7×7 merge grid to fit landscape; font minimums; Compound XP, Dorm, safeRate and base Donations cap; refined sim checks.
