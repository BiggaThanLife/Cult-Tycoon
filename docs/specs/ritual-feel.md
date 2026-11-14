# Spec — Ritual feel (match-3 feedback)

Owner: ui-ux-designer (feedback) and puzzle-engineer (rules). Goal: every match should feel good in the hands, in the
style of the big match-3 games, without any of their monetization hooks.

**Why replay:** satisfying cascades and a visible star reveal make chasing 3 stars and par worth a second attempt.

## Principles
1. **Every input answers within 100 ms**: a sound and a movement, even for an invalid swap.
2. **Escalate with the chain.** Each cascade plays a higher note (pentatonic scale), shows a bigger score pop and, from
   the second cascade, a named callout. The chain itself is the reward.
3. **Show where the points went.** Collected goal tiles fly to their counter, the counter pops when they land, and the
   score rolls up rather than jumping.
4. **Big tiles get big moments.** Line, bomb and sigil each have their own flash, sound, shake strength and haptic length.
5. **End on a high.** A win shows a banner, converts leftover moves into score one chime at a time, then reveals stars one by one.
6. **Never punish.** No lives, no timers, no "almost!" pressure, no paid boosters. A loss is one line and a free retry.

## Feedback table
| Moment | Visual | Sound (`sfx`) | Haptic |
|---|---|---|---|
| Level start | Tiles rain in column by column, squash on landing | `intro` | — |
| Select a tile | Outline + gentle pulse | `tap` | — |
| Valid swap | Tiles trade places with a slight overshoot | `swap` | — |
| Invalid swap | Swap and return; stuck tile shakes | `invalid` | 12 ms |
| Match clears | Cell flash, tile pops (grow then shrink), 6 coloured particles, `+score` | `match(combo)`: pitch rises per cascade | 8 ms |
| Goal tile collected | Tile flies to its goal counter; counter pops and turns green when done | `collect` | — |
| Special forged | Sparks, the new tile pops from 1.6x | `create` | — |
| Special resting | Overlay breathes | — | — |
| Line fires | White beam along the row or column, light shake | `line` | 20 ms |
| Bomb fires | Yellow 3x3 flash, gold sparks, medium shake | `bomb` | 35 ms |
| Sigil fires | Whole-board flash, strong shake | `sigil` | 50 ms |
| Tiles land | Squash and settle | `land` | — |
| Cascade 2 / 3 / 4 / 5+ | Callout: Blessed! / Divine! / Unhallowed! / ASCENDED!, score pop doubles, shake from 3 | `combo` | — |
| 3 or fewer moves left | Moves counter turns red and pops on each move | — | — |
| No moves left on board | "Reshuffling..." callout, tiles glide to new places | `reshuffle` | — |
| Idle 5 s | The two hint tiles wiggle, pause, wiggle | — | — |
| Win | "Ritual Complete!" banner with sparks | `win` | 40 ms |
| Leftover moves | Each move ticks down, +50 score, a random tile hops and sparkles | `tick(i)` rising | — |
| Result card | Stars land one at a time from 2x size | `star(i)` | 15 ms each |
| Loss | Board dims | `lose` | — |

## Rules of the leftover-moves bonus (engine)
On a win outside relaxed mode, each unused move adds `MOVE_BONUS` (50) to the score, emitted as one `bonus` snapshot.
It rewards finishing early and feeds the star rating. Star thresholds in `data/levels/rituals.json` were re-measured with the bonus included.

## Accessibility
- **Reduced motion:** no particles, shake, squash, pops or rain-in; tiles fade and slide at 60% duration; callouts appear without scaling; hints use a static outline. All counts, callouts and sounds remain.
- **Sound and haptics** have one toggle in Settings. Audio starts only after the first tap (browser rule) and fails silently if unavailable.
- Tiles are told apart by shape first, colour second.

## Tuning
All durations live in `FEEL` at the top of `src/screens/rituals.ts`; all sounds in `src/ui/sfx.ts`. Feedback never changes rules or scores.

## Not done yet
Music, per-tile idle animation, streak-across-levels rewards, colourblind palettes.
