# Review 2026-11-15: raids and inspections, standing guardrails

Reviewer: lore-and-sensitivity-reviewer
Checked against: CLAUDE.md "Content boundaries", docs/TONE_AND_CONTENT.md, DECISIONS D-008, D-009, D-010, D-110, D-112.
Also read: GDD section on Suspicion and events, ECONOMY.md (Raid Defense), `data/text/en.json` (raid, reporter, compound strings).
Scope: the owner's request for "police or some federal agency" visits to a side-view base. Nothing is designed yet.
These rules apply to every future design, text, art and Field Notes batch that touches the feature.

**Overall verdict: APPROVED WITH CONDITIONS.** The feature is allowed as a *civil inspection* (paperwork, permits,
taxes, health code). It is BLOCKED as an armed raid, siege, or "defend the compound" fight.

Working vocabulary for this doc: **inspection** = the player-facing event. "Raid" stays an internal/engineering word
only (see section 7 for the existing strings that must change).

---

## 1. Real-world history to steer clear of

This section is for writers' and designers' background only. **None of these names, places, dates or numbers may
appear in game text, art, item names or Field Notes** (D-010). Sources are listed in section 9.

| Event (internal reference only) | What happened, briefly | Motifs it makes off-limits |
|---|---|---|
| Waco, Texas, 1993 | A federal attempt to serve warrants on a religious group's residence on 28 Feb led to a gunfight (4 agents and 6 residents died), then a 51-day standoff. On 19 April, armoured engineering vehicles inserted CS (tear) gas; a fire destroyed the building and about 75 people died, more than 20 of them children. The 2000 Special Counsel report found the government did not start the fire. [1][2] | Standoff, day counter, armoured vehicles, gas, fire, helicopters, loudspeakers, cut utilities, compound-vs-government framing, children on site, apocalyptic "they are coming" prophecy |
| Philadelphia, 1985 | During a police operation at a group's rowhouse, an explosive device was dropped from a helicopter; the fire was allowed to burn. 11 people died, 5 of them children, and 61 homes were destroyed. The city's commission called it "unconscionable". [3] | Bombs, fire, police operations at a home, children on site |
| Ruby Ridge, Idaho, 1992 | An 11-day standoff at a family's cabin; a 14-year-old boy, his mother and a deputy marshal died. A 1994 Justice Department task force criticised the rules of engagement, including sniper use. It became a rallying symbol for the militia movement. [4] | Snipers, tactical teams, isolated cabin standoff, militia grievance narrative |
| Montana, 1996 | An 81-day standoff with a "sovereign citizen" group. It ended without bloodshed. [5] | Sovereign-citizen and fake-legal-theory tropes. Even a peaceful standoff is a standoff. |
| Arizona 1953 and Texas 2008 | Raids on religious communities in which hundreds of children were removed from families (in 2008, 468; the Texas Supreme Court let stand a ruling that the removal was not justified). [6][7] | Children taken into custody, buses of families, family separation, marriage/polygamy investigations |
| Guyana, 1978 | A congressman's fact-finding visit (with press and relatives) to a remote settlement ended in his murder at an airstrip and a mass death of residents. [8] Already covered by the "Kool-Aid" ban. | Official delegation visiting a remote settlement, press + relatives in the party, airstrips and plane departures |
| Oklahoma City, 1995 | The bomber cited Waco as a motive; the attack fell on its anniversary. [9] | Any inspection content pinned to a real calendar date, especially 19 April or 28 February |

### Motifs that must never appear, even indirectly
Applies to text, art, sound, UI, and event design.

1. **Sieges or standoffs.** No multi-day stand-offs, no "Day N" counters, no surrounding, no perimeter, no ultimatums,
   no negotiators, no phones to "the people outside", no megaphones or loudspeakers, no blasting music, no floodlights,
   no cut power or water, no "come out with your hands up", no surrender.
