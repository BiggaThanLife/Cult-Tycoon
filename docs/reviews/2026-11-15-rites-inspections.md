# Review 2026-11-15: rites, Omens, audiences and inspections (text, events, visitor art)

Reviewer: lore-and-sensitivity-reviewer
Checked against: CLAUDE.md "Content boundaries", docs/TONE_AND_CONTENT.md, `docs/reviews/2026-11-15-raids-guardrails.md`
(D-149, section 6 checklist), DECISIONS D-008, D-010, D-110, D-111, D-112, D-144, D-146, D-153.
Read in `data/text/en.json`: every key starting `rite.`, `ritual.lb`, `ritual.focus`, `tile.`, `omens.`, `daily.`,
`audience.`, `orders.reroll`, `orders.audience`, `boon.favorPerOrder`, `entity.*.audience`, `inspection.`,
`building.sealed`, `follower.away`, `float.fine`, `float.sealed`, `float.omens`, `tip.rites`, `tip.inspection`,
`debug.visit`, `event.neighbour.*`, `event.auditor.*`, `event.expose.*`, `event.inspector.*`, `event.full_review.*`,
plus `event.reporter.*` and `tip.reporter` (writer's flag 8).
Also read: `data/events.json` (all visit choices and effects), `data/entities.json` (reviewNotes and sources),
`src/art/sprites.ts` (visitor sprites, `seal_tape`, `tile_office_*`, `web_office`, `FOLLOWER` template),
`src/art/palette.ts`, and in `src/core/game.ts` the visit code (`applyVisit`, `settleInspection`, `rollVisit`) to confirm
behaviour behind the text. Data and code were not edited.

**Overall verdict: CHANGES REQUIRED** (2 strings, 2 sprites). Nothing is BLOCKED. Once the four changes land, the batch
passes every item on the guardrails section 6 checklist.

---

## Required changes

Text replacements are ASCII and no longer than the original.

### 1. `event.inspector.result.thermos` (Calm Draught to the inspector)
The offer itself is fine: named, openly offered, accepted (D-110). The problem is the second sentence. "The report
shrinks to one page" says the drink changed a public official's professional judgement, and the Calm Draught is a
mood drink ("a warm cup of 'it's probably fine'"). That is a calming drink used to make someone stop doubting, which
D-110 rules out even with consent. Amnesia Brew is the only potion with an owner exception, and only for the reporter.
The fix keeps the hospitality and lands the joke on the leader: the scheme fails, the goodwill still counts.

- Now (116): `She accepts a Calm Draught for her thermos, openly, with a biscuit. The report shrinks to one page. Suspicion falls.`
- New (102): `She reads the label and accepts a thermos of Calm Draught. Calm, yes. Still thorough. Suspicion falls.`

### 2. `event.reporter.result.no_comment` (pre-existing tutorial line, flag 8)
A slammed gate is refusing entry and the "locked gate" image the guardrails retire (section 1 rule 6, section 4).
- Now (99): `Nothing says 'nothing to hide' like a slammed gate. The reporter writes that down. Suspicion rises.`
- New (97): `Nothing says 'nothing to hide' like a sweaty 'no comment'. It goes in the notes. Suspicion rises.`

### 3. `seal_tape` sprite (src/art/sprites.ts, owner: pixel-artist)
Drawn as diagonal `PAL.yellow` and `PAL.ink` stripes with ink borders. That is hazard / crime-scene tape, which the
guardrails ban by name (section 4: "Never yellow-and-black, never crime-scene styling"; yellow-on-black is also the
standard warning colour pair in safety-sign standards such as ISO 3864-1). It also contradicts the text, which says
"beige tape".
Change to beige/pastel: stripes of `PAL.sand` and `PAL.bone`, or `PAL.sand` and `PAL.robeL`, edges in `PAL.woodD`
(not ink). No black, no yellow-and-dark contrast, no text. Update the comment to match.

### 4. `inspector` sprite (src/art/sprites.ts, owner: pixel-artist)
Comment and drawing: hard hat (`r(4,0,..)` yellow helmet), hi-vis vest (`r: PAL.acid`) with a white reflective band
(`r(4, 12, 8, 1, PAL.white)`) and a blue chest patch. At 16x16 a fluorescent yellow-green jacket with a reflective band
and a chest square is the silhouette of a uniformed patrol officer in several countries, and "helmets" and "vests" are on
the section 1 rule 2 list. Section 3 sets the wardrobe: cardigans, lanyards, sensible shoes.
Change to: no headgear (hair in `R`, e.g. `PAL.woodD`), a cardigan in a soft colour (`PAL.wood`, `PAL.robe` or
`PAL.pink`), no reflective band, keep the clipboard. Update the comment.

---

## Verdicts by item

| Item | Verdict | Reason |
|---|---|---|
| `rite.*` (pick, names, descs, results, full, none, choose, target, locked) | APPROVED | Generic rite words. "Communion": see note A |
| `ritual.focus`, `ritual.focus.short`, `tile.0`-`tile.4` | APPROVED | |
| `tile.office.0`-`.5` (Forms, Stamps, Receipts, Hairnets, Exit Signs, Paperclips) | APPROVED | Exactly the section 4 tile list. "Exit Signs" is signage, not a euphemism |
| `ritual.lb1`-`lb3` names (Tidy the Lobby, File Everything, Hairnet the Cauldron) | APPROVED | Compliance theatre, no banned words |
| `omens.*`, `float.omens`, `daily.*` | APPROVED | Omens are a currency, never a real-disaster foretelling (D-111). Daily board excludes inspection levels (game.ts), so no calendar-pinned inspections (rule 9) |
| `orders.reroll*`, `orders.audience*`, `audience.*`, `boon.favorPerOrder` | APPROVED | |
| `entity.*.audience` (5 lines) | APPROVED | See flag 7 |
| `event.neighbour.*` | APPROVED | Pesto is "Suspiciously Normal Pesto", accepted openly, taken home. Neighbour is not an official |
| `event.auditor.*` | APPROVED | Guardrails example line 10 verbatim; agency never abbreviated |
| `event.expose.*` | APPROVED | See flags 1 and 2 |
| `event.inspector.*` | CHANGES REQUIRED | Required change 1. Title, body, settle and look_busy pass |
| `event.full_review.*` | APPROVED | See flag 4 |
| `event.reporter.*` | CHANGES REQUIRED | Required change 2; the rest pass (flag 8) |
| `inspection.*` | APPROVED | Win line is the section 4 rule 6 wording; loss is "the usual outcome, nothing worse", never "they got in" |
| `building.sealed*`, `float.sealed`, `float.fine`, `follower.away` | APPROVED | See flag 9 |
| `tip.rites`, `tip.inspection`, `debug.visit` | APPROVED | |
| `data/events.json` visit effects | APPROVED | Fines are a % of Donations, never Followers. Seals 5 and 10 min, Dormitory never sealed (game.ts excludes it, so nobody loses a bed). One follower away for 4 min, returns automatically, no penalty. Every visit lowers Suspicion (D-153). No timeout on a waiting visitor |
| `neighbour` sprite | APPROVED | Cardigan, casserole dish |
| `auditor` sprite | APPROVED | Glasses, sweater vest, ledger. Note B |
| `reviewer` sprite | APPROVED | Lavender top, stack of files. Note B |
| `inspector` sprite | CHANGES REQUIRED | Required change 4 |
| `seal_tape` sprite | CHANGES REQUIRED | Required change 3 |
| `tile_office_0`-`5` | APPROVED | Form, rubber stamp, receipt, hairnet, green exit sign, paperclip. Stamp is a desk stamp, not a seal or insignia |
| `web_office` | APPROVED | Red-tape X on a tile; not a lock, chain or barricade |

---

## Writer's flags, answered

1. **`event.expose.result.sample` (Amnesia Brew to a reporter): APPROVED.** This is the D-110 owner exception and is
   now clearer than the original: she reads the label, shrugs, accepts. Keep all three beats (label, choice,
   tote bag). The brew stays reporter-only; it is never given to officials or followers.
2. **`event.expose.result.interview`: APPROVED.** The follower volunteers, is away a short while, comes back, and the
   joke is the thin con (snacks), not the follower. Note C on the summary wording.
3. **`event.inspector.result.thermos`: CHANGES REQUIRED** (required change 1). Openly offered is fine; the drink must
   not be what shrinks the report.
4. **`event.full_review` body and settle: APPROVED.** Lanyards, a folding chair, tea; a fine, a sealed room, a long
   letter, everyone carries on. No custody, no closure of people. Optional grammar fix in note D.
5. **"lobby" / "front door": APPROVED.** Section 1 rule 2 says inspectors "knock, wait, and come in through the front
   door". Visitors waiting *inside* in the lobby is the opposite of refusing entry. Neither word is a death or
   confinement euphemism in context.
6. **Look Busy strings and banned words: APPROVED.** Checked every Look Busy string (`rite.look_busy.*`,
   `rite.result.look_busy`, `event.*.look_busy`, `inspection.*`, `ritual.lb*`, `tip.inspection`) against the
   section 4 list (defend/defence/defense, hold, hold the line, last stand, repel, resist, breach, storm, siege,
   standoff, fortify, barricade, enemy, attack, incoming, surrounded, perimeter, tactical, raid): none present.
7. **Entity audience lines: APPROVED, all five.** Mothman: no bridge, town or disaster, only "you should tidy" (D-111).
   Anansi: "table of stories" fits his role as owner of all stories; no dice, cards or luck (D-146). Vorl: no
   published-mythos names or phrases; "sit by the water" is invitation and melancholy, not harm. Baba Yaga and the
   Jersey Devil match their reviewNotes (plain English, judging; petty neighbour).
8. **`event.reporter.*`: CHANGES REQUIRED for `result.no_comment` only** (required change 2). No `event.reporter.*`
   string contains "compound"; the only nearby "compound" is `event.cat.body`, which is not inspection content and
   may stay. Recommended (not required): `tip.reporter` (42) -> `A notepad is at the door. Look tax-exempt.` (42).
9. **"Reopens in about {m} min" / "Back in about {m} min": NOT countdowns under rule 4.** Rule 4 bans a clock towards
   an inspection's arrival or running during it (the standoff "day counter" motif). These are approximate recovery
   durations shown after the visit is over, in whole minutes, recalculated on a static card. Conditions: keep
   "about", whole minutes only, no seconds, no ticking or flashing, no red, no progress bar or HUD-persistent timer,
   and never show a time on the waiting visitor.

---

## Notes and recommendations (not required)

- **A. "Communion".** The word is generic English for spiritual communion and the rite has no sacramental imagery
  (resin skulls, an entity). Keep it, but never pair it with bread, wafers, wine, chalices or an altar rail.
- **B. Chest patch on official sprites.** `FOLLOWER` has a 2x2 `L` patch at mid-chest. On the auditor (white) and
  reviewer (red) it reads as a name tag. To make sure it never reads as a badge, add a 1 px cord from collar to card
  (a lanyard) and never use gold, silver-grey or star shapes there.
- **C. `inspection.summary.away` for the reporter.** The expose event reuses "is helping with the inquiry". A reporter
  is not an inquiry. A separate key such as `{name} is giving an interview for {m} min` would be accurate; it needs a
  small engine change, so it is for the lead to schedule.
- **D. `event.full_review.body`.** "forty sections, a lanyard each" reads as if the sections wear lanyards. Optional
  (151, original 152): `The Office of Mild Concern has arrived for a Full Review. Two clerks, two lanyards, forty
  sections, one folding chair. Somebody brought a flask of tea.` (one line in en.json). Keep it at three officials or
  fewer.
- **E. "inspector" in running text.** "Inspector" alone is also a UK police rank. Titles already say
  "A Building Inspector"; keep "Building Inspector" in any future title, name or callout.
- **F. Length.** Several visit bodies exceed the TONE 140-character guide (neighbour, auditor, inspector, full review).
  Not a sensitivity issue; QA's overflow audit decides.
- **G. Decision log.** Calm Draught offered to a visitor is the first non-order potion use besides Amnesia Brew
  (D-144). Lead: log that visitor offers follow D-110 (named, offered, accepted, no effect on anyone's judgement).

---

## Section 6 checklist (after required changes)

- [x] Player-facing name is inspection / inquiry / review / audit; "raid" absent from all batch text
- [x] Office of Mild Concern, never abbreviated, no banned words
- [x] Civil titles (auditor, building inspector, reviewers); no ranks, badges, seals, lettered clothing (after change 4, note B)
- [x] Violations civil only: lawn, tax/tithe, gutters, health code
- [x] No siege, standoff, surrounding, ultimatum, loudspeaker, floodlight, day counter
- [x] No armoured or tactical vehicles or gear (after change 4); no dawn or night visits
- [x] No gas, smoke, fire; exit signs only
- [x] No countdown on arrival or during a visit (flag 9)
- [x] No children
- [x] No fortifications, guards, locked gates, refusing entry (after change 2)
- [x] No militia or sovereign-citizen language; officials are not framed as enemies
- [x] No weapons, arrests, custody, injuries, damage; the cat is not involved
- [x] Nobody hidden; only paperwork tidied
- [x] Nobody removed; the away follower volunteers, returns, and is not punished
- [x] No real agencies, acronyms, dates, places or events
- [x] Joke lands on the leader's panic and paperwork (after change 1)
- [x] "Exit", "door", "away" cannot be read as death or confinement
- [x] ASCII; all strings are keys in en.json; seal tape beige (after change 3)

---

## Sources

Mythology (as recorded in `data/entities.json`, verified in the batch-2 review). Living communities connected to each
figure are noted so writers keep them in mind; game text names none of them.
- Mothman: Keel, *The Mothman Prophecies* (1975); Sergent & Wamsley, *Mothman: The Facts Behind the Legend* (2001).
  Community: the West Virginia town tied to the legend and the families of the 1967 collapse (D-111; never named in game).
- Baba Yaga: Johns, *Baba Yaga: The Ambiguous Mother and Witch of the Russian Folktale* (Peter Lang, 2004);
  Afanas'ev, *Russian Fairy Tales* (Pantheon, 1945). Community: Slavic peoples whose tales she belongs to.
- Jersey Devil: Regal & Esposito, *The Secret History of the Jersey Devil* (Johns Hopkins UP, 2018); McCloy & Miller,
  *The Jersey Devil* (1976). Community: Pine Barrens residents.
- Anansi: Rattray, *Akan-Ashanti Folk-Tales* (Clarendon, 1930); Marshall, *Anansi's Journey* (UWI Press, 2012).
  Community: Akan peoples of Ghana and the Caribbean and African diaspora.
- Vorl: original to this game (D-104).

Inspections: all real-world background and sources are in `docs/reviews/2026-11-15-raids-guardrails.md` section 9;
nothing in this batch alludes to them. Safety colours: ISO 3864-1, *Graphical symbols - Safety colours and safety
signs* (yellow with black contrast = warning).
