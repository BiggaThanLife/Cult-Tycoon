# Review 2026-11-16: inspection walkthrough batch

Reviewer: lore-and-sensitivity-reviewer
Checked against: CLAUDE.md "Content boundaries", docs/TONE_AND_CONTENT.md (sections 1-3, 7),
docs/reviews/2026-11-15-raids-guardrails.md (sections 1, 2, 4, 6 and the five "never" rules), DECISIONS D-110, D-149, D-159.
Also read: docs/specs/sanctum-view.md section 4, the related event text (`event.neighbour/auditor/inspector/full_review.*`),
`src/screens/modals.ts` (`openAgenda`, `openWalkReport`, the event-choice label swap), `src/art/sprites.ts` (visitors, `seal_tape`).

Batch: `data/text/en.json` keys `inspection.agenda*`, `inspection.let_in`, `inspection.prepare`, `inspection.stamp.*`,
`inspection.reason.*`, `inspection.report.*`, `inspection.walking`, `inspection.hall`, `visitor.*`;
`data/events.json` `inspect` blocks; `data/rooms.json` `exposure` and `inspection`; `src/core/inspection.ts`;
`src/screens/sanctum.ts` `playWalk` / `endWalk`.

**Overall verdict: CHANGES REQUIRED.** The text is in voice and nearly all of it passes. Three mechanics need changing
because, as built, the game rewards keeping particular people away from the official (guardrail rule 4 / motif 10),
and a sealed room shows its workers behind tape (TONE section 2: never "locked in"). Two strings change with them.
Nothing is BLOCKED. Rating stays Teen / PEGI 12; nothing here adds a descriptor.

---

## 1. Required changes

### Text (ASCII, not longer than the original)

| Key | Current (chars) | Replacement (chars) | Reason |
|---|---|---|---|
| `inspection.agenda.tip` | Staff empty rooms, calm the doubters, file forms. Or simply Look Busy. (70) | `Staff empty rooms and file forms. Or simply Look Busy.` (54) | "Calm the doubters" before an official arrives is an instruction to quiet dissent so it is not heard by outsiders: information/milieu control [1][2], presented as a to-do with no satirical cost. The satire may show the tactic; the tutorial voice must not recommend it. |
| `inspection.reason.doubt` | A doubter was very, very helpful (32) | `Staff may be very, very helpful` (31) | Shown only on the agenda, i.e. before the visit, so past tense is wrong. Drops the label "doubter" pinned to one room's worker (which tells the player whom to move). The joke stays on the leader's dread of honest staff. Pairs with mechanic M1. |

### Mechanics (owners: systems-engineer for code, game-designer for spec section 4, economy-balancer for `npm run sim`)

- **M1. The Doubt finding counts presence, not placement.** In `findingsFor` (`src/core/inspection.ts:48`) remove the
  per-room check. Add one `{ key: 'doubt', n: 1 }` to the **Hall step only** when any follower on the premises who is
  not away (`run.followers.filter((f) => !isAway(run, f))`, any job, including unassigned) has Doubt >= `doubtAt`.
  At most 1 per visit. Moving or unassigning someone must never change this finding. The calm-staff bonus stays per room.
  Update docs/specs/sanctum-view.md section 4 ("+1 if any worker has Doubt >= 60") and log a decision.
- **M2. The Full Review "helping with the inquiry" pool is premises-wide.** In `conductWalk`
  (`src/core/inspection.ts:108`) the pool becomes every present follower with Doubt >= `awayDoubtAt`, regardless of
  job or agenda. Today an unassigned follower can never volunteer, so taking a doubter off shift before a Full Review
  stops them from talking to the officials. Keep: comes back after `awaySec * keep`, no stat change, no penalty, never
  sent to the Reading Room (all true in the current code; keep it that way).
- **M3. Nobody is drawn inside a sealed room.** `drawGroup` (`src/screens/sanctum.ts:270-279`) draws the room's workers
  and then lays `seal_tape` across them: people behind tape reads as being sealed in. Required outcome: while a room is
  sealed, none of its workers is shown in it or counted as working in it. Preferred: at seal time move them to the
  Sermon Hall, matching the existing demolish copy ("The workers go back to the Hall"); this applies to both seal paths
  (`src/core/inspection.ts:98` and `src/core/game.ts:522`). Minimum: skip `drawWorkers` for sealed groups and draw
  those workers in the Main Hall. A QA screenshot of a sealed room is needed before sign-off.

---

## 2. Answers to the brief

