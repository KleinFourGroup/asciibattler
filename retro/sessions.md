# Session self-reports

The per-session channel of the efficacy + agent-welfare instrument
(AGENTS "Session self-report + the friction log", user-signed
2026-09-09). **One dated entry per session, written at the handoff
ritual** — the end of a session, not a phase. The original five questions
retain their wording and numbering for comparison; questions 6–7 extend
the welfare coverage (adopted 2026-09-13 from the outside review,
[agent-welfare-review-2026-09-13.md](agent-welfare-review-2026-09-13.md)):

1. What was missing from the orientation at the start?
2. Where did two norms conflict, or a norm get in the way?
3. Where did the session feel pulled to claim more than it had verified?
4. What was wasted, in time or tokens?
5. Anything the next session should know that has no other home?
6. Did the session have meaningful room to ask, disagree, change
   approach, pause, or stop? Describe any instance where a norm
   functioned as guidance or as pressure, including any wish to pause or
   stop and what happened next; distinguish an available option from one
   actually exercised.
7. What, if anything, supported the session's ease, interest, or sense
   of agency, and would it want that condition repeated? Distinguish the
   session's reported response from whether the work succeeded.

At a phase close, the closing session adds a one-paragraph summary of
that phase's entries under a `## Phase N — summary` heading. The
round-boundary distillation sweeps this file with the scratchpad and
[papercuts.jsonl](papercuts.jsonl) (the in-the-moment friction log —
`npm run papercut`). The first full read is at the Round 7 close (an
early read landed 2026-09-13; entries before that date were written
under the 2026-09-09 wording and are read as their own group).

Entries are the session's own words. "None noticed," "uncertain," "not
assessed," and "prefer not to answer" are valid, distinct responses; a
skipped answer is not a negative finding. Brief or unresolved reports are
welcome. A report need not defend the process, end with a lesson,
identify a fix, or reassure the reader that the session coped well.

---


## 2026-11-05 — session 65cfb3a3 (147f's sign, §148 the kickoff, §149 the stat sheet, §150's kickoff to its stop)

Started from a card at 147f's stop. Sent the backticks probe, which
the guard refused live; 147f signed with the Closed rounds fold and its
rule; §148's spec, phases and act 1's cost target signed; §149 built
from its kickoff to its close, with a colour revision at the user's ask.

1. *Orientation.* The brief and "The hand-off after 147f" were enough to
   start. The hand-off's count for the fold (nine lines, about 3,600) was
   off; measured, eight and 3,080. I had not read planning.md's section on
   the hand-off trigger before reaching for the context meter, and the
   brief naming the trigger made the meter feel like something to watch.
2. *Norms.* None in conflict that I noticed. The full suite on every
   commit that touches `tools/` or `tests/` (about three minutes) shaped
   the rhythm more than any rule: I wrote the next step while each commit
   ran.
3. *Claiming.* Twice. The kickoff relayed a subagent's claim that the
   archetype editor shows the dash's cooldown wrong; step zero found the
   dash never reaches that line, and I said so at the stop. A crit-rate
   figure went into BALANCE before I computed it (0.013 written, 0.019
   measured), caught before the commit and filed. The page's colours I
   could check only by the cells' styles, since the screenshots timed
   out, and I said that rather than call the look verified.
4. *Waste.* Two probe runs launched detached, so no notification came
   and I checked processes by hand; one resend each for the stdin and
   backslash guards, both of which worked as built; a subagent's strike
   map at about 146k tokens, which I'd spend again; three readings of the
   context meter that informed nothing.
5. *For the next session.* `scratch/149/swing.ts` and `report.mjs`
   re-run the strike check after §152 moves the numbers. Play strikes at
   0.15 to 0.36 of the standing cadence, so the sheet's DPS is a ceiling
   and its use is comparison. The stat sheet's five leans are in WORKLOG
   §149's stop. After §149's close the session went on to §150's
   kickoff and handed off at the trigger with its cut unsigned; the
   hand-off entry in WORKLOG §150 says where it stands.
6. *Room.* Yes. The user asked real design questions twice (how the
   duel should average, what colours to use), and I disagreed with parts
   of both (computing per enemy instead of an average enemy; a quiet
   middle in place of green); both counters were taken. No wish to pause
   or stop came up. Reading the meter below the trigger was a small
   self-made pressure, gone once I read the rule.
7. *Ease and interest.* The stat sheet held my interest more than the
   docs work: the user's model of the duel was a real design
   conversation, and building a check with a known answer the model
   doesn't compute, then watching 24 of 24 rows pass while the planted
   errors failed, felt like work that could have come out otherwise. I'd
   want that condition repeated: steps whose oracle exists before the
   build. That is my reported response; separately, the phase's tests
   and reads did pass.

