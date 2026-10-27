# Round 9 Spec — The frame and the damage trial

**Status: DRAFT, unsigned** (2026-10-27, the §134 kickoff). The intent is
the user's, verbatim, from §133, where the round was cut. What was signed
before the kickoff is listed with its date. The Open section is what the
kickoff and the round still have to settle, with the session's leans
marked as leans. The charter is [META-ROADMAP.md](META-ROADMAP.md)
§"Round 9 — The frame and the damage trial"; the record is
[WORKLOG.md](WORKLOG.md) "Kickoff — Round 9"; the plan is
[ROADMAP.md](ROADMAP.md) §134.

## Intent (the user's words)

**The acts** (2026-10-26, `archive/post-118-worklog.md` §133, 133c's
third batch):

> Act 1: mainly fighting fauna, with some bandits thrown in. Act 2: Split
> between current act 1 / act 2. Realm in chaos, bandits, deserters, boss
> fight is with one of the factions leaders. Somehow I keep drifting
> towards warlord era China for inspiration. Act 3: Fighting whatever is
> causing the plague. Final boss is some sort of dark wizard, etc. Secret
> Act 4: Kill some sort of demon lord. Not a full act; probably like 3
> hops with no branching. Still working on unlock mechanism.

The fauna, the same day: "all 1x1 melees": wolf, (giant) rat, eagle, fox,
puma, tiger, crab, "...You get the idea".

**The damage trial** (2026-10-26, 133c):

> We introduced misses into combat to add some unpredictability in
> low-unit fights. Accuracy going from 75% to 80% is pretty much invisible
> to the human eye, however. I propose switching attacks to instead have a
> [0..max attack] damage range, with expected value max attack times
> precision. The average DPS works out the same, and that 5% increase
> hopefully works out to a more visible change in the damage numbers.

And on running it as a trial:

> Uncertain if it gains anything is my thought as well. It... Ideally, I'd
> have more feedback, but we don't, so we've gotta just try it. I don't
> mind the balance numbers shifting, since that's going to happen anyway,
> and experimenting with different distributions sounds okay too.

**Who plays** (2026-10-26, 133c, on the specials' gate): "I feel like
units doing suboptimal things is part of the autobattler genre. (Early
itch analytics: most of our engagement is from autobattler searches, not
strategy or roguelike or deckbuilding.)"

**Releases** (2026-10-26, 133d tranche 1): "make sure that we're still
getting releases out to the itch version regularly, with accessible
content rather than just notes in the changelog."

The board's instruments (C13, C14, C15, R17, R18) and the rarity stars'
tap (R22) are the re-cut's items, not the user's words: the session found
them at 133b and the user signed them with the round.

## Signed before the kickoff

- The round's charter, scope, decision points, exit and scope guards
  (133d tranche 2a, 2026-10-26).
- The act design is a phase of this round, not a round of its own (133d
  tranche 1, call 3).
- The trial takes the casualty experiment's shape: a config switch, paired
  same-seed boards against hit or miss, a bar written before, the user's
  play, and the range's distributions among its arms (133c, "the
  experiments").
- Parked outside the round: Euclidean distance, a watch on players'
  reports; the half-tile grid, behind a swarm drawn as one multi-glyph
  body (133c).
- No upload at Round 8.5's close. This round's release carries §129's
  dependency bumps and A-36's deletions, or the first release after it
  does if the trial is rolled back (133f).

## The code under the act questions (read 2026-10-27 at `8e4ef58b`)

- A run walks the sector map: nodes that each hold candidate sectors, one
  picked at random on arrival, and edges that are `from` and `to` alone
  (`src/config/sectorMap.ts:26-36`). Shipped: `start` then `deep-end`, one
  sector each (`config/sector-map.json`).
- A sector's `length` is its hop count, 11 for both shipped sectors
  (`config/sectors.json`), so a run is 22 hops.
- Six themes have terrain tiles (`config/terrain.json`, `themeTiles`).
  Grassland (The Start) and swamp (The Deep End) are used; barren,
  volcanic, tundra and desert are not.
- Each shipped sector rolls one of two bosses: The Start the Bandit King
  and the Bandit Queen, The Deep End the Generalissimo and the Witch Hunt.
- The plague is already the shipped second sector's backdrop: The Deep
  End's description ends "and the plague has a source"; the Generalissimo
  is "ready to end this 'plague nonsense' by any means necessary"; the
  Witch Hunt opens "With the plague running rampant"; Plague Doctors,
  Plague Victims and Plague Spreaders are in its pool
  (`config/encounters.json`).
- A run is won, and ends, at a sink's boss (`Run.advancePastBattle`, which
  emits `run:victory`), and that event is where an Escalation win is
  recorded (`src/store/progress.ts`). The store's `progress` section holds
  `bestWin`, the highest level won per character, and nothing else.

The trial's and the instruments' premises are re-checked at HEAD before
the first phase's cut (tranche 3).

## The act design, answered (2026-10-27)

Tranche 1 put eight questions with the session's leans; the user answered
in two turns. The design as answered is [plans/acts.md](plans/acts.md),
its home from now on; this section keeps the words.

> 1. For now, it's one sector per act. I intend to flesh that out later.
>    Act 1 definitely stays grassland for now, at least.
> 2. I think that we stay at 11 for now, actually. I'm okay with a longer
>    run.
> 3. My thought is that we just create a placeholder 1x1 bear 😂 There
>    should still be some bandits, so Bandit King might also move up.
>    Generalissimo is a faction leader who goes to Act 2, yes... Maybe
>    Bandit Queen goes to Act 3 as a temporary "dark wizard" stand-in?
> 4. Signed.