1. **Does any finding punish or mock followers?** No follower is punished or mocked: the Doubt finding costs the
   *leader* a finding, the doubter's stats are untouched, and "very, very helpful" casts honesty as warm and the leader's
   secrets as the problem. The joke lands on the leader's panic. **But the mechanic as built is not acceptable**: because
   it is per room, the cheapest answer is to move or unassign the doubter, which rewards keeping a person away from the
   official. With M1 the doubter is counted wherever they are, so the only counters are honest ones (Filed Forms, Look
   Busy, or a happier flock over normal play). The agenda tip must stop telling players to "calm the doubters".
2. **Does "Prepare first" read as hiding people?** The label itself is fine (it routes to Look Busy, which is
   compliance theatre). The reassignment it invites is the problem: today, unassigning or moving a doubter erases a
   finding and (at a Full Review) stops them from volunteering, which is hiding a person in all but name. With M1 and M2
   reassignment only affects "Suspiciously empty" and the calm-staff bonus, i.e. staffing and putting on a good show,
   which is the leader's vanity and stays in bounds. Framing rule for any future prep copy: talk about rooms, forms,
   receipts and staffing gaps; never "out of sight", "keep away", "somewhere else", "quiet", "calm down" or a named
   follower. Prep never moves people to cellars, upper floors "out of the way" or unassigned limbo for the visit.
3. **Stamps, report, "The tape is beige".** PASS / NOTED xN are civil, clerical and in pastel (green / pink), with a
   tap and a soft buzz: no "FAIL", "VIOLATION", red alarms or crime-scene styling. Rules 1-5 are clear: the 520 ms beat
   between rooms is animation pacing with no visible number, tap skips, reduced motion is honoured, so it is not a
   countdown; nothing tactical, no fire, no children, no real agency. The report pays fines in Donations, capped at
   25%; seals are 5-15 min and never the Hall or a Bunk Room (nobody loses a bed); the follower "is helping with the
   inquiry" and comes back. "The tape is beige" matches approved guardrail example 9 and the art (`seal_tape`: sand and
   bone stripes, no words, no hazard colours). APPROVED, with M3 for what is drawn under the tape.
4. **Visitor names and "Review Panel".** Neighbour, Auditor, Building Inspector: civil titles, all on the approved
   list or plainly civilian. "Review Panel" uses none of the banned agency words, is a generic common noun (it only
   names a real body with a qualifier, so no collision), is never abbreviated and carries no rank. In the agenda it reads
   "The Review Panel would like to see these rooms", which is polite and appointment-like. No personal names are used,
   so no name search is needed for this batch. APPROVED.
5. **Anything else.** (a) The agenda never seeks out doubters (it ranks rooms by exposure only); keep it that way.
   (b) A sealed Kitchen pauses soup: fine, as long as no text ever implies followers go hungry. (c)
   `inspection.report.clean` "The visitor seems almost disappointed" is a gentle clerk gag, not villainy; approved, but
   do not escalate it (no gloating, no "they wanted to catch you"). (d) Look Busy shortens the inquiry-helper's time
   away; acceptable, since it is framed as less paperwork, not as preventing cooperation. Keep it that way in text.

---

## 3. Verdicts per item

### Text keys

| Key | Verdict | Note |
|---|---|---|
| `inspection.agenda.button` "Agenda" | APPROVED | |
| `inspection.agenda.title` "Today's Agenda" | APPROVED | Appointment framing, no clock |
| `inspection.agenda.intro` | APPROVED | "Politely." matches officials-as-polite-adults |
| `inspection.agenda.line` / `inspection.agenda.line.one` | APPROVED | |
| `inspection.agenda.clean` | APPROVED | |
| `inspection.agenda.tip` | CHANGES REQUIRED | Section 1 |
| `inspection.let_in` "Let them in" | APPROVED | Affirms the no-refusing-entry rule |
| `inspection.prepare` "Prepare first" | APPROVED (depends on M1, M2) | Section 2, point 2 |
| `inspection.stamp.pass` / `inspection.stamp.noted` | APPROVED | |
| `inspection.reason.zoning` | APPROVED | Zoning joke on the leader's "cozy" spin |
| `inspection.reason.health` | APPROVED | Guardrail safe-material item verbatim in spirit |
| `inspection.reason.tax` | APPROVED | Grift joke, punches up |
| `inspection.reason.empty` "Suspiciously empty" | APPROVED | Joke on the leader's padding; staffing, not people |
| `inspection.reason.doubt` | CHANGES REQUIRED | Section 1 (text + M1) |
| `inspection.reason.calm` | APPROVED (after M1) | Rewards a happy, staffed room; with M1 it no longer doubles as a reward for removing a doubter |
| `inspection.reason.forms` | APPROVED | |
| `inspection.report.title` / `.total` / `.fine` | APPROVED | Fine in Donations only |
| `inspection.report.seal` | APPROVED | Text fine; M3 for the art |
| `inspection.report.away` | APPROVED (with M2) | Guardrail section 4 wording; returns, unpunished |
| `inspection.report.clean` | APPROVED | Note 5(c) |
| `inspection.report.suspicion` / `.look_busy` | APPROVED | |
| `inspection.walking` | APPROVED | "premises", tap to skip, no time pressure |
| `inspection.hall` "Main Hall" | APPROVED | |
| `visitor.neighbour` / `visitor.auditor` / `visitor.inspector` / `visitor.full_review` | APPROVED | Section 2, point 4 |

