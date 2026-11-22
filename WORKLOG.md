# WORKLOG — Round 12 (Push, pull and blink)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 12's phases before this one are in
[archive/worklog-phase-158.md](archive/worklog-phase-158.md) (the kickoff,
§157, and the pre-step and the design, §158),
[archive/worklog-phase-159.md](archive/worklog-phase-159.md) (forced
movement, the seam),
[archive/worklog-phase-160.md](archive/worklog-phase-160.md) (the pushers
and the bursts),
[archive/worklog-phase-160.5.md](archive/worklog-phase-160.5.md) (the
fall) and
[archive/worklog-phase-161.md](archive/worklog-phase-161.md) (the blink
and the charge); Round 11's are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md).

## Phase 161.5 — the hex and the ice storm as specials

The kickoff's inputs, by pointer: what §161 hands on
(`archive/worklog-phase-161.md`, "§161's close"); the insertion
(`archive/worklog-phase-160.md`, "160g — the fourth answer"); ROADMAP
§161.5; `process/planning.md` "Phase kickoff".

### The kickoff's audit, and the cut put to the user (2026-11-22)

Read at `800e818a`. The shape asked for is the one 160d-post and
160e-post built for the telekinetic and the banshee (`e4cfad9a`): the
special recovers in 0.3 s and outranks a basic attack at priority 11,
its recharge unchanged.

- *The hold today.* Both specials recover by `fill`, so the caster
  stands until the recharge ends: the warlock 4.6 s after each hex (a
  flat 5 s; wind-up 0.15 s, travel 0.25 s), the ice mage 2.5 s after each
  ice storm, the whole of its flat 2.5 s (`scratch/161.5/holds.ts`, at
  each unit's speed). While held, neither can step away from a foe.
- *The band.* Both specials reach 5 cells with a floor of 2
  (`rangeCells` 5, `minRangeCells` 2 in `config/abilities.json`), and
  `rangeForArchetype` and `minRangeForArchetype` give 5 and 2 for both
  units (`scratch/161.5/band.ts`), so each holds 2 to 5 cells from its
  target and kites out when a foe comes closer (`engagementDirective`,
  `src/sim/positioning.ts`). The banshee's band is 0 to 2 and the
  telekinetic's 0 to 1, which is why a melee basic attack fits them. A
  ready ability outscores a step (`AbilityBehavior`), so a melee basic
  on these two would swing only at a foe already beside the caster;
  that is read from the code, not measured.
- *The floor goes with the first-listed ability.* `minRangeForArchetype`
  takes the floor of the longest-reaching ability, the first of equals
  winning, and a basic attack is listed first (the katana's
  convention). A basic at 5 cells with a floor of 0 would move both
  casters' band to 0 to 5 and stop their kite; at a floor of 2 the band
  is unchanged.
- *The stats the specials leave unread.* A strike's base damage is its
  `might` plus the stat its `scaling` names (`resolveScalars.ts`). The
  ice storm scales on nothing and the hex deals no damage, so the ice
  mage's `ranged` 6 and the warlock's `magic` 10 are read by neither. A
  basic at might 1 scaling on them would deal 7 and 11 a strike, as much
  as the archer's bow (might 4, `ranged` 3) or more, so a weak basic
  scales on nothing (or on `strength`, which both have at 0, as the
  punch and the scratch do).
- *The area-lock guard* (`src/config/abilities.test.ts`) reads the
  cooldown and the status duration, not the recovery, so changing the
  recovery leaves it as it is.
- *Where they fight.* Neither is draftable. The warlock: the Dark Magic
  Posse and the Miscreants (act 3), the ghoul nest camp. The ice mage:
  the Elemental Trio (act 3, also through an event), the frost coven
  camp. The roster dial seats either on the player's side, as §160 read
  the banshee; `encounter=` fields their encounters.
- *What a new ability carries* (from `e4cfad9a`'s files): its def, the
  unit's list, a line in `locales/en/abilities.json`, the registry's id
  list, a test file per carrier (`banshee.test.ts`'s shape), DESIGN's
  scaling line and Round 12's newcomers paragraph. That commit moved
  no snapshot.

The cut put to the user: two carriers, each `batch`, and the play a
`stop`, with one fork at the cut, the basic attack's reach. *A, ranged,*
the lean: a weak shot at a foe 2 to 5 cells off, might 1 on no stat,
every 1.5 s speed-scaled, a floor of 2 so the band and the kite stay,
the ranged shot's tracer and sound; about three shots between hexes and
one or two between storms. *B, melee,* the punch's shape: it swings only
at a foe already beside the caster, and the caster holds in its band
with nothing to do the rest of the time. Either way the 0.3 s recovery
frees both to step away between casts, which §162's board prices.

### The cut signed (2026-11-22)

**Signed** ("Fully signing the cut; I agree with range."): 161.5a and
161.5b `batch`, 161.5c the play a `stop`, the basic attack ranged (arm
A). The names and lines are drafts read at the play: the warlock's
**Jinx**, "A spiteful little curse.", and the ice mage's **Icicle**, "A
flung shard of ice.", as is the archer's shot sound on a mage.

**§161's two friction candidates, signed:** a premise used before it was
read (four times in §161) takes no new rule, as at §158's close; the
hidden pane's "not live" case, where calling `__probe.ready()` again did
not help and a resize with a reload did, is a fact line in
`process/browser-pane.md`'s "not live" bullet.
