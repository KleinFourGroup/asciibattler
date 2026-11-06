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

**151a signed** (the user: "Signing your lean, Claude! 😁"): committed
ahead of 151b.

### 151b — bandits out of the draft (2026-11-06)

`draftable: false` on the bandit and his price row out. Two findings at
step zero, each inside the step's intent:

- *A scripted port* took any archetype (`src/run/RunConfig.ts`), and a
  port prices its units by the price book, which throws on an unpriced
  one (`unitPriceFor`): `port=ghoul` already, and `port=bandit` once his
  price went. A scripted port now drops a unit no player can draft, with
  the other bad goods' warning.
- *The roster guard's rule 2 as cut* ("every archetype in the table is
  draftable") failed on the shipped table for the bandit and for the
  prodigy, whom an event grants (`grantUnit`), so a player's roster holds
  him without a draft. Rule 2 asks instead whether a player can hold the
  archetype: the draftable, and what an event grants, a reward table holds
  or a character starts with. The guard reads that from the raw event,
  reward and character files; the builder's `holdableArchetypes` from the
  parsed catalogs, a test holding the two equal.

The tables, rebuilt from their own 150h sources with no box: each builder
drops what no player can hold or no site can offer and names the count
(`dropUnholdable`, `dropUnacquirable`, each with a planted case and its
control). The roster table v7 dropped 66 rows holding a bandit, 28,551
battles to 28,485, and equals v6 less those rows; the prior table v7
dropped `unit:bandit`'s row (n 509), 35 items to 34, and equals v6 less
it. In each, the provenance differs from v6's in the build head, the time
and the note alone. On the shipped v6 tables both guards failed on the
bandit alone; on v7 both pass.

Checks: the draft's literal exclusion list with the bandit, and a port
scan of 30 seeds read against the raw config (on the old config, 9
bandits stocked; on the new, none); a scripted port dropping a bandit and
a ghoul. `npm test` and the fuzz smoke green. The corpus: a replay on the
old baseline differed on 13 of 33 journals; recorded again, none of the
33 paid a unit off, so `corpus.test.ts` failed on the command kinds; a
survey of chaos seeds 1 to 40 on its four dial sets found one run that
pays a unit off, chaos 33, added; recorded again, 34 journals, 0 differ,
20 of 21 command kinds change a run, `corpus.test.ts` 38 passed.

### 151c — Mars narrowed, Diana and Hecate, the renames (2026-11-06)

The user's last names (2026-11-06: "Cloak and scales are objectively
better; let's go with those!"): the Cloak of Laverna and the Scales of
Moneta. Built: Mars (`mars` kept) +4 strength alone, the Spear of Mars;
`diana`, the Quiver of Diana, +4 ranged; `hecate`, the Torch of Hecate,
+8 magic; each one empower a turn under the shared `honed` key with
`merge: add`, priced 40, weight 1 in the daemons reward table after Mars.
Every daemon off "Idol" as signed, and the three character lines with
them. Run v50 to v51; the fingerprint's diff is its version line alone.

- *The v50 save.* `save-across-map.test.ts` said a bump turns it into
  the rejection check, never re-recorded, so no v51 save was recorded (the
  cut's "a v51 one recorded" dropped). It now pins: `Run.fromJSON`
  refuses it; the run slot, stamped 50, rejects it as stale before
  loading, keeps its text, and the player reads `save.rejected`; the
  control, the same save stamped at v51, loads.
- *The strike-conversion test* reads Mars's ranged and magic at Diana's
  and Hecate's keys (`MOVED_AFTER`), the converted 4 and 8, until it
  retires at §152.
- *The prior table's guard* acknowledges `daemon:diana` and
  `daemon:hecate` PENDING until the closing board's rebuild; the fold
  prices them at 0 until then. Mars stays acknowledged as the Soldier's
  start daemon.
- *A mirror of the empower policy* in `arbitratedStrategy.test.ts` called
  the selector without the buff; with Mars on strength alone it no longer
  matched the policy path, so it passes the grant's buff as the path has
  since 151a.

Checks: the catalog's pins (thirteen daemons; Mars, Diana and Hecate one
attack stat each under one key, Minerva defense under her own);
`daemon=mars|diana|hecate` start a run with that daemon and round-trip,
an unknown id starts none; a Soldier's ports over seeds 1 to 120 stock
Diana 17 and Hecate 9 times and never Mars. Hecate stocked none of the
first 30 seeds' 60 slots, and over 120 seeds 9 where 20 is the mean, the
lowest of the twelve; `sampleDistinct` is an unweighted partial
Fisher–Yates, so the session reads it as chance. `npm test` 3955
passed; the fuzz smoke 587 passed. The corpus: a replay differed on 34 of
34 journals (the renames alone change the event payloads), recorded
again, 0 of 34 differ, 20 of 21 command kinds, `corpus.test.ts` 38
passed.

