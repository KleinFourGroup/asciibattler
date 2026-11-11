# WORKLOG — Round 11 (The roster)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 11's phases so far:
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) (the
kickoff, §148, and the stat sheet, §149),
[archive/worklog-phase-150.md](archive/worklog-phase-150.md) (the board's
instruments, §150),
[archive/worklog-phase-151.md](archive/worklog-phase-151.md) (the
content, §151),
[archive/worklog-phase-152.md](archive/worklog-phase-152.md) (the
weapons and defense, §152) and
[archive/worklog-phase-153.md](archive/worklog-phase-153.md) (power by
rarity, its growth key, and the pools, §153). Round 10's are
`archive/worklog-phase-142.md` to `archive/worklog-phase-147.md`.

## Phase 154 — the kits

The kickoff's inputs, by pointer: the charter, ROADMAP §154 (the idols'
sizes are there alone); META-ROADMAP §"Round 11 — The roster"; TODO's
Round 11 rows: the kit watches (the officer, the mercenary, the
halberdier, the stormcaller, the gunslinger, the adventurer, the rioter),
re-aimed here on the prior table v8's unit rows, BALANCE 2026-11-08 ("the
prior table v8"); the priest's and the gambler's parity against the
soldier; the area-status enemies' retune; the blind fix and the kiter's
case; the wolf's retreat. What §153 hands on, its close entry
(archive/worklog-phase-153.md); `process/planning.md` "Phase kickoff".
151f, the units' lines, lands here when the user writes them.

### The kickoff's audit, and the cut put to the user (2026-11-08, session 08067f79)

The audit at `e05ebb04`, each charter item against the code and the
prior table v8.

- *The kit watches,* read by BALANCE's rarity verification protocol (a
  negative row taken free is a kit question, a negative row bought with
  no grant read a price question, each disposition the user's). On v8's
  unit rows (BALANCE 2026-11-08): taken free, only the officer is clearly
  negative, −50.1 ± 17 (2.9 errors); the catapult (−25.5 ± 13), the
  rogue (−19.0 ± 10) and the adventurer (−19.8 ± 12) are under two.
  Bought, the mercenary −41.2 ± 12, the shaman −59.1 ± 22, the officer
  −68.8 ± 33 and the archer −31.2 ± 16. High, the mage free, +29.3 ± 14.
  v7's flags that v8 drops: the halberdier and the stormcaller free, the
  gunslinger and the adventurer bought, the rioter free. One character
  and one bot's play.
- *The officer.* His cane is might 0 on strength 1 (1.85 dealt a second
  on the stat sheet at act 1's normal fights, level 3, the lowest of any
  unit that attacks), and Inspire's aura gives allies within 4 cells +2
  mobility, which moves them faster and does nothing else. Power 2 since
  153b; his free row was −20.9 on v7 at power 1. Speed scales only an
  ability that sets `speedScaled`, and none ships one, so a speed aura
  would do nothing. *Wrong, found at 154e's stop:* `speedScaled`
  defaults to true and only the dash opts out, so speed quickens every
  other ability, and a speed aura would quicken allies' strikes.
- *The stormcaller* has the mage's stats and strike (the sheet's rows are
  identical) plus chain lightning's three jumps at 0.6 falloff, at a
  legendary's price (105) and power (3) against the mage's 45 and 1; on
  v8 −6.6 ± 13 against the mage's +17.6 ± 10. Its free row (+2.9 ± 16)
  makes it no kit question by the protocol; noted.
