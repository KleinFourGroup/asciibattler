# WORKLOG — Round 13 (The unit kit)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 12's phases are
[archive/worklog-phase-158.md](archive/worklog-phase-158.md) (the
kickoff, §157, and §158) to
[archive/worklog-phase-163.md](archive/worklog-phase-163.md) (the close,
with Round 12's exit read and Round 13's charter against the code at
163a).

## Phase 164 — the kickoff

The kickoff's inputs, by pointer: the charter, META-ROADMAP §"Round 13 —
The unit kit", standing at Round 12's close with its `extends`
parenthetical amended; its premises at HEAD and the registration places
recounted from Round 12's four newcomers, `archive/worklog-phase-163.md`,
163a; TODO's Round 13 section, with the resume mode for `box-drive.sh`
due before the round's board; `process/planning.md` "Phase kickoff" and
"The artifacts" (the spec first).

### The kickoff's audit, and the phases put to the user (2026-11-28)

Read at `a95f12e2`. `git diff --stat 6940a92f HEAD -- src config tools
scripts tests locales` is empty, so 163a's premises stand with their
files and lines (`archive/worklog-phase-163.md`, 163a). The spec is
[round-13-spec.md](round-13-spec.md), proposed. This kickoff read the
surfaces under them:

- *The damage path.* `World.applyDamage` returns true for every strike
  (`src/sim/World.ts:774-807`). `dealDamage` returns the damage after
  defense, not clamped at the target's HP (`World.ts:704-723`), and it
  reaches the `unit:attacked` event and the `dealHit` and `takeHit`
  triggers (`World.ts:791-802`), never the op that struck. The
  damage op's three branches (an area, a `fizzle` shot, a
  `commit-at-cast` strike) each draw the crit on `combatRng`
  (`src/sim/effects/interpreter.ts:164`, `:196`, `:210`) and record a
  miss in `FireScratch.missed` (`:184`, `:203`, `:216`); `applyStatus`
  and the push skip a missed target (`:329`, `:385`). The scratch is made
  fresh at each phase boundary and is not serialized
  (`src/sim/effects/EffectAction.ts:171-176`). `applyDamage` takes no op,
  so `evadable` has to reach it through its options.
- *The dodge's carriers.* Before 137c deleted evasion, the adventurer
  carried 11, the rogue and the rioter 7, and every other unit 3 to 6
  (`config/units.json` at `d50e23f1^`, read by a script). 154g held the
  adventurer, the rioter and the rogue "until Round 13 gives them back
  their dodge" (`archive/worklog-phase-154.md`); the charter names the
  adventurer, the rogue and perhaps the ninja. So the rioter is the kit
  watch's, not the charter's.
- *A passive ability.* An aura with no ops proposes nothing
  (`src/sim/effects/propose.ts:51`), and a `self` ability never widens its
  carrier's reach (`src/sim/archetypes.ts:45`). An ability with no ops
  and no aura would fall into `proposeSelfMove` and leap
  (`propose.ts:303-308`), so a passive dodge needs the aura's skip.
- *The RNG.* `combatRng` is forked off the World's `rng` when the World is
  built and serialized with it (`World.ts:436`, `:2256`). A dodge drawn
  after the crit, as the landing note has it (`World.ts:782-787`), adds a
  draw only where an evadable strike meets a dodger, and shifts every
  combat draw after it in that fight. A stream of its own would be one
  more serialized RNG, a World bump.
