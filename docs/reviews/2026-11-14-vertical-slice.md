# Review 2026-11-14: vertical-slice content batch

Reviewer: lore-and-sensitivity-reviewer
Checked against: CLAUDE.md "Content boundaries", docs/TONE_AND_CONTENT.md, DECISIONS D-104, D-110, D-111, D-112.
Files read in full: data/text/en.json, data/entities.json, data/events.json, data/orders.json,
data/followers.json, data/recipes.json, data/items.json.

**Overall verdict: CHANGES REQUIRED** (5 strings in data/text/en.json). Nothing is BLOCKED.

## Verdicts by group

| Group | Verdict |
|---|---|
| Amnesia Brew / reporter event (en.json `event.reporter.*`, `item.amnesia_brew.*`, events.json, recipes.json) | CHANGES REQUIRED |
| Ingredients and items (en.json `item.*`, items.json) | CHANGES REQUIRED (1 string) |
| Followers: names and traits (followers.json, en.json `trait.*`, `float.*`, `draft.*`, `roster.*`) | CHANGES REQUIRED (1 string) |
| The Mothman: text and orders (en.json `entity.mothman.*`, `order.mothman_*`, orders.json) | APPROVED |
| The Mothman: entity record and sources (entities.json) | APPROVED, with one citation correction recommended |
| Cat event | APPROVED |
| Ascension preview (`ascension.*`) | APPROVED, with a guardrail for the later build |
| UI, tutorial tips, buildings, rituals, merge, garden, lab, offline, settings, debug | APPROVED |

## Required changes

All proposed text is ASCII and no longer than the original.

### 1. Reporter event does not show informed acceptance (D-110)
D-110 and CLAUDE.md say nobody has memories erased against their will. As written, the reporter accepts
an unnamed "free sample" and is never told what it does. That reads as a concealed dose, even though the
drink is handed over openly. Fix: name the drink at the point of offer, and say it sparkles (magical).

- `event.reporter.choice.sample` (19 chars)
  - Now: `Offer a free sample`
  - Proposed (18): `Offer Amnesia Brew`
- `event.reporter.result.sample` (138 chars)
  - Now: `"Free sample? Don't mind if I do." The reporter loved it, remembers nothing about the last hour and left with a tote bag. Suspicion falls.`
  - Proposed (135): `"Amnesia Brew? Don't mind if I do." One sparkly sip and the last hour blurs. The reporter left happy with a tote bag. Suspicion falls.`
- `item.amnesia_brew.desc`
  - Now: `A free sample for nosy visitors. One sip and the last hour politely blurs. Harmless. They keep the tote bag.`
  - Proposed (1 char shorter): `A sparkly, labeled free sample. One sip and the last hour politely blurs. Harmless. They keep the tote bag.`

Note: the example line in TONE_AND_CONTENT.md section 2 has the same gap. I will update it when these land.

### 2. Nightshade reads as a real poisonous plant in a drink
The brew served to the reporter is Basil + Nightshade, and nightshade is a well-known real poison. The
hard limit bans poisoning in any form. The current description hints that it is harmless but does not
say it is not the real plant.

- `item.nightshade.desc` (63 chars)
  - Now: `Decorative. Mystical. Strictly for brewing things that sparkle.`
  - Proposed (63): `Not the real kind. Ours glows. For brewing things that sparkle.`

Recommended, not required (game-designer / owner call, since it touches GDD, ECONOMY and the slice spec):
change the display name to an invented plant. GDD section listing Mandrake and Wolfsbane has the same
issue and needs the same treatment before those crops ship.

### 3. "Gullible" makes the follower the joke
Followers are sympathetic marks. TONE section 1 already describes them as "slightly too trusting".

- `trait.gullible.name` (8 chars)
  - Now: `Gullible`
  - Proposed (8): `Trusting`
- `trait.gullible.desc` (`Believes the brochure.`) is fine as is. The trait id can stay.

