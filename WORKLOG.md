# WORKLOG — Round 12 (Push, pull and blink)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 12's phases before this one are in
[archive/worklog-phase-158.md](archive/worklog-phase-158.md) (the kickoff,
§157, and the pre-step and the design, §158) and
[archive/worklog-phase-159.md](archive/worklog-phase-159.md) (forced
movement, the seam); Round 11's are
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) to
[archive/worklog-phase-156.md](archive/worklog-phase-156.md).

## Phase 160 — the pushers and the bursts

The kickoff's inputs, by pointer: the signed design, `round-12-spec.md`
"Tranche 2A" and "Tranche 2B" (the four newcomers draftable, each also an
enemy in one act-2 or act-3 encounter; the whirlwind a special on the
ronin; the lines the session's drafts, read at the phase's stop); what
§159 hands on (`archive/worklog-phase-159.md`, "§159's close"); ROADMAP
§160; `process/planning.md` "Phase kickoff".

### The kickoff's audit, and the cut put to the user (2026-11-17)

Read at `d42b717c`.

- *The burst on its caster.* A caster-anchored aoe proposes through
  `proposeCasterAnchoredBlast` (`src/sim/effects/propose.ts`), gated only
  on a victim in the blast now; its reach is its radius
  (`engagementReach`), so its carrier closes to the radius; `affects:
  'enemies'` leaves the caster out. No shipped def uses it; synthetic defs
  pin the propose arm.
- *Its look is missing.* The action surfaces no cell
  (`EffectAction.phaseTarget`), and `spawnBurstFx`'s explosion returns
  without one (`src/render/BattleRenderer.ts`, the `explosion` branch), so
  a self-centred burst would draw nothing; the explosion's ring is sized
  for a 3×3 (`spawnExplosion`).
- *The push from a centre.* `from: 'center'` on the `push` op
  (`schema.ts`), the interpreter's origin the blast's centre and a victim
  on it pushed away from the caster (159c); the slide's look and sound
  are §159's, so a knockback needs no render work.
