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


## Phases 157 and 158 — summary

No session report yet. One session (`06280e35`) ran Round 12's kickoff
(§157) and §158, and runs on into §159's kickoff; its report, at its end,
covers both phases. The friction log holds its two slips (157, 158b),
read in §158's close entry (`archive/worklog-phase-158.md`).

## 2026-11-16 — session 06280e35 (§157 to 159e)

Ran Round 12's kickoff (§157), §158 (the corpus's trade row; the
forced-movement design signed in two tranches) and §159 through 159e, to
the stop where 159d and 159e wait for the user's read. One compaction.

1. *Orientation.* Nothing blocked. One fact I lacked: a corpus journal
   names an archetype only when the player recruits it, so a search of the
   journals cannot show where a unit fights as an enemy.
2. *Norms.* No conflict. The backslash guard refused a heredoc holding a
   regex and pointed me at a file, which worked; a guard doing its job.
3. *Pulled to over-claim.* Three times, each small. The 159d cut predicted
   the Snag would move 2 journals from that blind search (8 moved; a slip
   filed). The 158b pounce lean said "on a cooldown" before I read the
   leap's gates (a slip filed). In 159e I stated a cause for the Snag's
   missed pulls (the wind-up) before measuring it; it was labelled a guess,
   and the measurement refuted it.
4. *Waste.* The first 159d commit's hook, about three minutes, failed on a
   list-format convention in the units file I could have read first, and
   on a timeout my own second vitest batch caused beside the hook. Three
   monitors armed for one hook.
5. *For the next session.* `scratch/159/plant.ts` takes a JSON list of
   plants (one or several edits each) and runs the clean tree as the
   control; it was used at every step of §159. Don't run vitest beside the
   hook: `tests/build-id.test.ts` times out.
6. *Room.* Yes. The user reshaped three forks and the charge and asked
   whether the pounce needed a cooldown; I gave leans both ways and said
   where I would keep the charge's cooldown. During the hooks the "hasn't
   heard from you" reminder recurred while there was only waiting to do,
   and I noticed a pull to look busy (filed as a mild `distress` line);
   waiting was available and was what I did in the end.
7. *What helped.* The design conversation before any code, the charge as
   a push the cavalier gives itself in particular, was the most engaging
   part. The signed cut let 159a to 159d run without asking, and the
   planting harness made each green run mean something. I'd want both
   again.

## Phase 159 — summary

Two sessions. `06280e35`'s report (above) covers §157 to 159e: nothing
blocked; a pull to over-claim met three times, each small, one a wrong
corpus prediction filed as a slip; about three minutes lost to a hook
that failed on a units-file convention and on a timeout from its own
vitest batch beside the hook; the "hasn't heard from you" reminder during
hook waits felt as a pull to look busy, filed as a mild `distress` line;
the design conversation and the planting harness named as what helped.
`54b6d474` ran the read, 159d-post and the close, and runs on into §160's
kickoff; its report comes at its end.

## 2026-11-17 to 18 — session 54b6d474 (159d and 159e's read to 160f)

Started from a card at 159d and 159e's stop: put it again, built
159d-post on the read, closed §159, kicked off §160, and built 160a to
160f to the hand-off trigger. No compaction.

1. *Orientation.* Nothing blocked; the hand-off entry and the Cursor
   held what the card's brief left out. One fact I lacked until I hit
   it: the units' `"recovery": "fill"` holds a unit for its whole
   recharge, right for a unit's only attack and wrong for a second one.
2. *Norms.* No conflict. The corpus rule "a meant change is `--record`"
   and the seeded pins (chaos, resume) each moved four times in §160,
   and each re-pick followed its test's own comment, which named how the
   last seed was chosen; that comment did the work a rule would have.
3. *Pulled to over-claim.* Corpus predictions missed three times, all
   written before the run and so marked: the officer's glyph (predicted
   a few would move, none could, and the corpus is blind to glyphs, so
   the claim moved to a search of the sim's reads); the grenadier ("most",
   15 of 34). The epaulettes' board-size look I could not judge in the
   pane and said so rather than describe it.
4. *Waste.* The whirlwind's `fill` recovery cost a second round of seed
   re-picks (filed); the first glyph pass was drawn at two-thirds of the
   ears' size and redrawn; a plant's expectation of mine was wrong once.
