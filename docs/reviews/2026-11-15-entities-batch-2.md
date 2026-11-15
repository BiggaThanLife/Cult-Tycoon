# Review 2026-11-15: entities batch 2 (Baba Yaga, Jersey Devil, Anansi, Vorl)

Reviewer: lore-and-sensitivity-reviewer
Checked against: CLAUDE.md "Content boundaries", docs/TONE_AND_CONTENT.md, DECISIONS D-104, D-105, D-110,
D-111, D-112, D-134.
Files read in full: data/entities.json, data/orders.json, data/recipes.json, data/items.json.
Read in data/text/en.json: every key starting `entity.`, `order.`, `boon.`, `orders.`, `merge.`, `levelup.`,
`building.`, plus `ritual.r4` to `ritual.r9` and the five `item.*` pairs named in the brief.
Not reviewed: art, board modifiers, any entity mechanic not yet in data (GDD section on patrons).

**Overall verdict: CHANGES REQUIRED** (1 string in data/text/en.json). Nothing is BLOCKED.

## Verdicts by entity

| Entity | Verdict | `reviewStatus` may be set to "approved"? |
|---|---|---|
| Baba Yaga (record, intro, 4 orders, `ritual.r4`) | APPROVED | Yes |
| The Jersey Devil (record, intro, 4 orders, `ritual.r6`) | APPROVED | Yes (content). Lead: he is not in D-105; log a decision |
| Anansi (record, intro, 4 orders, `ritual.r8`) | APPROVED, depends on required change 1 | Yes, once `orders.gamble` is changed |
| Vorl, the Patient Deep (record, intro, 4 orders, `ritual.r9`) | APPROVED | Yes |

## Verdicts by group

| Group | Verdict |
|---|---|
| Orders UI (`orders.*`) | CHANGES REQUIRED (1 string: `orders.gamble`) |
| New Mothman orders (`order.mothman_3` to `_6`) | APPROVED (D-111 holds: lamps, porch, streetlight, tree) |
| Potions (`item.calm_draught.*`, `item.moonlight_tincture.*`, `item.zeal_tonic.*`, recipes.json) | APPROVED, with guardrails for the follower-serving build |
| Ingredients (`item.graveyard_moss.*`, `item.moonpetal.*`) | APPROVED |
| Boons (`boon.*`, boon tables in entities.json) | APPROVED |
| Rituals `ritual.r4` to `ritual.r9` | APPROVED |
| Candle chain and merge UI (`merge.*`) | APPROVED |
| Level-up and building text (`levelup.*`, `building.*`) | APPROVED |
| Sources (entities.json) | APPROVED: all six verified; fuller citations recommended below |

## Required changes

Proposed text is ASCII and no longer than the original.

### 1. Dice imagery on Anansi
Not a hard-limit breach, but it fails TONE section 5 ("portrayed as their folklore self"). In the tales
Anansi wins by wit, bargains and rigged wagers; he never leaves anything to chance. Dice also pin
gambling props on a West African and Caribbean folk hero, which is an image I do not want attached to him.
The fix matches his own lines (`entity.anansi.intro`: "That is the fun. For me."; `order.anansi_2.thanks`:
"I decide the share."): he sets the pay, the leader is the one gambling.

- `orders.gamble` (32 chars)
  - Now: `Anansi rolls the dice: pay x{n}.`
  - Proposed (32): `Anansi sets the share: pay x{n}.`

`orders.kind.gamble` ("GAMBLE: pay is rolled on delivery") can stay: it describes the player's risk, not
the character. "Dice" in GDD, ECONOMY and D-108 is internal wording and is fine; keep it out of game text
and out of his art (no dice, cards or casino props).

## Recommended, not required

- **Anansi's "temple"** (`order.anansi_4.*`). Reads as a copy of the leader's grift, so it passes. It does
  put a place of worship next to a figure whose rule is "stories, not worship practice" (D-105). Swapping
  the word removes the question:
  - `order.anansi_4.text`: `"A Brochure and a Taper. I am opening a rival flock. Only as a joke. Probably."`
  - `order.anansi_4.thanks`: `"My flock had six members by lunch. I sent them back to you. You are welcome."`
- **Fallback for the kings line**, only if the owner wants no death reference at all (see check 1):
  - `order.baba_yaga_4.thanks`: `"Hm. Tidy. Kings have failed this. They sweep my yard now. You may go."`

## Answers to the eight checks

