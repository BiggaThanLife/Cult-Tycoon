# Tone & Content Guide

Owner: lore-and-sensitivity-reviewer · Required reading before writing **any** player-facing text.

## 1. The voice
**Deadpan bureaucratic evil.** A corporate memo that thinks it's scripture. The leader is grandiose, vain, cheap and
incompetent. Entities are ancient, bored and terrible managers. Followers are earnest, sweet and slightly too trusting.
Short lines. Pixel UI means every word costs space: aim for ≤ 60 characters for pops, ≤ 140 for descriptions.

**Who is the joke?** The leader (vanity, hypocrisy, grift), the con's absurd mechanics, and the entities' pettiness.
**Who is never the joke?** Followers as people, victims or survivors of real groups, real cultures and faiths.

## 2. Do / Don't
| ✅ Do | ❌ Don't |
|---|---|
| "Wellness Retreat — Followers check in. Their bank details check out." | Anything implying a follower is physically hurt, starved or locked in |
| "A follower asked a question. Assign them to Latrine Duty: Eternal? [Yes] [Also yes]" | Jokes about followers dying, disappearing or being "taken care of" |
| "The Great Disappointment — Predict the end of the world. Be wrong. Predict it again." | References to real mass-casualty events, real dates, real comet/ship deaths |
| "Motivational Kombucha. Placebo. Effective placebo. We checked." | Drinks/potions that poison, drug, sedate or covertly dose anyone ("Kool-Aid" in any form) |
| "Amnesia Brew? Don't mind if I do." One sparkly sip, the last hour blurs. Kept the tote bag. (Named, offered, accepted.) | Gas, poison, weapons, violence or threats against the public or press |
| "The Mothman foresaw this. He foresees a lot. He's mostly right about the weather." | Any reference to the real bridge collapse or town tied to the Mothman legend (D-111) |
| Low Sanity: "Bartholomew has named the cabbage. The cabbage has accepted." | Depicting distress, breakdowns, or mental illness as the punchline |
| "Baba Yaga reviewed your hut. Two legs out of five." | Mocking Slavic (or any) culture, accents, food or faith |
| "The Patient Deep requests a candle. It does not need light. It wants to watch you get one." | Sacred rites or names from closed or living religious practice |
| Satirize tactics: "Love-Bombing Brunch: +20 Devotion. They'll never feel this loved again (until they question you)." | Romanticize tactics without a visible cost or a satirical edge |
| Pamphlet-Reading Room: "Re-education. Mostly fonts." | Real people, real group names, parody names that are one letter off a real group |

## 3. Hard limits (from CLAUDE.md, repeated so writers never miss them)
- No jokes whose target is real victims, deaths or survivors. No victim names. No real group names anywhere (D-010).
- No real living people. No sound-alike names of active groups or leaders.
- No mechanics or text involving self-harm, suicide, sexual abuse, child abuse, mass violence, poisoning, gas attacks.
- No on-screen harm. Followers leave, defect, doubt, or go to the Reading Room. Raids end with everyone shuffled onto a bus, grumbling.
- No children as followers. All followers are adults.
- Potions are openly offered and magical; nobody is dosed covertly (D-110). The Mothman never references the real 1967 bridge collapse (D-111).
- Romance/sexual content: none. "Leader's personal attention" tactics are not in the game.
- Teen / PEGI 12 target. Mild fantasy menace, mild crude humor. Flag anything above.

## 4. Allowed real-world nods (indirect only)
- The apocalypse date that keeps moving (generic, historically common pattern) → *The Great Disappointment* achievement.
- Luxury vehicle collections, branded merch, NDAs, celebrity recruitment, "levels" of enlightenment you pay to reach,
  multi-level marketing structures, love-bombing, schedule exhaustion, isolation from family. All as **generic tactics**.
- Never a specific date, place, uniform, logo, slogan or name traceable to one real group.

## 5. Mythology rules
- Mock the leader's ignorance ("The Prophet pronounced it 'Bobba Yogurt'"), never the source culture.
- Entities are portrayed as their folklore self, generally powerful and dignified *on their own terms*; they find the leader as ridiculous as we do.
- Use folklore figures, cryptids, public-domain literature or original creations. Avoid figures central to living worship
  or closed traditions without review (see DECISIONS D-104).
- Each entity in `data/entities.json` must have `sources` and `reviewStatus: approved` before it ships.

## 6. Field Notes voice
Calm, factual, non-sensational, second person, no jokes. "What it looks like / Why it works / Warning signs / Learn more."
Each claim cites a source in `docs/FIELD_NOTES_SOURCES.md`. No real group names in game text. Ends with a gentle note that
support resources exist (general, not crisis-hotline-specific unless verified).

## 7. Review checklist (every text batch)
- [ ] Target of each joke is the leader, the con, or an entity
- [ ] No hard-limit content; no real names; no sound-alikes
- [ ] Mythology entries have sources and show respect for the source culture
- [ ] Fits the UI length budget
- [ ] All strings are keys in `data/text/en.json`