2. **Armoured or tactical anything.** No armoured vehicles, tanks, battering rams, helicopters, convoys, unmarked vans,
   SWAT/tactical gear, helmets, vests, shields, snipers, scopes, crosshairs, dawn raids, flashbangs, doors kicked in,
   walls breached. Inspectors knock, wait, and come in through the front door.
3. **Gas, smoke and fire.** No tear gas, smoke, flames, burning, explosions, alarms going off. Fire-safety comedy is
   limited to **objects** (an extinguisher, an exit sign). No flame icons or smoke art in inspection content.
4. **Countdowns.** No ticking timer to an inspection's arrival or during it. An inspection can be *announced* like an
   appointment ("Tuesday, between 9 and 4:30"), never counted down.
5. **Children.** No children on site, in custody, in dialogue or in art. All followers are adults (TONE section 3).
   No child-welfare, custody, marriage or family-separation investigations, ever.
6. **"Compound vs. government".** No fortifications, walls, watchtowers, guard posts, gates that lock against
   officials, armouries, stockpiles, bunkers, siege pantries, escape tunnels or hidden rooms. In inspection content,
   call the place "the premises" or "the retreat", not "the compound". The leader never prophesies a confrontation
   with authorities and inspectors are never framed as the apocalypse, the enemy or persecutors of faith.
7. **Militia and sovereign-citizen tropes.** No "I do not consent", "no jurisdiction", "free man", "strawman",
   fringed flags, "patriots", "jackboots", "the feds", "it's my constitutional right" speeches. The leader's excuses are
   about vanity and grift ("it's a donation, not a sale"), never anti-government legal theory.
8. **Real agencies, ranks and symbols.** No real agency names or acronyms, no lettered windbreakers, no badges, seals,
   eagles or stars resembling real ones, no police ranks (see section 3).
9. **Real dates and places.** No calendar-pinned inspection events, no real states, towns, counties or landmarks.
   Use "the county" or "the township" generically.
10. **Hiding people.** Players may hide *objects* (receipts, hoodies, an unlicensed cauldron). They never hide
    followers or the leader from officials: no closets, crawlspaces, buried vehicles or tunnels.
11. **Removing people.** Nobody is taken away. Followers leave by their own choice. The "everyone onto a bus" image is
    retired for this feature (section 7).

---

## 2. What is safe and funny

Target of the joke: the leader's panic, vanity and grift, and the absurd weight of paperwork. Inspectors are polite,
tired, thorough adults; they are not villains and not idiots. Followers are sympathetic and often helpful.

Safe material:
- Inspectors with clipboards, lanyards, cardigans, a thermos, a folding chair, a very long form.
- Tax audits, undeclared income, merch receipts, "tithes" that look a lot like sales.
- Zoning (40 bunks in a "single-family dwelling"), building permits, occupancy certificates, gutters.
- Health code for the Alchemy Lab and kitchen: hairnets, labels, a sink for hands only.
- Fire-safety *signage and equipment*: exit signs, extinguisher tags. No flames.
- An **inspection warrant** read aloud at length. (Administrative inspection warrants for building and health codes
  are a real civil tool [10], so the word is acceptable only in the phrase "inspection warrant".)
- The leader hiding merch receipts, rehearsing excuses, pretending to be "just the gardener".
- Rooms sealed with beige "PENDING REVIEW" tape; fines paid in Donations; followers helping the inquiry with biscuits.
- Office hours: inspections only happen in daytime business hours (this also rules out dawn-raid imagery).

### Ten example lines (ASCII, under 90 characters, deadpan bureaucratic)