- *A new unit.* `Archetype` is a string (`src/sim/Unit.ts`), so neither
  snapshot bumps. The beasts' commit (`76232d8c`) names the registrations:
  `config/units.json`, `config/abilities.json`, both records in
  `config/fuzz-strategies.json`, the two locale files, the ability
  registry. A draftable adds a base price (`config/prices.json`), a
  prior-table row or a PENDING acknowledgment
  (`tests/prior-table-coverage.test.ts`, rule 1), and every ability a
  description (151e's test).
- *The draft pool is one pool by rarity* (`DRAFTABLE_BY_TIER`,
  `src/run/Recruitment.ts`), not per act. A draftable newcomer changes the
  picks of its tier, so it moves most of the corpus: `--record` at each.
- *Glyphs.* Free letters include d, e, E, k, K, n, N, t, T, x, X; the
  atlas holds 40 of 128 cells. The glyph sampler (144b) draws candidates
  on the real board: `?bp=board-open15_pose-sampler&glyphs=…`.
- *The banshee:* the Wail, an aoe on a target cell at range 4, radius 1,
  panic; enemy-only, in the Bandit Queen (act 3's boss) and the
  banshee-barrow camp. *The ronin:* the katana alone, uncommon, 30; an
  enemy in the Ronin and the Mages, Brigand Champions and the Witch Hunt
  (act 2) and the Bandit King (act 1's boss), so the whirlwind reaches
  act 1.
- *"Snipers slow and heavy"* (the user's guidance for new units, §152)
  is cadence and might: it applies to the grenadier.

**The cut, put to the user.**

- **160a — the glyphs** (`stop`): two to four candidates each for the
  grenadier and the telekinetic in the sampler, beside the shipped glyphs
  they could be taken for, a lean each. No commit.
- **160b — the burst drawn on its caster** (`none`): a caster-anchored
  blast's explosion at the caster's live cell, its ring sized to the
  radius. Exit: a render pin with its planted failure; no sim touch, the
  smoke silent, the corpus unchanged. Its look read at 160g.
- **160c — the grenadier** (`batch`): a draftable ranged unit; the
  grenade an aoe on its target's cell, radius 1, a knockback of 1 from
  the centre, slow and heavy; a line; an enemy in act 2's Artillery
  Company. Exit: a test from the raw config that the foes around the
  centre land one cell out. Predicted: the smoke fires; most of the
  corpus moves (`--record`). Read: its URL; wrong looks like a grenade
  that moves no one, or a grenadier that walks into melee.
- **160d — the telekinetic** (`batch`): a draftable unit whose one
  ability is a burst on itself, radius 1, a knockback of 2, magic; a
  line; an enemy in act 3's Dark Magic Posse. Exit: a test that the burst
  throws every adjacent foe two cells and never its caster. Predicted as
  160c. Read: its URL; wrong looks like a telekinetic that hangs back, or
  foes that never land.
- **160e — the banshee's burst** (`batch`): the Wail anchored on the
  banshee, radius 2, the panic kept; still enemy-only. Exit: a test that
  it panics foes within two cells of the banshee and no farther.
  Predicted: the corpus moves only where a banshee fights. Read: a URL
  with banshees; wrong looks like a banshee screaming from afar.
- **160f — the ronin's whirlwind** (`batch`): a second ability on the
  ronin, a burst on itself at radius 1, strength, on a longer cooldown
  and over the katana's priority. Exit: a test that it hits every
  adjacent foe and the katana swings between. Predicted: the corpus
  moves where a ronin fights or is drafted. Read: its URL; wrong looks
  like a whirlwind with no one beside it, or no katana between.
- **160g — the play** (`stop`): the four in play, the push's distance and
  feel on units in play, the bursts' look and sound, the drafted names,
  lines and numbers, rarities, prices and encounters.

**Leans built on, listed at the reads:** the grenadier uncommon on the
archer's stat line with the slow, heavy cadence; the telekinetic rare on
the mage's; the whirlwind firing with a single foe beside the ronin (no
minimum count, since the schema has none); sounds reused (the grenade
the catapult's impact, the bursts the bolt's, the whirlwind the melee
swing), a new cue only where 160g asks. The priors: a PENDING
acknowledgment for each newcomer, measured at §162's board.

**Signed** ("Signed with all of your leans!"): the cut and its reads as
put, every lean above, and §159's friction candidate on its lean (no new
rule; the `execSync` line added to `process/shell-and-windows.md`, after
a check: `execSync('echo a^b')` printed `ab`). The stretch: 160a's stop
first, then 160b to 160f with their `batch` reads, to 160g's stop.

### 160a — the glyphs, put (2026-11-17)

In the sampler at
`?bp=board-open15_pose-sampler&glyphs=U+00F0,U+00F3,O,n,h,e,c;k,K,h,H,t,U+E004`,
each candidate beside the shipped glyphs it could be taken for (the
officer's `O`, the healer's `h`, the catapult's `c`; the halberdier's `H`,
the tiger's eared `t`, U+E004). All six drew from the shipped faces in the
pane, none refused; the atlas grows by two. **The grenadier:** `ð` (U+00F0,
Latin-1, shipped), a round body with a stroke rising from it, a grenade
and its fuse that is still a letter (the lean); `ó` (U+00F3), the same
idea nearer the officer's `O`; `n` and `e`, plain letters from the name,
near the healer's `h` and the catapult's `c`. **The telekinetic:** `k`,
for kinetic (the lean); `K`, nearer the halberdier's `H`; `t`, rejected
in the lean as the tiger's eared `t` without its ears.

### 160a — the soldiery's radical, drawn (2026-11-17)

**Signed:** `k` for the telekinetic ("I love k for the telekinetic!").
The grenadier's `ð` was turned down as decidedly not ASCII; the user
asked for `g` or `G` with a new radical beside the ears, one that more
units could wear. A hat over the letter was liked and then set aside for
a mark flanking the sides, as the ears do, so any letter in either case
can wear it ("the hat directly above would force us to lowercase only
for all soldiery"). The session's lean, epaulettes at the top corners:
the corner slot then says what kind of unit it is (ears a beast,
epaulettes a soldier), and the two never stack.

**Drawn** in `scratch/160a/` (ignored by git): `radicals/*.svg`, a
`glyphs.json` of trial rows at U+E020 to U+E025, and `build.ts`, which
composes `trial.otf` with the production builder
(`tools/font/glyphFace.ts`); `trial-c.otf` is the copy the sampler
loads. A first pass at a 165-wide, 170-tall board read as quote marks and
dashes at 150 px, much weaker than the ears (180 by 280), so both were
redrawn at the ears' size. The candidates: a flat board with three
strands of fringe (U+E020 `g`, U+E022 `G`), the classic rounded pad with
the same fringe (U+E024, U+E025), and a plain board sloping down and out
(U+E021, U+E023). At 120 px in the pane the sloping board reads as an
acute and a grave accent, rejected in the lean; the flat board reads a
little like a comb. The URL:
`?bp=board-open15_pose-sampler&glyphFace=/scratch/160a/trial-c.otf&glyphs=g,U+E020,U+E024,U+E021,U+E000;G,U+E022,U+E025,U+E023,U+E001`.
The board-size read is the user's: the pane's board was too small to
judge.

**The pick** (2026-11-18): the rounded pad with fringe, on `g` ("I like
the rounded with fringe! And I'm good with g also!"); the trial's U+E024.
The user asked whether the officer should wear it too. Drawn for that
read: the officer's `O` with it (U+E026 in `trial-d.otf`), beside the
plain `O`, `Ö` and `Q`, at
`?bp=board-open15_pose-sampler&glyphFace=/scratch/160a/trial-d.otf&glyphs=O,U+E026,U+00D6,Q;g,U+E024,U+E000`;
at 130 px in the pane the epaulettes sit wide of the letter, beside its
upper half, where the umlaut's dots sit close above it. What a shipped
glyph change touches: the glyph rides in the WorldSnapshot's units (no
player keeps one) and in the promotion screen's event payload
(`src/core/events.ts`), so the corpus's event digests move for runs that
promote an officer; `corpus.ts` allows `--rebaseline` after a replay
mapped back to the old glyph shows nothing else moved.

### 160a — the epaulettes shipped (2026-11-18)

**Signed** ("Fully agreed, Claude! 😁 The officer looks great with the
epaulettes, but the mercenary and the halberdier definitely don't
thematically fit."): the officer wears them; the rule is officers and
elite troops, the line infantry and hired swords plain.

**Built.** `radicals/epaulettes.svg` (the trial's rounded pad with three
strands of fringe), and two rows in `glyphs.json`: U+E020 `g.epaulettes`,
the grenadier's, unused until 160c adds the unit, and U+E021
`O.epaulettes`, the officer's, now in `config/units.json`. `npm run
gen:font`: 10 drawn glyphs, the atlas's 40 live glyphs all in a shipped
face (the officer's `O` out, its new glyph in). The face's README and
DESIGN's glyph paragraph name the soldiery's family and the rule.

**Checked.** The glyph-face and font-coverage tests and the sampler's,
102 of 102: the rebuild byte-identical to the committed woff2, and every
drawn glyph's ink inside the atlas cell's room (the epaulettes' top 688
units above the baseline against 839). The corpus: predicted to move in
the promotion screen's payload for runs that promote an officer;
**0 of 34 differ**, since the corpus digests battle events, none of
which carries a glyph, and the end's hash holds none, so it cannot see a
glyph. What carries the claim instead: a search of `src/sim`, `run`,
`bot`, `core` and `journal` for reads of `.glyph` finds only copies
(the archetype lookup, the unit's constructor, the World's spawn,
snapshot and restore), no branch; the same search over `src/render`
finds its reads, the control. The officer's swap moves nothing but what
is drawn.

### 160b — the burst drawn on its caster (2026-11-18)

**Step zero.** The audit's gap holds: `spawnBurstFx`'s explosion
returned without a surfaced cell, and a caster-anchored action surfaces
none. `onActionPhase` already reads the ability's def, so the renderer
can tell an aimed blast from one on its caster without the sim saying
more. Every shipped explosion (the bolt, the vial, the molotov, the ice
storm, the hex, the wail) is aimed, radius 1, so a ring sized by radius
leaves them all as they were. No `BattleRenderer` test exists (it needs
WebGL), so the decision moved into a pure function for the pin.

**Built.** `src/render/burstPlacement.ts`: `explosionPlacement(selector,
targetCell, casterCell)`, the surfaced cell for an aimed blast and the
caster's live cell for one on its caster, the ring 1.1 world units a
cell of radius. `BattleRenderer` passes the def's selector to
`spawnBurstFx`, which draws what it returns; `EXPLOSION_RING_SPREAD`
moved to the new module. ARCHITECTURE's render tree.

**Checked.** `burstPlacement.test.ts`, 3 tests: every shipped explosion,
read from the raw config, drawn on its cell with the ring at 1.1, its
value before; a burst on its caster drawn on the caster's cell, at 2.2
for radius 2; nothing drawn with no cell. Planted
(`scratch/160/160b-plants.json`, run by `scratch/159/plant.ts`): 4
plants, each caught, the clean file green. Typecheck clean. In the pane,
on `?seed=5&character=soldier&roster=mage:3,mage:3,mage:3` driven
through the first fight: 17 explosions, every ring 1.1, so the bolt
reaches the new path unchanged. No caster-anchored blast ships yet; its
first draw is 160d's. No sim touch: the smoke silent, the corpus
unchanged by construction.

### 160c — the grenadier (2026-11-18)

**Step zero.** The rioter's Molotov is the shipped thrown blast (range 4,
floor 2, radius 1 on the target's cell, the vial's arc), so the grenade
is its sibling: `ranged` scaling, a heavier, slower throw (snipers slow
and heavy: the bow is might 4 every 2.5 s; damage is might plus the
scaling stat) and a knockback from the blast's centre. A new draftable
trips more than the beasts' four registrations: every weight vector,
the default and the five fixtures (gotcha #124, appended at weight 0);
the prior table's and the roster table's coverage (a PENDING each); the
units file's field order (the formatter writes `rarity` before
`retargetOnLosLoss`); the ability card's count of abilities with a floor
(11 to 12, the grenade's 2); and the seeded run the two resume tests
need to complete, since the draft pool grew.

**Built.**

- `grenadier` (`config/units.json`, after the officer): `g` with the
  epaulettes (U+E020), uncommon, the archer's stat line and growth,
  `retargetOnLosLoss` as the archer; base price 28.
- `grenade` (`config/abilities.json`, after the snag): range 4, floor 2,
  a radius-1 square on the target's cell, the ring at half damage; a
  0.3 s wind-up, the vial's throw over 0.5 s; at impact might 5,
  `ranged`, not evadable, and a push of 1 away from the centre; a 3.5 s
  recharge. Its line: "Lobs a charge that blasts foes a step back." In
  the registry's list of forced movers. `grenade_burst`
  (`fxRegistry.ts`): the explosion with the catapult's `thud` and a light
  shake.
- An enemy among the Artillery Company's skirmishers (weight 1 beside
  the bandits' 3 and the mercenary's 1); acts 2 and 3 both field it.
- The joins: `"grenadier": 0` appended to both records of the default
  and the five fixture vectors; PENDING rows in the prior-table and
  roster-table coverage tests, each cleared by §162's rebuild; the card
  test's floor count 12; the resume tests' completing seed 36 to 19, the
  smallest of the eight of 80 that now complete (19, 34, 41, 53, 67, 72,
  76, 79; `scratch/160/seed-complete.ts`). The en extract regenerated.
- DESIGN: the officer's `O` with the epaulettes (missed at 160a), the
  newcomers' line, the Grenade among the carriers.

**Checked.** `src/sim/grenadier.test.ts`, 3 tests from the raw config:
it carries the grenade and is drafted uncommon; its reach and floor are
the grenade's; and a grenade at a foe four cells off, with foes on the
three ring cells beyond it and one due north, knocks each ring foe a
cell out along its own line from the centre and the centre's foe away
from the thrower into the cell the east foe left. Planted
(`scratch/160/160c-plants.json`): 5 plants (no push; the push from the
thrower; the inner ring moved first; not drafted; no reach), each
caught, the clean file green. **The corpus:** predicted most of the 34
would move; the replay diverged on 15, and `--record` moved 9 beyond
their config hash; the re-recorded corpus replays 0 of 34 differing, 21
of 21 command kinds change a run, 48 event names. In the pane, on
`?seed=5&character=soldier&roster=mercenary:3,mercenary:3,grenadier:3,grenadier:3`
driven through the first fight: 23 grenades, 24 explosions drawn, 26
foes shoved, the grenadiers on U+E020.

**Read** (`batch`, at 160g's stop): that URL. What changed: two
grenadiers behind two mercenaries. Wrong looks like a grenade that moves
no one, a blast that flings foes through walls, or a grenadier that
walks into melee.

### 160d — the telekinetic (2026-11-18)

**Step zero.** A blast on its caster reaches its radius
(`engagementReach`), so a radius-1 Repulse makes the telekinetic close
to melee, with no floor. Damage can't go below might 0 (`schema.ts`),
and a ring multiplier on a burst whose centre is the caster would halve
every victim, a trick; so the damage is set by the stat instead: the
mage's line at the corrupter's magic of 6, Repulse at might 0. The Dark
Magic Posse's waves are fixed pairs (a shaman with a warlock or with a
corrupter, each with a casualty weight); the telekinetic joins the
corrupter's wave as its bodyguard at the same weight, 3.

**Built.**

- `telekinetic` (after the grenadier): `k`, rare, the mage's stat line
  with magic 6, power 2 (the rare tier's); base price 30.
- `repulse` (after the grenade): a radius-1 square on the caster, enemies
  only; a 0.4 s wind-up, then magic at might 0 and a push of 2 away from
  the caster; a 3 s recharge. Its line: "A burst of force that hurls back
  every foe beside it." In the forced movers; `repulse_burst`, the
  explosion with the bolt's boom and a light shake.
- The joins as at 160c: `"telekinetic": 0` appended to the six weight
  vectors, PENDING rows in both coverage tests; the en extract. The
  resume tests' seed 19 still completes. 160b's pin said every shipped
  explosion is aimed; it now holds the aimed ones as before and adds the
  shipped blasts on a caster, drawn on the caster's cell at the raw
  radius's ring.
- DESIGN: the newcomers' line and Repulse among the carriers.

**Checked.** `src/sim/telekinetic.test.ts`, 3 tests from the raw config:
it carries Repulse alone, drafted rare; its reach is the burst's radius,
no floor; and a Repulse throws three foes beside it two cells along
their own lines, and leaves the telekinetic (place and HP), an adjacent
ally and a foe two cells off where they stand. Planted
(`scratch/160/160d-plants.json`): 6 plants (no push; a pull; allies
hit; radius 2; not drafted; the reach read from `rangeCells`), each
caught, the clean file green. One plant's expectation was mine and
wrong: at radius 2 the reach test passes, correctly, since the reach
follows the radius; the knock test catches it. **The corpus:**
predicted 5 to 20 of 34; the replay diverged on 14, `--record` moved 4
beyond their config hash, the replay after 0 of 34, 21 of 21 command
kinds, 48 event names. In the pane, on
`?seed=5&character=soldier&roster=mercenary:3,mercenary:3,telekinetic:3,telekinetic:3`
through the first fight: 17 Repulses, all 17 explosions on the caster's
own cell at a ring of 1.1 (160b's first consumer), and 5 foes shoved:
in a crowd the cell behind a foe is often taken. Measured across the
pushers for 160g.

**Read** (`batch`, at 160g's stop): that URL. Wrong looks like a
telekinetic that hangs back, a burst drawn anywhere but on it, or foes
that never land.

### 160e — the banshee's burst (2026-11-18)

**Step zero.** The Wail was an aimed blast (range 4, radius 1, a
straight launch and 0.3 s of flight). On its caster it needs no launch
and no flight, so its `wail_launch` key goes unused and leaves the
registry; one fx pin held that both pure afflicters fly a projectile,
and now holds the hex alone, the Wail being a burst on its caster. The
area-lock pin (a flat cadence, a shorter longest duration) still holds:
6 s against 4 s.

**Built.** `wail`: a radius-2 square on the banshee, enemies only, a
0.2 s wind-up then the panic as before, `rangeCells` 0, its burst
`wail_burst` (drawn on the banshee by 160b at a 2.2 ring). The banshee's
reach is the radius, so it closes to two cells. Still enemy-only, in the
Bandit Queen and the banshee barrow. DESIGN's newcomers paragraph.

**Checked.** `src/sim/banshee.test.ts`, 2 tests from the raw config:
the banshee stays undraftable and reaches its radius; a Wail panics a
foe beside it and one at the radius's edge, not one a cell beyond, nor
its ally, nor itself. Planted (`scratch/160/160e-plants.json`): 4
plants (aimed at the target again; radius 1; allies hit; drafted), each
caught, the clean file green. The render, config and card tests 456 of
456. **The corpus:** predicted 0 to 4 of 34, only runs meeting a
banshee; the replay diverged on 3 (`chaos-16`, `chaos-4-…-bits-300`,
`chaos-8-sectorHops-2`), re-recorded, the replay after 0 of 34, 21 of 21
command kinds, 48 event names. In the pane, banshees fielded on the
player's side (`?seed=5&character=soldier&roster=mercenary:3,mercenary:3,banshee:3,banshee:3`)
through the first fight: 17 Wails, every explosion on the banshee at a
2.2 ring, up to 3 foes panicked at one impact.

**Read** (`batch`, at 160g's stop): that URL, or the Bandit Queen.
Wrong looks like a banshee screaming from afar, a burst drawn off it,
or a scream that panics no one.

### 160f — the ronin's whirlwind (2026-11-18)

**Step zero.** The ronin carries the katana alone (might 2, 1.5 s, the
ronin's strength 4 and luck 14); every ability but the dash and Inspire
is priority 10, so the whirlwind at 11 outranks the katana when both are
ready. The registry builds its factories from id lists; the whirlwind
moves no one, so it takes a list of its own, the bursts on their casters
that move no one.

**Built.** `whirlwind`: a radius-1 square on the ronin, enemies only, a
0.2 s wind-up, might 3 `strength`, crit base 0.1, evadable as the
katana; priority 11; a flat 5 s recharge; a 0.3 s recovery. Its line: "A
spinning cut at every foe around." On the ronin beside the katana; its
fx `whirlwind`, the explosion on the ronin with the melee swing's sound.
DESIGN's newcomers paragraph.

**Found while testing: the recovery.** The first draft took the
single-attack units' `"recovery": "fill"`, which holds the unit for the
whole recharge, so the ronin stood five seconds after each spin and the
katana never swung between; the test's "katana between spins" failed on
it. A second ability needs the Snag's shape, a short fixed recovery on
a flat recharge. Repulse and the Wail keep `fill`, as the bolt and the
bow do: each is its unit's only attack.

**The seeded pins moved twice** (once on the first draft, once on the
fix). The chaos census lost `buyPortPacket` when the Gambler's slot
stopped buying a packet; across 80 seeds under the final whirlwind,
seed 11 (2.1 s alone) is the one that redraws, docks, buys a packet,
recruits and rests while leaving both census lists as they are
(`scratch/160/chaos-census.ts`). The resume tests' completing seed 19
no longer completes; seed 3 is the smallest of nine of 80 that do.

**Checked.** `src/sim/ronin.test.ts`, 2 tests from the raw config: the
ronin carries both and keeps the katana's reach; with three foes beside
it and one two cells off, it opens with a spin that strikes each foe
beside it once and not the far one, and the katana swings before the
second spin. Planted (`scratch/160/160f-plants.json`): 4 plants (the
`fill` recovery; no whirlwind; the katana's priority; a square blast a
cell wider), each caught, the clean file green. **The corpus:**
predicted 8 to 25 of 34; the replay diverged on 13, `--record` moved
those 13, the replay after 0 of 34, 21 of 21 command kinds, 48 event
names. In the pane, `?seed=5&character=soldier&roster=ronin:3,ronin:3,ronin:3`
through the first fight: 7 whirlwinds and 13 katana swings, every spin
drawn on the ronin at a 1.1 ring. The ronin's prior-table row now
prices an older kit; §162's rebuild replaces it.

**Read** (`batch`, at 160g's stop): that URL. Wrong looks like a spin
with no one beside the ronin, or no katana between spins.

### The hand-off after 160f (2026-11-18)

At the hand-off trigger (505k at `c17096bf`). **Done:** 160a signed
(`k`; `g` with the epaulettes, worn by the officer too); 160b built
(`none`); 160c to 160f built, ◐, their `batch` reads due at 160g.
**Open: 160g, the play `stop`, not yet put.** Before putting it, one
measurement: in the pane's first fight 17 Repulses shoved only 5 foes
(the cell behind a foe is often taken in a crowd), as the Snag pulled
about half the time before 159d-post; measure each pusher's landings
headless (the grenade, Repulse, the Snag) on a few seeded runs, as
`scratch/159/snag-probe.ts` did, and put the number with the calls.
**160g's calls** (session drafts, the leans built on): the grenade
(might 5 `ranged`, the ring at half, push 1 from the centre, range 4
floor 2, 3.5 s, its line), Repulse (magic 6 on the mage's line, push 2,
3 s, its line), the Wail's radius 2, the whirlwind (might 3, flat 5 s,
priority 11, its line); the rarities and prices (the grenadier uncommon
at 28, the telekinetic rare at 30); the encounters (the grenadier among
the Artillery Company's skirmishers, acts 2 and 3; the telekinetic in
the Dark Magic Posse's corrupter wave at casualty weight 3); the sounds
reused (the grenade the catapult's `thud`, Repulse the bolt's
`magicboom`, the whirlwind the melee swing); the explosion as every
burst's look. **The reads' URLs** are in 160c to 160f's entries.
**Tools no doc names:** `scratch/159/plant.ts` with
`scratch/160/160{b..f}-plants.json`; `scratch/160/seed-complete.ts`
(the completing two-hop seeds); `scratch/160/chaos-census.ts` (which
kinds each chaos slot applies, for a seed re-pick);
`scratch/160a/build.ts` (a trial face from scratch radicals for the
sampler).

### 160g — step zero: the landings, and the bursts at scenery (2026-11-18)

Measured at `a64a1fd3`, headless, six seeded runs each (seeds 3 to 8,
`character=soldier&hops=4`), the unit on the player's side: two
grenadiers, two telekinetics or two banshees behind two mercenaries, or
three adventurers or three ronin.

**The landings** (`scratch/160/landings-probe.ts`, wrapping
`EffectAction.applyEffect`: the units in the blast before the impact's
ops, how far each moved after, and the cell that stopped a short one):

- *The grenade:* 450 throws, 253 (56%) moved a foe; 770 foes hit, 364
  (47%) knocked a cell, 406 not: 102 killed by the hit, then scenery 108,
  the victim's own ally 62, an impassable tile 56, the grenadier itself
  22, the board's edge 17, a claimed cell 17, the grenadier's ally 15,
  another victim 7. Of the foes it doesn't kill, 54% move.
- *Repulse:* 335 casts, 85 (25%) moved a foe; 207 foes hit (0.62 a
  cast), 63 (30%) thrown two cells, 47 (23%) one, 97 (47%) none: 33
  killed by the hit, the victim's ally 24, scenery 20, a tile 12, the
  edge 4, a claim 3, an ally 1. The short ones stopped on scenery 26, the
  edge 8, a tile 7, a body 6.
- *The Snag:* 258 casts, 190 (74%) moved their target, as at 159d-post
  (193 of 252): 64 dragged two cells, 61 one cell to land beside the
  adventurer, 65 stopped short by a body, tile, edge or claim, 60 not at
  all (22 killed by the hit).

**Found: a burst on its caster fires at scenery.** Repulse's 0.62 foes a
cast led here. `proposeCasterAnchoredBlast` gates on `resolveAreaVictims`,
which counts every `isCombatTargetable` unit off the caster's team: the
destructible scenery (rubble, destructible cover and walls) and a passive
camp's members as well as foes. An aimed blast picks a hostile as its
target and takes scenery only as collateral; a burst on its caster has no
target, so rubble beside it is reason enough to cast. Classified at the
cast (`scratch/160/camp-gate-probe.ts`):

| | casts | a hostile in the blast | scenery alone | a passive camp member, no hostile |
|---|---|---|---|---|
| Repulse | 354 | 164 | 183 | 7 |
| the Wail | 387 | 214 | 131 | 42 |
| the whirlwind | 431 | 275 | 138 | 18 |

Every scenery-alone cast came with the caster's own target a live enemy,
so none was the rubble overlay's designed chipping
(`applyRubbleAutoTarget`, which targets rubble only with no hostile
reachable). With `fill` recovery the caster stands there
(`scratch/160/scenery-streak-probe.ts`): telekinetics in 45 streaks at
one cell, the longest 9 Repulses over 16.8 s; banshees in 55, the
longest 7 Wails over 36 s. The ronin's are single spins in passing, its
0.3 s recovery freeing it to walk on. This is 160d's and 160f's named
wrong look ("a telekinetic that hangs back", "a spin with no one beside
the ronin"), so a fix is inside their intent; it is put with the stop
rather than built first, since the stop was due. Among the casts at a
foe, 11% of Repulses, 5% of whirlwinds and 1% of Wails found none at
impact (the foe stepped off in the wind-up or died;
`scratch/160/empty-bursts-probe.ts`).

### 160g — the play, put (2026-11-18)

Put to the user with 160c to 160f's `batch` reads and their URLs, the
measurement above, and the calls the hand-off after 160f lists. The
calls, each on a lean:

- **New, from step zero: the burst's gate.** A burst on its caster fires
  only with a hostile (`hostileCandidate`) or the caster's own committed
  target in the blast; scenery and a passive camp stay collateral when it
  fires. The committed target keeps the rubble overlay's chipping and an
  ordered focus on a neutral. Lean: build it as 160f-post before the
  play, so the telekinetic's and banshee's reads aren't spent on rubble.
- **The landings:** the knockbacks stay ungated (159d-post: a knockback
  rides on its hit); a grenade moves 54% of the foes it doesn't kill,
  Repulse half the foes it hits.
- The numbers, names and lines as built; the rarities and prices; the
  encounters; the sounds reused; the explosion as every burst's look.

### 160g — the user's answer (2026-11-18)

**Signed** ("absolutely build 1"): call 1, the burst's gate, built
before the play as 160f-post. The user had already played the grenadier,
on `spiralFireLife`, and brought two findings. *A knockback into the
abyss:* a grenade into a line of foes on a path flanked by chasm moves no
one, where they should fall; a fall is a mechanic bigger than a `-post`,
and the user asked for the session's view (§158's fork 3 weighed a fall
that kills against the wall and signed the wall). *A knockback toward the
thrower:* the blast's near ring is knocked toward the grenadier, which
delivers a melee foe to it; the user's fix, a short stun after the push.
Both answered at the next stop, below.

### 160f-post — a burst fires at someone it is for (2026-11-18)

**Step zero.** As measured above: `proposeCasterAnchoredBlast`'s gate is
any `resolveAreaVictims` victim, scenery and passive camps included.
`currentTarget` already honours rubble the overlay chose and an ordered
camp member, and `hostileCandidate` is the acquisition's own test of a
hostile, so the gate composes the two without a new rule.

**Built.** `burstIsFor` (`src/sim/effects/propose.ts`): a victim sets the
burst off if it is on the caster's side (an allies blast, as before), a
hostile, or the caster's own target. Scenery and a passive camp are still
hit when it fires, as an aimed blast's ring hits them. DESIGN "The
carriers" and ARCHITECTURE's `propose.ts` line.

**Checked.** `src/sim/effects/propose.test.ts` +5 on the synthetic nova:
rubble alone beside it with its foe off abstains; rubble that is its own
target fires; a foe beside it with rubble too fires while its target
stands off; a passive camp abstains and the same camp turned hostile
fires; a passive camp member it was ordered onto fires. Planted
(`scratch/160/160f-post-plants.json`): 5 plants (the gate back to any
victim; no own-target clause; no hostile clause; any non-scenery counts;
no ally clause), each caught, the clean file green. The probes after:
Repulse 189 casts, every one with a hostile in the blast (was 164 of
354), 1.32 foes a cast, 54% moving one; the Wail 298 of 298; the
whirlwind 316 of 317, the other at rubble that was the ronin's own
target; no caster stood at scenery. **The corpus:** no prediction was
written before the replay, which diverged on 12 of 34; `--record` moved
those 12, the replay after 0 of 34, 21 of 21 command kinds, 48 event
names.

**Read:** `none` by the pins and their plants; the four's look is read
at 160g's play.
