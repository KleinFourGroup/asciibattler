# Round 8.5 Spec — Housekeeping

**Status: SIGNED 2026-10-11.** The intent and the kickoff's four calls
that day ("Yes to all four calls, Claude! Fully signed!"), and the file as
a whole that evening, once the user had read it ("I have now, and it's
(retroactively) signed!"). The intent and the candidates are the user's,
verbatim; D1 to D4 are the session's wording of what was signed. What the
Open section lists was settled at §119's shape-lock, as each item says.
The charter is [META-ROADMAP.md](../META-ROADMAP.md) §"Round 8.5 —
Housekeeping", amended the same day; the record is
[WORKLOG.md](post-118-worklog.md) "Kickoff — Round 8.5"; the plan is
[ROADMAP.md](post-118-roadmap.md).

## Intent (the user's words, 2026-10-11)

> I don't fundamentally suspect any specific piece of the code. The only
> point I've noted in particular is not actually code, but rather the
> verbosity of the comments, which we've already flagged via the raw step
> numbers. My ultimate intent is to extend the clean-up to the code base as
> a whole. Our goal is to leave it in a more approachable format than when
> we began. That means cleaning up duplicates, identifying fragile code,
> unifying similar constructs, etc.

On why now (the Round 8 close, C1's first answer): "We'll give the game
some time to circulate and see if any strangers have feedback, so this is
the perfect time to clean up the database."

The round was first raised on 2026-09-27. That day's words are on record
only as a session's paraphrase (dials that no longer move, duplicate
implementations, workarounds that could be smoothed, tests that pin removed
code), which is META-ROADMAP's charter text.

## How the user would do it alone (2026-10-11)

> Part of the issue of why this is hard to formalize is that, were I to do
> this on my own, I'd probably take a very informal and iterative approach:
>
> 1. Skim over the code base.
> 2. Identify something.
> 3. Implement the candidate fix.
> 4. Judge if it actually simplified things.
> 5. If it did, go back to step 1 and start all over, hoping that the
>    simplifications eventually let me identify other points.
>
> Now, you may choose to work that way, but you don't inherently have to.

## Candidates the user named (2026-10-11)

> - I've already mentioned the comments needing to be cleaned up.
> - We've already mentioned some dials as well, and I generally like your
>   criteria.
> - We have a lot of unit tests, and I wonder which are truly necessary
>   versus just verifying incredibly basic facts.
> - Our JSON dials are split into a lot of files; I wonder if some should
>   be combined...
> - I know we had to do a lot of special cases to split neutral team units
>   between static scenery versus camps, and I wonder if splitting those
>   into two separate teams might ultimately be better.
>
> This is not exhaustive, though, and just off of the top of my head!

The criteria the second bullet refers to are the session's, from the same
conversation: a knob stays if it has a named consumer today (a balance arm,
a board protocol, a test that varies it, a dev workflow the user uses);
"might be useful someday" does not count; each dial's fate still goes to
the user at the census.

## Signed at the kickoff (2026-10-11)

The user asked what better criteria and a better process would look like
("I don't know what a more concrete list of criteria and a better process
might look like here, and would love your thoughts"). The session proposed
these four and the user signed them.

**D1. Two tracks.** What divides them is whether a search can answer "is
this dead?" before the code is touched.

- *Track A, what a search can prove:* comments, dials with no consumer,
  unused exports, tests of removed code, exact duplicates. The census
  lists each with its evidence, the user signs the list, and it is deleted
  in batches under byte identity.
- *Track B, what has to be tried:* unifying, merging, splitting. Whether
  one of these is simpler can be judged only from the result, so it runs
  as the user's loop, with three changes. A profile replaces the skim: the
  files are ranked by size, churn, fix commits, gotcha references and
  special-case sites, and read from the top, with the candidates written
  down, because a session does not keep a skim. The bar (D2) is written
  before the trial, because the session judges its own work. The loop is
  bounded: after a subsystem's phase, one re-skim of that subsystem for
  what the changes exposed, ending when a pass finds nothing over the bar
  or at a budget the user sets once the census has sizes.
- Within a subsystem, deletion goes before reshaping, since a deletion can
  remove one half of a pair that would have been unified.
- Fragile code that can be fixed only by changing behaviour is listed and
  goes to TODO or a later round.

**D2. The bar for a kept trial.** All four:

1. the same behaviour, by a named oracle;
2. source lines do not grow;
3. no parameter that exists only to tell the former halves apart (if it
   needs one, they were not duplicates);
4. at least one thing a reader had to know is gone: a special case (its
   sites counted before and after), a type, a file, a config key, a
   gotcha, a doc paragraph, or a file from the set one edits to add a
   unit, a status, a command or a knob.

A trial under the bar is reverted and recorded as a no-op.

**D3. The charter, amended.** Reshaping is let in, by trial only. No
behaviour change, no new abstraction, no balance number moved, and the
permanent gates never relaxed: all four stay. "Byte-identical" gains a
second form, for a change that renames what is stored: identical after a
declared mapping back to the old names. §119 builds two more proofs: that
mapping, and parsed-config equality for a config move.

**D4. The comment pass aims at length.** The step codes are the part of it
that can be counted. The oracle is the one the charter names: a
comment-stripped before/after diff with a failing control.

## Open

- **The cold-read probe.** None of D2's counts measures "approachable"
  directly. The session's idea: a fresh agent given the same few tasks on
  the code before and after. The user's turn on it (2026-10-11):

  > - When I think of code simplicity, that's really a proxy for how easy
  >   a code base is to reason about.
  > - Primarily I'm thinking of this from a human reader perspective,
  > - Agents of your capability can handle the repo already. Though at the
  >   same time, we don't want to make it harder for you.
  > - The thought occurred to me that having a less powerful agent with no
  >   context might serve as a rough way to measure both.
  > - And yeah, I don't know if we'd want a formal cap, but we'd want to
  >   use this sparingly.

  The session read that as: the reader is mainly the user, with agents
  not made worse off; the measure is of reasoning; no cap. The user: "You
  read me right, Claude! I think that this will be a very interesting
  trial." And a caveat with a question:

  > I think we have one final caveat: if calibration finds that Haiku
  > still saturates correctness, then we revisit and see if total token
  > budget differentiates? And do we just one-shot these, or is it
  > averaged over N tries? We'll probably have to make that call based on
  > how expensive calibration is...

  Its form (the small reader, questions that predict behaviour, sparing
  use) is agreed; its step, 119f, is signed with §119's cut. Calibrated
  2026-10-12: Haiku was right in every run, with the comments and without
  them, so the caveat's second branch applies and the measure is tokens,
  with right answers as a floor. The user on the result: "I need to
  update my priors on Haiku's capabilities! Or maybe I just overestimated
  how complex this code base was. Probably both. Signing all of your
  leans, Claude!" At the close it runs eleven questions, three runs, two
  trees ([WORKLOG.md](post-118-worklog.md) §119, 119f).
- **§119's decisions:** the tool-only replay flag, which reverses §114's
  choice; whether the journal corpus is tracked or re-recorded from its
  seeds; the chaos census's other eight command kinds. Resolved at the
  shape-lock (2026-10-11): the flag confirmed, the corpus tracked, the
  eight left until the census wants them ([ROADMAP.md](post-118-roadmap.md) §119).
- The candidate list is not exhaustive, and the round's size is known only
  after the census.

## Settled before the kickoff

The Round 8 close's five answers (8.5 is next; the save format may bump,
more than once; the oracle map comes first; a TODO pass; the Pages site
retired): [archive/post-109-worklog.md](post-109-worklog.md) "118j
— the round close", C1. Nothing has come from the itch page (the user,
2026-10-11).