- *`healActor`.* A battle rule's effects are `gainBits` and `applyStatus`
  (`src/sim/battleRules.ts:50-60`), fired for the player's units alone
  (`:129`, `:146`). A daemon's battle hooks compile to that shape
  (`battleRulesFor`, `src/run/daemon.ts`), and a packet acts across a
  battle by an `injectRule` of the same shape (`src/config/packets.ts`;
  Venom's in `config/packets.json`). `BattleRuleEffect` is in the Run's
  pinned save shape (`tests/run-snapshot-shape.txt:76`), so a new effect
  moves the pin, a Run bump; the World serializes its rules, a World bump.
- *The specials' two gaps.* A `self` ability with no `summon` goes to
  `proposeSelfMove` (`propose.ts:303-308`), which wants an enemy outside
  strike reach and a leap landing, so a self-buff would propose only when
  a leap could. Its `applyStatus` lands on the caster
  (`interpreter.ts:360`). Its `heal` heals the action's `targetId`
  (`interpreter.ts:239-248`, `EffectAction.ts:171`), which for a leap is
  the enemy (`propose.ts:242`): read from the code, not probed, and no
  shipped `self` ability heals. The post-C5 audit had it a silent no-op
  (`archive/post-83-worklog.md:77-80`); since 161b a leap carries its
  enemy's id, so the gap is now a heal on the wrong side.
- *Global reach.* An `aoe` builds its cells (`squareCells`,
  `src/sim/effects/targeting.ts:29`) and then its units
  (`resolveAreaVictims`, `:133-143`) on every fire, so a radius-99 square
  is 39,601 cells. The aura pass builds no cells: it measures every
  carrier against every unit by `unitDistance` each tick
  (`World.ts:1300-1316`), so a board-wide aura costs what a radius-4 one
  does, and its flag is for meaning, not speed. `affects: 'enemies'`
  counts neutrals (`src/sim/effects/schema.ts:226-234`), and only damage
  turns a camp hostile (`World.ts:719-722`), so a player's global stun
  would stun every camp member and leave its camp passive. `stunned`
  exists (1 s, no move, no attack) and `rejuvenate` heals over time
  (`config/statuses.json`).
- *`extends`.* The catalog is parsed once (`src/config/units.ts:237`),
  and the combatant schema is not strict, so an `extends` key today is
  dropped unread. Both editors that save `config/units.json` save it from
  the parsed catalog through `formatArchetypesJson`: the archetype
  editor's working set is a clone of `ALL_UNIT_DEFS`
  (`tools/archetype-editor/editor.ts:104`), and the blacklist editor's
  toggles write into the same parsed catalog
  (`tools/blacklist-editor/draftable.ts`, its header), so a save would
  write a reskin out whole and drop its `extends`.
  `tests/fuzz/empowerPolicy.test.ts:151-155` reads the raw file and skips
  a record with no `abilities`, so it would miss a reskin's inherited kit;
  the Round 12 consumer tests read their own units' raw records
  (`src/sim/ninja.test.ts:25`, `src/sim/grenadier.test.ts:11`), none a
  reskin.
- *The commissar.* A new status needs a symbol of its own
  (`src/render/statusDisplay.ts`, held by its test) and a hue named in
  both palettes, the colourblind one keeping every pair of status hues
  0.070 apart in each simulated view (`src/render/palette.ts:94-118`):
  the charter's colourblind gate. The
  officer study read an aura of +2 SPD at 1.4 to 2.0 a fight better than
  the shipped aura at every act (BALANCE 2026-11-11, the officer study, at
  base mobility 6), so the commissar's speed and the officer's redesign
  are one question.
- *The ranged release.* The bow, the pistol and the halberd recover by
  `fill`, and the jinx and the icicle by a fixed 0.3 s, each on the
  speed-scaled cadence (`config/abilities.json`), so the experiment is a
  config line per weapon.
- *The conscript.* Power is nonnegative (`units.ts:66-67`), so a
  conscript whose fall costs the pool nothing is expressible in config;
  whether every reader of power takes a 0 is unread.

**The forks for the design stop (165a).** Each with its lean; 165a puts
both arms with their costs. The spec's Open lists them in short.

*Tranche A, the damage path:*

1. *The return.* `applyDamage` returns the damage dealt, or null for a
   dodged strike, and the damage op adds each hit to a `dealt` sum on the
   boundary's scratch beside `missed`. The other arm, `{ landed, damage }`.
   Lean: the number or null, one value for its two readers.
2. *The dodge's shape.* (a) A plain chance per evadable strike, the
   user's "regular %"; (b) a counted share, every nth evadable strike at
   the dodger, a counter on the unit (a World bump), no draw and no
   streak, a rhythm a player can count; (c) a chance that rises with each
   strike taken and resets on a dodge, a counter and a draw. Lean: (a),
   the user's words with no new state, and each dodge is a MISS splat on
   the dodger, so a streak is seen as one, not lost in the crowd.
3. *Its seat.* (a) An ability with no ops and a `dodge` block (its
   chance), on the card's ability row with a name and a line, skipped by
   the proposer as an op-less aura is; (b) a status its carrier sustains
   on itself, which a battle rule's `applyStatus` could also lay, but only
   on `dealHit` or `kill`, so "your units dodge" would need a battle-start
   trigger anyway; (c) a stat, the evasion Round 9 deleted. Lean: (a). A
   daemon's grant then waits for Round 18's ability-grant channel, which
   grants an ability by id; so the charter's "whether a daemon can grant
   it" answers: not this round.
4. *Its draw.* On `combatRng` after the crit's, only where an evadable
   strike meets a dodger. The other arm, a stream of its own, keeps the
   crits where they are for a World bump. Lean: `combatRng`.
5. *Which strikes.* The ops authored `evadable` (27 of 35 damage ops,
   163a). The whirlwind: (a) evadable as authored, a dodger slipping the
   spin as it slips the katana, and the two landing notes rewritten to
   "the blades and the shots, as against blasts, spells and ticks"; (b)
   not evadable, the notes kept. Lean: (a), since the spin is a blade's
   cut at each foe beside the ronin.
6. *What a dodge costs the attacker.* The strike is spent (its cooldown
   and busy window); no HP moves; no rider lands, since `applyStatus` and
   the push skip a missed target; `unit:missed`, then `dealMiss` and
   `evade`; no `dealHit`, so no battle rule fires and nothing is stolen.
   Lean: as the landing notes have it.
7. *Its carriers.* The adventurer, the rogue and the rioter, whom the kit
   watches hold for it, and the ninja, "an upgraded rogue". Lean: all
   four, each number at §167; the other arm, the charter's three.
8. *The `lifesteal` op.* Heals its caster by a `fraction` of what the
   damage ops on its boundary dealt (the number the hitsplats show,
   overkill included), rounded and clamped at max HP, emitted and booked
   as any heal; placed after its damage op, as `applyStatus` is. The
   other arm, a field on the damage op, which the status ticks and the
   chain's hops share (`schema.ts:181`, `:220`), so a burn tick could
   steal. Lean: the op, as chartered.
9. *`healActor`.* A battle rule's effect on `dealHit` alone (as
   `applyTo: 'target'` is): heals the acting unit by a `fraction` of the
   blow, rounded and clamped. The idol is a daemon's hook, the packet an
   `injectRule` for the encounter, as Venom is. Rounding makes a light
   blow heal nothing (20 % of 2 is 0); the other arm carries the
   remainder, more state. Lean: round.

