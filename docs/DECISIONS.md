# Decisions Log

Format: `D-### — date — decision — why — reversible?`

## Phase 0 discovery answers (owner, 2026-11-14)
- **D-001** Platform: web-first PWA. Stack: Phaser 3 + TypeScript + Vite.
- **D-002** Saves: local autosave + backup slot + export/import save code. No cloud.
- **D-003** v1 scope "small & complete": ~10 buildings, 4 patron entities, ~40 ritual levels, 3 merge chains, ~12 potions, 1 ascension cycle, 4 run endings + gallery.
- **D-004** Solo project; programmer art; Claude-written text. Asset manifest flags anything worth a human pass.
- **D-005** Tycoon is the spine; match-3, merge and alchemy are action verbs that feed it.
- **D-006** Sessions: both 2-minute check-ins and 20-minute deep sessions.
- **D-007** Endless with prestige; each run ends in one of several endings; a "credits" ending after the 3rd ascension; play continues after it.
- **D-008** Suspicion = soft setbacks. Max Suspicion can force the "Raided" ending for that run; meta progress (Relics, Prophecies, Grimoire, collections) is always kept.
- **D-009** Darkness: Cult of the Lamb-ish. Cute but wrong, implied menace, no on-screen harm. Teen/PEGI 12.
- **D-010** Field Notes codex exists (unlockable), but uses **no real group names**, even for long-defunct groups. Entries describe tactics generally, with citations to scholarly/journalistic sources in `docs/FIELD_NOTES_SOURCES.md` (sources may name groups; in-game text does not).
- **D-011** Palette: candy pastel by day, purple/teal night glow. Music: chiptune with eerie undertone (later phase).
- **D-012** Local stats log + debug view. No online telemetry.
- **D-013** Localization: string keys from day one, English only.
- **D-014** Accessibility: reduced motion, larger text, colorblind palettes (on top of shape-coding), relaxed puzzle mode (unlimited moves, no fail; still awards rewards, but no 3-star).
- **D-015** Project lives in its own new GitHub repo, not in `quantum-entanglement-app`.

## Lead decisions (Phase 1)
- **D-100** Map projection: **3/4 top-down on a 16×16 square grid**, not isometric. Why: far simpler programmer art, hit-testing and landscape expansion; still reads "Kairosoft". Reversible only at high cost (all building art).
- **D-101** Logical resolution: portrait minimum 180×320, landscape minimum 320×180, integer scale chosen so the minimum fits, then the logical canvas grows to fill the leftover space. Why: crisp pixels + "landscape shows more".
- **D-102** Ritual tiles are 20×20 logical px (8×8 board = 160px) so tiles land at roughly 40–48 CSS px on common phones.
- **D-103** Fonts: original bitmap fonts (4×6 small, 5×8 regular, 10×16 for "large text" mode) generated from a glyph table in `tools/art/`. Why: no license questions.
- **D-104** **Wendigo replaced.** The Wendigo comes from living Algonquian traditions, and many Indigenous voices ask that it not be used as a casual monster. Its archetype (huge production, fast Sanity decay) moves to an original entity, **Vorl, the Patient Deep** (Lovecraft-adjacent, fully original). Mami Wata (tied to living West/Central African and diaspora religious practice) and Tlaloc (deity of Nahua heritage) are parked in LATER.md pending lore review; likely to be replaced with original or folklore-only figures.
- **D-105** v1 patrons: **The Mothman** (modern American cryptid), **Baba Yaga** (Slavic folklore), **Anansi** (Akan/Caribbean folk tales; trickster stories, not worship practice), **Vorl** (original). Kitsune is next in line (folklore kitsune only, never Inari or shrine practice).
- **D-106** Prestige bonuses are additive percentages with soft caps (see ECONOMY.md). No exponential multipliers in v1.
- **D-107** Merge rule: merge **two** identical items into the next tier (not three). Simpler on a small portrait grid. Grid is **7×7** (168×168 px) so it fits the 180px landscape height; a 6-slot shelf holds overflow.
- **D-108** Deterministic RNG: one seeded PRNG stream per subsystem (board, recruits, events, Anansi rolls) derived from run seed, so the sim and replays are reproducible.
- **D-109** Game-time unit = 1 real second while the game is open; the debug panel can multiply it. Speed toggle: 1×/2×/4× affects production only, never puzzle timers.