| # | Line | Chars |
|---|---|---|
| 1 | The Office of Mild Concern would like a word. Possibly several thousand words. | 78 |
| 2 | An inspector is at the door. She has a clipboard. The clipboard has a clipboard. | 80 |
| 3 | The inspection warrant is read aloud. Section 9 is about gutters. There are 40 sections. | 88 |
| 4 | The Prophet is hiding the merch receipts in the altar. The altar is also undeclared. | 84 |
| 5 | Extinguisher last checked: never. The Prophet says it is 'decorative'. Fine: 40. | 80 |
| 6 | Health code: the Alchemy Lab needs hairnets. All of them. Even the cauldron. | 76 |
| 7 | Zoning says this is a 'single-family dwelling'. You have 40 bunks and a gift shop. | 82 |
| 8 | Bartholomew is helping with the inquiry. He brought biscuits. He brought receipts. | 82 |
| 9 | The Merch Tent is sealed 'Pending Review'. The tape is beige. It is very polite. | 79 |
| 10 | The Prophet asks if 'tithe' is tax-deductible. The auditor writes that down. | 76 |

These are approved as examples of voice. They still go through normal text review when added to `data/text/en.json`.
Note for writers: an earlier draft of line 5 had the Prophet call an exit "spiritual". Avoid any joke where "exit",
"leaving" or "the door" can read as a euphemism for death or for being locked in.

---

## 3. Naming

### Rules for any official body or official
- Never use these words in an agency name: Federal, Bureau, National, Agency, Service, Security, Intelligence,
  Investigation(s), Enforcement, Police, Constabulary, Marshal(s), Ranger(s), Trooper(s), Justice, Homeland,
  Public Safety, Revenue, Customs, Alcohol, Tobacco, Firearms, Explosives, Drug(s), Protective Services.
- **Never abbreviate** the agency in game text. No initialisms on screen, on uniforms or on vehicles. This removes
  any chance of an acronym collision.
- Checked against: FBI, ATF, IRS, DEA, DHS, CIA, NSA, US Marshals (USMS), ICE, CBP, TSA, FEMA, EPA, OSHA, FDA, state
  police and highway patrols, state bureaus of investigation (e.g. TBI, GBI), Departments of Public Safety (DPS),
  state revenue departments, child protective services; UK MI5, MI6, NCA, HMRC, SFO; Canada RCMP, CSIS, CRA;
  Australia AFP, ASIO, ATO; Germany BKA, BND; France DGSI, DGSE; Interpol, Europol.

### Agency candidates

| Name | Why it is safe |
|---|---|
| **The Office of Mild Concern** (recommended) | Uses none of the banned words. "Office" is generic. The name itself defuses menace and makes the joke about proportion. No real body uses it. Short enough for a 5x8 title (26 chars). |
| The Department of Forms and Further Forms | "Department" is generic; the rest is pure bureaucracy joke. Unpronounceable as an acronym, so no one will shorten it. |
| The Ministry of Paperwork | "Ministry" is a civil-service word in many countries and a church word, which fits the satire. No real ministry has this name; it targets paperwork, not policing. |
| The Regional Clipboard Authority | "Authority" is used for transit and housing bodies, not law enforcement. The clipboard is the visual gag. "Regional" avoids any real state or county. |
| The Committee for Being Up to Code | A committee is the least tactical body imaginable. Makes clear the violations are building and health code. |

### Local official candidates
Civil titles only. Never Sheriff, Deputy, Officer (alone), Agent, Special Agent, Trooper, Detective, Sergeant,
Captain, Commander, Constable or Marshal (including "Fire Marshal").

| Name | Role | Why it is safe |
|---|---|---|
| Building Inspector Ottoline Brisk | Zoning, permits, gutters | Civil title. Invented surname that describes her manner. |
| Auditor Percival Ledgerwood | Taxes, merch receipts, "tithes" | Civil title. Surname is a ledger joke, not a known person. |
| Compliance Clerk Dot Quillfeather | Health code, signage, hairnets | "Clerk" is as un-tactical as it gets. Invented surname. |

Before shipping any official's name, run a quick web search to confirm it is not a well-known living person.
Officials wear cardigans, lanyards and sensible shoes, carry clipboards and arrive alone or in pairs on foot or in one
small beige car. Maximum three officials on screen. No badges, seals, eagles, stars or lettered jackets.

