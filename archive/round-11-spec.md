# Round 11 Spec — The roster

**Status: SIGNED 2026-11-05** ("Oh I like how all of that sounds,
Claude! 😁 Signing everything!"), with the phases §149 to §156, the stat
sheet added as §149 at the kickoff. The intent is the user's, verbatim
where it is theirs, from the casualty verdict (§93), Round 9's kickoff
and the trial's roll-back (§136), the re-cut (§133), the TODO rows placed
since and this kickoff (§148). What was signed before the
kickoff is listed with its date. The Open section is what the round still
has to settle, with the session's leans marked as leans. The charter is
[META-ROADMAP.md](META-ROADMAP.md) §"Round 11 — The roster"; the record
is [WORKLOG.md](WORKLOG.md) §148; the plan is [ROADMAP.md](ROADMAP.md).

## Intent (the user's words)

**The rebalance** (2026-10-28, at the hit-roll trial's roll-back,
[archive/round-9-spec.md](archive/round-9-spec.md) "What replaces it"):

> I don't think we want cadence to be decreased. The current rates feel
> good. Yes, this will buff armor, and we'll probably have to trim defense
> bases and growth, but we're due for a major rebalance Regardless.

> What we're trying to do is get new weapon mights so that unit DPS (and
> thus balance) is at least roughly equivalent.

Round 9 built the mechanical conversion; this round retunes it by taste,
snipers slow and heavy (the charter's line).

**The stat sheet** (2026-11-04 and 11-05, at this kickoff, WORKLOG
§148):

> I'd like some extra tooling that helps to quantify how comparatively
> high and low various unit stats and growths are relative to others,
> and the same for weapon stats. Something that puts it all together and
> compares a final unit's DPS versus an "average" enemy would be really
> nice too.

> given an archetype and a level, and given a target enemy level,
> construct the first unit with the expected stats of the archetype at
> that level, and then construct an "average enemy," with stats equal to
> the expected value of the average base plus the average growth rate,
> and then do the damage calculations to get an expected DPS versus the
> expected DPS received.

> 1. We'd ignore range. Assume the attacked unit is in range and not
>    moving. Thus these are really maximum possible DPS numbers.
> 2. Oh, the question is what we're taking the average over. Maybe over
>    units fielded in encounters? Except I'd guess we'd want to split
>    that up by sector, so that would be another input. 🤔 Ah, but if
>    we're doing that, rather than input a target enemy level, you may as
>    well just extrapolate the player unit's level to a full hand and
>    churn that through the wave calculations...

The session's reply, signed with "I like how all of that sounds": the
inputs are an archetype, a level and a sector. A full hand at that level
resolves the sector's waves through the game's own `resolveWave`, since a
wave's count and level budget follow from the hand. The damage is
computed against each fielded enemy type and then averaged, because the
floor of 1 makes damage against an average enemy's stats misread units
near it. Time to kill is shown both ways beside the DPS. A hand against a
wave as a team fight stays the sim's question, as a forced-encounter
run.

**Power by rarity** (2026-09-05, the casualty verdict, item 4,
`archive/post-88-worklog.md` §93): "More diversity in unit power —
instead of 1 / 1 / 1 / 2 by rarity, perhaps 1 / 1 / 2 / 3 or even
1 / 2 / 3 / 4." With it: "A whole new round of health pool inflation …
not exactly urgent."

**The area-status enemies** (the same verdict, item 7a): the banshees
"NEED a rework at some point — 'really annoying'". Their mechanism half
shipped in Round 7; the retune half is this round's.

**The idols and the bandits** (2026-10-26, the re-cut,
`archive/post-118-worklog.md` §133, 133c):

> Idol of Mars feels too strong. I'd like to split it up into smaller
> ones that buff just one of strength, range, and magic.

> I'm inclined to make bandits non-draftable. They just kinda don't have
> any purpose.

**Dis Pater's tithe** (2026-10-26, 133d): rounded once on a turn's
total, "that is indeed what I meant for Dis! 😂", so his `--grant` read
runs on the tithe as built.

**Ability descriptions** (the same sign, 133d): "Signing your ability
description changes also": a `description` on the ability schema and a
line on the card, so each later round writes its abilities' text as it
authors them.

**Act 1's cost** (2026-11-03, at 146e's stop): "Round 11 makes sense to
me! 😁", a cost target per kind signed at this kickoff, on the pool as
it is now, and act 1's encounters read against it after the retune.