1. **Baba Yaga.** Formidable, terse, on her own terms; the leader is judged throughout. Plain standard
   English, no accent, no dropped articles, no national, food or faith jokes. "Yes, Grandmother" is the
   polite form of address heroes use in the tales, and it is played straight.
   **The kings line stays.** `order.baba_yaga_4.thanks` is one clause, past tense, off screen, no detail,
   and the eaten are unnamed fairy-tale royalty, not followers, the public or anyone real. That is mild
   fantasy menace, inside Teen / PEGI 12. Folklore: she is a man-eating ogress with a fence of human bones
   who eats those who fail her, and princes are her typical visitors, so the boast is in character. "Kings"
   is the writer's exaggeration; in most tales the hero escapes. Condition: this is the ceiling. Never
   children (the tales' child-eating motif is off limits here), never followers, never how.
   `order.baba_yaga_1.text` ("wearing your face") is accepted on the same terms: absurd, aimed at the
   leader, undone in the thanks line.
2. **Anansi.** Folktale trickster only. Standard English, no dialect spelling, no sky god, no rite, no
   proverb played for laughs. He is ahead of the leader in every line. Tiger is the traditional foil of
   the Jamaican tales (the stories were Tiger's until Anansi won them), so `order.anansi_3` is the classic
   shape: the small clever one fleeces the big strong one. It reads respectfully. Note for writers: Tiger
   belongs to the Caribbean branch; the Akan tales use the leopard. Dice: see required change 1.
3. **Jersey Devil.** No real people, no Leeds name, no origin story, no real town or dated sighting in any
   player-facing string. "The pines" is as specific as it gets. A loud, petty neighbour is fine; his
   mischief is property-level (fence, mailbox, power) and nobody is hurt. His voice is casual, not a
   phonetic accent. Keep it that way: no ethnic or mob stereotype ("It's for a guy" is as far as it goes).
4. **Vorl.** I found nothing lifted. No mythos proper noun, place, quotation or stock formula appears in
   the intro, orders, blurb or `ritual.r9`. One web search for "Vorl" and one for "the Patient Deep"
   returned no matching published character or title. That is a spot check, not a clearance search; a
   minor prior use of a four-letter name cannot be ruled out. Nearest mythos names are Vorvadoss and
   Voorm, which are not confusable. Watch the word "Deep": "the Patient Deep" and "Deep Bell" are fine,
   "Deep One(s)" is another author's term and is banned.
5. **Potions (D-110).** In this batch the three potions are only delivered to entities, at their request.
   No code gives them any effect on followers yet. Calm Draught says "served openly". Moonlight Tincture
   says "strictly for entities". Zeal Tonic is "mostly bubbles and belief", an honest placebo. The recipes
   use Nightshade, which stays "not the real kind" (D-134). All three pass.
   **Zeal Tonic and the tiger: acceptable.** The tiger buys it knowingly and drinks it himself; nothing is
   slipped to anyone and the only loss is money. It is the same joke as the placebo kombucha in the tone
   guide, and the target is the con. Guardrails for when follower serving is built (GDD lists Zeal Tonic
   as Devotion and Calm Draught as Sanity): served openly and optionally; Calm Draught never makes anyone
   sleepy, quiet or compliant and never lowers Doubt or Suspicion; Zeal Tonic never lowers Doubt.
6. **Joke targets.** Leader, con or entity in every string. The tiger is a folktale foil, not a follower.
   `order.anansi_4.thanks` moves six followers around as a headcount; the butt is the leader being
   out-recruited by lunch, so it passes. No joke lands on a follower, a victim or a culture.
7. **Sources.** All six verified, see below.
8. **reviewNotes.** Tightened wording below.

## Sources (entities.json)

Checked by web search on 2026-11-15. Search-result summaries and catalogue listings only; I did not open
the books. All six are real publications with the author, title, publisher and year as cited. No
correction is needed; the fuller forms below are recommended.

| Cited | Result | Recommended citation |
|---|---|---|
| Johns, Baba Yaga | Verified (Peter Lang listing; Slavic Review notice) | `Johns, Andreas. Baba Yaga: The Ambiguous Mother and Witch of the Russian Folktale. International Folkloristics 3. New York: Peter Lang, 2004.` |
| Afanas'ev, Russian Fairy Tales | Verified (WorldCat, NYPL, publisher). One LibraryThing entry says 1946; catalogues and publisher say 1945 | `Afanas'ev, Aleksandr. Russian Fairy Tales. Trans. Norbert Guterman, commentary by Roman Jakobson. New York: Pantheon, 1945.` |
| Regal & Esposito, Secret History | Verified (hardback April 2018, paperback 2019) | `Regal, Brian & Esposito, Frank J. The Secret History of the Jersey Devil: How Quakers, Hucksters, and Benjamin Franklin Created a Monster. Baltimore: Johns Hopkins University Press, 2018.` |
| McCloy & Miller, The Jersey Devil | Verified. Co-author is listed as Ray Miller Jr.; most catalogues give Wallingford, PA, one gives Moorestown, NJ | `McCloy, James F. & Miller, Ray Jr. The Jersey Devil. Wallingford, PA: Middle Atlantic Press, 1976.` |
| Rattray, Akan-Ashanti Folk-Tales | Verified (Open Library, archive.org, 1930 reviews) | `Rattray, R. S. Akan-Ashanti Folk-Tales. Oxford: Clarendon Press, 1930.` |
| Marshall, Anansi's Journey | Verified | `Marshall, Emily Zobel. Anansi's Journey: A Story of Jamaican Cultural Resistance. Kingston: University of the West Indies Press, 2012.` |

Notes:
- McCloy & Miller is a popular book; Regal & Esposito is the academic one. Good pairing.
- Rattray is a 1930 colonial-era collection. Fine as a tale source; Marshall supplies the modern view.
- Recommended addition for Anansi, because Rattray's Akan tales do not contain Tiger:
  `Beckwith, Martha Warren. Jamaica Anansi Stories. American Folk-Lore Society, 1924.` The search confirmed
  author, title and year (it is on Project Gutenberg). I did not confirm the publisher line; check it
  before adding.
- The ASCII rule covers data/text only, but the citations above are ASCII anyway.

Pages used:
- https://www.peterlang.com/document/1098532
- https://search.worldcat.org/oclc/166025
- https://www.bookwire.com/book/USA/The-Secret-History-of-the-Jersey-Devil-9781421424897-Regal-Brian-61090590
- https://libcat.library.tamu.edu/Record/in00000358849
- https://openlibrary.org/books/OL4746421M
- https://aalbc.com/books/9789766402617
- https://www.gutenberg.org/etext/72735
- https://www.britannica.com/print/article/47337

Living communities:
- **Baba Yaga:** Russian, Ukrainian, Belarusian and other Slavic peoples, at home and in diaspora. The
  cited sources are Russia-focused; the figure is wider. Game text says "Slavic" and names no country.
- **Jersey Devil:** people of the New Jersey Pine Barrens, who have a history of being mocked as backward,
  and descendants of the Leeds family, whose name the legend carries.
- **Anansi:** Akan people of Ghana, and Jamaican and wider Caribbean and diaspora communities for whom the
  tales are heritage and, in the Caribbean, a history of resistance under slavery.
- **Vorl:** none. Original.

## Proposed reviewNotes (standing guardrails)

For the lead to paste into data/entities.json. These are developer notes; no code displays `reviewNotes`
or `sources` (only the type in src/core/data.ts mentions them). Keep it that way.

- **baba_yaga:** `Slavic folklore witch in a hut on chicken legs; ambiguous figure who tests visitors and rewards the polite and capable. Formidable and unimpressed; she judges, the leader is judged. Plain standard English: no accent, no dropped articles. Say 'Slavic', never a country; no food, drink, faith or politics jokes. 'Grandmother' is the tales' polite address; keep it sincere. Menace is fairy-tale, one clause, off screen, aimed at the leader or unnamed fairy-tale royalty. Never children, never followers, never detail.`
- **jersey_devil:** `American folklore creature of the New Jersey Pine Barrens (winged, hooved, horse-headed). A loud, petty neighbour. No real people, living or historical. Never the Leeds name, the 'thirteenth child' birth story, real towns or dated sightings; 'the pines' only. Never mock Pine Barrens residents or use the word 'Piney'. Casual voice, no phonetic accent, no ethnic or mob stereotype. Mischief is property-level (fences, mailboxes, power); he never hurts people or animals.`
- **anansi:** `Trickster spider of Akan (Ghana) folktales, carried to the Caribbean and the Americas; owner of all stories. Folktale figure only: clever, charming, a step ahead of the leader. Never call him a god. Never name or joke about the sky god or any Akan religious figure, rite or proverb. Standard English: no dialect or patois spelling, no 'Brer' forms. He wins by wit and bargains, never luck: no dice, cards or casino imagery. Foils are tale animals (Tiger, Snake) or the leader, never followers. No slavery or plantation jokes.`
- **vorl:** `Original creation for this game (D-104): a vast, patient thing in deep water. Cosmic-horror in tone only. No names, places, quotations or stock phrases from any published mythos: never 'Deep One(s)', 'Old One(s)', 'Elder', invented-language chants or New England place names. Its hunger is for candles, flowers and attention; it never takes, eats or harms anyone. Sanity effects are comic only (D-112).`

## Process notes (no action needed for this batch's text)

- **Jersey Devil and D-105.** D-105 lists four v1 patrons; the Jersey Devil is in LATER.md. Shipping him
  needs a DECISIONS entry (lead / game-designer). Content is cleared either way.
- **Lengths.** By hand count, three order lines run to about 95 characters (`order.baba_yaga_2.text`,
  `order.anansi_1.text`, `order.anansi_2.text`) and `order.vorl_4.thanks` is about 101. Not a content
  issue; qa-tester's overflow audit decides.
- **`orders.gamble` hard-codes "Anansi".** If another entity ever gets a gamble order the string will be
  wrong. systems-engineer / narrative-writer to note.
- **Tone guide.** After the lead confirms, I will add to TONE section 5: the Baba Yaga menace ceiling, the
  "no luck imagery for Anansi" rule and the Vorl banned-phrase list.
- **Field Notes.** None in this batch. docs/FIELD_NOTES_SOURCES.md still does not exist.


---
**Lead follow-up (same day):** `orders.gamble` changed as required and made entity-neutral (`{name} sets the share`); the optional Anansi 'flock' wording adopted; the kings line kept as the stated ceiling; guardrail notes and fuller citations pasted into `data/entities.json`; all four set to `approved`. The Jersey Devil's inclusion is logged as D-137. Internal docs and the balance key still say 'gamble'/'dice' as engineering terms only.
