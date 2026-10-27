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

## Open

### The act design (tranche 1, put to the user 2026-10-27)

1. **Each act's theme.** One sector per act, or candidates per act (the
   map already picks among a node's candidates; each is a full sector of
   content). *Lean:* one sector an act for now; act 1 grassland, act 2
   barren, act 3 swamp, act 4 volcanic, with tundra and desert left for
   candidates later. Until Round 21 reworks the shipped two, a run would
   be grassland, grassland, swamp.
2. **Hops per act, and so a run's length.** Today 22 hops. Acts 1 to 3 at
   11 each make 33 to act 3's boss, half again as long; at 9, 27; at 8,
   24. From Round 10 to Round 21 the run is act 1 plus the shipped 22.
   The time a hop takes in play is not measured here. *Lean:* about 9 an
   act.
3. **Bosses.** Act 2's faction leader, act 3's dark wizard and act 4's
   demon lord are the outline's. Open: act 1's boss (Round 10's decision
   point, under its scope guard of no 2×2, so the bear cannot be it yet);
   whether the Generalissimo is act 2's leader; one boss an act or a pool
   of two as today. *Lean:* act 1 an alpha beast with its pack, 1×1 for
   now; the Generalissimo as the leader; a pool of two where the content
   allows.
4. **The enemies' split.** *Lean:* the Deep End's plague and occult
   encounters go to act 3 when act 3 lands, and act 2 keeps the human
   half (bandits, deserters, the period archetypes); act 4's are new.
5. **The plague's cause, and the arc.** Open; the user's to write. *One
   reading, offered:* the dark wizard spreads the plague, and the demon
   lord is what he spread it for, so the secret act answers "why". The
   terminal frame has a pun ready: a plague in a machine is a virus, and
   a demon lord sits beside the daemons the player carries.
6. **The ending, and what a win is.** (a) A win is act 3's boss; act 4,
   when open, is offered after it as a choice, losing there does not undo
   the win, and its boss is a second record. (b) With act 4 open the run
   goes on to it, and only its boss wins. (a) needs the win recorded
   apart from the run's end, which one event does today, and a choice at
   act 3's end; (b) needs only the gated edge, but makes finding the
   secret act a harder run. *Lean:* (a), with the credits after the first
   win.
7. **Act 4's unlock, in outline.** The user is still working on it. (a)
   Any first win opens it, or (b) a win at some Escalation level or with
   each character: both read `bestWin` and cost nothing in the run. (c) A
   condition met during a run, found or done in acts 1 to 3: a Run field
   (a Run bump) and content. *Lean:* (c), gated by (a), since "secret"
   reads as found rather than handed out.
8. **Where the act design lives.** The round's spec is archived at the
   close, and Rounds 10 and 21 to 23 build on the design. *Lean:*
   `plans/acts.md`, beside the tutorial and music plans; DESIGN.md's
   Aesthetic paragraph (act 1 brigand country, act 2 the Deep End)
   describes the shipped game, gains a pointer now and is rewritten when
   Round 10 ships act 1.

### The trial (tranche 2)

What keeping it would look like: the bar is a decision point, and it rests
on what the trial is for. The user's intent names two aims, precision made
visible and unpredictability in small fights; by 133c's arithmetic a
single draw a strike makes a hit's spread smaller (0.433 of the damage to
0.194 at a hit chance of 0.75), steadier fights, and a two-parameter
family makes the spread a dial. The rest of the trial's decision points
(the distribution; bleed, blind and the two hit-hooking daemons; the bot's
sensors; the MISS splat) are the trial phase's kickoff.

### The kickoff's own (tranche 3)

The charter's premises re-checked at HEAD, the phases and their order, and
the first phase's cut with its reads.
