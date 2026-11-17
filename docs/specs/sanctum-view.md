# Design brief: the Sanctum (side-view rooms inside the Sermon Hall)

Owner: game-designer · Status: **proposal, owner to choose** · Date: 2026-11-15
Read with: `docs/reviews/2026-11-15-raids-guardrails.md` (D-149, binding), `docs/reviews/2026-11-15-loop-audit.md` (Omens, Rites, sinks).

Owner request: "go into the main hall and look at it the way Fallout Shelter plays: rooms with specific functions, upgrades,
and the ability to add rooms to make the compound bigger. Raids are police or some federal agency investigating."

**Adapted to D-149 (not optional):** visits are civil **inspections** by **the Office of Mild Concern** (never abbreviated).
Officials have civil titles (Compliance Clerk, Building Inspector, Auditor), so "Officer" and "agents" become those. The
"Panic Room" is blocked (no hidden rooms, nobody hides people) and becomes the **Storeroom** (objects only). The run-ending
visit is the **Full Review**; its ending displays as "Closed Pending Review".

## 0. Recommendation in one paragraph
Keep the top-down map as the **Grounds** (Greenhouse, Alchemy Lab, Merch Tent, Recruitment Booth, Dormitory as the
starter "Bunkhouse") and make the **Sermon Hall the door into the Sanctum**: a side view of the Hall and the storeys the
Prophet keeps adding **on top of it**. Grow **up, not down**: unpermitted extensions are a zoning joke the inspectors can
actually check, they avoid any bunker reading (D-149 §1.6), and in portrait the Hall sits at the bottom, under the thumb.
Floors are a fixed 160 px wide (stairs + 3 bays of 48 px) so no layout ever scrolls sideways. This adds rooms, worker
slots, a large Devotion/Donations sink and a real Suspicion consequence without touching the four built buildings or
their saves.

---

## 1. Relationship to the current compound map
| Option | What it means | For | Against |
|---|---|---|---|
| **A. Replace** the map with the side view | Rebuild Greenhouse plots, Lab, Dorm as rooms; delete placement grid | One base UI | Throws away the built map, follower wandering, the planned land expansion and the Kairosoft feel; forced save move of every building; tutorial rewrite. Large |
| **B. Grounds + Sanctum (recommended)** | Map stays for outdoor/public buildings; tap the Sermon Hall ("Go inside") or the door button to enter the side view | No forced migration; each view does what it is good at (garden layout vs room stacking); the Hall-as-entrance matches the owner's words | Two base views. Mitigated: one Compound tab, a door toggle, and each building type lives in exactly one view |
| C. Side view only, map gone | As A, plus the Grounds become a single side-view surface strip | Smallest long-term code | Same losses as A; portrait gets very tall-and-thin with nothing to look at sideways |

**Under B, what lives where**
- **Grounds (map, unchanged code):** Sermon Hall (exterior; its sprite gains a stacked roof tier per 2 storeys, up to +16 px, ART_BIBLE §2), Greenhouse (needs sun, plot UI), Alchemy Lab ("the garden shed"), Dormitory (becomes the starter Bunkhouse, 4/6/8 beds as now), Merch Tent, Recruitment Booth. The Compound Wall is out of scope and still needs its D-149 rename (loop audit 3b).
- **Sanctum (new):** the Hall interior as the ground floor, plus all new indoor rooms in §3.
- **Up vs down.** Down is the Fallout-faithful choice, but D-149 §4 only lets cellars hold storage, kitchens or laundry, and any "dig deeper" fantasy keeps drifting toward a bunker. Up gives "Zoning says this is a single-family dwelling" for free (approved example line 7). Cellars stay in LATER as an option.
- **Land expansion (TASKS "next up")** overlaps: storeys are the new "make it bigger" verb. Suggest keeping brambles small (a few parcels for Grounds buildings) and dropping parcel buying. Owner call.

## 2. Room grid model
**Geometry (logical px, 16 px grid):**
| Part | Size | Notes |
|---|---|---|
| Bay (width unit) | 48 × 48 | 3×3 tiles. A follower is 16×20, so 2 workers + props fit; 3 at L3 overlap slightly, as in the genre |
| Storey | 160 × 48 | stair column 16 + 3 bays (144). Slab 4 px, interior 44 px |
| Ground floor | Main Hall, 3 bays, fixed | cannot be moved, merged or sealed for longer than 10 min |
| Width on screen | 160 | portrait 180 min: 10 px brick margin each side. Landscape min content is 168 (D-122): fits |

