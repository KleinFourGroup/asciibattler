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
