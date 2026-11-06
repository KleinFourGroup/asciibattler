# WORKLOG — Round 11 (The roster)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 11's phases so far:
[archive/worklog-phase-149.md](archive/worklog-phase-149.md) (the
kickoff, §148, and the stat sheet, §149) and
[archive/worklog-phase-150.md](archive/worklog-phase-150.md) (the board's
instruments, §150). Round 10's are `archive/worklog-phase-142.md` to
`archive/worklog-phase-147.md`.

## Phase 151 — the content

The kickoff's inputs, by pointer: the charter, ROADMAP §151;
META-ROADMAP §"Round 11 — The roster" (N28, N24, A33); the roster table
v6 holds a bandit in 66 of its battles (archive/worklog-phase-150.md,
150h); `process/planning.md` "Phase kickoff".

### The kickoff's audit, and the cut put to the user (2026-11-06, session 3d0a8fc1)

Read at `bda09e6e`.

- *Mars is the Soldier's start daemon* (`config/characters.json`,
  `"daemon": "mars"`, his description "marching under the Idol of
  Mars"), so removing it decides what the default company starts with.
  Mars is also one of the eleven entries, at weight 1, in the daemons
  reward table (`config/rewards.json`), and is priced 40
  (`config/prices.json`). No event names him.
- *The board's ARM empowers blind to stats.* `--empower=level:hi`
  (`tests/fuzz/board/board.ts:211`) picks the highest-level hand card
  (`tests/fuzz/empowerPolicy.ts:130`). Under Mars every attacker uses a
  stat he raises; under one-stat idols the same rule would spend +4
  ranged on a mercenary, and the Soldier's rows would fall for the bot's
  reason, not the game's.
- *The buff's key.* Mars's empower is `honed`, merged by key with `add`,
  with a colour and the label "Honed" (`src/render/statusDisplay.ts:113`,
  `locales/en/ui.json:61`). Three idols sharing it need no new colour or
  label; a card empowered by two of them shows one badge with both mods.
- *The prior table* has no Mars row: the Soldier's start daemon is
  acknowledged PENDING, derived from his config
  (`tests/prior-table-coverage.test.ts`). After the split the two idols
  he does not start with have no row, and the fold prices them at 0 until
  a rebuild. `unit:bandit`'s row (n 509) goes stale at N28, and rule 2
  fails on a stale row, with no acknowledgment for one.
- *The roster table's* rule 2 asks only that an archetype exists
  (`tests/roster-table-coverage.test.ts`). v6 holds a bandit in 66 of its
  28,551 battles: the sum of `n` over the rows holding one, the control
  the sum over every row, which equals the table's own `battles`. Its
  only consumer is `--roster=sampled` (the run, search and sweep
  commands); no board row reads it.
- *Both tables' sources are on this machine*: the eight
  `output/board-runs/150h/arb-*/rosters.csv` and the three
  `output/box-batches/*-4c4fecec/decisions.csv`. A rebuild under the new
  catalog needs no box.
- *The bandit* leaves the draft by `draftable: false`. His price row (25)
  is read when a port stocks him or a player sells one
  (`unitPriceFor`, `src/config/prices.ts:130`), and no character's roster,
  reward table or event grants him, so out of the draft nothing reads it
  and it goes with the flag. He stays an enemy in the camps and the
  encounters.
- *The save.* `RUN_SCHEMA_VERSION` is 50 (`src/run/Run.ts:305`). A slot
  at another version is `rejected: stale` (`src/store/runSlot.ts`), and
  the menu shows `save.rejected`, "saved by an older version of the game"
  (`locales/en/ui.json:207`). `tests/integration/save-across-map.v50.json`
  holds Mars.
- *The strike-conversion test* reads Mars's mods out of
  `config/daemons.json` (`tests/strike-conversion.test.ts:125`) and
  throws once he is gone. It still retires at §152's first commit.
- *The ability's text.* 29 abilities in `config/abilities.json`. The
  schema's `name` is prose, addressed `abilities.<id>.name`, so a
  `description` joins the i18n extract. The attack editor's formatter
  writes each field by name (`tools/attack-editor/format.ts:170`), so a
  save from it would drop a field it does not know. The card's ability row
  is `abilityRow` (`src/ui/UnitCard.ts:652`): the name, the detail line,
  the cadence.
- *The units' lines.* 23 combatants have none: the 29 less the six
  beasts. They are the 16 draftable after N28 and seven that are enemies
  only (the bandit, the ice mage, the warlock, the luminant, the banshee,
  the ghoul, the prodigy).
- *The corpus* replays past the config stamp, so it proves the
  description steps inert; N28 and N24 change behaviour, so each records
  it again (`--record`, `tests/fuzz/corpus/corpus.ts`).
- *By URL*, `?daemon=<id>` starts a run with a catalog daemon in place of
  the character's (`src/run/RunConfig.ts:184`).