## Answers to the six checks

1. **Joke targets.** Leader, con or entity throughout, apart from `trait.gullible.name` above. Reviewed and
   accepted: `float.follower_fine` and `tip.done` (scare-quoted "fine"). They are irony about the leader's
   indifference. Condition: never show them as a reaction to low Sanity or a follower leaving (D-112).
2. **Amnesia Brew (D-110).** Openly handed over, harmless, reporter leaves happy with a tote bag. Not yet
   clearly informed or clearly magical. See required change 1. events.json mechanics are fine: no force,
   refusing costs only +5 Suspicion.
3. **Mothman (D-111).** No bridge, collapse, town, date or real-disaster omen in any player-facing string.
   `reviewNotes` in entities.json names the 1967 collapse as a guardrail; I found no code in src/ that
   reads `reviewNotes` or `sources`, so it is not shown to players. Keep it that way.
4. **Real people, groups, sound-alikes.** None found. Follower names are first names only, old-fashioned
   and generic. No group, leader, slogan, place or date traceable to a real group.
5. **Rating.** Teen / PEGI 12 holds. Mild occult flavor ("Hex Bomb", "Dark Favor", "Summoning Sigil"), no
   violence, no crude language, no romance.
6. **Mothman dignity.** Good. He is patient, terse and in charge; the leader is the fool
   (`entity.mothman.intro.ok`: "Of course, Mr. Man"). His font notes and porch-light evening are his own
   pettiness, on his own terms.

## Mothman sources (entities.json)

Checked by web search on 2026-11-14. Search-result summaries only; I did not open the books.

- **Keel, John A. The Mothman Prophecies. Saturday Review Press, 1975.** Verified as a real publication,
  correctly attributed. Fuller imprint is New York: Saturday Review Press / E. P. Dutton, 1975.
- **Sergent, Donnie & Wamsley, Jeff. Mothman: The Facts Behind the Legend. Mothman Lives Publishing, 2002.**
  Verified as a real publication with the right authors and publisher. The year is inconsistent across
  listings: Open Library and the West Virginia Encyclopedia give 2001, most retailers give 2002. First
  author is listed as Donnie Sergent Jr. Recommended citation:
  `Sergent, Donnie Jr. & Wamsley, Jeff. Mothman: The Facts Behind the Legend. Mothman Lives Publishing, 2001.`

Both are popular/enthusiast books, not academic ones. Recommended: add one independent reference source.
The West Virginia Encyclopedia has a Mothman entry that turned up in the search; I have not read it, so
it is a lead, not a verified source.

Living community: the legend belongs to a real town and to the families of the 46 people who died in
1967. D-111 is the protection for them and the slice text respects it.

## Guardrails and process notes (no action needed for this batch)

- **Ascension.** `ascension.beamed.*` sits near the banned ship-departure theme. Approved because it is
  the leader's rented-spotlight exit scam and nobody dies. When built: leader only, visibly staged, no
  followers "departing", no comet or ship. `ascension.fake_death.*` must never be staged as suicide.
- **`reviewStatus`.** entities.json already said `approved` before any review note existed. This note is
  the first sign-off. Please leave that field to the reviewer in future.
- **Paths.** TONE section 5 says `data/entities/`; the data lives in `data/entities.json`. I will correct
  the guide.
- **Length.** `welcome.body` is about 190 characters, over the 140 guideline. Fine if the dialog fits on
  the minimum portrait canvas; qa-tester to confirm.
- docs/FIELD_NOTES_SOURCES.md does not exist yet. Not needed for the slice (no Field Notes text in batch).


---
**Lead follow-up (same day):** all five required text changes applied as proposed; the Sergent & Wamsley citation was corrected; the tone guide's Amnesia Brew example and entity path were updated. Open for the owner: renaming Nightshade (and later Mandrake/Wolfsbane) to invented plants.