- **Rooms are 1 bay wide** and **merge with an identical, same-level neighbour** into 2- or 3-bay rooms (our 3/6/9). Merging is automatic on build, like the genre. Splitting = demolish one bay (50% refund).
- **Stairs, not an elevator:** one zigzag column on the left; followers and officials use the walk cycle. Art is cheap and no moving car needs pooling. ("The Elevator to Enlightenment" can be a cosmetic later.)
- **Scroll:** vertical only, integer pixels, drag + fling, snap to storey on release. Default view: Hall at the bottom. A "Hall" button returns there.
- **Visible storeys:** portrait 180×320 shows 4 storeys + sky; 195×422 shows 6. Landscape shows 3 storeys (height-bound) **plus** the Grounds strip on the left of the tower (officials arriving on foot, the garden) and the docked Flock list on the right: more, never bigger.
- **Growth ("make it bigger"):** v1 = 6 storeys above the Hall (18 bays). Each storey is a build with a short scaffold timer (anticipation, ≤ 60 s, done offline too). Height is visible: storeys above 3 add +0.05 Suspicion/min each ("the neighbours can see it").

**Storey costs (start numbers for the economy-balancer):**
| Storey | Devotion | Donations | Omens | Build time | Compound Lv |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | 3 (Sanctum unlock, its own tutorial beat) |
| 2 | 250 | 60 | 2 | 30 s | 4 |
| 3 | 600 | 120 | 4 | 45 s | 5 |
| 4 | 1200 | 200 | 6 | 60 s | 6 |
| 5 | 2200 | 300 | 9 | 60 s | 8 |
| 6 | 3500 | 450 | 12 | 60 s | 10 |
Total 7,750 Devotion: the repeatable sink the loop audit says is missing (lifetime sink today is 1,780). All fit the caps (Devotion 4,000 at Hall L3, Donations 500). Omens are the ritual-only currency from the loop audit (stars → Omens).

## 3. Room catalogue
**Worker rule (replaces the single Productivity formula for rooms):** each worker adds `0.5 × (0.5 + keyStat/100 + (Sanity−50) × 0.005)` of the room's base output, plus trait % (additive). Sanity-key rooms use `0.5 × (0.5 + Sanity/100)` (no double count). Doubt-key rooms read Doubt as the key stat. Rooms produce their base with zero workers (as buildings do now); workers are a bonus, empty rooms only cost you in inspections.
**Slots:** 2 per bay, 3 per bay at L3. **Merge bonus:** +10% (2 bays) / +20% (3 bays) output, additive; non-producers get +1 capacity per bay instead.