- *The idols:* Mars +4 STR, Diana +4 RNG, Hecate +8 MAG, one empower a
  turn each (the old Mars's three parts, §151's provisional sizes). The
  idols' rows with errors, by `scratch/154/item-worth.mjs` (152's units'
  reader generalized, matching the table's n and meanΔ on 12 of 12
  daemons and 16 of 16 units; before its reward-site sign was fixed it
  failed on all 12, the control): Hecate +79.7 ± 19 (4.3 errors; bought
  +80.7 ± 23, as a reward +77.2 ± 32), the strongest item signal in the
  table; Diana +23.4 ± 15; Mars unmeasurable, the Soldier's own start
  idol. Magic is the larger stat for a mage (about 11 at level 3 against
  an archer's ranged of about 4), but Hecate's strongest consumers have
  little: the healer's magic 4 and the shaman's 3, whose ghouls rise a
  level a point, so +8 triples a heal or lifts the ghouls eight levels.
- *Parity.* 150h read the priest −10.8 / −8.3 and the gambler −16.7 /
  −13.3 against the soldier on act 1 (clear rate in points; the band
  ±5). Since then Mars, the soldier's start idol, lost his +4 RNG and +8
  MAG (151c); Minerva and Janus are unchanged, and power's scale moves no
  starter (all common or uncommon). Unread at HEAD.
- *Blind.* The fallback stands (`src/sim/Targeting.ts:670`'s comment says
  so), so a blinded ranged unit fires to its full reach. TODO's row
  says "a plain archer still hits what is adjacent"; it does not: the
  bow fires at 2 to 3 cells. Under the user's lean (strike only inside
  blind's acquisition range, 1), every ranged attacker with a floor holds
  fire for the whole blind, 4 s: ten abilities, the bow, the magic bolt,
  the catapult shot, the vial, the ice storm, the hex, the light ray,
  chain lightning, the molotov and the pistol. So the charter's exit pin
  ("a blinded archer holds fire at 3 cells and fires at 1") cannot hold
  as written. The luminant alone blinds (the light ray, every 2 s at 2
  to 3 cells): act 2's witch-hunt boss and act 3's elemental trio. No
  draftable unit blinds.
- *The area-status enemies* are act 3's: the banshee's wail (panic), the
  ice mage's ice storm (frozen) and the warlock's hex (confusion), each
  on a 3×3 area. At act 3's level 14 (luck 6.9) each holds its area for
  most or all of its cooldown: panic 4.0 s every 4 s (the bandit Queen's
  banshee, fielded at twice the level, longer), confusion 6.1 s every
  3 s, frozen 2 s every 2.5 s. Each status is applied by that one
  ability alone, so a retune through the abilities' own numbers moves
  nothing else. *These figures leave out speed, wrongly (154e's stop):*
  each caster's speed shortens its cooldown.
- *The wolf* ships Bite (might 1, 1.5 s) on the bandit's body with the
  adventurer's mobility, a plain biter by construction. Gambit's retreat
  is a `move: retreat` op after the strike, config alone.
- *Also seen:* Cornucopia −36.3 ± 15 (2.4 errors), outside §154's
  charter; Round 17's (deck and daemons) to weigh.

**The cut** (no snapshot bump; no RNG stream added; seeded drives and the
corpus move where a run meets a changed unit):

- **154a — the parity read** (`none`, its call deferred to the next
  stop). 153c's two soldier lines and 150h's priest and gambler act-1
  lines, n = 120 each with `--per-encounter`, six rows at the cut's HEAD
  under v8, on the box (about 13 CPU-hours). Each character against the
  soldier on the shared seeds, against ±5; it also reads act 1 under v8.
  A character outside ±5 and told apart on the shared seeds goes to the
  user at the next stop: hold, or a lever on the character (its start
  idol's size, its roster, a draft weight). Nothing before that stop
  builds on it. Docs only; the smoke does not fire.
- **154b — blind** (`none`). `currentTarget` takes no fallback for a
  blinded unit, as for a confused one, so it strikes only inside blind's
  acquisition range; the kiter's case as signed. Pinned headless, the
  tests failing on HEAD first: a blinded archer holds fire at 3 cells
  (and at 1, or fires at 1, by the kiter's call); a blinded halberdier
  strikes at 1 and holds at 2; each strikes at range again when blind
  lapses. The comment at `Targeting.ts:670` rewritten. The smoke fires;
  the corpus re-recorded if a journal meets a luminant.
- **154c — the officer's kit** (`batch`). Inspire's aura +1 DEF beside
  its +2 MOB, the ability's and the status's lines to match. Read at the
  next stop: an officer's card reads the new line and an ally beside him
  shows the defense; wrong looks like the two disagreeing. His worth at
  154g. The smoke fires.
- **154d — Hecate's size** (`batch`). +8 → +4 MAG; Mars and Diana held.
  Read: Hecate's card and tooltip read +4 MAG. Her worth at 154g. The
  smoke fires.
- **154e — the area-status retune** (`stop`, a taste call in play). The
  wail, the hex and the ice storm through their own numbers, each status
  holding its area about half the time at act 3's level (the lean's
  numbers, in the message). The user plays act 3's fights by URL. The
  smoke fires.
- **154f — the wolf** (`stop`, a taste call in play, at 154e's stop).
  Harry: Bite's numbers with Gambit's retreat. The user plays act 1's
  wolfpack and canids. Act 1's wolf fights move; §155 re-pins act 1's
  bands. The smoke fires.
- **154g — the prior table v9 and the watches re-read** (`stop`, the
  decision point). The registry's recipe at the HEAD after 154f (about
  5 h of box); the units' and the idols' worth re-read with errors; each
  watched row's disposition to the user (hold, re-tier, re-price, named
  watch), the officer's and Hecate's first. If nothing after it moves an
  item's value, it stands as §155's prior-table rebuild.

*The stretch the sign opens:* 154a on the box first (no commit in the
tree until its last line launches), then 154b, 154c and 154d, then 154e
and 154f built and put together at one stop with 154a's read and 154c's
and 154d's batch reads.

The leans put with the cut: the kiter's case (A), every ranged unit with
a floor holding fire while blind, since it adds no rule beyond the reach
capped at blind's acquisition range and a floored unit already holds
fire point-blank; the officer's aura +1 DEF (the other arms a +2 STR
aura, or the officer re-tiered to uncommon); Hecate +4; the area-status
numbers, each about half its cooldown at act 3's level: the wail's
cooldown 4 → 6 s and its panic 2 s + 0.15 s a point of luck (at most
4), the hex's cooldown 3 → 5 s and its confusion 1.5 s + 0.15 s a point
(at most 3), the ice storm's frozen 2 → 1.25 s with its cooldown kept,
since it also strikes; the wolf given Harry; every other watch held
until 154g.

**Signed** (the user, 2026-11-08: "Signing the cut and your leans,
Claude! 😁"): the cut and its reads as put, and every lean: the kiter's
case (A), so the exit's pin reads a blinded archer holding fire at 3
cells and at 1; the officer's +1 DEF; Hecate +4; the area-status
numbers; Harry; the other watches held until 154g.

### 154a — the parity read (2026-11-08)

The numbers are in BALANCE (2026-11-08, the characters' parity on act 1
under the prior table v8): six rows at `8ebca66d`, one `cpx42`, 2 h 25
min. In short, against the soldier, regen / deploy:

- The priest −4.2 / −8.3, the regen row inside ±5 and not told apart,
  the deploy row outside and told apart (p 0.031).
- The gambler −16.7 / −13.3, both outside and told apart (p 0.0008,
  0.0009).
- 150h read −10.8 / −8.3 and −16.7 / −13.3. Three of the four gaps are
  where they were; the priest's regen gap narrowed, unpaired.
- The soldier under v8 against 153f's rows under v7: regen 79 → 85,
  deploy 115 → 113 of 120, neither told apart. Act 1's turn targets hold
  on both rows, and 153f's two kept deploy costs stay just under their
  bands.

*Its call, at the next stop* (signed: a character outside ±5 and told
apart goes to the user, hold or a lever on the character): the priest
on deploy and the gambler on both rows.

### 154b — blind (2026-11-08)

- `currentTarget` takes no fallback for a blinded unit, as for a confused
  one, so a blinded unit strikes only what `updateTarget` marked inside
  blind's acquisition range, 1. Pinned in
  `src/sim/statusBehaviorConsumers.test.ts`: a blinded archer holds fire
  at 3 cells (unblinded, it fires there) and at 1 (it marks the adjacent
  foe, and the bow's floor is 2); a blinded halberdier strikes at 1 and
  holds at 2 (unblinded, it strikes at 2); a blinded archer fires at 3
  again once blind is removed. On the code before the fix three failed,
  each at its blinded line after its control passed; the pin at 1 passed
  there too, since the floor already held fire at 1.
- The tests' units stand still by carrying no MovementBehavior (`still`
  in the test helper), not by a long move cooldown: a unit's first step
  needs no cooldown, and `addEffect` re-derives the stats, which drops
  the test's override. With the cooldown, the draft's archer at 1 kited
  to 2 on its first tick and lost its mark.
- The journal corpus: 0 of 34 journals differ (`npm run corpus`).

### 154c — the officer's kit (2026-11-08)

- Inspire's status, `inspired`, carries +1 defense beside its +2
  mobility; the ability's line reads "Nearby allies move faster and
  defend better." (config and locale), DESIGN's auras paragraph names
  both mods. `src/config/units.test.ts` pins the status's axes, mobility
  and defense, and fails on the status before the change (it read
  mobility alone).
- A headless probe (an officer with Inspire, a mercenary beside him):
  the mercenary's defense 2 → 3 and mobility 4 → 6 within five ticks.
- The corpus: 3 of 34 journals diverge (player-1-sectorHops-2,
  player-2-sectorHops-2-character-priest, chaos-1-sectorHops-2), runs
  that meet an officer; re-recorded once after 154f.
- *The batch read, at the next stop:* hovering Inspire's name on the
  officer's card shows the new line (seen in the pane), and an ally
  within 4 cells in battle wears the `»` pip. No card shows the +1
  itself, since a card draws the unit's base stats; the headless probe
  above is its evidence. Wrong looks like the old line. His worth at
  154g.

### 154d — Hecate's size (2026-11-08)

- Hecate's empower +8 → +4 MAG, her line to match (config and locale);
  Mars and Diana held. No test pins the size.
- The corpus: no journal beyond 154c's three diverges, so none meets
  Hecate.
- *The batch read, at the next stop:* Hecate's card and tooltip read
  "+4 MAG"; wrong looks like either still reading +8. Her worth at 154g.

### 154e — the area-status retune (2026-11-08)

- Through the three abilities' own numbers, as signed. The wail: its
  cooldown 4 → 6 s, its panic 2 s + 0.15 s a point of luck (at most 4;
  was 3 s + 0.15, at most 6). The hex: its cooldown 3 → 5 s, its
  confusion 1.5 s + 0.15 s a point (at most 3; was 4 s + 0.3, at most
  8). The ice storm: its frozen set on the op at 1.25 s (the status's own
  2 s stays the default), its cooldown kept at 2.5 s, since it also
  strikes.
- At act 3's level 14 (luck 6.9), by the formulas: panic 3.0 s every
  6 s (was 4.0 every 4), confusion 2.5 s every 5 (was 6.1 every 3),
  frozen 1.25 s every 2.5 (was 2 every 2.5). The bandit Queen's banshee,
  fielded higher, holds longer, at most 4 s of 6. Each status is applied
  by its one ability alone, so nothing else moves. *Wrong, found at the
  stop:* these use the base cooldowns, but speed shortens them, and the
  casters are fielded above level 14 (below).
- The corpus: six journals beyond 154c's three diverge (player-5,
  chaos-4-character-gambler-bits-300, chaos-5-character-gambler-bits-300,
  chaos-8-sectorHops-2, chaos-16, chaos-37), runs that reach act 3's
  casters.
- *The stop, in play:* the bandit Queen, the elemental trio, the
  miscreants and the dark magic posse; each area status should hold its
  area about half the time, not most of it.

### 154f — the wolf (2026-11-08)

- The wolf's Bite becomes Harry: Bite's damage (might 1 on strength,
  1.5 s, no crit base) moved to a 0.25 s windup, then the gambit's
  `move: retreat` on the impact, its swing on the windup. Bite is gone
  from the catalog, the registry, the locale and DESIGN's beasts line;
  no other unit used it. `src/config/units.test.ts` pins the wolf's
  ability and Harry's two ops, and rejects a planted Harry that advances
  instead.
- A headless probe (a wolf beside a mercenary, 80 ticks): it bites at
  tick 1, springs back a cell at tick 6, steps in again, and bites every
  32 ticks against the 30 of its cooldown, so its damage rate barely
  moves; it spends part of each cycle out of contact.
- The corpus: 24 of 34 journals now differ, act 1's wolf fights being
  common; re-recorded in the next commit.
- Two seeded pins moved with it, both in files outside the step: the
  journal tool's test needs a winning soldier run at three hops, and
  seed 1 now loses, so it takes seed 2, the smallest that wins (seeds 1
  to 12 driven: 2, 4, 7, 8, 10 and 11 win); the chaos census sees
  `buyPortPacket` change a run on its four seeds, so the kind moves from
  its blind list to its changing list.
- *The stop, in play:* the wolfpack and the canids (the bear's fight
  fields wolves too). A wolf should bite and spring back, not stand and
  trade; wrong looks like a stutter that never lands a bite, or one that
  never leaves contact.

### The corpus re-recorded after 154c to 154f (2026-11-08)

- `npm run corpus -- --record` after the four behaviour changes (154b
  moved no journal). On the new record the corpus's reach test failed:
  no row bought a unit or sold a packet any more (chaos 53 and chaos 37
  had). A survey of 80 (320 runs over its four dial sets) found no
  undialled run that buys a unit; chaos 64 on the gambler's dials, the
  shortest run that buys a unit or sells a packet, does both, so it
  replaces those two rows (33 journals, the table's comment says why).
  `corpus.test.ts` 37 passed, and a replay 0 of 33 differ.

### 154e's and 154f's stop (2026-11-10)

The user's read: "the effect stun locking is still happening in the
first three" (the bandit Queen, the dark magic posse, the elemental
trio), "Everything else passed": 154f's wolf in play and 154c's and
154d's batch reads. 154a's call is not yet answered.

*The cause is speed, not magic* (the user asked whether magic's scaling
was it; no duration scales on magic). `speedScaled` defaults to true
(`src/sim/effects/schema.ts:390`) and only the dash opts out, so a
cooldown shrinks to 1 − 0.05 a point of speed, floored at 0.4
(`config/stats.json`); and the casters are fielded above level 14. A
headless probe (`scratch/154/lock-probe.test.ts.txt`) played the four
fights from the play links on seeds 1 to 3 and read, each tick, which
player units carried each status:

| fight | caster | cooldown, base → real | status | longest lock | share locked |
|---|---|---|---|---|---|
| bandit Queen | banshee L22, spd 10, lck 9 | 6 → 3.0 s | panic 3.35 s | 36–39 s | 24–34 % |
| dark magic posse | warlock L35, spd 14, lck 13 | 5 → 2.0 s | confusion 3.0 s | 3–15.7 s | 0.7–12 % |
| elemental trio | ice mage L17–18, spd 10 | 2.5 → 1.25 s | frozen 1.25 s | 3.75–10 s | 2–9 % |
| miscreants | warlock L8–9, spd 6, lck 5 | 5 → 3.5 s | confusion 2.25 s | 2.25 s | 16–23 % |

In the first three the status lasts as long as the cooldown or longer,
so it chains on whoever stands in the area; the miscreants' warlock
never chains, which fits its passing. "Share locked" is of all player
unit-time, most of which is outside the area.

*The same probe with `speedScaled: false` on the three abilities* (a
temporary config edit, reverted): the cooldowns stay 6, 5 and 2.5 s at
any level, every duration's cap sits below its cooldown, and the
longest lock in all twelve runs is one application (panic 3.35 s,
confusion 3 or 2.25 s, frozen 1.25 s). The Queen's panic share falls to
9–20 %. The cost: the ice storm also strikes, and at the trio's level
it would hit half as often as it does now (every 2.5 s, not 1.25).

*Put to the user* (the message of 2026-11-10): `speedScaled: false` on
the wail, the hex and the ice storm, the signed numbers kept; the ice
storm's cadence a lean (keep 2.5 s with frozen 1.25, or 1.5 s with
frozen 0.75 to keep its damage rate near today's); 154a's call asked
again.

**Signed** (the user, 2026-11-10: "Signing your leans for all three!"):
`speedScaled: false` on the wail, the hex and the ice storm, the signed
numbers kept; the ice storm at 2.5 s with frozen 1.25 s, its damage
cadence halving at the trio's level; 154a held, the priest's and the
gambler's gaps for §155's board to read again (TODO's priest parity
row).

### 154e-post — the area locks unhasted (2026-11-10)

- `speedScaled: false` on the wail, the hex and the ice storm: their
  cooldowns stay 6, 5 and 2.5 s at any level, the signed durations
  kept. DESIGN's speed line and the schema's comment name them beside
  the dash.
- A rule in `src/config/abilities.test.ts`: an area ability that lays a
  status with a `behavior` keeps a flat cooldown, and that status's
  longest duration is shorter than the cooldown. It selects exactly the
  three, and on the config before the fix it failed at the ice storm's
  speed scaling.
- The lock probe on the built tree, the four fights on seeds 1 to 3:
  cooldowns 120, 100 and 50 ticks; the longest lock in every run is one
  application (panic 3.35 s, confusion 3 s or 2.25 s, frozen 1.25 s);
  the bandit Queen's panic share 9–20 % of player unit-time.
- The corpus: 4 of 33 journals diverged; re-recorded, and
  `corpus.test.ts` 37 passed, its reach whole.
- Seen beside it, not changed: the luminant's light ray recasts every
  1.1 s at the trio's level with a 4 s blind, so it can hold one target
  blind; blind took 2–3 % of player unit-time in the probe.

*154e-post's re-read* (the user, 2026-11-10: "I did the plays first,
Claude, and they're good, so you're clear to launch!"): the three
fights pass in play. 154e done; 154g launched.

### 154g — the prior table v9 and the watches re-read (2026-11-10)

The numbers are in BALANCE (2026-11-10, the prior table v9, and the
watches re-read on it): the registry's recipe at `07ce8ed5`, 4 h 54 min
of one `cpx42`, 32.3 CPU-hours; 36 items, 35 over the floor, Hecate (65)
under it. What it says:

- *The bank completed 97 of 120 runs* against v8's 80 (paired 22 : 5,
  p 0.0015), and act 3's defeats fell from 14 to 2. Act 3 is where the
  area locks act, but the bank's prior changed too (v9's bank ran under
  v8, v8's under v7), so neither cause is isolated. §155's board
  records acts 2 and 3; act 3's band is Round 22's.