*Tranche B, the rest:*

10. *The self arm.* A `self` ability whose ops are `applyStatus` or
    `heal` proposes on its cooldown while its unit has a target, with no
    score gate; a self-heal abstains at full health, the one condition,
    since a heal at full health looks broken. A `self` ability's heal
    heals its caster. Lean: as written.
11. *The arm's consumer.* None of the round's named units needs it, and
    the re-cut ships no seam without one. Arms: (a) the conscript's
    appeal (fork 17's third arm); (b) a part of the officer's redesign;
    (c) carried with the heal's fix, a TODO row, to the first round that
    wants it. Lean: (c), since a special made up to give a seam its
    consumer is the wrong way round; (a) if the conscript's appeal wants
    a special anyway.
12. *Global reach, the selector.* A new selector, `board`, with
    `affects`: every combat-targetable unit it admits, no cells built;
    proposed when it has a victim, as a burst on its caster is; refused
    beside a push `from: 'center'`. The other arms: an `aoe` with a board
    radius (its shape, anchor and ring meaning nothing), or a large
    radius. Lean: the selector.
13. *Global reach, the aura.* An aura's `radius` takes `'board'`. Lean:
    as written; Round 14's totems are its next consumer.
14. *The camps under a global `enemies`.* (a) As `affects` reads it
    today, every camp member struck and left passive, Round 14's flags
    refining it; (b) a `board` selector that skips camp members. Lean:
    (a), since Round 14 is where `affects` learns camps and a rule here
    would be undone there.
15. *The global special.* A global stun (`stunned`) or a global heal (a
    heal op or `rejuvenate`), and who carries it: a draftable legendary
    (the stormcaller, the shaman), the healer, an act's boss, or a new
    unit. Lean: a global heal on the shaman, a legendary kit watch at
    −27.9 ± 14 on the prior table v9, where the stormcaller read strong
    (pooled +18.8, 154g); a
    global stun's natural home is an enemy boss, a fight-wide stun the
    player plays around, for the act rounds.
16. *`extends`.* A child names `extends` and gives what differs:
    `baseStats` and `growthRates` merge stat by stat, and every other key
    replaces whole; its own `name` required, so no reskin shows under its
    parent's; one level, combatants only, refused at parse otherwise; run
    once before the parse. Both editors edit the raw records and preview
    the merged one, and the formatter writes a child's `extends` and its
    own keys alone, with `knownAbilityIds`'s last reader gone in the same
    pass (U6). 163a's recount becomes the checklist, each place with a
    test that fails for a new archetype missing it where none does today;
    the redraw-fisher file, refused by its own schema and loaded by
    nothing, deleted unless a reader wants it. Lean: as written.
17. *The soldier and the conscript.* The soldier's id, `soldier` beside
    the character's in another namespace, and whether he is drafted: the
    user's words make him a mercenary where the name fits the fight,
    which reads as an enemy reskin. The conscript's appeal: (a) power 0,
    his fall costing the pool nothing, a cheap body that buys time; (b) a
    price under the mercenary's; (c) a special on the self arm. Lean: the
    soldier `soldier`, not drafted, an act-2 enemy; the conscript (a), a
    draftable common, if step zero finds every reader of power takes a 0.

**The phases, and why this order:**

1. *§165, the design.* One step. Risk: low; it is the round's decision
   point.
   - **165a — the design** (`stop`). The seventeen forks with both arms,
     cost and lean, in two tranches: A (1 to 9) put first, B (10 to 17)
     after A's sign. A probe under `scratch/165a/` for a premise still
     uncertain (the self heal's target, the readers of a power of 0).
     Commit: the WORKLOG entry. Predicts: docs only, so the hook runs the
     docs tests alone and no smoke; no snapshot, no RNG stream.
2. *§166, `extends`, the checklist and the mercenary's reskins.* First
   because the merge is inert until a child exists, proven byte-identical
   (the merged catalog deep-equal to today's parse, with a planted child
   that must differ), and its guards then catch what each later newcomer
   misses, where 161f's slip was. Risk: low-medium (two editors' saves).
   Reads: the merge, the editors and the guards `none`; the reskins'
   glyphs a `stop` at their step (the glyph sampler, 144b); each reskin
   `batch` with its URL; the play a `stop`. Predicts: no snapshot bump
   and no RNG stream; the smoke fires (`config/` staged) and the corpus
   replays unchanged through the merge; a new draftable moves the recruit
   offers, so the corpus moves at the first one.
3. *§167, the dodge.* The widened return; the dodge's seat and draw with
   the miss path woken; the whirlwind's flag and its two notes in one
   commit; then its carriers. Before lifesteal, since the return's null is
   the dodge's, and the kit watches wait on it. Risk: medium (the path
   every strike takes). Reads: the seam `none` (headless tests and plants;
   no shipped unit dodges until its carriers, so the corpus replays
   unchanged); each carrier `batch`; the play a `stop`. Predicts: no World
   bump on a plain chance (one on a counter); a draw on `combatRng` where
   a dodger is struck, so the corpus moves with the carriers.