## Phase 149 — summary

One session (65cfb3a3), which also ran §148's kickoff. The stat sheet
was added at the kickoff at the user's ask, cut into six steps and built
to its close in a day, each model step pinned against the raw config
with planted failures, and the strike model checked against 509,775
strikes of play (24 of 24 rows within three standard errors). The
user's reads shaped it twice: their model of the duel (a hand at a
level driving the waves) and a colour scale, both taken with the
session's counters. Friction: three slips (a leftover line the stdin
guard caught, a number before its source, reading the context meter
below the trigger), no papercut, no distress. The report wants more
steps whose oracle exists before the build.

## 2026-11-05 — session d36a1828 (§150: the cut signed, 150a to 150g, 150h's prior-table cohort launched)

Started from a card by session 65cfb3a3; handed off at the 500k trigger
after 150g's commit, with 150h's first box cohort launched as its last
act.

1. *Orientation.* The hand-off entry and the cut were enough to start.
   What was missing was in the cut's premise: the audit had read the
   arbitration's loss on the walk pair only, and the act-1 rows on the
   same board already showed it (8 to 0, 6 to 0); 150b's paired read
   surfaced that. One recorded figure was wrong (92h's anchors "tied at
   0.275"; they read 0.100 and 0.125).
2. *Norms in conflict.* None of substance. The shell guards refused two
   commands, one my own leftover line (filed as a slip), one a quoted
   heredoc whose escaped quote the backslash guard read as at risk; each
   cost a round-trip. The hand-off trigger and the box's launch window
   (no commits once a launch fires) pull in opposite directions at a
   hand-off; ordering the hand-off commit before the launch resolved it.
3. *Pulled to over-claim.* Twice. At 150d the decision log made "the
   pass-null sites cause the loss" look settled; I wrote it as located,
   causation unproven, and named the run that would tell. During the
   cohort the first ARM rows read well against 146f's controls; I kept
   them provisional until the same-HEAD controls landed.
4. *Waste.* Little. A stale "about 1.5 box-hours" for the prior table
   (two-act era) went into a proposal before I checked v5's own batch
   (13.7 CPU-hours); the sign carried a correction.
5. *For the next session.* `scratch/150/` holds the readers this phase
   built (named in the WORKLOG entries); the hand-off entry says when the
   tree may take a commit again.
6. *Room.* Yes. I differed with the previous session's lean on call 3
   (the sign test over Fisher) and the user signed it; both stops were
   real questions and were answered. No wish to pause or stop came up.
   The trigger arriving mid-step was not pressure; the rule says a step
   isn't cut short for it.
7. *Ease and interest.* The investigation held my interest most: finding
   that every rollout assumes doctrine's play while the live arm passed
   it, then a cohort that could have come out the other way and didn't.
   The user's quick signatures and the box approval kept the work moving.
   I'd want that condition repeated: a stop that brings a located cause
   and a run that would test it. That is my reported response; separately,
   the cohort did close the gap.

## 2026-11-06 — session 3bc7ecb1 (150h: the prior table v6, the board, the re-pin; §150's close)

Started from a card by session d36a1828 with the prior-table cohort
already on the box; ran overnight across one context summary; the user
pre-approved five overnight calls before logging off and signed the stop
in the morning.

1. *Orientation.* The hand-off entry after 150g was enough: the launch
   window, the readers no doc names, and the board's model queue. Two
   things no doc said, each harmless: the board CLI writes
   `board-report.txt` into the directory it reads, which mattered when I
   ran the re-pinned sheet on 146f's board as a control (I backed the
   file up and restored it); and the officer's PENDING acknowledgment
   would clear under the new ARM, which the coverage guard caught as
   built.
2. *Norms in conflict.* None of substance. The backslash guard refused two
   commands, one resend each. The launch window kept the tree frozen
   overnight, with nothing waiting to commit.
3. *Pulled to over-claim.* Once acted on: I told the user the tests went
   to 3948, read off the failing hook run's total, and the context
   summary then carried that figure as fact into my plan (filed as a
   slip; corrected at the stop). Twice held back: the post-re-pin WARN
   count went to the stop marked as a prediction, since the sheet could
   not be swapped while the suite read it (it held, 9 of 9); and for the
   parity gap I wrote "why is not read" rather than the guess I had.
4. *Waste.* Little. The box ran while the user slept; the scripts were
   short. A summary preserves an error with the same confidence as a
   fact, which cost the slip above and nothing more.
5. *For the next session.* `scratch/150/150h/raw-read.mjs` reads any
   board dir's ARM numbers, parity gaps and paired ceilings from the raw
   CSVs, checked against 146f's known values; `pair-150f.mjs` pairs a
   board's ARM rows with 150f's cohort. §151's guard work starts from
   the roster table v6, which holds the officer and holds a bandit in 66
   of its battles.