**The wolf** (2026-11-01, at 144e's stop, TODO's row): if it plays as a
plain biter beside the other beasts, it takes Gambit's retreat.

**The units' lines** (2026-11-02, 145c): a one-line description for each
unit, the user's to write, as a set.

The blind fix's rule is the user's lean of 2026-10-15, pending testing
(TODO's row): a blinded unit wanders and strikes only within its
acquisition range. The kit watches, the priest's parity, the wall watch,
power's growth key and the four board instruments (BALANCE's header, the
ceiling label, the arbitration's walk loss, the skill gradient's leg)
are the sessions' findings, not the user's words, each signed into
the charter or TODO with its date.

## Signed before the kickoff

- The charter, scope, decision points, exit and scope guards (133d
  tranche 2a, 2026-10-26), amended at Round 10's close in three lines and
  its exit (147a, 2026-11-03): the kit watches without the bandit; N28
  with the roster table's guard failing on a recorded roster that holds
  an archetype no longer draftable; the wall watch read on this round's
  board, the terminal band's re-set at Round 22; the exit as the board
  read, act 1's bands re-pinned and signed, acts 2 and 3 recorded for
  Rounds 21 and 22, the prior table rebuilt.
- **Save:** a Run bump, `mars` removed (the charter).
- How the re-cut's rounds run (133d tranche 1): each round ends in an
  upload with something a player can meet; a round that changes combat
  closes with a board read as paired same-seed deltas against the round
  before (here, 146f's board); each act's bands are re-anchored in the
  round that lands the act.
- At Round 10's close (147d): BALANCE's header read before the retune,
  the ceiling label, the arbitration's walk loss and the skill gradient's
  leg before the closing board; the Cursor's hand-off pass on trial.

## The code under the round

Read at `1ded6293`. Nothing under `src`, `config`, `tools` or `scripts`
has changed since 147a's read at `d0f557bf`, so its premises stand; the
audit, with its files and lines, is WORKLOG §148. In short:

- Every number the retune moves is config; `tests/strike-conversion.test.ts`
  pins the conversion against its frozen before-file, and its header
  already says the retune retires it.
- Power is 1/1/1/2 by rarity; every `growthRates.power` is 0, yet a
  recruit's level-up still draws for it.
- Mars is one daemon, one empower a turn of +4 strength, +4 ranged and
  +8 magic. A saved run holding a daemon id the catalog lacks throws on
  load, so removing `mars` is the charter's Run bump.
- Bandits leave the draft by one flag; the prior table's guard flags the
  change, the roster table's does not, and v5 holds 107 of its 25,657
  rosters with a bandit.
- The ability schema has no `description`; the unit schema has one, and
  only the six beasts fill it.
- Act 1's pool cost an instance at 146f runs from 0.02 (the rats' nest)
  to 22.5 (the cats), against BALANCE's guide of normal ≈ 3, elite ≈ 6,
  boss ≈ 10, set when the pool was 20; it is 40 now.

## Open

The calls, in tranches, with the session's leans; WORKLOG §148 holds the
reasons.

### Tranche 1 (the kickoff), signed 2026-11-05

1. **The spec and the phases:** this spec, and §149 to §156 in the
   order WORKLOG §148 gives (the stat sheet; the board's instruments; the
   content; the weapons and defense; power and the pools; the kits; the
   closing board; the close).

### Tranche 2 (after tranche 1's sign, or at its phase's kickoff)

- *This kickoff, after the phases:* act 1's cost target per kind,
  signed 2026-11-05 at the lean: normal 10 %, elite 30 %, boss 50 % of
  the pool, each fight within ½× to 1½× (BALANCE "Per-kind target
  bands").
- *§149:* abilities past the main attack (cooldown specials, damage over
  time, area attacks per target); a heal-per-second column; the idols as
  a toggle; Escalation as an input; the check against the swing read
  and its tolerance.
- *§150:* the arbitration's walk loss: how far to chase it, and the
  box's size if a run is needed.
- *§151:* the idols' provisional sizes; who drafts the abilities' text.
- *§152:* each weapon's might and cadence and the defense numbers, taste
  stops, with the user's play.
- *§153:* power's scale (1/1/2/3 or 1/2/3/4).
- *§154:* each kit change, the kiter under blind, the idols' sizes, the
  wolf.
- *§155:* the box's size and cost.