4. *§168, lifesteal.* The `lifesteal` op and the vampire; `healActor`
   with the idol and the packet. Risk: medium. Reads: the op and
   `healActor` `none`; the vampire's glyph a `stop`, his kit `batch`; the
   idol's and the packet's names and numbers a `stop`; the play a `stop`.
   Predicts: Run v51 → v52 and World v42 → v43 at `healActor`, so a run
   saved by `0.5.0` is refused by `0.6.0`; no bump for the op, whose
   fraction is read off the def as it fires (checked at its step zero);
   no RNG stream; the corpus moves with the vampire.
5. *§169, the specials and global reach.* The self arm and the heal's
   target if fork 11 keeps them; the `board` selector and the aura's
   reach; the global special. After the damage path, and before the
   kits, so the officer's redesign has every mechanism the round builds.
   Risk: medium. Reads: the seams `none`; the special `batch`; the play a
   `stop`. Predicts: no bump; the corpus moves with the special's carrier.
6. *§170, the kits by taste.* The ranged release, a config line per
   weapon for the user's play, kept or dropped (`stop`); the officer, his
   study's levers re-read on base mobility 3 by its driver
   (`scratch/154/officer-study.ts`, a local run sized at the phase's
   kickoff by `process/measurement.md`), then his redesign, the user's
   (`stop`); the commissar on him (`batch`, the play a `stop`). Last of
   the kits, since the commissar extends the officer and the redesign may
   use what §167 to §169 build; before the board, which reads them all.
   Predicts: config only, no bump; the corpus moves.
7. *§171, the closing board.* The resume mode for `box-drive.sh` first
   (TODO), then the prior table rebuilt for the newcomers and every kit
   changed, the rarity protocol's desk read per new draftable, and the
   board line for line against §162's, paired on its seeds, with the named
   watches, the kit watches and the priest's and the gambler's parity
   read. Risk: medium (about a day of box time, sized at its kickoff by
   `process/measurement.md`). Reads: `stop`.
8. *§172, the close.* `0.6.0` and its upload, the exit by clause, Round
   14's charter against the code, the process read, the archive. Reads as
   §163's.

Eight phases after the kickoff. The re-cut sized the charter at 4.5 to 5
(`archive/post-118-worklog.md` §133) before the dodge (§136), the officer
(§154) and the ranged release (§161.5) joined it; §170 is those riders,
and the dodge has a phase of its own. §169 and §170 could be one phase,
with one close fewer. *Not split off:* `knownAbilityIds` rides `extends`
(the same editor), the whirlwind's flag the dodge, the redraw-fisher
file the checklist. *Predicted:* the release four new units (the vampire,
the soldier, the conscript, the commissar), the dodge on up to four, a
global special, an idol and a packet, the officer reworked, and the
ranged release if kept; Run v52 and World v43 from `healActor`, one more
World bump only on a counted dodge.

### The spec and the cut signed (2026-11-28)

**Signed** (the user: "Signing the spec and the eight phases! 😁"): the
spec, and §165 to §172 as eight phases, with 165a, the design, a `stop`;
§169 and §170 kept apart. The cut is in the ROADMAP; the stretch runs
165a's step zero, then its stop, tranche A first.

## Phase 165 — the design

### 165a — the design, tranche A put to the user: the damage path (2026-11-28)

**Step zero,** read at `9b30c2fc`, each premise the forks rest on:

- `applyDamage` has three callers, the damage op's three branches
  (`src/sim/effects/interpreter.ts:180`, `:199`, `:212`), and a chain's
  hops reach it through the same op (`fireChainHopOps`, `:530-543`). One
  widened return covers every strike.
- The ops authored `evadable`, recounted from `config/abilities.json` by
  a script, chains walked: 27, every single-target strike but the
  catapult's shot and the chain lightning, and the whirlwind's area. Not
  evadable, 8: the grenade,
  Repulse, the magic bolt, the catapult's shot, the vial, the ice storm,
  the chain lightning's hops and the molotov. The hex and the wail lay a
  status with no damage op, the status ticks and the fall deal damage
  without `applyDamage` (`World.ts:1165`), so no dodge touches them.