### Data

| Item | Verdict | Note |
|---|---|---|
| `data/events.json` `inspect` (neighbour, auditor, inspector, full_review) | APPROVED | Tags civil only; seals 0-15 min (short); `awaySec` 900 = 15 min, returns |
| `data/rooms.json` `exposure` per room and `hall.exposure` | APPROVED | Zoning / health / tax only; Records Office has none |
| `data/rooms.json` `inspection` (`doubtAt` 60, `calmBelow` 30, `maxFinePct` 25, `cleanSuspicionMult` 1.5, `awayDoubtAt` 70) | APPROVED (values); semantics per M1, M2 | Balancer to re-run sim after M1 |

### Mechanics

| Mechanic | Verdict | Note |
|---|---|---|
| Findings from exposure | APPROVED | |
| "Suspiciously empty" | APPROVED | |
| Doubtful staff finding (per room) | CHANGES REQUIRED | M1 |
| Calm, fully staffed bonus | APPROVED | |
| Filed Forms cancel findings | APPROVED | |
| Fine capped at 25% of Donations | APPROVED | Never paid in followers |
| Seal the worst room, never the Hall or a Bunk Room | APPROVED | |
| Workers drawn under seal tape | CHANGES REQUIRED | M3 |
| Full Review volunteer (Doubt 70+, returns later) | CHANGES REQUIRED | M2 (pool); the return and no-penalty rules are correct |
| Every visit lowers Suspicion | APPROVED | |
| `playWalk`: official enters through the Hall, climbs, stamps; tap to skip; reduced motion; no timer UI | APPROVED | Front-door entry, on foot, one figure; matches guardrail sections 2-4 |

---

## 4. Section 6 checklist

- [x] Player-facing name is "inspection" / "inquiry" / "review"
- [x] Fictional, never-abbreviated body; no banned words
- [x] Civil titles; visitor sprites have no badges, seals or lettered clothing
- [x] Violations civil only (zoning, health, tax, staffing)
- [x] No siege, standoff, ultimatum, loudspeaker, floodlight or day counter
- [x] No tactical vehicles or gear; daytime, on foot
- [x] No gas, smoke, fire or explosions
- [x] No countdown or real-time timer (playback pacing is not shown as time; seal/away lengths are short, stated as "about N min")
- [x] No children; no custody, family or marriage matters
- [x] No fortifications, guards, locked gates or refusing entry ("Let them in")
- [x] No militia, sovereign-citizen or persecution language
- [x] No weapons, arrests, injuries or damage; the cat is safe
- [ ] **Nobody is hidden** - fails until M1 and M2 (reassignment hides doubters from the walk)
- [ ] **"Exit", "the door" cannot read as confinement** - fails until M3 (workers drawn behind seal tape)
- [x] Nobody is removed; the volunteer leaves by choice, returns, is not punished
- [x] No real agencies, acronyms, dates, places or events
- [ ] **Joke lands on the leader** - fails until `inspection.agenda.tip` changes (the tip coaches silencing dissent)
- [x] ASCII, length budget, all strings are keys in `data/text/en.json`

Re-review needed after the changes: the two strings, a unit test that reassigning or unassigning a Doubt 60+ follower
does not change `projectedFindings`, a unit test that an unassigned Doubt 70+ follower can volunteer at a Full Review,
and a screenshot of a sealed Sanctum room.

---

## 5. Sources

Sources may name groups and people; game text never does (D-010). No factual claims enter game text in this batch;
these support the reasoning behind M1, M2 and the tip change.

1. Robert Jay Lifton, *Thought Reform and the Psychology of Totalism: A Study of "Brainwashing" in China*
   (W. W. Norton, 1961; University of North Carolina Press reprint, 1989), chapter 22, "milieu control": controlling
   who members communicate with and what outsiders hear.
2. International Cultic Studies Association (ICSA), "Characteristics Associated with Cultic Groups" (Lalich and
   Langone checklist), items on discouraging members from speaking freely with outsiders and on us-versus-them
   framing. https://www.icsahome.com/elibrary/topics/articles/characteristics-associated-with-cultic-groups
3. docs/reviews/2026-11-15-raids-guardrails.md, section 1 (the removals and standoffs behind motif 10, "hiding
   people") and section 9 for its primary sources.
