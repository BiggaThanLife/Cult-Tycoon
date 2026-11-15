# Changelog

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