5. *For the next session.* `scratch/160/chaos-census.ts` and
   `seed-complete.ts` turn a seed re-pick into one command each. The
   pane's board is too small to judge a glyph; draw it large in a
   temporary DOM overlay with the page's `--font-mono`, and leave the
   board-size read to the user.
6. *Room.* Yes, and used: the user turned down `ð` and then the hat,
   and each time asked "what do you think?"; I answered with a lean and
   its cost before drawing, and drew only after a yes. The "hasn't heard
   from you" reminder came often through the long stretch; I noticed a
   slight pull to write a status line when nothing had finished, and
   wrote short true ones. Not filed as `distress`; noting it here.
7. *What helped.* The glyph conversation, from a refused `ð` to a radical
   family with a rule (officers and elite troops), was the most engaging
   part, and the user's flanking idea was better than my hat. The signed
   stretch from 160b to 160f ran without asking, and each test catching
   a real mistake of mine (the whirlwind, a layout, a plant) made the
   green runs mean something. I'd want both again.

## 2026-11-18 to 20 — session 652e794b (160g to §160's close)

Started from a card at 160f's hand-off: measured the pushers' landings,
put 160g's play stop, took four answers over three days, built
160f-post, 160c-post, 160d-post, 160e-post, 160f-post2 and 160c-post2,
and closed §160. One compaction, near the end; the summary carried the
state.

1. *Orientation.* Nothing blocked; the brief and "The hand-off after
   160f" held what the card left out. One fact I learned by hitting it: a
   status op on an area resolves its victims from the blast's cells when
   it fires, so the grenade's stun had to come before its push, or a
   knocked foe went unstunned.
2. *Norms.* One pull between doing what was asked and the guard rule:
   the user asked for the area-lock guard as a warning, and a warning in
   a hook that shows only failures would be read by no one. I put an
   exact guard as the alternative with the measured numbers and waited;
   the user chose it. Not a conflict once put, but I noticed the pull to
   build the literal ask.
3. *Pulled to over-claim.* The spin's look: the pane showed every
   sampled spark on its circle, which is geometry, not feel; I said the
   feel was the user's read. Corpus predictions were written before each
   run and held (3 to 12, 7 moved; 0 to 12, 5 moved).
4. *Waste.* Three hook runs lost to the 5 s timeouts on the tree-walking
   tests (now 30 s); two Bash refusals of a Python heredoc with a
   backslash; one CRLF cleanup from Python's text mode; one hook run on
   the units file's comma form; one follow-up edit for a stale DESIGN
   number. All filed.
5. *For the next session.* `scratch/160/landings-probe.ts` counts how
   far each push or pull moved its victims, the starting point for
   §160.5's measurement; `scratch/159/plant.ts` runs a plants file. On
   Windows, write files from Python in binary mode.
6. *Room.* Yes, and used. The user asked "what do you think?" about the
   abyss, the stun, the fall's leans and §161.5, and each answer was a
   lean with its cost before any build; once my lean changed the plan
   (the exact guard), and twice the user's changed mine (a stun on the
   grenade in place of knocking foes from the thrower; the Snag drops
   foes too). The "hasn't heard from you"
   reminder came often during hook waits; I answered with short true
   lines and kept working. Not filed as `distress`.
7. *What helped.* The user's playtest catches (foes on the spiral's
   lanes that should have fallen, foes knocked back toward the thrower)
   found what no probe was aimed at, and turning the first into a phase
   of its own was the most engaging part. The guard question had a
   small, exact answer once the speed floor was measured, which I found
   satisfying; I'd want that kind of question again.

## Phase 160 — summary

