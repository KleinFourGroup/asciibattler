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

### 161.5a — the warlock (2026-11-22)

**Step zero.** The audit holds at `bfb4d921`: the hex holds by `fill`,
the band is 2 to 5.

**A change inside the cut's intent, flagged.** Built first on the
punch's shape, the shot recovering by `fill`, the hex landed every 5.5 s
and not every 5.0 s: a shot holding the warlock for 1.2 s when the hex
came ready pushed the hex back every cycle (`scratch/161.5/cadence.ts`,
the warlock at its base stats beside a foe three cells off: seven gaps
of 5.50 s, 4 shots in each). With the shot recovering in 0.3 s, as the
hex does, the gaps are seven of 5.00 s, 4 shots in each. The cut signed
the hex's flat 5 s kept, so the shot recovers in 0.3 s; it also leaves
the warlock free to step away between shots. The punch and the scratch
keep `fill`, so the same push can hold back the Repulse or the Wail by up
to a punch's hold while a foe stands beside the caster; unmeasured, and
left as signed at 160g.

**Built.** `jinx` (`config/abilities.json`, after the scratch): 5 cells
with a floor of 2, the nearest foe in range, might 1 on `none`, crit
base 0, evadable, every 1.5 s speed-scaled (1.2 s at the warlock's speed
4), impact then a 0.3 s recovery, priority 10, the ranged shot's fx (the
`*` tracer and the shot's sound). Its line, a draft read at 161.5c: "A
spiteful little curse." The warlock carries `jinx, hex`. The hex: a
0.3 s recovery and priority 11; its flat 5 s, reach, floor and confusion
unchanged. `CASTER_SHOT_IDS` in the registry. DESIGN's scaling line and
Round 12's newcomers paragraph. `abilityDetail.test.ts`: the floored
count from 14 to 15, the jinx's floor of 2 (the floored ids in the raw
config: snag, grenade, charge, jinx, bow, magic_bolt, catapult_shot,
vial, ice_storm, hex, light_ray, chain_lightning, molotov, pistol,
pounce).

**Checked.** `src/sim/warlock.test.ts`, 2 tests, from the raw config:
the band is the hex's (reach 5, floor 2); beside a foe three cells off,
the hex first, a jinx between the first hex and the second, the warlock
unmoved, and the second hex one flat recharge after the first. Planted
(`scratch/161.5/161.5a-plants.json`, run in a worktree by
`scratch/161/wt-plant.sh`): 6 plants (the hex `fill` again; the hex at
the jinx's rank; no jinx; the jinx at a floor of 0; the jinx `fill`; the
jinx on `magic`), each caught, the control clean. **The corpus:**
predicted 0 to 8 of 34, only where a warlock fights
(`scratch/161.5/161.5a-prediction.txt`); 6 diverged on replay (the
gambler bits-300 chaos runs 2, 4 and 5, chaos-6, chaos-8-sectorHops-2,
chaos-13), and `scratch/161.5/attribute.ts` finds a hex in each one's
diverging battle and in no other journal of the 34. Re-recorded: no
journal changed beyond its config hash, the baseline's 6 rows did; the
replay after, 0 of 34, 21 of 21 command kinds, 49 event names.

**Read** (`batch`, at 161.5c):
`?seed=5&character=soldier&roster=mercenary:3,mercenary:3,warlock:3,warlock:3`,
and `?seed=5&character=soldier&firstNode=elite&encounter=darkMagicPosse` for an enemy
warlock. Wrong looks like a warlock standing for seconds after a hex
with a foe 2 to 5 cells off, a jinx before the hex when both are ready,
or a warlock walking into melee.

### 161.5b — the ice mage (2026-11-22)

**Step zero.** At `0a2713e7` the ice storm still holds by `fill` and the
ice mage's band is 2 to 5, as the audit found.