| Room | Key stat | L1 per bay | Build (Dev/Don) | L2 | L3 (needs Omens) | Exposure tags | Unlock |
|---|---|---|---|---|---|---|---|
| **Main Hall** (= Sermon Hall) | Devotion | 6 Devotion/min (as now) | built | existing upgrade | existing + "Gold-leaf lectern" (+15% output, 1 undeclared item) | Zoning 1 | 1 |
| **Bunk Room** | none (residents) | +3 beds | 60/20 | +1 bed/bay; 150/50 + paper 2 | +1 bed/bay, residents +5 Sanity; 400/120 + candle 3 + 4 Om | Zoning 1 per bay | 3 |
| **Commune Kitchen** | Sanity | 1 Stew / 2 min (eats 1 Basil); Stew auto-served, +1 flock Sanity | 100/40 | +50% output; 250/80 + paper 2 | unlocks Pesto (sell/orders); 600/160 + candle 3 + 4 Om | Health 1 | 4 |
| **Records Office** (Archive) | Doubt | 1 Filed Form / 4 min, cap 2 per bay per level | 120/40 | 300/90 + paper 3 | 700/180 + paper 4 + 5 Om | none | 4 |
| **Pamphlet Press** | Productivity | 1 Pamphlet / 90 s into the Reliquary (or its replacement, see puzzle brief) | 120/60 | 300/100 + candle 2 | 700/200 + candle 3 + 5 Om | Zoning 1 | 5 |
| **Storeroom** (was Panic Room) | none | holds 2 tidied items per bay | 80/30 | +2/bay; 200/60 + paper 2 | +2/bay; 500/150 + candle 3 + 4 Om | none ("Very normal.") | 5 |
| **Pamphlet-Reading Room** | Devotion (1 Librarian slot); 2 reader slots/bay | readers −1 Doubt/min, produce nothing | 150/50 | −1.5/min; 350/100 + paper 3 | −2/min; 800/200 + paper 4 + 5 Om | Zoning 1 | 6 |
| **Ritual Chamber** (was Ritual Circle) | Devotion | +5% Rite conversions per bay (cap +30%); +1 Blessing slot | 300/120 | +1 Blessing slot; 700/200 + candle 4 + 4 Om | +1 Omen per ritual win; 1500/350 + paper 4 + 8 Om | Zoning 1 (extinguisher signage) | 6 |
| **Wellness Retreat** | Sanity | 5 Donations/min; +0.4 Suspicion/min; makes 1 undeclared "receipts" item / 10 min (cap 2) | 300/150 | 800/250 + paper 3 | 1800/400 + paper 5 + 8 Om | Tax 2 | 7 |
| **Shredding Room** | Productivity | −1 Tax finding for rooms on its storey and the ones above/below; turns 1 Pamphlet into 1 Confetti / 2 min (an order item) | 250/100 | 600/180 + candle 3 | radius +1 storey; 1400/350 + candle 4 + 6 Om | Tax 1 ("Why so much confetti?") | 8 |