*Read at 151e's stop (batch):* a new run as the Soldier; at the pre-turn
gate the Spear of Mars offers one empower, +4 strength, the card badged
"Honed"; wrong looks like three stats, or no prompt. Diana and Hecate by
`?daemon=diana` and `?daemon=hecate`; the new names on the character
select, the ports and the rewards.

### 151e — the abilities' lines and the card's line (2026-11-06, at its stop)

The 29 lines, terse and plain as signed, each saying what the card's
numbers don't: the floor of ten abilities ("Can't hit an adjacent foe.",
the catapult's "within four cells"), the arc over walls, the heal's
target, the gambit's spring back, the summon's cap and its level with
magic, the luck-lengthened statuses, the chain's falloff. The weapons and
the beasts' attacks name themselves. Written into `config/abilities.json`
where the attack editor's formatter puts them (its test reproduces the
file byte for byte); the locales re-extracted, 356 addresses to 385.

The guard: a test over the raw config file that every ability has a
non-empty line and the loaded catalog the same, its control a planted
def without one and one with a blank. The schema keeps the field
optional, so the many synthetic defs in the tests need none; the test
is the requirement for what ships.

The card, arm A as built: the line under the ability's name, italic at
0.6 opacity as the unit's own line is, above the numbers
(`unit-card__ability-description`). Read in the Browser pane (Chromium,
1280×720, seed 3, the Soldier with `daemon=diana`, the first pre-turn
gate): six hand cards, a line on each row. A line adds 30 px to a card
there (the bow's wraps to two lines); without it the hand already ran
27 px past the window's bottom, and the pre-turn screen scrolls to it.
Arm B, drawn by a temporary change not committed: the line as a tooltip
on the name, the card's height unchanged. Screenshots:
`scratch/151/arm-a-line.jpg`, `scratch/151/arm-b-tooltip.jpg`.

151c's read points seen in the same pane: the character select names the
Spear of Mars, the Aegis of Minerva and the Mask of Janus; `daemon=diana`
opens with "Quiver of Diana — once per turn, empower a unit: +4 RNG" and
its grant chip "+4 RNG, click a card to empower"; the Soldier's own gate
reads "Spear of Mars — +4 STR". Not seen: a card empowered and badged,
and the ports and rewards with the new names (headless pins cover the
stock).

### The hand-off after 151e (2026-11-06, session 3d0a8fc1)

Handed off at the context trigger, at 151e's stop. Done: 151a, 151b and
151d (each `none`, signed or oracle-read), 151c and 151e built and open
(◐). Open, all at 151e's stop, put to the user in this session's last
message and to be put again by the next: the card line's look (arm A,
built: the line under the name; arm B, a tooltip on the name; the
session's lean B, since the hand already runs past a 1280×720 window and
the lines will grow when the special abilities get flavour); the 29
lines, for the user's edits; 151c's batch read (WORKLOG 151c, "Read at
151e's stop"). 151f, the units' 23 lines, waits on the user's writing
and does not hold the close. Files no doc names: the two arms'
screenshots, `scratch/151/arm-a-line.jpg` and `arm-b-tooltip.jpg`; arm B
is a one-line swap in `abilityRow` (`src/ui/UnitCard.ts`): drop the
description div for `attachTooltip(name, () => def.description!)`, and
its CSS rule with it.

### 151e-post — arm B, the reach's floor, the lines; 151c and 151e read (2026-11-06)

The stop put again and answered (2026-11-06: "Signing all of your leans,
Claude, and the read looks good!"). The leans signed: arm B, on the
condition that the floor goes in the numbers, since DESIGN says a tooltip
is never the only channel for what the player acts on, and "reach 3" on a
bow that can't fire at 1 said otherwise; the ten "Can't hit…" clauses
out with it; Inspire's line made to say what "inspired" does. 151c's
batch read signed in the same words.

- *The catapult's line was a cell off.* `firingBandCell` fires at a
  distance at least `minRangeCells` and at most `rangeCells`, so the
  catapult's floor of 4 fires at 4 to 6, and "within four cells" read as
  including four. The clause went with the other nine; the numbers now
  say `reach 4–6`.
- *The two new lines are the session's:* the bow, whose line was only its
  floor, "A short bow."; Inspire, from the status (+2 mobility, 5 s,
  `config/statuses.json`), "Nearby allies move faster.", no number in it
  to go stale.
- *The text site* takes the star run's touch route: a long press on a
  card that is a control (the pre-turn hand, read `press` on all six),
  a tap where it isn't (the roster modal, `tap`). Tab reaches each name.
- The exit's "a line on every shipped ability's card" holds as the name's
  tooltip; the test that each ships one stands.

Checks: the reach test reads the raw config, ten floored abilities
among those with a reach, 0 wrong; its control, the old bare reach, fails
it 2 of 2. `npm test` 3959 passed, the fuzz smoke 587, typecheck clean.
Read in the Browser pane (Chromium, 1280×720, seed 3, the Soldier, the
first battle's pre-turn gate): the bows read `reach 2–3`; the cards 380
px, ending at 747 px, the same 27 px past the window as the line-less
baseline, so neither change costs height (the bow's numbers already ran
two lines); hovering the Bow opens "A short bow." in the roster and on
the hand (`scratch/151/post-b-tooltip.jpg`). Tab from the first card
lands on its Bow, `:focus-visible`, and opens the line over it (the box
centred on that name, 8 px above it, not on the hovered one). Not seen:
the touch route, a long press on the hand, and anything in Firefox.

### §151 closed (2026-11-06, session bc61973d)

**The exit** (ROADMAP §151), each part with its step: no bandit in a
draft or a port's stock, the draft's exclusion list and a 30-seed port
scan read against the raw config, 9 bandits stocked on the old config
and none on the new (151b); the roster table's guard failing on its
planted case, both guards failing on the shipped v6 tables on the bandit
alone and passing on v7 (151b); the three idols in play by URL,
`daemon=mars|diana|hecate` each starting a run with that daemon and
round-tripping (151c); a v50 save rejected with its message, the run
slot rejecting it as stale and the player reading `save.rejected`, its
control the same save stamped v51 loading (151c); a line on every
shipped ability's card, the guard over the raw config with a planted def
without one, the line the name's tooltip since 151e-post (151d, 151e).
*The scope guards:* across §151 (`git diff bda09e6e..827e06fb --
config/`) the numbers that moved are the charter's alone: the bandit's
draft flag and his price (151b); Mars's ranged and magic moved to Diana
and Hecate at Mars's own sizes, +4 and +8, each priced 40 at weight 1
in the daemons table (151c); the rest is prose, the 29 ability lines and
the renames. The idols' sizes stay provisional for §154. 3959 main tests
in 272 files and 587 fuzz:smoke in 60 at `83cb01ed` (its hook), the jobs
parity 1 of 1 and the journal corpus 38 of 38 on the same code. 151f, the units' lines, is carried past
the close as signed at the cut. What §151 hands on: the
strike-conversion test reads Diana's and Hecate's keys (`MOVED_AFTER`)
until it retires at §152's first converted number; `daemon:diana` and
`daemon:hecate` PENDING in the prior table's guard until the closing
board's rebuild; the idols' sizes to §154.

**The friction read**, the four slips filed in §151 and its two session
reports (3d0a8fc1, bc61973d):

- *A failure hidden by a filter on the output*: the pre-commit hook piped
  through `tail -4` (151c; the failing step unrecorded and a flake
  unidentified, about 5 min of re-runs and a lost data point), and a
  restore's `2>/dev/null` hiding that its backup was elsewhere
  (151e-post; one call, the control's edit left in the file until a grep
  showed it). Before this phase, a commit's hook behind a filter twice:
  132d (a missing message file hidden, about 70 s) and 136f (a commit
  piped into `tail` and chained to a push; the hook failed and `tail`'s
  exit 0 let the push run). It recurred and cost something, so it goes
  to the user as a candidate. The rule exists
  (`process/shell-and-windows.md`, "A filtered result is not the
  result") and each instance broke it, so the lean is a guard, not a
  rule: the shell guards' module (`.claude/skills/context-meter/hooks/`)
  refusing a top-level `git commit` whose output is piped to a filter,
  its message saying to log the hook to a file and read the file. It
  would have caught three of the four; a stray `2>/dev/null` it would
  not.
- *A line written before its source was read*: the catapult's "within
  four cells" from the floor's rule without the band's inclusive bound
  (151e, filed after the hand-off; it reached the user in the stop's
  table and was caught against `firingBandCell` before an edit), and a
  WORKLOG check line citing `src/ui/tooltip.test.ts` for the Tab and
  touch routes before it was opened (151e-post; caught before the
  commit, one check). It continues §150's *a figure carried without its
  source*, which the user answered at §150's close the same day with no
  rule; neither instance here shipped and neither is new to that answer,
  so it is listed, not put again. 151e-post took the floor's prose out:
  the numbers print it from config, under a test on the raw file.
- *A shell guard refusing a command before it ran*: the stdin guard on a
  python heredoc chained to a node fallback (151-kickoff), and the two
  refusals for quoting in 3d0a8fc1's report; a resend each, the guards
  doing their job. Listed, not a candidate.
- *The corpus re-picked by seed*, from 3d0a8fc1's report: its trade rows
  lost a command kind again at 151b (chaos 33 added after a 40-seed
  survey), after re-picks at 145g and 146e (the report counts four). Not
  a rule or a guard; a TODO row under Round 11, "The corpus's trade rows,
  picked by what they drive".

No `papercut` was filed in §151, so none needs a disposition; the four
slips are counted by trap at the round sweep. No `distress` was filed,
and neither report records a wish to pause or stop.

**The candidate, signed and built.** The user, 2026-11-06: "Let's build
that guard, Claude! 👍 That one makes a lot of sense". The commit-pipe
guard (`.claude/skills/context-meter/hooks/commitpipe.ts`) refuses a
`git commit` whose output a pipe carries into another command, reading
the command through the stdin guard's parse, lifted out of `stdinStall`
as `commandsIn`. Checks: `tests/shell-commit-pipe.test.ts`, 23 cases
(the four instances' shapes and seven more to refuse, eleven to let
through), with two planted controls, a guard blind to the pipe (4
failed) and one that refuses nothing (12 failed); the mod's hooks
type-checked against Claude Code 2.1.317's declarations, a planted type
error failing the same check. Replayed over the retained transcripts'
20,948 main-chain Bash calls, it refuses 753 of the 1,894 that name a
commit, in 112 sessions (442 into `tail`, 305 into `grep`, 6 into
`sed`), the three piped commits among them (132d's session 60e58d62,
136f's 37c3d345 with its push, 151c's 3d0a8fc1; the fourth instance,
this session's `2>/dev/null`, is no commit), and throws on none; the stdin guard's verdict is the same through
the lifted parse as through HEAD's on every one (35 stalls, 0 differ).
The count is the cost: piping the commit is the habit, 2 to 16 a session
in the last two weeks, so a session is likely to meet the refusal once
before it switches to logging the commit to a file. The replay is
`scratch/151/commit-pipe-scan.mjs`. The mod loads in a fresh session, so
the guard was not seen refusing live here.