**The cut** (Run v50 to v51 at 151c; no RNG stream added; no box):

- **151a — the empower, by stat** (`none`). `level:hi` picks the
  highest-level hand card whose abilities scale with a stat the granting
  buff raises, else the highest-level card, as now. Exit: under Mars,
  byte-identical on the ARM's shape; the failing control, a planted
  one-stat buff on which the old rule picks a card that does not use it.
  The fuzz smoke and the jobs parity fire (`tests/fuzz/`). A
  pre-registered stop: if a Mars run moves, the moved rows go to the
  user, since the change would then move 150h's refs before the idols do.
- **151b — bandits out of the draft** (`none`). `draftable: false` and his
  price out. The roster table's rule 2 becomes "every archetype in the
  table is draftable", its planted case failing and its control passing.
  Both tables rebuilt from their own 150h sources under the new catalog,
  each builder dropping what is no longer draftable or acquirable and
  naming the count: the roster table v7 with 66 battles out, the prior
  table without `unit:bandit`'s row, each diff showing nothing else moved.
  Exit: no bandit in a draft or a port's stock over a seed window, read
  against the raw config. Every draft and port roll moves, from a smaller
  common tier; the fuzz smoke fires; the corpus recorded again.
- **151c — the three idols** (`batch`). `mars` out and three one-stat
  idols in at the provisional sizes, one empower a turn each, the `honed`
  key shared; the Soldier's start idol and his description; Run v50 to
  v51, the v50 fixture kept as a rejected save pinned to its message and a
  v51 one recorded; the prior table's PENDING for the two idols he does
  not start with, until §155's rebuild; the strike-conversion test told
  Mars left. Exit: each idol in play by `?daemon=<id>` and in a port's
  stock; a v50 save rejected with its message. The reward and port rolls
  and every Soldier battle move; the fuzz smoke fires; the corpus recorded
  again. *Read:* a new run as the Soldier; at the pre-turn gate his idol
  offers one empower, +4 to its one stat, the card badged "Honed"; wrong
  looks like Mars's three stats, or no prompt; the other two by
  `?daemon=`.
- **151d — the ability's `description`** (`none`). An optional prose
  field on the ability schema, the attack editor's field with its
  formatter carrying it, the i18n extract. Exit: a description
  round-trips an editor save, the old formatter its failing control; the
  corpus replays green. The fuzz smoke fires and stays byte-identical.
- **151e — the abilities' lines and the card's line** (`stop`). The 29
  lines, the field required from here, and the line on the card's ability
  row, its look drawn in two arms at the stop. Exit: a line on every
  shipped ability's card. Byte-identical; the corpus green.
- **151f — the units' lines** (`none`), the user's, as they are written:
  23 lines in the archetype editor, committed with a test that every
  combatant has one. The words are the user's, read as written, and the
  line's place on the card shipped at 145c. It runs beside the round and
  does not hold §151's close.

*Why this order:* the bot before the idols, so the idols are read by a
bot that spends them where a player would; the bandits before the idols,
since both touch the prior table's guard and the smaller change goes
first; the ability text after the content, so the stretch ends at its one
stop, where 151c's batch read is read too. *Between §151 and §155* the
ARM prices the two idols the Soldier does not start with at 0; §153's
kickoff decides whether its box read needs the prior table rebuilt first
(150h's recipe, 31 CPU-hours).

**The calls, with the session's leans:**

1. *The cut and its reads* as above.
2. *The Soldier's start idol:* the strength one. Six of his ten cards are
   mercenaries, so his hand nearly always holds a card it fits, and a
   mercenary company under the strongman keeps his line's fiction. The
   ranged one is the near alternative, which keeps the buff on his four
   archers; whether that is where Mars felt too strong is a guess, not
   measured. Uncertain between the two; none at all is the third arm.
3. *The idols' names and provisional sizes:* the Idol of Hercules (+4
   strength), the Idol of Diana (+4 ranged), the Idol of Hecate (+8
   magic): Mars's own number for each stat, one empower a turn, price 40
   each, weight 1 each in the daemons reward table, so one of the three
   comes up 3 times in 13 where Mars came up once in 11. The sizes stay
   §154's.
4. *Who drafts the abilities' 29 lines:* the session, from each ability's
   shape, edited by the user at 151e's stop.

### The cut signed (2026-11-06, session 3d0a8fc1)

The user signed the cut and its reads ("that generally looks good"),
with these calls over two replies:

- *Mars stays as the strength idol* ("keep the 'strength' daemon as
  Mars, since that thematically makes sense"), with Diana for ranged and
  Hecate for magic. The Soldier keeps him, the session's lean for his
  start. So the id `mars` stays and the prior table's acknowledgment for
  the Soldier's start daemon is unchanged; the Run bump stays, as the
  signed exit has it, so no save made under the old catalog (Mars on
  three stats, bandits in the draft) goes on under the new one. The
  charter's "`mars` removed" is amended in ROADMAP and META-ROADMAP.
- *The daemons off "Idol"* ("so many of our daemons are idols, and it
  reads as repetitive"), each named for an object of its god, since a
  daemon is an item the company carries; the renames ride 151c and its
  batch read. Signed: Spear of Mars, Quiver of Diana, Torch of Hecate,
  Aegis of Minerva, Coin of Mercury, Mask of Janus, Sigil of Laverna,
  Key of Portunus, Wheel of Fortuna, Pact of Dis Pater; the Cornucopia
  and the Patrician's Seal as they are. The session's Mint of Moneta and
  Shrine of Laverna were refused as not portable, and "Pact with" as
  reading oddly. Moneta's is the user's Bounty of Moneta, with the
  session's note that a bounty is a reward, not an object, and Scales of
  Moneta (her coins show her with a balance) the alternative; settled
  before 151c.
- *The sizes* at the lean: Mars's own number for each stat, one empower
  a turn, price 40 each, weight 1 each in the daemons reward table; §154
  sets them.
- *The abilities' lines:* the session drafts all 29, terse and plain.
  Eleven are not weapons (seven spells; the heal, the gambit, the dash,
  the inspire), and the user counts them mundane by gaming standards
  too; the user leads the flavour when the special abilities come.
- *Not this round:* "I want to start diversifying from the Roman
  aesthetic also, but I think that can be a future point" (TODO, "Not
  yet placed").

### 151d — the ability's `description` (2026-11-06)

Built ahead of 151a's stop, since it rests on nothing 151a decides. An
optional prose field on `AbilityDefSchema` (`src/sim/effects/schema.ts`),
addressed `abilities.<id>.description`; the attack editor's Description
input; and its formatter writing the line after the name when present
(`tools/attack-editor/format.ts`). No ability has one yet, so
`locales/en/abilities.json` is unchanged; 151e writes them and makes the
field required.

Checks: the formatter's new test round-trips a description and omits an
absent one, failing on the old formatter (its control) and passing on the
new; `npm run corpus`, 0 of 33 journals differ; the typecheck clean; the
i18n tests, 85 passed.

### 151a — the empower, by stat (2026-11-06, at its stop)

Built: the `level` policies take the grant's buff and look only at the
cards whose abilities read a stat it raises, or at the whole hand when
none does (`tests/fuzz/empowerPolicy.ts`). `scalingStatsOf` walks the
parsed defs for every op's `scaling` and every scaled value's `stat`,
`none` and `level` aside. Both callers pass the grant's `effect.buff`:
the gate walk (`tests/fuzz/gateWalks.ts`), which the rollouts' walk goes
through too, and the ARM's nominee (`arbitratedStrategy.ts`). `scored`
and `random` are unchanged. Not committed at the stop; the patch is
`scratch/151/151a.patch`.

Step zero changed the cut's prediction. The corrupter's vial scales on
nothing and the rioter's molotov on luck, so neither reads a stat Mars
raises: under Mars a hand whose highest-level card is one of them now
empowers the next card, where the old rule spent Mars on it for nothing.
Byte-identity under Mars was the exit, so this is the pre-registered
stop.

Checks:

- The helper's stats per archetype equal a re-derivation from the raw
  config files, all 29. Under the three-stat buff the draftable
  archetypes it passes over are the corrupter and the rioter alone, and
  a hand led by any other draftable keeps its pick.
- The planted control: a level-5 mercenary and a level-3 archer under a
  ranged-only buff, where the old rule takes the mercenary and the new
  the archer. A buff no ability reads (defense) keeps the old pick.
- Against 150h's board at `8a63a20e`, seeds 1 to 30, run locally: the
  deploy row (act 1) 29 identical and seed 10 moved; the walk-deploy row
  26 identical and seeds 8, 10, 15 and 23 moved, every outcome and final
  hop unchanged. A probe line, not committed, logged each pick the new
  rule changed, read on serial re-runs since the `--jobs` workers do not
  forward stderr: deploy seed 10, one pick, a level-9 corrupter passed
  over for a level-9 archer; on the walk, one pick each: seed 8 a level-17
  corrupter for a level-14 archer, seed 10 a level-9 corrupter for a
  level-9 archer, seed 15 a level-10 rioter for a level-9 mercenary, seed
  23 a level-10 corrupter for a level-10 mercenary. Each serial re-run's
  row equals its `--jobs` row.
- Not run: the ARM rows. Their nominee and their rollouts call the same
  selector, so they move at least where doctrine does, and likely more,
  since every rollout walks the grants.

The decision at the stop, with the session's lean: commit 151a now and
go on to 151b. 151b and 151c move every run next, and 150h's refs are
re-pinned at §155, so holding it saves no re-pin; the other arm, keeping
the old pick under Mars alone, carves out a daemon 151c narrows anyway.