- *The units' moves are the table's noise*: an rms of 0.85 errors over
  16 units, none past two. The officer's +18.7 is 0.95 errors, and
  units whose own kits §154 left alone moved further (the halberdier −30.5, the
  reaver −26.0, the stormcaller +25.4), so the table cannot read his
  +1 DEF. He is still the lowest unit pooled, −36.0 ± 14 (2.7 errors),
  as on v8 (−54.7 ± 14) and in v4's book, when a rare's power was 1.
- *Hecate*, +79.7 ± 19 → +0.5 ± 23, a move of −79 ± 30 in the
  direction the cut aimed. Her n fell under the floor because v8's prior
  had the bank take her at every offer (29 of 29 at the port, 36 of 36
  as a reward), so she is met about once a run.
- *The idols swing past their errors between any two tables*: an rms of
  1.45 errors (v7 → v8: 1.44), the economy idols down at v8 and up at
  v9. Cornucopia, −36.3 at the kickoff, reads +10.5 ± 16.
- *Bought, 15 of the 16 unit rows read below the null* (mean −32.4; v8
  13 of 16, −23.0); taken free, 11 of 16 (mean −6.3).
- *Every character starts with four to six mercenaries* (the soldier
  six, the priest six, the gambler four), so a mercenary recruited is
  always a fifth to seventh copy.