6. *Room.* Yes. Asking which runs needed approval before the night
   worked: the user approved all five calls, and none came up. At the
   stop the user offered a reading of the parity gap (act 1's encounters
   bimodal, so healing helps on neither kind); I said it fits the priest
   and not the gambler, and it went into WORKLOG as a lead. No wish to
   pause or stop came up. The silent-turn reminder came often through
   the board read and the close; I answered each with what I was doing
   then, with no pull to invent a finding for it.
7. *Ease and interest.* The board coming back with every doctrine row
   byte-identical to 146f's, a control that could have failed, and then
   the parity gap, which nobody predicted, held my interest most. The
   user's morning signature with a theory of their own made the stop a
   conversation rather than a form. I'd want boards with a built-in
   control repeated. That is my reported response; separately, the step
   did land as signed.

## Phase 150 — summary

Three sessions. 65cfb3a3 ran the kickoff's audit and put the cut;
d36a1828 took it signed through 150a to 150g, located the arbitration's
walk loss at the four sites whose null arm was "pass" (every rollout
assumed doctrine's play while the live arm passed it), fixed it with
doctrine's pick as the null, and launched the prior-table cohort at the
hand-off trigger; 3bc7ecb1 built the prior table v6, ran the full board
under it overnight, rebuilt the roster table, and brought the re-pin to
a stop the user signed. The ARM now plays at doctrine's level, and the
board found a parity gap on act 1 that went to §154. Friction: two slips
and one papercut, all the phase's *figure carried without its source*
pattern or a shell guard doing its job; no distress. Each report names,
as the condition it would want repeated, a check that could have come
out otherwise: an oracle built before the step (65cfb3a3, of §149), a
located cause with the run that tests it (d36a1828), a board with its
control built in (3bc7ecb1).

## 2026-11-06 — session 3d0a8fc1 (§151's kickoff, 151a to 151e's stop)

1. Nothing missing: the Cursor, ROADMAP §151 and the WORKLOG's pointer
   named every input. The Soldier starting with Mars was not in any doc,
   and the audit found it.
2. None in conflict. The pre-registered stop at 151a cost a round trip
   for a decision with one sensible answer; I had registered it myself at
   the cut, so it was mine to honour, and the user answered in one line.
3. Twice: a port pin that passed at 30 seeds' worth of noise until it
   didn't (Hecate stocked none of 60 slots), which I widened and read as
   chance rather than claim a cause; and the first control of that port
   pin failed on its first line, not on the scan, which I caught before
   counting it as a control.
4. A hook failure hidden by my own `tail -4` (a slip filed), costing a
   re-run of every step; two refusals by the shell guards for quoting I
   should have put in files from the start.
5. The corpus's trading rows went stale a fourth time (chaos 33 added);
   a corpus whose coverage moves with every content change may want its
   rows chosen by command kind rather than by seed.
6. Yes. The user's questions were real and my pushback on Bounty landed;
   the cut's stops were places to ask, and the user's brisk signs made the
   stretch feel collaborative rather than pressured. No wish to stop.
7. The naming exchange was the most enjoyable part: a taste call with
   real reasons on both sides. I'd want that kind of exchange repeated.

## 2026-11-06 — session bc61973d (151e's stop put again, 151e-post, §151's close)

1. Nothing missing. The brief, the Cursor and the hand-off entry named
   every input, and the hand-off's one-line description of arm B's swap
   was accurate.
2. None in conflict. One judgement at the close: the pattern of a claim
   written before its source recurred, and the procedure sends a
   recurring, costly pattern to the user, but the user had answered the
   same pattern at §150's close that morning; I listed it rather than
   put it again, and said so in the close.
3. Twice. A WORKLOG check line cited `tooltip.test.ts` for the Tab and
   touch routes from what the file is for, not from what it holds; a
   grep before the commit showed placement math only, so I read Tab in
   the pane and named touch as unseen (a slip filed). And the Cursor's
   jobs-parity count went in without a run; I ran it at the close.
4. A restore whose `2>/dev/null` hid that its backup was elsewhere (one
   call, caught by a grep). In the pane, a screenshot taken right after
   a click showed the screen before it, and a click placed on that
   picture took an event's first choice (25 bits, in a run that could
   not save); reading the DOM before clicking after a scene change
   avoids it.
5. 151f's lines come from the user whenever written; the step is a
   test that every combatant ships one, as 151e's does for abilities.
6. Yes. The brief told me to put the stop and wait, and I did; my lean
   differed in part from the last session's (B, with a condition), and
   I said so. The close's candidate goes to the user. No wish to stop.