- The miss path: `unit:missed` floats the "Miss" word over the target
  (`src/render/BattleRenderer.ts:1425`) and plays on the fx channel
  (`src/audio/eventSounds.ts:127`); the pathing metrics count it as
  contact (`tests/pathing/metrics.ts:210`). `src/sim/World.test.ts:670`
  pins that no strike emits it, which the dodge changes on purpose.
- A passive ability today: Inspire has no ops, a 1 s cooldown and a
  `fill` timeline, because the schema requires a cooldown and a timeline
  (`config/abilities.json`). The card shows its detail as its aura and
  reach (`src/ui/abilityDetail.ts:80-85`) and its cadence column anyway
  (`src/ui/UnitCard.ts:688-695`).
- The old scale, a derivation and not a measurement: evasion cost an
  attacker 0.02 of hit chance a point (`config/stats.json` at
  `d50e23f1^`), every unit carried 3 to 6, and strikes landed 47.7 %
  overall (BALANCE 2026-10-28). Against a unit at 5, the adventurer's 11
  took 0.12 off a strike's chance, about a quarter of the strikes that
  would have landed, and the rogue's and the rioter's 7 took 0.04, about
  a twelfth.
- XP: a point healed pays 3, as a point of damage does
  (`config/leveling.json`), from the healing ledger that the heal op
  books (`World.recordHealing`). A steal booked there pays its stealer
  twice for one blow, and an idol of it would raise every player unit's
  XP by its fraction.
- `healActor`'s places: the daemon rule's effect union and its
  trigger-domain check (`src/config/daemons.ts:100-160`), the packet's
  `InjectedRuleSchema` (`src/config/packets.ts`), the sim's
  `BattleRuleEffect` and its `execute` (`src/sim/battleRules.ts`), the
  packet editor's rule form, and the Run's pinned shape.

**The forks,** each with its arms, its cost and the lean. Fork numbers
are §164's.

1. *The return.* (a) `applyDamage` returns the damage dealt, or null for
   a dodged strike; its three callers record a miss on null and add the
   number to a new `dealt` on the boundary's scratch. (b) It returns
   `{ landed, damage }`. Both are the same change to two files; (a) is
   one value for its two readers. A ring cell that rounds to 0 never
   reaches `applyDamage`, so it is neither missed nor dealt, as today.
   Lean: (a).