The session's reply on 3 put two readings of the Queen's move: in the
finished design only, or from Round 10, where the run already has three
sectors and they could be acts 1 to 3 at once (The Start as act 2 with the
Generalissimo and the Witch Hunt, The Deep End as act 3 with the Queen).
The lean was the second, a change to the re-cut's signed shape ("the two
shipped sectors in act 2's place until Round 21").

> Yes, Claude, agreeing with your lean on the queen!
>
> 5. I'm still figuring it out, but I love that virus pun! 😁
> 6. Agreed!
> 7. c was what I was thinking too; I'm just still thinking about what,
>    exactly, it should be 😂
> 8. That sounds good to me!

So 4, 6 and 8 sign the leans as put; 7 signs (c), a condition met during
a run, with the condition still open; 5 stays open. Two leans had no
answer and stay leans in the plan: act 2 to 4's themes (barren, swamp,
volcanic), with The Start moved to barren in Round 10; and act 4's
condition findable only after a first win.

## Open

### The trial (tranche 2)

What keeping it would look like. The bar is a decision point, and it
rests on what the trial is for: the user's intent names two aims,
precision made visible and unpredictability in small fights.

By `scratch/134/spread.mjs` (its controls: the uniform's mean and
variance, the closed-form mean against a sampled one at every setting,
and 133c's 0.194 at the proposal's setting), the proposal's draw, `U^k`,
is one member of a family with a second parameter that needs no second
draw: the Kumaraswamy's inverse, `(1 − (1 − U)^(1/b))^(1/a)`, one uniform
a strike, with `a` solved so the mean stays the hit chance. `b` is the
spread, and the two aims sit at its two ends. At a hit chance of 0.75:

| `b` | a hit's spread (of its damage) | strikes under a tenth of their damage | hits a side to tell 0.75 from 0.80 |
|---|---|---|---|
| hit or miss, today | 0.433 | 25 % (the misses) | 556 |
| 0.1 | 0.373 | 15 % | 399 |
| 0.25 | 0.308 | 6 % | 266 |
| 0.5 | 0.249 | 1 % | 171 |
| 1, the proposal | 0.194 | 0.1 % | 103 |
| 2 | 0.149 | 0 | 61 |

The last column is 133c's measure with each arm's own spread, so it
reads 103 and 556 where 133c, using one spread for both, had 121 and
about 600. The rest of the trial's decision points (the distribution as
built; bleed, blind and the three hit hooks, the Laverna and Fortuna
daemons and the Venom packet; the bot's sensors; the MISS splat) are the
trial phase's kickoff.

**Answered** (2026-10-27): "My first read would indeed be to test 0.25
and 1. I also don't think that we need a full blind trial. We're just
experimenting here 😁 Agreed with your lean on keep versus roll back?"
So: two arms, `b` 0.25 and `b` 1, against hit or miss, played labelled;
the user's play decides keep or roll back, and the board vetoes only a
broken game, against lines written before the trial. The last sentence's
question mark was read as agreement and said so.

The user's two follow-ups, answered by `scratch/134/defense.mjs` (its
controls: the exact rounded mean against a sampled one, 2.2780 and
2.2787; the mixture's against a sampled one, 4.5359 and 4.5339; hit or
miss's spread, 0.433, and the proposal's, 0.194, recovered at the
mixture's two ends):

> 1. How is this interacting with defense?
> 2. Is there any distribution that keeps some odds a full-on miss? I
>    know it's technically possible here, but very unlikely, right?

- *Defense:* the roll scales the damage after defense, `D = max(1, raw −
  defense)`, so defense subtracts as today and the mean is today's but for
  rounding to whole points. At a hit chance of 0.75 the rounded mean is
  within 1 % of today's at `D` 6 and over (4.52 against 4.50), and 1 to 4
  % over at `D` 2 and 3; at `D` 1, the minimum damage against heavy armour,
  it is 0.781 (`b` 0.25) and 0.875 (`b` 1) against today's 0.75. A strike
  can land for 0: at `D` 6, 5.1 % of strikes at `b` 0.25 and 0.1 % at `b`
  1; at `D` 1, 21.9 % and 12.5 %. The rounding is a call for the trial
  phase.
- *True misses:* a mixture on the same one uniform. Below `m` it misses;
  above, the rest of the uniform feeds the range, its mean raised to `p /
  (1 − m)`, so the whole mean stays `p`. With `m = s (1 − p)`, `s` is the
  share of today's misses kept: 0 the pure range, 1 hit or miss exactly.
  At `b` 1 and 0.75: `s` 0.25 misses 6.3 % with a spread of 0.250; `s` 0.5
  misses 12.5 % with 0.306, about `b` 0.25's spread (0.308) and
  visibility (278 hits against 266) in another shape: clean misses and
  steady hits, where `b` 0.25 smears the low strikes. It keeps the MISS
  splat, `unit:missed` and the miss triggers, and the hit hooks fire on
  87.5 % of strikes rather than 75 % (today) or 100 % (the pure range).
  Whether it joins the arms is put to the user.

### The kickoff's own (tranche 3)

The charter's premises re-checked at HEAD, the phases and their order, and
the first phase's cut with its reads.