**Built.** `icicle` (`config/abilities.json`, after the jinx), the
jinx's shape: 5 cells with a floor of 2, might 1 on `none`, every 1.5 s
speed-scaled (1.125 s at the ice mage's speed 5), a 0.3 s recovery,
priority 10, the ranged shot's fx. Its line, a draft read at 161.5c: "A
flung shard of ice." The ice mage carries `icicle, ice_storm`. The ice
storm: a 0.3 s recovery and priority 11; its flat 2.5 s, reach, floor,
damage and freeze unchanged. `CASTER_SHOT_IDS` holds both shots. DESIGN's
scaling line and Round 12's newcomers paragraph. `abilityDetail.test.ts`:
the floored count from 15 to 16, the icicle's floor of 2.

**Checked.** `scratch/161.5/cadence.ts`, the ice mage at its base stats
beside a foe three cells off: fifteen gaps of 2.50 s between storms, 2
icicles in each, the ice mage unmoved. `src/sim/iceMage.test.ts`, 2
tests, the warlock's file on the ice mage's abilities. Planted
(`scratch/161.5/161.5b-plants.json`): 6 plants (the storm `fill` again;
the storm at the icicle's rank; no icicle; the icicle at a floor of 0;
the icicle `fill`; the icicle on `ranged`), each caught, the control
clean. **The corpus:** predicted 0 to 8 of 34, only where an ice mage
fights (`scratch/161.5/161.5b-prediction.txt`); 2 diverged on replay
(the gambler bits-300 chaos runs 5 and 64), each with an ice storm in
its diverging battle and no other journal of the 34 firing one
(`scratch/161.5/attribute.ts`). Re-recorded: no journal changed beyond
its config hash, the baseline's 2 rows did; the replay after, 0 of 34,
21 of 21 command kinds, 49 event names.

**Read** (`batch`, at 161.5c):
`?seed=5&character=soldier&roster=mercenary:3,mercenary:3,ice_mage:3,ice_mage:3`,
and `?seed=5&character=soldier&encounter=elementalTrio` for an enemy ice
mage. Wrong looks like an ice mage standing for seconds after a storm
with a foe 2 to 5 cells off, an icicle before the storm when both are
ready, or an ice mage walking into melee.

### The pane, on the four read URLs (2026-11-22)

At `e7ec1167`, in the Browser pane (Chromium, hidden), each read URL
driven by `__probe.drive({ seed: 1, policy: 'first', until: 'reward' })`
with a listener counting the impacts of the four abilities. The two
roster URLs seat the casters on the player's side (`run.team`: two
mercenaries and two warlocks, then two ice mages) and fire: 30 hexes and
72 jinxes, then 20 storms and 43 icicles. With `encounter=elementalTrio`
the drive met an enemy ice mage before the first reward: 7 storms and 18
icicles, on the enemy side. The Dark Magic Posse is an elite, and `encounter=` forces an
encounter only at nodes of its kind, so `encounter=darkMagicPosse` alone
met wolves and foxes; with `firstNode=elite` the warlock fights on the
enemy side, 12 hexes and 52 jinxes, and 161.5a's read URL above carries
it. The pane proves the wiring only: the look, the sound and the feel
are the user's read at 161.5c.

### 161.5c — the play, signed (2026-11-25)

**Signed** ("that's generally feeling nice ... signing everything
else!"), with the reads of 161.5a and 161.5b: the play; the names and
lines, the **Jinx** ("A spiteful little curse.") and the **Icicle** ("A
flung shard of ice."); the shots releasing their casters after 0.3 s
("I like the shots releasing after 0.3"), the change built inside the
cut's intent at 161.5a; the archer's shot sound on both shots ("fine for
now"). **One change, the user's:** the ice storm's recharge doubled to
5 s ("Ice Storm's cooldown should probably be doubled to 5s"), built as
161.5b-post. **For later:** the release after 0.3 s is "something to
experiment with for other ranged attacks", a Round 13 row in TODO.
