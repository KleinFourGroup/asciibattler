# WORKLOG — Round 9 (The frame and the misses)

Per-phase narrative log (AGENTS "The planning stack"; `process/planning.md`
"The artifacts"): findings, decision rationale, rejected alternatives,
scope changes, playtest verdicts and the checks run land here under the
matching `## Phase N`; the ROADMAP stays a plan. The file holds the phase
in progress: at each phase close it moves to `archive/worklog-phase-N.md`
and a fresh one starts. Round 9's earlier phases:
[archive/worklog-phase-135.md](archive/worklog-phase-135.md) (the kickoff,
§134, with the spec's answers and the charter's premises at HEAD; and
§135, the board's instruments),
[archive/worklog-phase-136.md](archive/worklog-phase-136.md) (§136, the
trial's switch and arms; at its close the trial rolled back and the round
re-cut) and
[archive/worklog-phase-137.md](archive/worklog-phase-137.md) (§137, every
strike lands, headless; at its close, the stdin guard and the pre-commit
hook checking the commit itself).

## Phase 138 — the screen after the misses

The rule this phase dresses landed at 137c (`d50e23f1`): every strike
lands, and precision, evasion and `accuracy` are gone, with the screen's
references taken out as plain removals. What §137 left for this phase,
and what it did not verify on screen: `archive/worklog-phase-137.md`,
"§137's close, put to the user".

### The friction log's third kind (2026-10-28, before the kickoff, session ee3f6da8)

The user opened a process review from 137d's last papercut, the hook
spike that damaged the checkout's git state: a mistake, and more severe
than a papercut as they meant the word, small issues with the setup or
the tooling that made the work harder, to be passed through and fixed.

- *The incident's reach.* `.git/config` (one `core.worktree` setting)
  and `.git/index`; no file on disk and no commit. Between it and worse:
  the test's commit failed on our hook, and its next command, `git
  checkout -- README.md` (`tests/build-id.test.ts:67`), never ran. A
  search of `tests/`, `scripts/`, `tools/` and the hook for git verbs
  that write a working tree found only that line. The session reported
  the damage in its closing message (transcript `fc66283a`).
- *Why the log drifted.* The Round 7 definition, "any point of
  friction", listed "a wasted round-trip", and §132's "A known trap met
  again takes one line", meant as a permission to be brief, read as a
  duty. By this session's reading (one reader's labels, not a measure):
  in an evenly spaced sample of the whole log, about half the papercut
  entries were friction from the setup; of the 23 since §132, three or
  four were, about 17 were the filer's own mistakes, and about ten opened
  "known trap met again".
- *"A wasted round-trip."* Unexplained at its adoption (`e09145b9`); the
  entries that use it mostly mean one tool call, some an exchange with
  the user. Either way it names a cost, not a source.

**Signed** (the user, 2026-10-28): `slip` as a third kind, in their
words "something you could have done differently knowing only what you
knew then"; `--kind` required; the known-trap line a permission to be
brief, for either kind; "a wasted round-trip" dropped. Built: AGENTS'
filing text; `scripts/papercut.mjs`, its types and tests (a filing with
no kind is refused; control, HEAD's filer fails three of the five);
`process/welfare-and-efficacy.md`, "Filing", "Who reads" and the wording
row. The phase and round closes read "the friction lines" without naming
a kind, and the round close's rule test ("a slip it was written against
stopped") already reads slips, so neither changed.

**Not built: a severity flag.** A scale would rate inconsistently the
case it exists for (a small cost beside a large risk), cannot apply to
`distress`, whose name sets no threshold, and reaches the user later
than a closing message does; there has been one incident in 372 entries.
The user likes a yes/no `--incident` with a concrete test (damaged, or
put at risk, something outside the step's own work: the checkout's git
state, pushed history, the box, the user's files) as the candidate if
the evidence comes.

### The kickoff's audit, and the cut put to the user (2026-10-29)

Read at `891eb78e`:

- *The charter's code surfaces are built already.* 137c took the
  screen's references out as plain removals, as §137's cut signed
  (`d50e23f1`): the PRC and EVA rows (`statLabels.ts`, nine labels now,
  POW lifted above a grid of eight), the ability detail's hit chance
  (`abilityDetail.ts`, now `N dmg · reach R · C% crit`), the promotion's
  Dodge line (`promotionDelta.ts`), the strings `stat.precision`,
  `stat.evasion` and `promotion.delta.dodge`, the buffs' numbers in
  `locales/en/daemons.json` and `packets.json`, the archetype editor's
  vs EVA and vs PRC dials with its Dodge and to-hit lines, the attack
  editor's Accuracy field, and the layout editor's tile hints. 137c-post
  fixed the tools index's to-hit preview and the hitsplat guide.
- *Nothing else on screen reads the two stats.* Every list of stats
  iterates `STAT_LABELS`: the card, its buff text, the promotion (it
  walks the card's own rows, `PromotionScreen.ts:157`), the archetype
  and packet editors. A search of `src/ui`, `src/render`, `src/audio`,
  `src/i18n`, `locales/` and `tools/`, tests left out since 137c's exit
  search covered them, for miss, dodge, evade and evasion, accuracy,
  precision, to-hit and hit chance finds only the idle miss path and
  other senses of the words (GLSL's `precision`, "missing", "dismissed").
  No run stat counts strikes (`RUN_STAT_KEYS`; the game-over screen
  lists the fallen), rarity is per archetype, not a sum of stats, and no
  stat row has a tooltip but POW's.
- *The card's grid lost a whole row.* Two columns in the level-up draws'
  order; PRC and EVA were the fourth row's pair, so the eight stand in
  four rows, CON STR / RNG MAG / LCK DEF / SPD MOB, none ragged. The
  promotion card stacks its stats in one column, two rows shorter.
- *The idle miss path, which the scope guard keeps:* `hitsplat.miss` and
  the MISS splat, `unit:missed` and its sound, and the attack editor's
  Evadable checkbox, which sets `evadable`, read by nothing until the
  dodge.
- *What DESIGN still says.* Battle mechanics' stat list has a "No hit
  roll" bullet that is no stat and tells the conversion's history; the
  `speed` bullet's clause on `agility` coming "to read as 'dodge chance'
  once the real dodge stats arrived"; no line for `power`, whose home is
  the encounter loop paragraph; a pointer to ROADMAP's Phase E, which the
  ROADMAP no longer holds. The Stat identity paragraph calls the Rioter
  "dodgy" and says the four §76f units are draftable only, though the
  Witch Hunt's waves field the rioter (`config/encounters.json`). The
  Combat paragraph has no false sentence this read found since 137c, and
  phase tags run through it (I6, GP2, E6).
- *Not checked here:* any surface in a browser. 137c's pane read (seed 9,
  the soldier, by `__probe.drive`) showed eight stats under POW and no
  hit chance on the promotion and recruit screens, with no NaN, no
  "undefined" and no console error but the pane's resource-cache ones.

**The cut** (no step adds an RNG stream or bumps a snapshot; neither
fires the smoke unless a `-post` fix touches `src/sim`, `src/run`,
`src/core` or `config`; no count is re-recorded; no batch):

- **138a — DESIGN's stat list and Combat paragraph, as the game is**
  (`none`). One bullet a stat for the nine, `power` pointing to its home,
  each saying what the stat does and where its numbers live, without the
  phase history; the hit roll's absence and the idle miss path said once,
  in the Combat paragraph; the Stat identity paragraph's two false
  sentences fixed; each number checked against `config/`. Docs only.
- **138b — the surfaces read in play, and the phase's close** (`stop`).
  Step zero drives each route below in the pane for a console error and
  a route that reaches its surface. The read, the user's, on their own
  dev server:
  1. *A full card* (a recruit offer, the deck list, the pre-turn hand):
     POW alone above eight stats in four rows of two; each ability row
     `N dmg · reach R · C% crit`. Wrong: a gap where a row was, a hit
     chance, a NaN.
  2. *A promotion:* `+N` chips on the eight; the lines Max HP, Move
     cadence, and each ability's damage or crit. Wrong: a Dodge line, an
     empty line, a chip beside nothing.
  3. *A buff:* Hype, Overclock and Mars read "+4 STR / RNG, +8 MAG",
     Shield and Minerva "+2 DEF", and the buffed card's marker text
     agrees. Wrong: the old +8 and +4.
  4. *A battle:* every strike a number, never "Miss". Wrong: a Miss,
     which would mean the idle path fired.
  5. *The editors* (`/tools/`): the archetype editor's preview with the
     Level dial alone and no Dodge or to-hit line; the attack editor with
     no Accuracy field, Evadable kept and idle; the layout editor's tile
     legend with costs only. Wrong: a label with no input, an empty
     line, a console error.
  A finding lands as a `-post` fix before the sign; then the close by
  `process/planning.md`, "Phase close".

**The call, with the session's lean:** how far 138a goes. The lean is
the plain rewrite above, the history left to git and the archived
worklogs, since these are the passages a session reads before touching
combat; the other arm fixes only the false sentences and keeps the
history. Either way the rest of the block stays: the "Archetypes for MVP"
list and the E1/E3 line are history and not false.

### The cut signed (2026-10-29)

"Fully signed with your leans, Claude! 😁" The cut as written, with 138a
the plain rewrite and the rest of DESIGN's stat block left. The stretch:
138a, then the stop at 138b.

### 138a — DESIGN's stat list and Combat paragraph (2026-10-29)

The stat list is one bullet a stat for the nine, `power` among them
pointing to the encounter loop, each saying what the stat does without the
phase history; the conversion and the idle miss path are said once, after
the Combat paragraph; the Stat identity paragraph's two sentences fixed.

**Step zero, inside the cut's intent and flagged:** the rewrite found four
more sentences in the two passages that were false before §137, and
dropped or corrected each: `defense` "applied to the post-cover number"
(half cover blocks paths and lets shots through, and nothing in `src/sim`
scales damage by it); "environmental fire/chasm damage is unmitigated" (a
chasm is impassable and deals nothing; what skips defense is a
damage-over-time tick, burn, bleed and poison each `bypassDefense` in
`config/statuses.json`); `mobility`'s heavy unit "around −7" (the catapult
and the shaman are −14 since the bases doubled); and its floor "at
mobility 8+" (by the knobs, `1 − m × 0.075` reaches 0.3 at about 9.3; the
claim is dropped, not restated). `magic` named two abilities; it now
names what it feeds.

**Each claim against the config** (one-off reads, printed and compared,
no instrument kept): every damage op's `scaling` and `critable` from
`config/abilities.json` (eighteen, all critable; nine on `strength`, four
on `ranged`, two on `magic`, three on `none`); `speedScaled` defaults
true and only the dash sets it false; the three luck durations are the
hex's confusion, the wail's panic and the molotov's burn, each capped;
`heal_ally` scales on `magic` and is the healer's one ability; burn, bleed
and poison are not critable and bypass defense, the first pinned in
`src/config/statuses.test.ts:70`; defense bases 0 to 3, the halberdier
alone at 3; mobility −14 to 6; power 1, the three legendaries 2, growth 0,
and `power` an optional field of a wave entry (`src/config/encounters.ts:97`);
the four §76f units draftable by the schema's default and fielded in the
Generalissimo's and the Witch Hunt's waves only. Every combatant is 1×1
(only the 2×2 and 3×3 rubble is larger), so "Units: single-tile" stands.
No link in the repo, outside the archives, names the renamed passages.

### 138b-pre — the attack editor's damage outline (2026-10-29)

Found at 138b's step zero in the pane: the attack editor's outline of a
damage op read "8 dmg · crit 10% → 16 ·". Its flags list held "acc N%"
or "unmissable" for every op until 137c took that entry out, so in the
usual case it was empty and the join left a separator with nothing after
it. The outline now ends at the crit and adds "· bypass def" only for an
op marked so. No test reads it (the function is private to a module that
touches the DOM when it loads), so the pane is the instrument: before the
fix the trailing "·" (the control), after it "8 dmg · crit 10% → 16", and
with Bypass defense ticked "8 dmg · crit 10% → 16 · bypass def", the box
unticked after. Tools only; no player sees it.