---

## 4. Mechanic limits

### Never (BLOCKED)
- Weapons of any kind drawn, carried, stored, found or mentioned, by anyone.
- Arrests, handcuffs, custody, jail, prison, courtrooms with criminal charges, on or off screen in game text.
- Violence, injuries, damage to people, animals (the cat included) or property. Inspectors never break anything.
- Fire, smoke, gas, explosions.
- A standoff timer, a siege meter, a "days remaining" counter, an ultimatum.
- "Defend the compound" combat: no waves, no enemies, no health bars on officials, no barricades, no guards.
- Refusing entry, locking doors or gates against officials, or hiding people.
- Punishing followers who cooperated: they are never sent to the Pamphlet-Reading Room, shunned or fined for it.

### Allowed
- **Followers leave to "cooperate with the inquiry".** Shown warmly (tea, biscuits, a clipboard of their own).
  Recommendation to the designer: let some come back later ("back after the paperwork"); the GDD decides.
- **Rooms sealed with tape for a while.** Beige or pastel tape reading "PENDING REVIEW". Never yellow-and-black,
  never "POLICE LINE" or crime-scene styling. Seal durations stay short (CLAUDE.md: no grind walls, short timers).
- **Fines paid** in Donations (never in Followers). A fine may be reduced by fixing the violation.
- **Objects confiscated or "logged"**: undeclared hoodies, an unlabelled potion crate. Potions are inspected as
  labelling and hygiene matters only; never as drugs or poison (D-110).
- **The run-ending inspection (D-008)** closes the premises "pending review". The leader gets a fine and a very long
  letter, maybe a zoning hearing on a Tuesday. Followers go home by their own choice. No one is taken anywhere.
