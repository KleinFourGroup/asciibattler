# Round 10 Spec — Act 1, the wilds

**Status: SIGNED 2026-10-30** ("That looks great to me, Claude!
Signed!"), with the phases §142 to §147 and the scripted run's starting
act; tranche 2 stays open for the phases that need it. The intent is the user's,
verbatim, from §133, where the round was cut, from Round 9's kickoff,
where the act design was answered, and from the TODO pass of 2026-10-13.
What was signed before the kickoff is listed with its date. The Open
section is what the round still has to settle, with the session's leans
marked as leans. The charter is [META-ROADMAP.md](META-ROADMAP.md)
§"Round 10 — Act 1, the wilds"; the act design is
[plans/acts.md](plans/acts.md); the record is [WORKLOG.md](WORKLOG.md)
§141; the plan is [ROADMAP.md](ROADMAP.md).

## Intent (the user's words)

**The acts** (2026-10-26, `archive/post-118-worklog.md` §133, 133c's
third batch):

> Act 1: mainly fighting fauna, with some bandits thrown in.

The fauna, the same day: "all 1x1 melees": wolf, (giant) rat, eagle, fox,
puma, tiger, crab, "...You get the idea". The eagle and the crab wait for
traversal (Round 19), so this round's are the five ground ones.

**The act design, answered** (2026-10-27, Round 9's kickoff,
[archive/round-9-spec.md](archive/round-9-spec.md) "The act design,
answered"):

> 1. For now, it's one sector per act. I intend to flesh that out later.
>    Act 1 definitely stays grassland for now, at least.
> 2. I think that we stay at 11 for now, actually. I'm okay with a longer
>    run.
> 3. My thought is that we just create a placeholder 1x1 bear 😂 There
>    should still be some bandits, so Bandit King might also move up.
>    Generalissimo is a faction leader who goes to Act 2, yes... Maybe
>    Bandit Queen goes to Act 3 as a temporary "dark wizard" stand-in?

And on the session's reading of 3, that the three sectors are acts 1 to 3
from this round: "Yes, Claude, agreeing with your lean on the queen!"

**The scripted run** (2026-10-13, the Round 8.5 TODO pass, census T-93):
finer control of what a run loads as content ramps up: "an event chain
from end to end in one run", "a specific chain of encounters or
layouts", "to override a shop's inventory".

**Releases** (2026-10-26, 133d tranche 1): "make sure that we're still
getting releases out to the itch version regularly, with accessible
content rather than just notes in the changelog."

The sheet's multi-act tooling, the atlas resize and the roster table's
rebuild are the session's findings, not the user's words: the re-cut
found the first two at 133b, 135b found the third, and the user signed
them with the charter (the third at 140a).

## Signed before the kickoff

- The round's charter, scope, decision points, exit and scope guards
  (133d tranche 2a, 2026-10-26), re-pointed at Round 9's kickoff when the
  three sectors became acts 1 to 3 (2026-10-27), with the roster table's
  rebuild added at Round 9's close (140a, 2026-10-30).
- The act design ([plans/acts.md](plans/acts.md), 2026-10-27): one sector
  an act; act 1 grassland, 11 hops; a placeholder 1×1 bear and the Bandit
  King as act 1's bosses; the Generalissimo and the Witch Hunt to The
  Start; the Queen to The Deep End. Unanswered there and still a lean:
  The Start takes act 2's barren theme in this round.
- How the re-cut's rounds run (133d tranche 1): each round ends in an
  upload with something a player can meet; a round that changes combat,
  movement or the economy closes with a board read as paired same-seed
  deltas against the round before; each act's bands are re-anchored in
  the round that lands the act.
- At Round 9's close (140a, 140d): B-19, the editors' repeated sheet
  rules, stays a TODO lead with no oracle; `--escalation`'s help line
  joins `--sector-hops`'s row; the backslash guard is a Round 10 TODO row.

## The code under the round

Read at `9e1b7c48`; the audit, with its files and lines, is WORKLOG
§141, "The kickoff's audit". In short:

- The engine takes a third sector with no code change; act 1 is data.
- Every seed re-draws when act 1 enters the map, since the run's streams
  key on the count of sectors entered; the journal corpus re-records,
  and a handful of tests that name the two-sector map fail.
- Every single-sector probe (`hops=`, `firstNode=`, the board's act-1
  rows, `sampled:<hop>`) reads the first sector, so from that commit
  nothing opens The Start or The Deep End alone.
- The board's seam and wall are single values, and the roster table's
  buckets are keyed by a sector's position.
- A `0.2.0` save loads onto the three-act map if the node ids stay, and
  finishes as the old two-act run.
- By run hop, the King stays at 11 and the act-2 bosses at 22; the Queen
  moves from 11 to 33.

## Open

The calls, in tranches, with the session's leans; WORKLOG §141 holds the
reasons.

### Tranche 1 (the kickoff)

1. **The spec and the phases:** this draft, and §142 to §147 in the
   order WORKLOG §141 gives (the scripted run, the board's acts, the
   fauna, act 1 and the run's shape, the board and act 1's bands, the
   close).
2. **The starting act in the scripted run.** Not in the charter's list;
   plans/acts.md counts on it ("starting at any act"). *Lean:* in, since
   it is how the board reads one act alone and how acts 2 and 3 are
   played without the hops before them.

### Tranche 2 (each at its phase's kickoff)

- *§144:* the beasts' glyphs, a taste stop with each drawn; new attacks
  or the shipped melee ones.
- *§145:* the save (*lean:* RunSnapshot v50 kept, the node ids `start`
  and `deep-end` kept, a resume test across the map change); The Start's
  theme (*lean:* barren, plans/acts.md's, which also keeps its bandit
  camps); the titles (*lean:* act 1 "The Wilds"; whether The Start keeps
  its title as act 2 is the user's); the boon, `sector-1-start` (*lean:*
  to act 1's root, its id kept, its "rife with bandits" line the user's
  to keep or change); act 1's size (*lean:* the shipped sectors' shape,
  six normal encounters, two elites, two bosses, two fauna camps, the
  shared layouts and events) and who writes its text (*lean:* the
  session drafts and the user signs).
- *§146:* the box's size and cost.