## Phase 1 review (2026-11-14)
- **D-110** Potions are consensual and magical. Amnesia Brew (owner-requested) is a free sample the reporter happily drinks; it magically blurs the last hour and they leave with a tote bag. Doubt-Be-Gone Tea is cut: drinks never erase follower doubt. Follower potions are openly served "wellness" placebos with small buffs. Why: covert dosing is too close to the poisoning/drugging hard limit.
- **D-111** Mothman guardrail: the legend is tied to the 1967 Silver Bridge collapse (46 deaths). No bridges, collapses, the real town or "omen of a real disaster" jokes. His omens only foretell in-game events. Recorded here so writers never need to look it up.
- **D-112** Sanity stays (owner-specified) but is portrayed comically; low Sanity makes followers wander off or take a "sabbatical", never break down.
- **D-113** Compound XP comes from orders (main), first-time builds/upgrades, ritual stars and questline steps. Levels gate unlocks (GDD §5).
- **D-114** Dark Favor is tracked **per entity**. A small "Favor of Any" pool from Heralds and dailies can be spent on any entity.
- **D-115** Vertical slice raises Suspicion via recruitment (+6 per recruit) and a scripted reporter visit, and lowers it with Amnesia Brew. The Merch Tent is not in the slice.
- **D-116** Sim degeneracy check counts only active choices (build, upgrade, order, ritual, brew, merge, recruit); passive collection is excluded.
- **D-117** Subagent `model`: judgment-heavy roles (designer, sensitivity reviewer, puzzle and systems engineers) use `inherit` so they follow the session model; production roles use `sonnet`.

## Phase 2 — vertical slice (2026-11-14)
- **D-118** One Phaser scene (`App`) with a `Screen` class per tab instead of one Phaser scene per mode. Screens redraw from state in `rebuild()`, which is what makes rotation and resize safe with no reload. Supersedes "scenes/" in ARCHITECTURE §1.
- **D-119** Art is generated at runtime into one canvas atlas (`src/art/sprites.ts`) instead of PNG files from `tools/art/`. Why: zero asset pipeline, the single-file build needs no external files. An asset manifest and PNG export move to LATER.md.
- **D-120** Font: the classic public 5x7 dot-matrix LCD glyph set (rendered proportionally, with reworked descenders) instead of hand-drawn original glyphs. Amends D-103. It is a generic, decades-old matrix with no known licence restriction; a bespoke font is flagged for a human pass. One pre-coloured texture per colour so it works without WebGL tinting. The 4x6 badge font and the 10x16 large-text mode are not built yet.
- **D-121** Save code is base64(JSON) with a checksum prefix, no deflate. Saves are a few KB. Amends ARCHITECTURE §5.
- **D-122** Landscape regions: 60px left rail (resources + tabs), 92px right dock, leaving exactly 168px at the 320px minimum for the merge grid. The ritual board and merge grid take the advisor strip's space on short landscape screens.
- **D-123** Slice economy tweaks: start with 30 Donations (was 20) and rituals pay a flat 6 Donations, so the Alchemy Lab is always affordable without waiting. Completed rituals can be replayed for half rewards, so the player can never be stuck.
- **D-124** A Fine brew (stir minigame) gives one extra bottle rather than a separate quality tier. Full quality tiers come with the Alchemy system pass.
- **D-125** Ritual levels use 5 tile types (no Coin tile) for solvability targets; rituals pay a flat Donation amount instead. Coin tiles return with later levels.
- **D-126** The Dormitory is pre-built ("the previous owners left in a hurry") so the first draft always has a bunk.
- **D-127** Accessibility in the slice: reduced motion and relaxed rituals are implemented; shape-coded tiles are in. Colourblind palettes and large text are not built yet (TASKS).
- **D-128** `main` holds docs; Phase 2 work is on `claude/vertical-slice`.
- **D-129** Sensitivity review of the slice: 5 strings changed (Amnesia Brew is named when offered and visibly magical; Nightshade is 'not the real kind'; the Gullible trait displays as 'Trusting'). Open question for the owner: rename real poisonous plants (Nightshade, Mandrake, Wolfsbane) to invented ones.

## Phase 3 — ritual feel and handover docs (2026-11-14)
- **D-130** Ritual feedback pass per `docs/specs/ritual-feel.md`: pops, particles, beams, squash, rising-pitch chimes, combo callouts, goal fly-ins, leftover-moves bonus count, star reveal, haptics. All synthesized in code (no audio files, no licences). No lives, timers, boosters or near-miss pressure: the feel is the reward, nothing is sold or gated.
- **D-131** Engine: a win pays `MOVE_BONUS` = 50 per unused move as a `bonus` snapshot (not in relaxed mode). Star thresholds re-measured with the validator: r1 1100/1450/1750, r2 1950/2700/3200, r3 2800/3450/4550.
- **D-132** Save version 2 adds `settings.sound` (default on) with a v1 to v2 migration. First real use of the migration path.
- **D-133** `docs/PLAYBOOK.md` is the required route for changes, with `npm run check` as the single gate, so smaller models can update the game safely. It also lists the places that are not data-driven yet (second entity, repeating orders, event triggers, new building behaviours).