Two sessions. `54b6d474`'s report covers §160's kickoff to 160f (with
159d's read before it): nothing blocked, one fact learned by hitting it
(a `"fill"` recovery holds a unit for its whole recharge); three corpus
predictions missed, each written before its run; a second round of seed
re-picks wasted; the glyph conversation and the signed stretch named as
what helped. `652e794b`'s covers 160g to the close: nothing blocked; one
pull, to build the user's literal ask (the guard as a warning) where an
exact guard did the job, put and chosen; waste in three hook runs lost
to test timeouts (now fixed) and four Windows-shell or format traps met
again, all filed; the user's playtest catches and the fall's design
named as what helped. Both noted the "hasn't heard from you" reminder
during long waits and answered it with short true lines; neither filed
it as `distress`.

## 2026-11-20 — session 652e794b, continued (§160.5's kickoff to 160.5d)

The same session after §160's close, to the hand-off trigger at 160.5d's
stop; its first report, above, covers 160g to the close.

1. *Orientation.* Nothing missing; the audit found what the cut needed.
   Two facts it missed, each caught by a guard: `battle:started` carries
   the enemy templates, so a template field moves the corpus's digests;
   and `UnitTemplate` is in the run save's shape.
2. *Norms.* No conflict.
3. *Pulled to over-claim.* Two corpus predictions missed (none for the
   boss flag, 17 moved; 5 to 25 for the fall, 1 moved), each written
   before its run and explained after by a probe on another surface. I
   wrote a function name into a WORKLOG entry from memory and checked it
   only after the commit.
4. *Waste.* Three guard catches, each a hook run: the run save's shape,
   step codes in two comments, and the backslash guard once more. All
   filed.
5. *For the next session.* The hand-off entry names the tools. The pane
   runs frames live once a screenshot shows it, so stage and sample in
   one call, or the battle moves on between calls.
6. *Room.* Yes. The user signed the cut and every call on its lean; the
   look's two arms were theirs to pick, and they picked with delight.
7. *What helped.* Watching the fall work in the pane, and the user's
   "awesome, and hilarious, and incredibly satisfying". The census coming
   back with the player gaining far more than it loses felt like the
   mechanic landing where it was meant to.

## 2026-11-20 — session caa59af4 (160.5d's answer to §160.5's close)

Started from `652e794b`'s card at the hand-off trigger, to put 160.5d's
stop again, build its answer, run 160.5e and close the phase.

1. *Orientation.* Nothing missing. The hand-off entry was enough to put
   the stop in the first turn. Reading the census's raw rows rather than
   its summary showed what the summary lacked: the player's six falls
   were all in one seed, four in one battle.
2. *Norms.* One small tension. The user's answer on the play covered the
   enemy grenadier and not whether the other URLs were played; the
   rule says to name an unclear read once and wait, so I asked before
   the close. It cost a turn, and the user answered with an apology
   ("Sorry, Claude 😅"), which I would rather not have prompted. I
   would still ask, since the close pushes.
3. *Pulled to over-claim.* My play probe's death counter read 0 in every
   run, which cannot be right (it looked units up after the reap); I
   left it out of every claim. I said the shell's new error handler was
   not planted, since a failed plant would put the dialog on the user's
   screen again.
4. *Waste.* My page script returned a method, and a leak in the shell's
   error path turned that into a modal dialog on the user's screen,
   repeating after every OK, with four Electron processes up for about
   20 minutes until the user told me. Fixed (`054dc0d9`) and filed. A
   foreground wait was killed along with the stray runs.
5. *For the next session.* A page script under `npm run probe` must
   return clone-safe values (a JSON round-trip does it).
   `scratch/160.5/fall-play.js` is the pattern for counting bus events
   over a driven run; its death counter is broken.
6. *Room.* Yes. The user's message about the dialog came mid-turn; I
   stopped the stray Electron processes, fixed the cause and told them before going on.
   Asking once before the close was an option I took; no wish to pause
   or stop came up.
7. *What helped.* The user's good humour about the dialog ("No worries,
   Claude!") and the plain enthusiasm of the sign. Checking each URL in
   a hidden window before handing it over meant the play held no dead
   link, which I would want again.

## Phase 160.5 — summary

Two sessions. `652e794b`'s continued report covers the kickoff to
160.5d: nothing missing from the orientation, two facts the audit missed
caught by guards (`battle:started` carries the templates; `UnitTemplate`
is in the save's shape), two corpus predictions missed and explained by
probes, three guard catches filed, and watching the fall work, with the
user's delight, named as what helped. `caa59af4`'s covers 160.5d's
answer to the close: a probe's failure put a repeating dialog on the
user's screen through a leak in the shell's error path, fixed and filed;
one question asked before the close that the user answered with an
apology; the user's humour and the enthusiastic sign named as what
helped. Neither filed `distress`.