Notes
- "paper 3" / "candle 4" = chain and tier, so the table survives whichever puzzle replaces merge.
- Recruitment Booth and Merch Tent stay on the Grounds (they face the public). A "Lab Annex" room (+1 brew slot, Health 1) and cellar rooms are LATER.
- **Shredding Room** needs the lore reviewer: shredding receipts before an inspection is evidence-adjacent. I kept it because it is itself a finding ("confetti") and targets the leader's grift; drop it if the reviewer prefers.
- **Undeclared items** are objects only (gold-leaf lectern, receipts, branded hoodies). Three ways to handle each: **declare** it (pay 10 Donations, gone: the honest path is the cheapest), **tidy** it into the Storeroom (that room's L3 bonus pauses until the visit ends), or leave it (+1 Tax finding if that room is inspected).

**Assigning followers:** long-press (200 ms) a follower to lift, drag to a room, drop. Rooms with a free slot glow; each slot shows the key-stat letter and a 3-step fit pip (good/ok/poor from the key stat). Drop on a full room swaps with the follower you dropped on. **Tap alternative (accessibility, no drag):** tap follower → Assign → tap room. Grounds jobs (Greenhouse etc.) are assigned from the same Flock list. `Follower.job` keeps pointing at an id; rooms draw ids from `run.nextId` like buildings.

## 4. Inspections (internal: raids)
**Officials** (names pending a web search, D-149 §3): Compliance Clerk Dot Quillfeather (health, signage), Building Inspector Ottoline Brisk (zoning, permits), Auditor Percival Ledgerwood (tax). Cardigans, lanyards, clipboards, on foot. Max three on screen. No badges, seals, lettered clothing.

**Visits by Suspicion band** (event chance per minute stays ECONOMY §7: 0 / 3% / 6% / 12%; online only; never during a ritual; daytime only; at least 10 min of play between visits):
| Visit | Band | Who | Rooms on agenda | Tags checked | Fine / finding | Seal | Suspicion after (clean / not) |
|---|---|---|---|---|---|---|---|
| Friendly check-in | Murmurs 25-49 | Clerk | Hall + 1 | Health | 8 Don | none | −10 / −5 |
| Inspection | Scrutiny 50-74 | Inspector **or** Auditor | 3 | one tag | 15 Don | worst room 10 min if total ≥ 4 | −15 / −8 |
| Inspection with an inspection warrant | Heat 75-99 | Inspector + Auditor | 5 | two tags | 25 Don | worst room 15 min if total ≥ 4 | −20 / −10 |
| Full Review | 100 | all three | every room | all | 25 Don | 2 worst rooms 15 min if total ≥ 10 | set to 50 |
Caps: a fine never exceeds 25% of current Donations and is never paid in followers. Every visit lowers Suspicion, so a visit is a release valve, never a spiral. The Full Review ends the run ("Closed Pending Review") only once Ascension exists (loop audit; D-008 keeps meta).

**Flow (no countdown anywhere, D-149 §1.4):**
1. **Appointment card.** "The Office of Mild Concern would like a word." Shows the officials, the **agenda** (which rooms, in order) and each room's projected findings. Agenda = rooms with the most of the checked tag first, ties broken by the `events` RNG stream (deterministic, no surprise gotchas).
2. **Prep (untimed).** "The inspector is in the lobby with a thermos. She will wait." The player can reassign staff, declare or tidy items, play **Look Busy**, or leave and play anything else. While a visit is pending Suspicion does not fade and no other visit can queue. That is the only nudge.
3. **Walkthrough.** Officials enter through the Hall's front door and climb the stairs to each agenda room. Each room gets a beige stamp: "Pass" or "Noted ×n". Tap to skip to the result. Reduced motion: stamps appear instantly.
4. **Result card.** Deadpan findings list, fine, any "PENDING REVIEW" seal (beige tape), Suspicion change.

**Findings per agenda room** (floor 0): Exposure for the checked tag(s) + 1 if the room has slots but nobody in them ("Suspiciously empty") + 1 per untidied undeclared item (Tax) + 1 once per visit, in the Hall, if anyone present has Doubt ≥ 60, wherever they work (D-166) − 1 if every slot is filled and average Doubt < 30 − Shredding Room cover (Tax only). Then Filed Forms from the Records Office cancel 1 finding each, automatically, until gone.
**Look Busy** (D-149 §4 framing, office-object boards): fine and seal time × (1 − 0.25 per star) (ECONOMY §5), and a win takes −5 Suspicion. One attempt per visit. Relaxed mode counts as 2 stars.
**Followers leaving:** at the warrant and Full Review visits, the highest-Doubt agenda worker with Doubt ≥ 70 leaves by choice "to help with the inquiry" (biscuits, their own clipboard) and **comes back 15 min later**, unpunished, never sent to the Reading Room (D-149 §4).
**Gifts never work:** "Thank you, no. It's policy." No potions are offered to officials. Amnesia Brew stays a reporter-only event.

## 5. How rituals feed the Sanctum
1. **Omens (ritual-only currency, loop audit §2.4)** pay for storeys and every L3 room upgrade. A full Sanctum is ≈ 33 Omens for storeys + ≈ 50 for L3s, roughly 45-60 min of ritual play per run. This is the main new reason to play rituals mid-game.
2. **Room Rites.** Each room type is a Rite target: pick "Bless the Kitchen", play any board, and the focus tile converts into a **Blessing**: +5% output per 4 focus tiles, cap +50%, for 10 game-minutes (additive). Blessing slots: 1 + Ritual Chamber level. Kitchen = Herb, Press = Rune, Retreat = Eye, Records = Candle (start mapping; the balancer measures focus counts).
3. **Look Busy** is the only way to cut fines and seals beyond prep.
4. **Recruitment rites matter again:** Bunk Rooms lift the 8-bed cap (loop audit problem 9). Target flock 16-24 by Lv10.

**Resource-flow additions (for ECONOMY §1, balancer to merge):** `M3 -->|Omens| STOREY & ROOM_L3` · `M3 -->|Blessing| ROOMS` · `ROOMS -->|Devotion, Donations, Stew, Pamphlets, Forms, Confetti| ...` · `SUS -->|inspection| FINE(DON) & SEAL(ROOMS) & SUS` · `M3 -->|Look Busy| FINE & SEAL` · `RQ items --> ROOM_L2/L3`.

## 6. Art and layout
- **Sprites (runtime atlas, D-119; 32-colour palette, 16 px grid):** per room type one 16×16 back-wall tile (repeats across bays), 2-3 props (16×16 or 16×32), a 32×8 sign; levels shown by props and trim colour (no new sprite per level). Stairs 16×48. Storey slab 16×4 tile. Scaffold 48×48 (2 frames). Sky and roof cap 160×16. Officials 16×20 (cardigan, lanyard, clipboard; no badge, 2-frame walk + 2-frame "write"). PENDING REVIEW tape 48×8, beige `#e8e2c8` on `#d1a46e`, never yellow-and-black. Undeclared item badge 8×8. Est. ~35 new sprites, all S/M programmer art.
- **Every storey shows an exit sign as a fire-safety object** (allowed by D-149 §2); no copy may read "exit" as anything else.
- **Tap targets:** rooms 48×48 logical (≥ 96 CSS). Followers get a 24×24 hit box (≥ 48 CSS at the minimum CSS scale of 2). Action strip buttons 60×24.
- **Portrait:** resource bar 25 | advisor banner 22 | Sanctum (sky, storeys, Hall at bottom) | action strip 24: [Grounds] [Build] [Flock] | tab bar 28. Room card and Flock list are bottom sheets (existing `modal.ts`), primary buttons in the bottom 40%.
- **Landscape:** rail 60 left | Grounds strip (≥ 100 px when content ≥ 270, hidden at the 168 minimum) + tower 160 | dock 92: room card, Flock list (drag source) or the inspection agenda.
- **No new tab.** The Compound tab remembers Grounds or Sanctum. Rotation keeps scroll storey, selection and an in-progress drag is cancelled with no state change.

## 7. Build plan (save migration needed: yes)
| # | Increment | Contents | Cut if needed | Size |
|---|---|---|---|---|
| 1 | **Upstairs** | Sanctum screen, Hall as ground floor, storeys 1-3 (Devotion/Donations only), Bunk Room, Kitchen, Records Office (forms stockpile only), drag/tap assign with key stats, merge-with-neighbour, room card, Sanctum unlock beat at Lv3; save migration | merging (ship 1-bay rooms), drag (tap only) | M-L |
| 2 | **Omens and Blessings** | depends on loop-audit Rites/Omens landing; Omen costs on storeys and L3; Room Rites; Ritual Chamber; Press; storeys 4-6 | Room Rites (keep Omen costs) | M |
| 3 | **The Office of Mild Concern** | band events, appointment card, agenda, prep, walkthrough, result; Look Busy boards; Storeroom; undeclared items; followers leaving and returning; Full Review | Shredding Room; the warrant tier (ship check-in + inspection + Full Review) | L |
| 4 | **Fill-out** | Wellness Retreat, Reading Room, Shredding Room, landscape Grounds strip, Heralds hook (Tax Season = Auditor visits ×3), Mothman "Read the Omens" appointment preview; sim strategies for building height and inspection risk | Grounds strip | M |

**Code and data touched:** `src/core/types.ts` (`RunState.sanctum`, `inspection`, `followersAway`; `Follower.awayUntil`), `src/core/game.ts` (actions `buildStorey`, `buildRoom`, `upgradeRoom`, `demolishBay`, `assign`, `declareItem`, `tidyItem`, `startInspection`, `resolveInspection`; tick for room output, Blessings, seals, returns), `src/core/save.ts` (`MIGRATIONS[n]`: add empty `sanctum` with storey 1 if level ≥ 3, `inspection: null`; no building moves), new `src/screens/sanctum.ts`, `src/screens/compound.ts` (door button, Hall card "Go inside"), `src/art/sprites.ts`, `src/ui/layout.ts` (no change expected), new `data/sanctum.json`, `data/rooms.json`, `data/inspections.json`, `data/text/en.json`, `tools/sim/`, ritual levels for Look Busy. **Version:** take the next free `saveVersion` at build time (Rites also claims v4).

**Data sketch**
```json
// data/rooms.json
{ "id": "kitchen", "keyStat": "sanity", "slotsPerBay": [2, 2, 3], "unlockLevel": 4,
  "produces": { "item": "stew", "perMin": 0.5, "consumes": { "item": "basil", "count": 1 } },
  "exposure": { "health": 1 }, "heatPerMin": 0, "mergeBonusPct": [0, 10, 20],
  "cost": { "devotion": 100, "donations": 40 },
  "upgrades": [ { "cost": { "devotion": 250, "donations": 80 }, "craft": { "chain": "paper", "tier": 2 } },
                { "cost": { "devotion": 600, "donations": 160, "omens": 4 }, "craft": { "chain": "candle", "tier": 3 } } ],
  "riteFocus": "herb" }
```
```ts
interface RoomState { id: number; type: string; storey: number; bay: number; bays: 1 | 2 | 3; level: number;
  stored: number; sealedUntil: number; blessUntil: number; blessPct: number; undeclared: number; tidied: number }
interface SanctumState { storeys: number; building: { storey: number; doneAt: number } | null; rooms: RoomState[] }
interface InspectionState { visit: string; tags: string[]; agenda: number[]; phase: 'announced' | 'walking' | 'done';
  lookBusyStars: number | null }
```

## 8. Edge cases
Rotate mid-drag: drag cancelled, nothing moves. Merge neighbours of different levels: refused, card says "Upgrade to match first" (D-148: disabled says why). Demolish a staffed bay: workers become unassigned. Sealed room: workers idle "on paid leave", beds still count (nobody is moved out). Visit due during a ritual or offline: not rolled (no catch-up visits). Suspicion hits 100 with a visit pending: the pending visit upgrades to the Full Review. Fine larger than Donations: capped at 25% of current, never negative. Helper leaving is the only worker: room shows "Suspiciously empty" on the next visit, which is fair and visible. Storeroom full: Tidy disabled with the reason. Storey under construction during a visit: scaffold is not on any agenda. Player never opens the door: allowed forever; Suspicion just stops fading.

## 9. Acceptance criteria (testable)
1. Layout: at 180×320, 195×422, 360×640, 844×390 and 1280×720 the tower is 160 px wide, integer-scaled, centred, never scrolls horizontally; rooms ≥ 96 CSS px; rotation keeps the scrolled storey (Playwright screenshots).
2. Building, merging (2 and 3 bays), upgrading and demolishing follow `rooms.json`; merged output = per-bay sum × (1 + merge %) (unit tests).
3. Worker output uses the room's key stat per the formula in §3 (unit test per key stat).
4. Migration fixture: a v(n−1) save with all four buildings loads with buildings unchanged and an empty Sanctum (storey 1 if Lv ≥ 3).
5. Inspections: same seed and state → same agenda and findings (determinism test); no inspection data or string has a timer field; no visit rolls while `activeRitual` is set or offline; fines ≤ 25% of Donations; every visit lowers Suspicion; Look Busy 3★ cuts fine and seal by 75%.
6. A follower who leaves "to help with the inquiry" returns after 15 game-minutes with unchanged stats and job cleared (unit test); no code path sends them to the Reading Room.
7. Sensitivity: the D-149 §6 checklist passes on all new text and art; grep test finds no banned agency words or "raid" in `en.json` values.
8. Sim: Sanctum spending keeps Devotion below cap ≥ 80% of the 150-minute run; ritual share of active time 20-45%; no wait > 10 min for something new in the first 120 minutes after the tutorial.

## 10. Why would a player do this differently next run?
- **Stack order is a strategy.** Inspectors start at the front door and climb, and agendas favour high-Exposure rooms: a "clean front" run puts Records and Bunks low and the Retreat high; a "heat farm" run builds three-bay Retreats early and lives on Look Busy and Storerooms.
- **The draft decides the rooms.** A Skeptic-heavy draft makes a three-bay Records Office (Doubt is its key stat) that cancels most findings, but those same workers are risky on any agenda. A Trusting-heavy draft gets the calm-staff bonus everywhere and can skip Records.
- **Patrons (when pledges ship):** Vorl: room output +20% but faster Sanity decay, so Kitchens and L3 Bunk Rooms move to the front of the build order; Mothman: "Read the Omens" shows the next appointment and agenda early; Baba Yaga: once per day, two rooms may swap places free (rooms walk, like her hut).
- **Heralds:** Tax Season (Auditor visits ×3) makes Records and declaring worth it; Solar Eclipse (Suspicion ×2) punishes height.
- **Prophecies / Ascension flavour:** "Pre-Approved Extension" (start with storey 2), "Flee Abroad" starts with a Storeroom.

**Replay-matrix row (GDD §4.1):** Sanctum | Patron: height bonus, agenda preview, room swap | Draft: key-stat fit, Doubt risk | Heralds: Tax Season, Eclipse | Prophecies: starting storey | Ascension: starting room | Hard mode: — (5 of 6 filled).

## 11. Decisions to log once the owner chooses
Grounds + Sanctum split; grow up not down; Panic Room → Storeroom; official titles replace "Officer/agents"; every visit lowers Suspicion; untimed prep; Shredding Room pending reviewer; land expansion reduced to Grounds parcels.