- The readers' checks: n and meanΔ equal the table's on 16 of 16 units
  and 12 of 12 idols; a planted 0.01 on the officer and on Hecate reads
  one mismatch in each family; on v8's sources the reader reproduces
  153g's units.

*Also found:* the kickoff's false speed claim (corrected at 154e's stop)
had taken a speed aura off the officer's options too. Speed quickens
every ability but the dash and the three area locks, so +1 speed on
Inspire's aura would quicken nearby allies' strikes: at acts 1 and 2,
where the draftables' speed runs about 5 to 10, by 7 to 11 % (the
cadence reads the caster's effective speed at each cast,
`src/sim/effects/propose.ts`).

*Put to the user* (the message of 2026-11-10), the leans:

- Hecate: hold at +4 MAG; Diana held.
- The officer: Inspire's aura gains +1 speed beside +2 mobility and +1
  defense, a `batch` read, §155 rebuilding the table. The alternative:
  hold, a named watch for Round 13 (the unit kit), and v9 stands as
  §155's table. A re-tier is not the lean: he read lowest in v4's book
  at power 1 too.
- The mercenary: hold, a named watch; his recruit row reads a fifth to
  seventh copy as much as his kit.
- The halberdier: hold, a named watch (free −12.7 ± 16; his bought row
  +26.1, −32.0, −81.7 on v7 to v9 at n 38 to 60).
- The stormcaller and the gunslinger: hold, off the watch list (pooled
  +18.8 and +11.5, free +34.7 and +29.5).
- The adventurer, the rioter and the rogue: hold until Round 13 gives
  them back their dodge; the rogue named beside them, v9's strongest
  unit signal (pooled −29.5 ± 9, 3.4 errors; free −31.0 ± 11).
- The catapult and the shaman: named watches (the catapult free
  −49.2 ± 19; the shaman pooled −27.9 ± 14).
- The port's unit prices as a level: a named watch in TODO, a price
  question only with a grant read (the protocol's step 3).
- Cornucopia's flag dropped; the idols' swing between tables a TODO
  row, since a row read on one table can flip on the next.