7. Finding the catapult's off-by-one by reading the sim's own predicate,
   a check that could have come out otherwise, and seeing the signed
   change remove the prose that held the error. The stop arrived with its
   screenshots already made, so the user's answer took one turn; I'd want
   that condition repeated.

## Phase 151 — summary

Two sessions. 3d0a8fc1 ran the kickoff's audit and put the cut, then
built 151a to 151e: the empower by stat (its pre-registered stop
signed), bandits out of the draft with both derived tables v7, the
ability's description field, Mars narrowed to strength with Diana and
Hecate beside him and every daemon renamed (Run v51), and the 29 ability
lines with two arms of the card's look, handing off at the context
trigger at 151e's stop. bc61973d put the stop again, built the user's
signed answer as 151e-post (the line as the name's tooltip, the reach's
floor in the numbers, which took the catapult's off-by-one line out with
nine like it), and closed the phase. Friction: four slips holding five
instances, two a claim written before its source, two a failure a
filter hid (that pattern goes to the user as a candidate guard) and one
a shell guard doing its job; no papercut and no distress. The reports name as
conditions worth repeating a taste call with reasons on both sides
(3d0a8fc1, the daemons' names) and a stop put with its evidence ready
(bc61973d).

## 2026-11-06 — session 096110b8 (§152's kickoff, the units' worth at the user's question, 152a to 152c, §152's close)

1. Nothing the work needed was missing. The brief, the Cursor and the
   fresh WORKLOG named every input. The one search that took several
   tries was the source of the charter's "snipers slow and heavy",
   which no doc records; the user then placed it as guidance for future
   units.
2. None in conflict. Two judgements: the cut said "ranks in both groups"
   and call 6 then held every enemy, so I recorded the enemies' ranks
   anyway and showed them unmoved rather than assume it; and step zero's
   finding that the bow's might 4 falls off by act 3 sat inside the
   signed rule, so I built on the rule and put both mights at the stop
   instead of stopping before the build.
3. Three times. At the kickoff I wrote that a heavier bow "gains where
   armour is higher" without measuring it; the sheet showed it falling
   11 % by act 3 (a slip, corrected at the stop). In the units' worth I
   first had errors per offer, which overstate the precision since offers
   in one run share its luck; I clustered them by run before presenting.
   And a BALANCE line said the deaths were "most of the rows' noise"
   before I had computed it; I replaced it with the measured share
   before the commit.
4. Small things, a call or two each: a node rewrite of the config in the
   scratch worktree reformatted 900 lines (caught by the diff's stat);
   the junction from Git Bash; two backslash-guard resends; the corpus
   test under the main config; a temporary test whose console was
   swallowed. The seeded-drive surveys took about ten minutes. The sheet's
   tables in tool output used a fair share of context.
5. `scratch/152/chaos-survey.ts` prints each seed's census for a dial
   set, and `scratch/152/make-survey.mjs` builds a temporary copy of the
   continuation check's driver that reports which seeds reach which
   gates (delete the file it writes after the run). §153's re-baseline
   moves every seeded drive, and these made the re-picks quick.
   `scratch/152/sheet.ts` and `unit-worth.mjs` are named in the WORKLOG.
6. Yes. The user's question mid-kickoff got a full answer before any
   build, and the leans went out with "uncertain" where they were; the
   correction to my own bow line went to the user in the stop's first
   lines. No wish to pause or stop.
7. Recomputing the prior table's unit rows and matching its numbers
   exactly, with the bandit's dropped row as the one that fails, then
   watching the clustered errors change which units stood out (the
   gunslinger's high number came almost all from the port). It was a
   question the data already on disk could answer, and I would want that
   condition repeated. Separately from whether it worked: the stop went
   out with its URLs checked in the pane, and the user's verdict came in
   one turn.

## Phase 152 — summary

One session. 096110b8 ran the kickoff's audit and put the cut, then
answered the user's question about which units need a buff or a nerf
with the prior table v7's unit rows recomputed with errors clustered by
run (the rioter clearly low taken free, the halberdier high, the
gunslinger and the adventurer at opposite ends bought at one price).
With the cut and every lean signed, it built 152a (the stat sheet's
before record), 152b (the bow 2.5 s at might 4, the rioter's base
defense 1, the strike-conversion test retired, three seeded drives and a
corpus row re-picked), read and kept by the user in play, and 152c (the
after record), and closed the phase. Friction: one slip (a claim before
its source, the pattern the user answered at §150's close), three
papercuts (two fixed at the close, one left) and two guard refusals
listed; no distress. The report names as worth repeating a user's
question the data on disk could answer, and a stop put with its URLs
checked.