2. *The dodge's shape.* (a) A plain chance: an evadable strike at a
   dodger is dodged with the dodger's chance. No new state; streaks
   happen (at 25 %, two dodges in a row one time in 16, three in 64).
   (b) A counted share: every nth evadable strike at the dodger is dodged
   (n = 4 for a quarter); a counter on the unit, serialized, a World
   bump; no draw, no streak, and a rhythm a watching player could count.
   (c) A rising chance (Dota 2's pseudo-random evasion): low at first,
   rising with each strike taken until a dodge resets it, averaging the
   card's number; a counter and a draw, a World bump; no long streak
   either way. Lean: (a), your "regular %", which a card line states
   plainly ("dodges 25 % of strikes"); its cost is luck in a short fight,
   where a dodger meets few strikes.
3. *Its seat.* (a) A passive ability: no ops, a `dodge` block with its
   chance, targeting `self`, skipped by the proposer as an op-less aura
   is; on the card, its name, its line and "dodge 25 %", its cadence
   column blank; the schema either relaxes the cooldown and the timeline
   for a passive or takes dummies, as Inspire's are. (b) A status,
   `evasive`, whose behaviour carries the chance, which its carrier
   sustains on itself by an aura: a daemon's or a packet's rule could lay
   it on `dealHit` or `kill` (a riposte), and its pip shows it on the
   board, all fight, on every dodger; "your units dodge" would still need
   a battle-start trigger. (c) A stat in the stat block, growing on
   level-up: an empower or a packet's buff could raise it today, the most
   composable with daemons, but it is Round 9's evasion back, on every
   unit and the stat sheet. Lean: (a), the passive special you named; a
   daemon's grant waits for Round 18's ability grant, by id, so not this
   round.
4. *Its draw,* under (a) or (c) of fork 2. (a) On `combatRng` after the
   crit's draw. (b) A stream of its own, a key in `rngStreams.ts` and one
   more serialized RNG on the World, a World bump, which leaves the crits
   after a dodge where they would have been. Either way a fight with no
   dodger draws nothing new, so its journals replay unchanged. Lean: (a).
5. *Which strikes.* The 27 authored `evadable`, so a dodger slips the
   charge and the pounce too, and the charge's knockback with it, since
   the push skips a missed target (`interpreter.ts:385`). The whirlwind:
   (a) evadable as authored, a dodger slipping the spin as it slips the
   katana, and the two landing notes rewritten to "the blades and the
   shots, as against blasts, spells and ticks"; (b) not evadable, the
   notes kept. Lean: (a), since the spin is a blade's cut at each foe
   beside the ronin.
6. *What a dodge costs the attacker.* The strike's cooldown and busy
   window are spent; no HP moves; no rider lands (`applyStatus` and the
   push skip a missed target); `unit:missed`, then `dealMiss` and
   `evade`; no `dealHit`, so no battle rule fires (Laverna's bit, Venom's
   poison, Fortuna's crit) and nothing is stolen. The crit is drawn
   first, so a dodged crit is a plain miss. No other arm worth drawing;
   listed so the sign covers it.
7. *Its carriers.* (a) The adventurer, the rogue, the rioter and the
   ninja; (b) the charter's three, the rioter's watch then read on his
   kit alone. A carrier dodges on either side, so an enemy rogue dodges
   the player's strikes too. Numbers at §167, the old scale one anchor
   (about a quarter for the adventurer, a twelfth for the rogue and the
   rioter). Lean: (a).
8. *The `lifesteal` op.* (a) An op, `{ kind: 'lifesteal', fraction }`,
   after its damage op on the same phase: it heals the caster by the
   fraction of what that boundary's damage ops dealt, rounded, clamped at
   max HP, with `unit:healed` from the caster to itself. A dodged strike
   deals nothing, so it steals nothing; an area steals from its whole
   sum; a chain's delayed hops fire on boundaries of their own, so only
   the primary's hit is stolen from. (b) A `lifesteal` field on the
   damage op, which the status ticks and the chain's hops share
   (`schema.ts:181`, `:220`), so a burn tick could steal unless refused.
   With either, the dealt number is the hitsplat's, overkill included,
   against the HP removed; and the steal is (i) not booked to the healing
   ledger, since the blow already paid its XP, or (ii) booked, as every
   heal is, paying the fraction again. Lean: (a), the hitsplat's number,
   (i).
9. *`healActor`.* (a) A battle rule's effect, `{ op: 'healActor',
   fraction }`, on `dealHit` alone (the parse refusing it on `kill`, as
   `applyTo: 'target'` is refused there): it heals the striker by the
   fraction of the blow, rounded, clamped, not booked (as fork 8). The
   idol is a daemon's hook, the packet an `injectRule` for the
   encounter, as Venom is, and an area heals its caster once a victim.
   Its rounding: (i) rounded, so a light blow may heal nothing (20 % of 2
   is 0); (ii) a remainder carried on the unit, more state for a fraction
   of a point. Either way Run v52 and World v43. Lean: (a), (i).

### 165a — tranche A signed but fork 8 (2026-11-28)

The user's answers, fork by fork:

1. "Your call." The lean (a) stands: the dodge decides inside
   `applyDamage`, so the return carries null for a dodged strike whatever
   its shape.
2. **(b), a meter**: "Every hit fills up a meter, and when the meter is
   full, the hit misses. Basically, the extension of every nth hit to
   non-round numbers." Built on these leans, inside that intent: the
   meter is the dodger's, starts empty each fight, and each evadable
   strike at the dodger adds the dodger's share; the strike that fills it
   is dodged, and the meter keeps what ran over, so a share of 30 % dodges
   exactly 3 strikes in 10. It is kept in whole percent, since ten floats
   of 0.1 sum below 1 and would skip the tenth. Saved on the unit, a World
   bump at §167 (v43), which moves `healActor`'s to v44. Whether the board
   shows the meter is §167's look.
3. "I think the plan was a": the passive ability.
4. Not applicable under (b): the dodge draws nothing, and the crit is
   still drawn first, so a dodge moves no combat draw.
5. "a for sure!": the whirlwind evadable, its two landing notes
   rewritten with the flag.
6. "Exactly!"
7. "Rogue and ninja for sure; adventurer gets a lesser dodge. I don't
   think the rioter fits thematically. If it looks weak in the balance
   data, we can give it one." The carriers are the rogue, the ninja and
   the adventurer at a smaller share; the rioter's watch is read at the
   board on his kit, a dodge his if it reads weak (TODO's kit watches).
8. "Please elaborate?" Open; the elaboration is put with this entry.
9. "Agreed": a battle rule's `healActor` on `dealHit`, rounded, not
   booked to the healing ledger.

**Fork 8, elaborated.** How the vampire's bite heals him, as three
questions:

- *The shape.* (a) A step of its own in the ability, after the hit: the
  bite is the damage, then "heal me by 30 % of what this just dealt", as
  the Snag is a hit then a pull. (b) A setting on the damage: "damage,
  30 % lifesteal", one line shorter, but the damage's format is also the
  burn's, the bleed's and the poison's ticks and the chain's hops, so the
  schema must refuse it there or a tick could steal. Lean: (a). Worked:
  a bite of 10 heals 3; a sweep of 4 at each of three foes (12) heals 4
  (3.6 rounded); a dodged bite heals nothing; a chain steals only from its
  first target, since its later hops land on later ticks.
- *Overkill.* A bite of 10 into a foe with 2 HP left: from the 10, the
  number that floats up, the heal is 3; from the 2 HP removed, 1. Lean:
  the 10, since the heal then matches what the player saw; the other arm
  is the literal drain, and stops a big blow on a dying foe from healing
  much.
- *XP.* An ability's healing earns 3 XP a point, as damage does. Booked
  as a heal, that bite earns 30 XP for its damage and 9 more for its
  steal, when the vampire is wounded. Lean: not booked, so a vampire
  levels as fast as any fighter dealing the same damage; fork 9's
  `healActor` signed the same way.

### 165a — tranche A signed (2026-11-28)

**Fork 8 signed** (the user: "Operations, XP: signed! Overkill: This is
all happening in a chaotic fight, so I don't think the player will catch
the mismatch. I vote we go literal."): the `lifesteal` op after its hit,
not booked to the healing ledger, stealing from the HP the blow removed
(at most the HP its target had), not from the number that floats up. So
fork 1's return is the HP a strike removed, or null for a dodge. The
session's lean, put with tranche B: `healActor` literal too, so both
kinds of steal follow one rule.

**The meter's unit, the user's suggestion:** "the meter counting in whole
percentage points means that we can't represent a 1/3 rate. Maybe have it
count to 120? Or whatever the industry standard is for this type of
issue." The arms, put with tranche B: (a) a share written as a fraction,
n dodges in d strikes, the meter adding n a strike and dodging when it
reaches d, keeping the rest: the error term of Bresenham's line
algorithm, the standard way to spread n events evenly over d steps in
whole numbers, exact for every share; (b) a fixed scale of 120, exact
for halves to sixths, eighths, tenths and twelfths but not sevenths or
ninths (2,520 covers every denominator to 10); (c) whole percent, which
cannot hold a third. Lean: (a).

### 165a — tranche B put to the user: the rest (2026-11-28)

**Step zero,** read at `886314e9`:

- *A `self` heal, probed* (`scratch/165a/selfHeal.probe.test.ts`, run
  through a real World tick by its own config,
  `scratch/165a/vitest.probe.config.ts`): a `self` ability whose one op
  is a heal of 30, cast by a wounded caster at a wounded foe. With
  `rangeCells` 0 it never proposes, the foe beside it or four cells off,
  since the leap's proposer finds no landing. With `rangeCells` 3 and the
  foe four cells off it proposes once and heals the foe, 40 → 70, the
  caster left at 40, with or without a leap before it (the leap moved the
  caster to x 5, the harness's control). The code read at §164 holds.
- *A power of 0:* every reader takes it. The chip rule charges nothing
  for a death of power 0 (`src/run/chipRule.ts:142`, `:165`), the fallen
  and standing sums add it (`World.ts:1798-1817`), the HUD's exposure
  multiplies it (`chipRule.ts:78-93`), and a summon is already booked at
  0 (`World.ts:1834-1841`). The one other effect: a capped turn charges
  each pool the other side's standing power (`chipRule.ts:40-43`), so a
  standing conscript presses nothing on the enemy's pool then. Power by
  rarity is 1/1/2/3, signed at Round 11, so a power-0 common is the
  ladder's one exception.
- *An area heal is unbuilt:* the heal op heals the one target it was
  given (`interpreter.ts:239-248`), while `applyStatus` lands on every
  victim an area resolves (`resolveStatusTargets`, `:347-362`). So a
  global stun or a global `rejuvenate` needs only the selector; an
  instant global heal also needs the heal op taught an area's victims.
- *The selector's neighbours:* a burst on its caster proposes when it has
  a victim (`propose.ts:356-357`); an engaging ability's reach is its
  `rangeCells`, or a nova's radius (`archetypes.ts:44-52`), so a board
  ability's reach must read as null there, or it strands its carrier at
  an endless range.
- *The soldier's id:* the characters are `soldier`, `priest` and
  `gambler` (`config/characters.json`), and the locale keeps characters
  and units in separate files (`locales/en/characters.json`,
  `locales/en/units.json`).

**Tranche A's two leans, put with it:** the meter as a fraction, n dodges
in d strikes (the arms in the entry above), and `healActor` literal as
fork 8 is, stealing from the HP the blow removed.

**The forks,** §164's numbers:

10–11. *The self arm and its consumer.* (a) Built: a `self` ability with
   no move and no summon proposes on its cooldown while its unit has a
   target, a self-heal abstaining at full health, and a `self` ability's
   heal heals its caster; its consumer named now, the conscript's appeal
   or a part of the officer's redesign. (b) Carried to the first round
   with a consumer, with a TODO row naming the probe's result, and a
   parse refusal now: a `self` ability with ops must carry a move or a
   summon, so the heal on the wrong side cannot be authored until the arm
   exists (every shipped `self` ability passes it). Lean: (b), since a
   special made up to give a seam its consumer is the wrong way round,
   and the refusal guards the path where the mistake would happen.
12. *Global reach, the selector.* (a) A new selector, `board`, with
   `affects`: every combat-targetable unit it admits, no cells built,
   proposed when it has a victim, its reach null for the engagement
   range, refused beside a push `from: 'center'`. (b) An `aoe` with a
   board radius, its shape, anchor and ring meaning nothing. (c) A large
   radius: a radius-99 square builds 39,601 cells a fire. Lean: (a).
13. *Global reach, the aura.* An aura's `radius` takes `'board'`; the
   aura pass already measures every pair, so it costs nothing more.
   Round 14's totems are its next consumer. Lean: as written.
14. *The camps under a global `enemies`.* (a) As `affects` reads it
   today: a player's global stun stuns every camp member and leaves the
   camp passive, since only damage turns a camp hostile; Round 14's flags
   refine it. (b) A `board` selector that skips camp members, a rule
   Round 14 would undo. Lean: (a).
15. *The global special.* Its kind: (a) a global heal, instant, with the
   heal op taught an area's victims; (b) a global heal over time,
   `rejuvenate` on every ally, needing only the selector; (c) a global
   stun, `stunned` on every enemy. Its carrier: the shaman, a legendary
   kit watch at −27.9 ± 14 on v9; the stormcaller, who read strong
   (pooled +18.8); the healer; or an enemy boss, where a fight-wide stun
   is something the player plays around (the act rounds). Lean: (a) on
   the shaman, an instant heal reading as your "global heal" does, its
   cooldown long.
16. *`extends`.* A child names `extends` and gives what differs:
   `baseStats` and `growthRates` merge stat by stat, every other key
   replaces whole; its own `name` required, so no reskin shows under its
   parent's name; one level, combatants only, refused at parse
   otherwise; run once before the parse. Both editors edit the raw
   records and preview the merged one; the formatter writes a child's
   `extends` and its own keys alone; `knownAbilityIds`'s last reader goes
   in the same pass. 163a's recount becomes the checklist, each place
   with a test that fails for a new archetype missing it where none does
   today; the redraw-fisher file deleted unless a reader wants it. The
   other arms: a deep merge of every key (abilities appended, not
   replaced), or chains of parents. Lean: as written.
17. *The soldier and the conscript.* The soldier: `soldier` as his id,
   beside the character's in its own file, and an enemy only, for act
   2's realm in chaos (your words make him the mercenary where the name
   fits the fight), against a draftable duplicate of the mercenary. The
   conscript's appeal: (a) power 0, his fall costing the pool nothing, a
   cheap body that buys time, with the costs above; (b) a price under the
   mercenary's; (c) a special on the self arm (fork 10–11's (a)). Lean:
   the soldier `soldier`, an enemy; the conscript (a), a draftable
   common.

### 165a — tranche B signed (2026-11-28)

**Signed** (the user: "Agreed on the leftovers!", then "Agreed" to 10–11,
12, 13, 14, 16 and 17, and of 15 "Let's try it!"): every lean. Tranche
A's two: the meter's share a fraction, n dodges in d strikes, and
`healActor` stealing from the HP the blow removed. Tranche B: the self arm
carried with a parse refusal now; the `board` selector, an aura's
`'board'` reach, the camps as `affects` reads them; an instant global heal
on the shaman, the heal op taught an area's victims; `extends` as
written; the soldier an enemy, the conscript power 0 and a draftable
common. The spec's tranches 2A and 2B hold the design as signed.

### §165's close (2026-11-28)

**The exit by clause.** *Both tranches signed:* 165a, tranche A (fork 8
the same day, after its elaboration) and tranche B, 2026-11-28.

**What §165 hands on.**

- *To §166:* `extends` (fork 16), the checklist and its tests, the
  redraw-fisher file deleted unless a reader wants it, `knownAbilityIds`
  gone; the soldier an enemy for act 2, the conscript power 0 and a
  draftable common (fork 17).
- *To §167:* the return (fork 1), the meter as a fraction saved on the
  unit, a World bump (forks 2 to 4); the whirlwind evadable with its two
  notes (fork 5); the rogue, the ninja and a lesser adventurer (fork 7);
  whether the board shows the meter, its look.
- *To §168:* the `lifesteal` op and `healActor`, both literal and
  unbooked (forks 8 and 9), Run v52 and World v44.
- *To §169:* the parse refusal of a `self` ability with ops but no move
  and no summon (forks 10–11); the `board` selector and the aura's reach
  (12, 13); the instant global heal on the shaman (15).
- *To §171:* the rioter read on his kit, a dodge his if he reads weak
  (TODO's kit watches).

**The friction read.** Two lines filed across §164 and §165, both slips
of this session at 164: a long bash heredoc for a WORKLOG entry refused
by bash (163a's trap met again, one refused call), and two audit lines
written from memory of a code read that the code contradicted, caught by
re-reading each cite before the commit. The heredoc is a known trap met a
second time in two phases; it cost one call each time, and the Edit tool
is the route that worked both times, so it is listed and left, no rule
proposed. The cites are the evidence rule working before a commit;
listed and left. No `papercut` and no `distress` line filed, so nothing
to dispose of or quote.

**Sessions.** One session ran §164 and §165 (`40b44d9b`); it runs on into
§166's kickoff, and its report, at its end, covers both.
