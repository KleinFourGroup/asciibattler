# Round 8.5 Spec — Housekeeping

**Status: DRAFT, opened 2026-10-11 at the kickoff. Unsigned.** The intent
and the candidates below are the user's, verbatim. The process, the bar a
kept change has to clear and an amendment to the charter were proposed by
the session the same day and are with the user
([WORKLOG.md](WORKLOG.md) "Kickoff — Round 8.5"); this file gains them as
they are answered. The charter is [META-ROADMAP.md](META-ROADMAP.md)
§"Round 8.5 — Housekeeping"; the plan is [ROADMAP.md](ROADMAP.md).

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

## Marked uncertainty

- "I don't know what a more concrete list of criteria and a better process
  might look like here, and would love your thoughts." The session's
  answer is a proposal, not yet signed (WORKLOG "Kickoff — Round 8.5").
- The candidate list is not exhaustive.
- The round's size is known only after the census (META-ROADMAP).

## Settled before the kickoff

The Round 8 close's five answers (8.5 is next; the save format may bump,
more than once; the oracle map comes first; a TODO pass; the Pages site
retired): [archive/post-109-worklog.md](archive/post-109-worklog.md) "118j
— the round close", C1. Nothing has come from the itch page (the user,
2026-10-11).

## Pending the user's answer

- The process: what is signed as a list before it is deleted, and what is
  tried and then judged.
- The bar a tried change has to clear to be kept.
- Whether the charter's "a deletion round, not a refactor" is amended to
  let re-shaping in (unifying, merging, splitting), and what "the same
  behaviour" means for a change that renames what is stored.
- Whether the comment pass aims at the step codes or at the comments'
  length.