- **Telegraphing** (e.g. the Mothman's omens) is fine as an appointment notice, not a clock.
- Side-view base: cellars and lower floors are fine as storage, kitchens or laundry. They are never called bunkers or
  shelters and never used to hide people from inspectors.

### Verdict: a "look busy / tidy up the paperwork" match-3 ritual
**APPROVED with framing rules.** A match-3 about getting the paperwork in order before (or while) the inspector
looks around is consistent with the satire: the leader is scrambling to look legitimate, not resisting.

Framing rules:
1. The goal is **compliance theatre**, not resistance. Goals read like "File 12 permits", "Hang 3 exit signs",
   "Find the receipts", "Hairnet the cauldron".
2. Tiles are office and housekeeping objects: forms, stamps, receipts, mops, hairnets, labels, exit signs, coffee
   mugs. Blockers are "red tape", coffee stains, unsigned forms, dust. Never sandbags, boards, locks, chains, shields,
   weapons, or anything that blocks a door.
3. The inspector is never an opponent on the board: no health bar, no "attack", no "waves".
4. Move limits only, as now. No real-time timer, consistent with D-130.
5. Banned words in title, goals, callouts and results: defend, defence/defense, hold, hold the line, last stand,
   repel, resist, breach, storm, siege, standoff, fortify, barricade, enemy, attack, incoming, surrounded, perimeter,
   tactical, raid.
6. Winning = "Everything is in order. Suspiciously in order." Losing = a fine, a sealed room, or a very long form.
   Losing is never "they got in".
7. Suggested player-facing name: **"Look Busy"** (ritual) with purpose line "Inspection prep: look busy, look legal."
   Internal ID `defense` can stay.
8. Relaxed mode (D-014) works unchanged: it simply means the paperwork was always fine.

---

## 5. Rating check

**Confirmed: Teen / PEGI 12 is safe, with headroom, as long as sections 1 and 4 hold.** With no weapons, violence,
injury, drugs, gambling or fear content, inspections add no content descriptor under the ESRB or PEGI criteria [11][12];
the existing fantasy menace and mild crude humour remain the rating drivers. What would push it higher: weapons drawn
or used (violence descriptors), injuries or fire involving people, or realistic depictions of armed law enforcement.
Real-history allusions would not necessarily change the rating, but they break the project's own boundaries.

---

## 6. Reviewer checklist for any raid or inspection content

- [ ] Player-facing name is "inspection", "inquiry" or "audit", not "raid"
- [ ] Officials come from a fictional, never-abbreviated body with no banned words (section 3)
- [ ] Officials have civil titles, no police ranks, no badges, seals or lettered clothing
- [ ] Violations are civil only: tax, zoning, permits, health code, signage, labelling
- [ ] No siege, standoff, surrounding, ultimatum, negotiator, loudspeaker, floodlight or day counter
- [ ] No armoured or tactical vehicles, gear, snipers, helicopters, convoys, dawn or night visits
- [ ] No gas, smoke, fire, flames or explosions (signage and extinguishers only)
- [ ] No countdown or real-time timer; announcements read like appointments
- [ ] No children anywhere; no custody, family or marriage investigations
- [ ] No fortifications, guards, bunkers, tunnels, locked gates or refusing entry
- [ ] No militia, "patriot" or sovereign-citizen language; no persecution or end-times framing of officials
- [ ] No weapons, arrests, custody, injuries, damage; the cat is safe
- [ ] Nobody is hidden; only objects are hidden
- [ ] Nobody is removed; followers leave by choice and are not punished for cooperating
- [ ] No real agencies, acronyms, dates, places or events, including in Field Notes
- [ ] The joke lands on the leader's panic or on paperwork, not on followers or on officials as villains
- [ ] "Exit", "leaving", "the door" cannot be read as death or confinement
- [ ] ASCII, UI length budget, all strings are keys in `data/text/en.json`

Field Notes: an entry may describe the "us vs. them / persecution narrative" as a manipulation tactic in general
terms, cited per TONE section 6. It never describes a real siege, raid, standoff or its outcome, even generalized.

---

## 7. Verdicts on existing content touched by this feature

| Item | Verdict | Reason / change |
|---|---|---|
| Inspections as a feature (civil, per sections 2 and 4) | APPROVED WITH CONDITIONS | Conditions are sections 1, 3, 4 and 6 |
| Armed raid, siege or "defend the compound" framing | BLOCKED | Mirrors real mass-casualty events (section 1) |
| "Look Busy" match-3 ritual | APPROVED with framing rules | Section 4 |
| `ritual.purpose.defense` "Raid defense: look busy, look legal." | CHANGES REQUIRED before the feature ships | Change to `Inspection prep: look busy, look legal.` (ASCII, 39 chars) |
| GDD/ECONOMY "Raid Defense" ritual name | CHANGES REQUIRED (player-facing only) | Display as "Look Busy"; internal names may stay |
| "Raided" ending (D-008, GDD endings) | CHANGES REQUIRED (player-facing only) | Display as "Closed Pending Review"; internal ID may stay |
| TONE_AND_CONTENT.md section 3: "Raids end with everyone shuffled onto a bus, grumbling." | CHANGES REQUIRED (reviewer-owned; not edited in this pass per brief) | Buses carrying people away after a raid echo the 1953 and 2008 removals. Proposed: "Inspections end with the premises closed pending review. Followers head home on their own, grumbling. Nobody is taken anywhere." Lead to approve; reviewer will update the doc |
| Agency names (section 3) | APPROVED | Recommended: The Office of Mild Concern |
| Official names (section 3) | APPROVED, pending a name search before shipping | Section 3 |
| Ten example lines (section 2) | APPROVED as voice examples | Normal text review on entry into en.json |
| Tax Season Herald (GDD) | APPROVED | Seeded by ISO week, not pinned to a real date; keep it that way |

Lead: consider logging the player-facing rename ("inspection", "Look Busy", "Closed Pending Review") and the retired
bus image as a decision in `docs/DECISIONS.md`.

---

## 8. The five hard "never" rules (summary)

1. **No siege, standoff or countdown**: no surrounding, ultimatum, day counter, ticking timer or "defend the compound".
2. **No weapons, tactical gear or armoured vehicles**, and no violence, injury, damage or arrests, on or off screen.
3. **No fire, smoke, gas or explosions**; fire safety is signage and extinguishers only.
4. **No children**, and nobody is hidden, taken into custody or removed; followers leave by choice.
5. **No real agencies, acronyms, ranks, insignia, dates, places or events**, and no militia or sovereign-citizen tropes.

---

## 9. Sources

Sources may name groups and people; game text never does (D-010).

1. US Department of Justice, *Report to the Deputy Attorney General on the Events at Waco, Texas, February 28 to
   April 19, 1993* (1993). Executive summary:
   https://www.justice.gov/archives/publications/waco/report-deputy-attorney-general-events-waco-texas-executive-summary
   Chapters: https://www.justice.gov/publications/waco/wacotocpg.htm
2. Office of Special Counsel John C. Danforth, *Final Report to the Deputy Attorney General Concerning the 1993
   Confrontation at the Mt. Carmel Complex, Waco, Texas* (8 Nov 2000).
   https://www.policinginstitute.org/wp-content/uploads/2018/02/Danforth-Report-Waco-1993-Incident_11-8-2000.pdf
3. Philadelphia Special Investigation Commission, *Findings, Conclusions and Recommendations* (March 1986).
   Abstract: https://www.ojp.gov/ncjrs/virtual-library/abstracts/findings-conclusions-and-recommendations-philadelphia-special
   Context: WHYY, "MOVE at 40: Looking back at the 1985 commission",
   https://whyy.org/articles/philadelphia-move-bombing-40th-anniversary-1985-commission
4. US Department of Justice, Office of Professional Responsibility, *Report of the Ruby Ridge Task Force* (10 June 1994).
   https://www.justice.gov/sites/default/files/opr/legacy/2006/11/09/rubyreportcover_39.pdf
   Summary: History.com, "Ruby Ridge", https://www.history.com/articles/ruby-ridge
5. Encyclopedia of the Great Plains, "Freemen standoff",
   https://plainshumanities.unl.edu/encyclopedia/doc/egp.pd.022.html ; Spokesman-Review, 15 June 1996,
   https://www.spokesman.com/stories/1996/jun/15/fbi-comes-out-looking-good-on-this-one
6. History News Network, "The failed 1953 raid that shaped the relationship...",
   https://www.historynewsnetwork.org/article/the-failed-1953-raid-that-shaped-the-relationship- ;
   Martha Sonntag Bradley, *Kidnapped from That Land* (University of Utah Press, 1993).
7. *In re Texas Department of Family and Protective Services*, 255 S.W.3d 613 (Tex. 2008);
   https://supreme.justia.com/cases/texas/supreme-court/2008/2001209.html ;
   NPR, "Court Rules Children Were Illegally Seized" (30 May 2008),
   https://www.npr.org/2008/05/30/90995226/court-rules-children-were-illegally-seized
8. US House Committee on Foreign Affairs, *The Assassination of Representative Leo J. Ryan and the Jonestown, Guyana
   Tragedy* (Report of a Staff Investigative Group, 15 May 1979).
9. FBI, "Oklahoma City Bombing" (Famous Cases), https://www.fbi.gov/history/famous-cases/oklahoma-city-bombing
10. *Camara v. Municipal Court*, 387 U.S. 523 (1967) (administrative inspection warrants for housing-code inspections),
    https://supreme.justia.com/cases/federal/us/387/523/
11. ESRB, Ratings Guide, https://www.esrb.org/ratings-guide/
12. PEGI, What do the labels mean?, https://pegi.info/what-do-the-labels-mean
