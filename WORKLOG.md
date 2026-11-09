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
  would do nothing.
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
  nothing else.
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
