# TODO.md

Small follow-ups that aren't roadmap steps. Add things here when they're worth fixing but would derail the current step. Cross them off as we land them.

**Completion convention (2026-07-06):** a completed item collapses to a single ✅ line + a pointer (commit hash, doc §, or "git history") *in the commit that lands it* — the full diagnosis lives in git history and the run-logs, not here.

**One section a round (the Round 8.5 TODO pass, signed 2026-10-14; re-placed
at §133's re-cut, 2026-10-26, `archive/post-118-worklog.md` §133, tranche 3: a round with no row
has no section, and a row with a trigger and no round is under "Watches").** Each
open item sits under the round it was given, with the groups META-ROADMAP
names; which round and why is the item's row in
[round-8.5-census.md](archive/round-8.5-census.md) section 5 (T-nn). A new item goes
under the round it is filed for, or under "Not yet placed" until the next
pass. The items ticked before the pass, and the fifteen it found done or
dropped, are in git at `cdd5c81`.

## Round 8.5 — Housekeeping (closed 2026-10-26)

By phase, as `archive/post-118-roadmap.md` §121 to §129 has them. The census rows that are not
TODO items (list A's deletions, list B's trials) are in
[round-8.5-census.md](archive/round-8.5-census.md), not here.

### Every phase: the comment pass

- ✅ **Rewrite the phase codes out of `src/` code comments** — `src`'s step codes 6,376 → 0 by `npm run oracle -- comment-codes`, held by `tests/comment-codes.test.ts`; its comment words 234,033 → 189,570; `tests` and `tools` keep theirs, by §125's decision point (`archive/post-118-worklog.md` §121 to §127; §133, 133f).

### §122 sim

- ✅ **Unify the duplicated `chebyshev` helpers.** The four private copies import `movement.ts`'s alias of `occupancy.ts`'s `distanceBetween` (census B-17; `archive/post-118-worklog.md` §122, 122j).

### §123 run

- ✅ **A loaded run can miss a field the class defaults.** `Run.test.ts` holds a loaded run's own properties to a constructed one's; `fromJSON` sets `pauseAtTurnGates` (census F-2; `archive/post-118-worklog.md` §123, 123k).

### §124 and §124.5 render and UI

§124, the board, closed 2026-10-18, and §124.5, the screens, 2026-10-20;
every item below is done (`archive/post-118-worklog.md` §124, "The close of §124"; WORKLOG
§124.5, "The close of §124.5").

- ✅ **A third copy of the neutral-target rule, a lead for the kickoff.** `ObjectiveController` calls `validNeutralObjectiveTarget`, kept as a trial on a truth table (`archive/post-118-worklog.md` §124.5, 124.5f).

- ✅ **The ability line overstates three units' damage.** The card's damage and heal numbers come from the sim's own functions, under a pin over the catalog (`archive/post-118-worklog.md` §124.5, 124.5e).

- ✅ **`damageStatFor` and the catalog's `damageStat` have no reader that runs.** Both deleted, with the editor's line and the tests that called them; gotchas #94 and #114 corrected (`archive/post-118-worklog.md` §124.5, 124.5g-post3).

- ✅ **The dev load key's console lines still give the map-only rule.** They give `devLoadRun`'s rule, and `toggleGrayscaleAudit` has no `force` (`archive/post-118-worklog.md` §124.5, 124.5d).

- ✅ **The battle HUD's enemy notch can show the next wave's bound.** In battle `Run.previewPoolsAtRisk` reads the fielded wave; `Run.test.ts` pins it on seed 2 (`archive/post-118-worklog.md` §124, 124g).

- ✅ **The page drive does not notice a phase whose scene never mounts.** `drive` refuses a phase whose scene is not on screen (`PHASE_SCENES`); the rest's map swap removed fails it (`archive/post-118-worklog.md` §124, 124a).

- ✅ **The probe runner's edges.** `--arg-file`, `--build` with `--dist`, the report's shape in `probe-cli.mjs`'s header, and `until: 'turn-outcome'` stopping as the battle ends (`archive/post-118-worklog.md` §124, 124b).

- ✅ **`UnitCard.ts` re-exports `UnitRarity` with no reader.** The re-export is out; every importer reads `config/units`, and the build's bytes are unchanged (`archive/post-118-worklog.md` §124.5, 124.5h-post).

### §126 tests

- ✅ **A guard against an import cycle through `config/units`.**
  `tests/units-cycle.test.ts`, on the shared walker, fails on any path
  back (`archive/post-118-worklog.md` §126, 126h).

- ✅ **A test that loops until a command takes effect never returns once
  the command stops taking effect.** Every loop that waits on a tick or a
  command counts its tries, in tests, `tests`' instruments and `src`'s
  replay loops; TESTING's "Bounded steps" (`archive/post-118-worklog.md` §126, 126e).

- ✅ **Three tests time out at 5 s when anything runs beside the suite.**
  The chaos seeds and four slower default-limit tests carry 15 s, each
  with its reason; `store-guard` keeps 30 s (`archive/post-118-worklog.md` §126, 126f).

- ✅ **Ten sites spawn an encounter on a World of their own.** All ten
  build it with `battleWorld` now, the stormcaller fixture's grid
  corrected to the 12×12 it ran on (`archive/post-118-worklog.md` §126, 126k).

- ✅ **Nothing notices the rollout walker buying nothing at a port.**
  `arbitratedStrategy.test.ts` walks a clone of its funded dock under the
  overlay and reads a purchase land (`archive/post-118-worklog.md` §126, 126i).

- ✅ **The step-code ceiling guards test titles too.** `comment-codes` counts
  the codes in `it`, `test` and `describe` titles, and `comment-strip` masks
  a title's words (`archive/post-118-worklog.md` §126, 126n).

- ✅ **Pin ARCHITECTURE's event catalog against `events.ts`.** `eventSounds.test.ts` holds the catalog's rows to the interface's keys, with a self-check (`archive/post-118-worklog.md` §126, 126g).

- ✅ **Pin `ui.css`'s `--font-mono` against `FONT_STACK`.** `font-coverage.test.ts` holds the sheet's chain to `FONT_STACK` and a generic tail (`archive/post-118-worklog.md` §126, 126g).

### §127 tools

- ✅ **A guard on the context readings** — closed unbuilt: every recorded slip was caught by read-back before its commit, and the guard's inputs are harness internals (`archive/post-118-worklog.md` §127, the kickoff).

- ✅ **`comment-length` takes any path** — a file or a folder, in the repo or out of it (`sourcesAt`, `archive/post-118-worklog.md` §127, 127d).

- ✅ **`comment-strip` proves a file with a held comment** — named apart with its held comments, its code proven with every comment out and controlled (`archive/post-118-worklog.md` §127, 127e).

### §128 to §133, the close

Split at §128's kickoff (2026-10-23); `archive/post-118-roadmap.md`'s entries for §128
and §130 to §133 say which phase takes each row.

- ✅ **DESIGN's "Out of scope" list names as backlog what has since been built** — seven lines struck with their phases; synergies and the camera's line stay, each with why (`archive/post-118-worklog.md` §130, 130d).

- ✅ **Dead links in the docs** — the five fixed, and `tests/docs.test.ts` checks every relative link outside `archive/`, whose misses are left (`archive/post-118-worklog.md` §130, 130d).

- ✅ **`phase-stats`: a commit-TYPE fix column beside the word-match ratio** — `fixT%`; Round 8's 9 `fix` commits by git, 9 by the tool (`archive/post-118-worklog.md` §130, 130c).

- ✅ **`phase-stats` under `--since`** — `.5` and `.75` phases kept, a word scope's step read from its subject, the rest placed in the phase in flight; Round 8's 200 commits by git from §110's kickoff to the close, 200 by the tool (`archive/post-118-worklog.md` §130, 130c).

- ✅ **The friction log is a tracked file** — the six dirty checks leave out its path (`TREE_PATHSPEC` in `scripts/build-id.mjs`), in place of a spool (`archive/post-118-worklog.md` §130, 130a).

- ✅ **Two lines of the smoke were not read** — read at 128c in both browsers' storage inspectors: Firefox kept our keys 24 days, one foreign key; Edge's storage was empty before the day (`archive/post-118-worklog.md` §128, 128c).

- ✅ **Rounds 9 and 10, re-cut into smaller rounds with smaller phases** — Rounds 9 to 23, the old 11 and 12 renumbered 24 and 25, this file's rows placed by round (META-ROADMAP; `archive/post-118-worklog.md` §133, 133d and 133e).

- ✅ **Round a tithe's bits on the award, not on each kill** — built since 47f: a turn's tally is rounded once, which the user confirmed is the intent (`archive/post-118-worklog.md` §133, tranche 2c).

- ✅ **`forcedEncounterId` fields only at a node of its own kind** — stated in `RunConfig`'s comment on the field since 123m; closed at §133, tranche 3.

- ✅ **122o's seven deletion leads** — six deleted at 123l; `World.shove` is in Round 12's scope (`archive/post-118-worklog.md` §133, tranche 3).

- ✅ **Round-scoped rules, and a close that deletes as well as promotes** — `ROUND-RULES.md`, archived at each round close; the close keeps a line the round added only if it did something; a bar for a new rule or guard (`process/planning.md`; `archive/post-118-worklog.md` §132, 132e). Round 8.5's own list is 132f's.

- ✅ **A deletion's proof once ROUND-RULES' rule lapses** — `process/oracles.md` "Behaviour-equivalence refactors": fitted to the deletion's size and risk, in the user's words from 132h1 (`archive/post-118-worklog.md` §133, 133a).

### §129 the dependency phase

- ✅ **Dev-toolchain `npm audit` debt** — 10 at §129's kickoff, 0 at 129f (`archive/post-118-worklog.md` §129).


## Round 9 — The frame and the misses (closed 2026-10-30)

META-ROADMAP §"Round 9 — The frame and the misses" names each row's place.

### At the round's close

- ✅ **The keep test over the lines §132 added** — 20 rule rows over both ranges, two deleted, the rest kept on their records or the user's call (WORKLOG §140, 140d).

- ✅ **Read the trial of no context counts below 500k** — the silence kept: no line names context pressure, no hand-off before 500k without a reason, and each session past it handed off (WORKLOG §140, 140d).

### The board's instruments

- ✅ **A coverage guard for `roster-table.json`** — `tests/roster-table-coverage.test.ts`, with the sector ids by position and a launch-time refusal in `makeRosterSampler` (WORKLOG §135, 135b).

- ✅ **Compact `roster-table.json`** — written a row a line, 4,616,750 → 1,773,061 bytes, with the sector ids by position in its provenance; the per-bucket distributions not built, since the rows were already deduplicated and a sampled draw draws a whole roster (WORKLOG §135, 135a).

- ✅ **`box-drive.sh`: one artifact KIND per cohort** — each batch's fetch checks its own artifact (a `--search` line `best-strategy.json`, others `summary.csv`), `--artifact` an override, and `--plan` prints them before any box (WORKLOG §135, 135c).

- ✅ **The action classes deleted at Y5c are still described as live** — DESIGN's Combat paragraph, ARCHITECTURE's stats line and gotchas #19, #93, #95, #97 and #109 rewritten against the effect interpreter, none retired; #109's pin restored (WORKLOG §135, 135e).

- ✅ **FX_REGISTRY's own coverage gap** — `fxRegistry.test.ts`, "coverage": every ability authors `fx` or is listed with its reason (four), every periodic status's tick has a key with a sound or is listed (none) (WORKLOG §135, 135d).

### A fix for the first release

- ✅ **The rarity stars take the tap inside a card that is a control** — the pre-turn hand and the card list pass `clickable` when their cards are controls, so the stars take the long-press there; the user's touch read is 135g's (WORKLOG §135, 135f).

## Round 10 — Act 1, the wilds (closed 2026-11-04)

META-ROADMAP §"Round 10 — Act 1, the wilds" names each row's place.

### At the round's close

- ✅ **Look at the HANDOFF Cursor's structure and contents** — a pass over every Cursor line at each hand-off in `process/session-end.md`, its first run at the round close's rewrite, the cap at 3,900; Round 11 its trial (ROADMAP §147, 147d and 147e; WORKLOG §147).

At Round 10's close the board's ceiling label went to Round 11, the
scripted run's two warnings to Round 18 and the editors' shared rules to
"Watches" (WORKLOG §147, 147d).

### The board

- ✅ **Rebuild the roster table once act 1 is in the map** — v4 off 146b's board, 52 buckets over the three-act walk; the `sectors` line out (ROADMAP §146, 146c; WORKLOG §146).

- ✅ **The board report prints the sheet's whole history** — both headers print `sheetProvenance`: the count of the sheet's entries and the first and last entries' titles (ROADMAP §146, 146a; WORKLOG §146).

### The scripted run

- ✅ **A scripted run for content work** — `script=` and `act=` on `RunConfig`, the four old dials its cases, with a port's stock, a starting act and the CLIs; the user's three cases and a start at act 2 played at 142h (ROADMAP §142; WORKLOG §142). Round 25 keeps one clause: which dials a shipped build answers.

- ✅ **`--sector-hops` in the run-config tool** — the hyphenated spellings parse, and the help lists every URL parameter from a table a test holds to `RUN_CONFIG_PARAMS` (ROADMAP §142, 142g; WORKLOG §142).

- ✅ **The encounter dial warns when a forced id matches ZERO nodes** — the run warns at each act's entry (`Run.scriptWarnings`, `script:warning`), the browser's console and the run-config CLI print it (ROADMAP §142, 142d and 142g).

### The shell

- ✅ **The backslash guard** — the context meter's mod refuses, before it runs, a Bash command whose reading the halving changes; the halving measured again on 2.1.309 (ROADMAP §142, 142a; WORKLOG §142).

- ✅ **The backticks guard** — the context meter's mod refuses, before it runs, a Bash command holding a backtick bash would run as a command substitution, as written or after the halving; replayed over the round's 2,400 Bash commands it refuses the four that lost text and one other real substitution, and nothing else (ROADMAP §147, 147e; WORKLOG §147).

## Round 11 — The roster

META-ROADMAP §"Round 11 — The roster" names each row's place.

### Before the closing board

- [ ] **BALANCE.md's header at its 700-line cap.** It refused a commit
  at 140e, 143b and 145h, a hook round each, and every fix above the run
  log is now a net-zero edit. The retune writes BALANCE most, so before
  it, read the header for protocol text to demote to an archive, the cap
  kept (WORKLOG §147, 147d).

- ✅ **The ceiling deltas' label says paired seeds; the arithmetic is
  pooled.** Computed on the shared seeds since 150b, pinned where paired
  and pooled differ (WORKLOG §150, 150b; BALANCE.md 2026-11-05).

- ✅ **A blinded ranged unit strikes past its acquisition range** — `currentTarget` takes no fallback under blind, so a blinded unit strikes only inside blind's acquisition range and a ranged unit with a floor holds fire while blind (the kiter's case as signed); pinned in `src/sim/statusBehaviorConsumers.test.ts` (154b; WORKLOG §154). Its worth on the board: 154g's prior table and §155.

- [ ] **The PRIEST parity breach** (the 94h signing, 2026-09-08 — BALANCE §94h): +14.2 over the soldier on the deploy shape, +10.0 on regen (92h +5.0 / +5.9; the ±5 principle). Healing pays more when fights last three turns and the dead are booked (the casualty rule + the 94b openers). A kit/price question for Round 7 (the §94 charter excluded archetype changes); the gambler reads +6.7 / −1.6. At 146f, on act 1 (The Periphery), n=120: the priest +1.7 regen · +0.8 deploy over the soldier, inside ±5, and the gambler −2.5 / −1.7 (the 146g sheet); the row stays for Round 11's board, the priest's parity (C16). At 150h, the ARM with doctrine's pick as the null, n=120 on act 1: the priest −10.8 regen · −8.3 deploy against the soldier, the gambler −16.7 / −13.3, each told apart on the shared seeds, the soldier's rows having gained the most (BALANCE 2026-11-06, WORKLOG 150h); signed at 150h's stop into §154 beside the priest (the user's lead, act 1's encounters bimodal in difficulty, in WORKLOG 150h).

- [ ] **The deep-end wall, from above its band to below it.** Under the hit roll the deploy walk's boss wall read 0.459 at the §94 config (94h, user-signed HOLD: a roster-strength lever before any band move) and 0.579 on the old game at 139c, against the signed 30–35. The conversion moved it to 0.200 (139b's numbers; 0.299 at 137c's), and the two-act wins from 24 to 52 of 120, outside §139's line of one Escalation step (7). The old game with 137c's bot vector won 20 with a wall of 0.630 (139e), so the move is the game's, not the bot's. Where: act 2's elites and bosses 27 to 38 % less pool damage, act 1's bandit fights 41 and 46 % less, the ronin and the mages 59 % more; act 1's wins unchanged. Signed at §139: no number moves in Round 9, and the retune takes it. The cause is not measured; the user's idea (every swing pays defense at one pooled rate, a gap that grows with level) estimates at 1 to 4 % of an archer's swing, and a swing read split by act would test it (BALANCE.md 2026-10-29; WORKLOG §139). Those are the two-act walk's numbers. On the three-act walk the deep end is act 3, which the sheet's terminal pair reads: at 146f its wall 0.211 on deploy and 0.357 on regen, its reach 0.475 and 0.117 (BALANCE.md 2026-11-03). Round 11 reads it on its board; the band's re-set is Round 22's (WORKLOG §147, 147a).

- [ ] **The arbitration loses the walk.** The board's doctrine and ARM
  rows differ in `--arbitrate --prior-lambda=0.5` alone. On the
  three-act walk at 146b, paired on seeds 1 to 40, doctrine won 12 seeds
  the ARM lost and the ARM none that doctrine lost (p 0.0005); on act 1
  alone 5 against 1. 94h read the walk's gap at −0.200 on two acts and
  named the high-override sites (94g-2's count) as the suspect. The
  sheet's refs are ARM rows, so they carry the loss. Find where the
  arbitrated decisions go wrong on a long walk, before the closing board
  reads the roster (BALANCE.md 2026-11-03; WORKLOG §146, 146d).

- ✅ **The skill gradient's random < greedy leg can't tell a flip from
  noise.** Read by an exact sign test on the anchors' shared seeds since
  150c, a tie fine, the comment and the WARN in BALANCE's words (WORKLOG
  §150, 150c; BALANCE.md 2026-11-05).

- [ ] **Power diversity by rarity** (verdict item 4): 1/1/1/2 → 1/1/2/3 or 1/2/3/4 — a pool re-anchor rides behind it (every burn/turn moves); Round 11, after the §94 signing. Weigh the scale against the prior table v7, where the rare halberdier (+31 ± 14 taken free) and the legendary stormcaller (+25 ± 14) already read the highest (BALANCE 2026-11-06, "the draftable units' worth"; signed at §152's kickoff). A unit's power is what its fall costs its own side, so a steeper scale lowers a rare's or a legendary's worth by what its deaths cost, the officer's, the catapult's and the shaman's as well (WORKLOG §153, the kickoff's audit, which corrects this row's earlier "adds most where worth already is").

- [ ] **Act 1's cost, against the per-kind cost target.** §146 tuned
  act 1 to turn targets only. The target was signed at Round 11's
  kickoff (2026-11-05): normal 10 %, elite 30 %, boss 50 % of the pool,
  each fight within ½× to 1½× (BALANCE "Per-kind target bands"; WORKLOG
  §148). Out of band on 146f's walk rows: the rats' nest (0.02 / 0.09),
  the wolfpack (1.84 / 1.58), the poachers (9.45 / 9.41), the cats
  (19.94 / 22.51) and the Vermin Lords (2.67 / 1.66). Read at §153,
  after the weapons move every fight's cost, the rats' nest and the
  Vermin Lords first; `scratch/148/kind-cost.mjs` gives the kinds.

- [ ] **The AoE-status enemies — the RETUNE half** (range / cooldown / duration; "really annoying"): board work, carried to **Round 11** with the kit watches (Round 7's no-board guard).

- [ ] **Kit watches from the 94f price-book re-read on prior v4** (BALANCE §"The rarity verification protocol" step 3: a negative recruit row at FREE acquisition is a KIT question, not a price one — WORKLOG §94f): **officer** (−42 recruit / −36 port-buy, the worst row in the book) · **bandit** (−24 / −25, the weakest common) · **mercenary** (−15 / −10, the soldier's starter body) · **halberdier** (−16 recruit; port n=8 unreadable) · **stormcaller** (−2.8 — a legendary that does not pay at free acquisition under casualties). Round 7 idiom / Round 11 candidates; the §94 charter's "NOT doing: archetype changes" held. The dispositions taken at 94f: gunslinger common → uncommon (+28 / +27 at the cheapest price) · healer base 30 → 32 · everything else HOLD. Since rule C the ARM never drafts the officer at all (0 of 23,471 rosters at 146b and of 25,657 at 146f; the random and greedy anchors still take him), so the roster table's guard holds him PENDING until an ARM row drafts him (WORKLOG §146, 146c). On the prior table v7 (150h's ARM, the Soldier; BALANCE 2026-11-06, "the draftable units' worth"), taken free: the halberdier +31 ± 14 and the stormcaller +25 ± 14 now read high, the officer −21 ± 14 still low, the mercenary −1 ± 11 near 0; bought, the gunslinger +75 ± 18 and the adventurer −59 ± 24 at the same price, both added to the list; the rioter's −33 ± 10 free took §152's buff. The list is re-aimed at §154's kickoff, read on the numbers §152 and §153 leave (signed at §152's kickoff, 2026-11-06). Those numbers: the prior table v8's unit rows with their errors (BALANCE 2026-11-08, "the prior table v8"; WORKLOG 153g).

- [ ] **The wolf's retreat, if the wolf doesn't feel distinct** (the
  user, 2026-11-01, at 144e's stop). The wolf ships Bite, the Club's
  numbers, on the bandit's body with the adventurer's mobility. If it plays
  as a plain biter beside the other beasts, give it Gambit's retreat
  (strike, then spring back, as wolves harry big prey), the kit the fox
  was offered before it took Pounce and Dash (WORKLOG §144, "144e
  signed").

- ✅ **Power's level-up draw and its growth key.** Out at 153a: power
  has no growth rate (the schema refuses one), a level-up draws eight
  values, not nine, and six run streams' draws realigned, proven against
  the old roll with power's draw spliced back (WORKLOG §153, 153a).

- [ ] **The corpus's trade rows, picked by what they drive.**
  `corpus.test.ts` wants all 21 command kinds to change a run (20 until
  153e), and the
  rows that cover a trade are picked by seed, so a content change that
  moves a run can lose a kind and send a session surveying chaos seeds
  for a replacement: three port rows re-picked at 145g, chaos 15 and 26
  for 7 and 37 at 146e, chaos 33 added for a unit paid off at 151b. A row
  that drives its trade (a scripted port, say) may hold through a
  content change, and §152 to §154 re-record the corpus often (session
  3d0a8fc1's report; WORKLOG §151, 151b). At 152b chaos 33 stopped paying
  a unit off and chaos 10 replaced it; in the same survey chaos 4 also
  sells a packet, the one kind no stored run reaches, at 39 battles and
  14 s (WORKLOG 152b). At 153a three trade rows were re-picked, and at
  153e two more, chaos 37 among them, which also sells a packet (WORKLOG
  153a, 153e).

- [ ] **A `--set` path into one encounter.** `--set` reaches only a
  config group's top-level numbers (`resolveKnob`), so a lever inside one
  encounter (its pool, a level weight, a count factor) is swept on the box
  only by a commit per arm, which the one-HEAD rule makes slow. At 153e
  the Vermin Lords' rats' level weight was probed locally on 20 seeds
  instead, and their pool swept through `difficulty.enemyMoraleMultiplier`,
  exact only for a forced fight. A path such as
  `--set=encounters.vermin-lords.healthPool=80` would make a per-encounter
  sweep a queue like the others; §155 re-pins act 1's bands and may sweep a
  fight again (WORKLOG §153, 153e and the close, in
  `archive/worklog-phase-153.md`).

### Dis Pater

- [ ] **Dis Pater's sentence, against the tithe as built** (117e's watch,
  rewritten at §133). The tithe is tallied raw in the World and rounded
  once on a turn's total, which the user confirmed is the intent
  (2026-10-26), so at Escalation 3 to 5 (a bits lever of 0.75) one kill in
  a turn pays 2 and two pay 3: "each kill tithes 2 bits" holds for a
  one-kill turn alone. Reword it with the `--grant` read below, and reread
  it whenever level 3's lever is retuned.

- [ ] **The Dis Pater `--grant` read at n=80.** Both reads on the
      daemonized miner are thin site-causal pairs (the v3 shadow −11.25
      at n=55; the 88d3 live decline margin +4.3 at n≈18) — exactly the
      stream-perturbation-dominated shape WORKLOG §85g6c warned about —
      yet the user picks him every run. The standing rarity protocol's
      tool for a thin row is the paired same-seed `--grant` arm at the
      n=80 floor (the 88b cohort shape, ~40 min box): a FREE endowment
      read that answers "is holding him net-negative" without the
      site-causal confound. Candidate mechanism if it holds: the tithe
      funds MORE bot shopping, and port purchases price negative on
      average (88b). Rides the §89 amendment cohort or its own line.

### Ability descriptions

- ✅ **Ability DESCRIPTION text (the name half is done).** Shipped at
  §151: the schema's optional `description` (151d) and the 29 lines, the
  name's tooltip on the full card (151e; WORKLOG §151).

### Unit descriptions

- [ ] **A line for every unit, the user's to write.** A unit's
  `description` (145c) is optional, and only the six beasts have one;
  none of them is draftable, so in play the full card shows no line and
  an enemy card's tooltip is the only place one appears. The user writes
  a one-line summary for each unit in the archetype editor's Description
  field, as a set, since a line on some player cards and not others reads
  as uneven. Asked 2026-11-02 (WORKLOG §145, "145c's tooltip in tiers").

### At the round's close

- [ ] **The Cursor's hand-off pass, read as a trial** (signed at Round
  10's close). Each hand-off reads every Cursor line for still true,
  needed first and held elsewhere (`process/session-end.md`). The keep
  test reads whether the round's hand-off records name it, and a Cursor
  cap refusal in the round says it is not working (WORKLOG §147, 147d).

- [ ] **The silent-turn reminder, read again.** `npm run friction-scan`'s
  `nudges` over the round's sessions, beside Round 10's 158 over 11
  sessions and 3,596 tool calls, with the round's filings and reports on
  it; CLAUDE.md's note stood unchanged at Round 10's close (WORKLOG §147,
  147d).

## Round 12 — Push, pull and blink

META-ROADMAP §"Round 12 — Push, pull and blink" names each row's place.

- [ ] **Dash VFX (afterimage / trail / blink-flash).** N1's rogue dash currently reads as a fast slide (the `unit:moved` lerp over the ~5-tick motion window) + the `dash.wav` whoosh — no dedicated visual. The first-class **`unit:dashed`** event ([events.ts](src/core/events.ts), emitted by the effect interpreter's dash ([interpreter.ts](src/sim/effects/interpreter.ts)), carries `from`/`to`/`durationTicks`) is the ready hook: a BattleScene/BattleRenderer subscriber can draw a motion trail / afterimage / blink-flash on the leap. Folds into the deferred L/M status-VFX presentation pass. Surfaced at N1.

## Round 13 — The unit kit

META-ROADMAP §"Round 13 — The unit kit" names each row's place.

- [ ] **`knownAbilityIds` has one reader left, the archetype editor.**
  The unit catalog stopped calling it at the load cycle's fix, so no
  test reaches it. The editor could read `Object.keys(ABILITY_DEFS)` and
  the function go, which would order the editor's ability list by the
  catalog instead of the registry (`archive/post-118-worklog.md` §123, "The reach-diff over
  the seven").

## Round 14 — Neutrals

META-ROADMAP §"Round 14 — Neutrals" names each row's place.

- [ ] **A forest's own half cover.** On a procedural forest board the
  windows in the tree lines are the stone half cover `╥`, the one piece
  of the forest that reads as built (the user, 2026-11-01, at 145e's
  stop: "eventually think up a slightly more thematic replacement for
  the half cover"). The cheap route is the trees': a def equal to
  `half_cover` under a glyph of its own (a bush, a log, a stump), drawn
  in our glyph face and put where a forest board's window goes by a hash
  of the cell, so no rule changes and no stream moves
  (`battleSetup.spawnLayoutNeutrals`, `environment.treeAt`). The glyph
  is a taste stop. Here with the scenery, though it need not wait for
  the split (WORKLOG §145, 145e).

- [ ] **The camp-anchor revert, kept or cut.** `World.clearResolvedObjectives`
  reverts an engage order on a tile that is a camp's anchor once the camp is
  cleared. Its one producer, the enemy pull's tile order, was retired at
  §75j2; a player's manual engage on an anchor cell still reaches it, so
  cutting it changes what that order does, and Round 8.5 changes no
  behaviour. Decide beside "Camp-aware aura `affects`", which reworks how
  camps and teams meet. Pinned by `camps.economy.test.ts`, "a tile order
  parked on a camp anchor". From §122's kickoff (`archive/post-118-worklog.md` §122).

## Round 15 — The split

META-ROADMAP §"Round 15 — The split" names each row's place.

- [ ] **Split `Run.ts` and `World.ts`.** The two longest files in `src`
  (4,025 and 2,423 lines at `943c7cff`) are too long for a person to walk
  through in reasonable time (the user, closing B-15 for Round 8.5). Not as
  moves under widened access: 123n's count found every group of `Run.ts`'s
  methods reaching private state another group owns, so a split that
  helps a reader moves a phase's state and its share of the save with it,
  a second object, which needs a round whose charter allows one. Its
  candidates: the event phase, whose six fields are its own, and the deck.
  `World.ts` was not counted (`archive/post-118-worklog.md` §123, "123n"; the script is under
  `scratch/123n/`, on that machine only).

- [ ] **§123's comment-pass leads, placed at its close.** The "Leads,
  not built" under `archive/post-118-worklog.md` §123's batches 1, 3, 4a, 4c and 4d (a field
  only its test reads, checks a loader or `fromJSON` could make, a stale line
  in gotcha #111, the event dial reaching later sectors' roots), and
  123n's three lookups of the active event. The ones a later phase owns
  are in "The close of §123".

- [ ] **The census's unread leads** (census B-12 and "Sim and run",
  signed "left to each phase's kickoff", and no kickoff of §121 to §123
  took or dropped them; found at 133f). Near-duplicate runs the finder
  listed, none opened beyond its first line: `layouts.ts`'s one
  validation block written three times; the shared tails of the `camps`,
  `encounters`, `layouts`, `sectors` and `events` loaders, and of
  `abilities` and `statuses`; four loaders typing their schema by a
  hand-written interface that repeats each key; `actingPosition.ts`'s two
  searches; the stat fold in `runStats` and `statusEffects`; and
  `terrainGen`. Each is a reshaping under the corpus and the fuzz diff.
  `RunConfig.ts`'s parse, the sixth: the parse and its inverse are still
  written field by field, and §142 added `script` and `act` in the same
  shape (`parseRunConfig`, `runConfigToQueryString`).

## Round 16 — The turn

META-ROADMAP §"Round 16 — The turn" names each row's place.

- [ ] **A won-turn reward shape** (the user's §93 verdict item 3): under casualties a decisive win still books your own dead — candidates: a partial refund on a decisive win, or the enemy paying survivors on a loss (the surcharge machinery mixes rules per turn already). After the post-turn ledger screen lands (§94), re-read the feel before building.

## Round 17 — Deck and daemons

META-ROADMAP §"Round 17 — Deck and daemons" names each row's place.

- [ ] **WATCH: Escalation 3 (bits −25%) reads no harder on the board's
  arm** (118e; BALANCE 2026-10-10). Kept by the user as an economy step:
  the arm bought less and lost no depth, and how real players spend is
  unknown. Read again with level 3's read on this round's board, after the bit
  sinks, with exported journals (purchases a run, by level) if any exist.

## Round 18 — Events and rewards

META-ROADMAP §"Round 18 — Events and rewards" names each row's place.

- [ ] **A numbered layout crossed at an event node doesn't warn.** The
  route can cross a hop that `layout=` names at an event node whose page
  ends without a fight, and nothing says the layout went unused. It
  can't warn at the node's entry, since the event can still start a
  fight there; a warning at the event's return to the map, with no fight
  on the hop, would cover it (`Run.ts`, beside the rest and port warning
  at entry; WORKLOG §142, 142d and 142h; placed here at Round 10's close,
  where events start fights, WORKLOG §147, 147d).

- [ ] **The run-config CLI's headless run doesn't print mid-run
  warnings.** It prints the warnings raised at construction, but
  `runOne` (`tests/fuzz/harness.ts`) builds its own bus, so a
  `script:warning` raised during the headless run (a layout crossed at a
  rest, an owned daemon left out of a stock) goes unheard. The CLI
  (`tools/run-config/cli.ts`) needs that bus, or a listener passed in
  (WORKLOG §142, 142g and 142h; placed here at Round 10's close, WORKLOG
  §147, 147d).

- [ ] **Pin the Reward ledger's index mapping headless** (101e) — `RewardScreen.resolve` maps a ledger row onto its engine index (the un-taken rows before it) and is proven by ONE pane walk (four out-of-order accepts incl. a swap; WORKLOG §101e). Lift the mapping + the identity sync into a pure function beside the screen and pin it the `pressable.test.ts` way: out-of-order accepts, a no-op accept (full cache, no swap slot) leaves the row pending, a mismatched live offer rebuilds.

- [ ] **A `reward:resolved` bus event.** The Run emits nothing when a
  reward portion resolves, so the reward screen follows the live offer by
  asking every frame (114g-post, `RewardScene.tick`), where the port, event
  and pre-turn screens repaint from bus events. An event from the Run (in
  `src/core/events.ts`, ARCHITECTURE's table and the sound registry) would
  let this screen do the same, and could carry the pickup sound, so a clip
  replayed from a journal would have it.

- [ ] **The event screen doesn't render again on `run:cacheChanged`.**
  `EventScreen` listens for `event:pageChanged` and `run:bitsChanged`
  only, so a `hasPacket` or `cacheHasRoom` condition on the page in view
  goes stale after a discard in the cache modal on that page (the forced
  keep after an event's packet overflows a full cache is one). A choice
  shown disabled that the engine would take can't be clicked until the
  page changes; one shown enabled that it wouldn't take is a silent
  no-op. Latent: the shipped events' conditions are `bitsAtLeast` and
  `flagSet` only. Fix before an event with a cache condition ships: one
  subscription beside the other two, and a pane check of where keyboard
  focus lands after the redraw, which rebuilds the choice buttons. A
  behaviour change, so out of Round 8.5. Found at 124.5h's batch 8
  (`archive/post-118-worklog.md` §124.5); placed here by the user, 2026-10-20.

- [ ] **A battle's snapshot drops a queued unit's seeded effects.**
  `World.toJSON` leaves `effects` out of each queued spawn template and
  `spawnFromQueue` reads it; only the bot's look-ahead copies a battle
  that way. Census F-1; `scratch/120f/queue-effects.ts` shows it.

## Round 19 — The ground

META-ROADMAP §"Round 19 — The ground" names each row's place.

- [ ] **The bot's passability mask, built twice** (census B-18, a trial).
  `chokeCells` and `armyMinCut` (`src/bot/sensors.ts`) each build the same
  mask of the cells an army can cross, about twelve lines, from the inert
  neutrals' footprints and the tiles' passability. Here because the
  traversal profile rewrites the bot's `passable` reads: one function both
  call, built with the profile or before it. Proof: the fuzz diff, with
  `sensors.test.ts`'s choke tests (`archive/post-118-worklog.md` §125, 125j).

- [ ] **Terrain's combat effects back** (the user, at §136's close,
  2026-10-28: "we'll want a to do to add effects back, probably defense
  and speed modifiers"). Round 9 deletes the five tiles' precision and
  evasion modifiers with the stats (shallow water −10, ice and mud −12 on
  the attacker; hills +8 and sand −6 on the defender, in
  `src/sim/TileGrid.ts`'s tile table). Designed with ice and mud, which
  this round reworks (WORKLOG §136, "The trial rolled back, and the
  re-cut").

## Round 20 — The air

META-ROADMAP §"Round 20 — The air" names each row's place.

- [ ] **Renderer position-reconciliation sweep (self-heal + REPORT sprite/sim
  desyncs).** The 56e labyrinth desync (a sprite resting tiles from its
  logical cell, fixed at 56e-pre2 via `unit:swapAborted`) showed the failure
  class exists: the renderer maintains derived position state via
  event-driven lerps with NO reconciliation, so any missed/unhonored slide
  desyncs a sprite until its next absolute-target move. The cheap tier:
  each frame, any sprite with NO active animator entry whose position
  disagrees with its unit's logical cell beyond an epsilon gets the §36c
  settle-lerp — plus a DEV-mode `console.warn` naming the unit and offset,
  which turns unreproducible one-glimpse sightings into logged data (the
  user's "several tiles off" report couldn't be confirmed at 1-cell-per-
  failure; a warn would have named the real offset). Guard: only reconcile
  when the animator holds nothing for the handle (never fight a lunge/
  shove/slide). The full tier — sprite pos = authoritative base derived
  from sim position + transient offset envelopes (derive-don't-cache for
  the render layer) — makes desync impossible by construction but is a
  real SpriteAnimator/BattleRenderer rework in the eyeball-only layer;
  size it only if the warn ever fires after 56e-pre2. Filed 2026-07-15
  (user question at the 56e-pre2 diagnosis).

- [ ] **Flyers float** (the user at §108's stop 2: "some sort of
  floating animation (maybe just a simple sine wave?)"). What DESIGN's
  "Elevation on the board" already asks of it: the bob's highest point
  keeps clause 2 (about 15 % of a neighbour's ink at most; the lift of
  0.45 measured 13 %, so a small amplitude or a lower base lift), and the
  mark stays still on the tile. Also: a phase per unit, so a flock doesn't
  bob in unison; under reduced motion the lift stays and the bob goes; and
  a read on whether the bar and hitsplats bob with the glyph.

- [ ] **Rounded plates for organic scenery** (the user at §108's stop 1, 2026-09-25: future trees, where rounding "might thematically fit for 'organic' scenery"). The rounding exists: `MarkStyle.plateCorner` and the shader's rounded square (`terrainMarks.glsl` `plateShape`), with the explorer's `plateCorner` dial kept through 108f to try it. Today it is one global uniform; trees beside square-plated walls need it per mark (a spare field in the mark's texels). Square stays the default: the dashes did the walls' job, and rubble read as a tie. A large radius drifts toward the player's circle (the spec's caveat).

## Round 21 — Act 2, the realm in chaos

META-ROADMAP §"Round 21 — Act 2, the realm in chaos" names each row's place.

- [ ] **The three deep-end cost residuals** (the 94c re-read, 2026-09-07 — BALANCE §94c re-read): infernalColumn 10.6 · miscreants 10.2 · ronin-vs-mages 10.6 cost/instance against the 1.5 × normal-mean line (9.3), in band on TURNS. A bite property (cost/turn 3.2–3.3 vs 2.1) that predates 94b and the pool cannot close; the lever is the COUNT factor on those three waves (column hand×1.2 · miscreants hand×1.5 · mages hand×1.3 — fewer bodies at the same kill throughput = the same burn, less bite; level is already ×1.0 / ×1.25). One config commit + a six-arm re-read (~3.4 h) whenever those rows are next touched; not a §94 blocker (the config froze over it, user-signed).

- [ ] **Power at 2/3/4/6 with morale doubled, an option** (the user, 2026-11-07, at §153's kickoff, which signed 1/1/2/3). Read per common it is 1 / 1.5 / 2 / 3: 1/1/2/3 with the uncommon priced apart from the common, each tier distinct in whole numbers. (0.75/1/2/3 read the same way is 1 / 1⅓ / 2⅔ / 4, a legendary at four commons, as steep at the top as 1/2/3/4.) The cost: every morale number in config doubles (the player's pool, every encounter's pool, the power overrides, the morale heals and conditions in packets and events), the board's refs in points move, and the bots' scores need a check constant by constant (the rollout evaluator's death penalty already scales with the pool; the prior table's rows are in pool points). Weigh it where acts 2 and 3's pools are retuned, here or at Round 22 (WORKLOG §153, "The cut signed").

## Round 22 — Act 3, the plague

META-ROADMAP §"Round 22 — Act 3, the plague" names each row's place.

- [ ] **Mapgen tool: empty-camp-pool hint.** §81c field report
  (2026-08-17): the user spent five minutes rerolling VOLCANIC maps
  hunting for camps — the one theme whose pool ships empty. One line
  of UI (grey the Camps stat or badge the theme select "no camps")
  saves the next person the hunt. Dev-tool-only, trivial.

- [ ] **The Deep End's description calls it the second act.** Its
  `description` in `config/sectors.json` reads "A drowned, fetid second
  act"; it is act 3 since §145. Editor metadata only, never shown
  (`src/config/sectors.ts`), so it is rewritten with act 3 (WORKLOG §147,
  147a).

## Round 24 — Onboarding & Feel

META-ROADMAP §"Round 24 — Onboarding & Feel" names each group (the old Round 11).

### First: the layout rework (players' reports may bring it forward as a `.5` round)

- [ ] **A smaller window than 1280×720** (1024×576 first): a future goal,
  the user's call at 117.5c's read, and "closer to a full round" than a
  step. What stands in the way is the item below and the left column over
  an event's text. 117.5a has the text-over-text numbers at 1024×576 and
  960×540; they do not see a card over the board.

- [ ] **The battle HUD's unit cards cover the board** (the user,
  2026-10-09). On a 2.5k screen they cut the top and bottom tiles; at
  1280×720 more; at 1024×576 the enemy's cards cover half the board, and
  with a full roster a tile may not be clickable. The same ratio of card
  to board is a 720p window at 125 % text. The text-size survey can't see
  it (a card over the canvas is neither text over text nor a box off the
  page), so an instrument for it is the first step: the board's tiles a
  card covers, per window and size. A later round's.

- [ ] **At 150 % text a 720p window breaks down, and the layout wants a
  rework** (the user, reading 117.5d's mock, 2026-10-09: "things really
  start to break down by 150%; at some point, we'll need to rework
  things"). The two columns are 300px each of a 1280px page there. What
  150 % shows after 117.5e, which held it to "nothing out of reach" and
  no more: the columns over the outer cards of a recruit (plates over a
  card's glyph by 24px); the battle's banner cut by 139px of its name; the
  countdown's Fight button over the enemy's compact cards by 14px, since
  the enemy pane now drops 22px to stay under the hop chip; the promotion
  screen scrolling 66px. The event and the port are clear, their bodies
  narrowed to the room between the columns, which at 150 % is 612px. So a
  rework is about what a screen does with that little room (the card
  rows, the battle's top), not a fix per chip. Five screens are still a
  plainly centred column with no scroll (recruit, reward, game over,
  sector cleared, the menu): they fit today, and a taller body would put
  their ends off the page as the promotion screen's were. A later
  round's; the instrument is `shell/electron/probes/text-scale.js`.

### The feel sweep

- [ ] **Audio tell for the catapult hold-fire (82e rider,
  2026-08-17).** The release gate ships SILENT visually-speaking
  beyond the amber drain bar (user call at the 82e shape-lock) — a
  short "held fire" sound (creak/ratchet) on `unit:actionHeld` would
  carry the tell for eyes-elsewhere moments. The event already
  exists; this is an AudioPlayer subscription + an asset pick, feel
  round material.

- [ ] **Catapult LAUNCH creak (the F3 launch/impact split — optional tail).** F3 moved the projectile *launch* to the `release` phase (~12 ticks before impact), so the loose is silent and only the impact crash sounds. The seam is now trivial: the `catapult_launch` fx key already exists (projectile-only) — just author a launch "creak/thunk/FWOMP" sound (a `scripts/gen-sfx.mjs` recipe would do it) + add it to that key + register the `SoundKey`. Lower priority — the impact crash carries the weight. *(Same optional opportunity for the mage bolt's `release` "fwoosh," but `magicboom` at impact already reads right.)*

- [ ] **Renderer "queued/waiting" stance — the §44/§46 ship-feel deferral.** Units now WAIT on purpose (§44b's first-class `WaitAction`; §45b queues) and the seam for showing it was planted deliberately: the `unit:waited` event (event-only, [WaitAction.ts](src/sim/actions/WaitAction.ts)) fires once per deliberate hold. A subtle render tell (dim pulse, stance glyph tint, whatever reads at a glance) would let a player SEE "this unit is queueing, not stuck" — the §46 decision point deferred it as pure ship-feel polish. Render-only; no sim/snapshot impact. Natural home: any Cluster-3+ polish rider or the pre-launch pass. Filed at the §46c close-out (2026-07-06).

- [ ] **Fleeing-enemy threat tell (UI).** Parked at the §58 close
  (2026-07-19, user call): a player-facing "that unit can't reach/harm
  you" read — the derived reachability math (§58's unbuilt sensor)
  surfaced as UI instead of bot input. The bot side proved unnecessary
  (searcher-ate-it, BALANCE §58); the player value is readability on the
  fleer/deserter situation the experienced eye reads natively. Needs a
  snapshot-computable reachability read + a render/ui surface
  (eyeball-verify); candidate slot: a later UI/polish round.

- [ ] **Stalled-battle draw prompt (live-game UX).** The only stall guard is
  the per-turn tick cap (`resolveAsDraw`, driver-owned) — a player who hits a
  genuine stall IRL is stuck watching until the cap expires, with no engine
  heuristic to offer "this looks stalled; accept a draw?" earlier. Idea
  (user): a cheap no-progress read (e.g. no damage/pool movement for N
  seconds) that surfaces an accept-a-draw prompt in the UI. Sim read +
  UI-only surface; no effect on headless (harness keeps the hard cap).
  Originally floated around the draw/timeout-counter unification but never
  noted; captured 2026-07-15.

- [ ] **The capped turn's end sequence, read once in a browser.** A turn
  that runs out the clock pays the survivors' rule as the cap's surcharge,
  so the HUD flies one orb for each unit
  still standing (`src/ui/HUD.ts`, `lossEventsAtEnd`). It ships, and no
  browser read of it is on record. One capped turn in the user's Firefox,
  with the stalled battle's draw prompt above. Reworded at the Round 8.5
  TODO pass (census T-41) from "the survivors end sequence, unexercised
  live", whose trigger, a survivors-rule playtest, is ruled out.

- [ ] **Status-tick sparkle placement / height (27e experiment).** The 27e periodic-status pulse (`spawnSparkle` in [BattleRenderer.ts](src/render/BattleRenderer.ts)) anchors a touch below the glyph's visual center (`SPARKLE_Y_OFFSET = -0.175`), motes rising `SPARKLE_RISE = 0.35` — so the burn/poison/heal puff hugs the unit's torso (the `+N` number floats higher, at the glyph's ink top). User wants to leave it there for now but **experiment with the height/spread later** (raise toward the head ~+0.5, or float a halo over the unit ~+0.7). Pure render consts — eyeball-tune freely. **Related:** the **apply-flash was dropped** in the 27d/27e playtest follow-up (`status:applied` fired mid-slide — `MoveAction` flips the logical position onto the tile while the sprite is still lerping in — so the puff popped mid-lerp, "burning before arrival"). If a settle-on-arrival apply cue is ever wanted, the clean hook is to delay the `status:applied`-driven sparkle by the unit's remaining move lerp (the `applied` fx slot is still in the StatusDef schema + `driveStatusFx`). Surfaced at the 27e playtest (2026-06-24).

- [ ] **Movement polish: smooth the vertical motion of ground moves, then
  reopen the hop one final time** (the user at §108's stop 2). §81c2's
  profile does a step's whole height change in half the step, in a
  straight line, and stops dead at the midpoint. Floor heights are
  continuous noise, so nearly every step has one; at the 0.3 s mobility
  floor it lasts 0.15 s (0.05 s at 3×), and the user read the sharp corner
  as jitter on fast units. A candidate: smoothstep over the half-step. It
  still reaches the new height by the midpoint, which is what keeps the
  anchor at or above the surface it is over; check it with
  `tests/board/clip.ts`. Then the hop question reopens once, as the user
  asked: the measurements are in `archive/post-104-worklog.md` §108c, the
  dial's code at `d045497`, and `?bp=board-wade` is the fixture. Reduced motion drops any
  hop (DESIGN §Reduced motion).

- [ ] **A polish round: the rally X as a terrain mark** (the user at the
  §109 kickoff: "at some point, we should probably investigate turning the
  rally glyph into a terrain marker"). The tile objective marker is a glyph
  sprite that stands its ink, not its quad, a small gap above its cell, so
  it reads the X's ink bottom from the atlas (R10, re-grounded at 109a:
  under the quad-bottom anchor the X's ink sits 17/64 of a cell above its
  quad bottom, and dropping the term floats it 0.43 world units). Drawn by
  the terrain as a mark shape (the §108 table, a new shape id) it lies on
  its tile with no ink read at all, and R10 is deleted. A new look, so a
  read; the enemy mark rides above a glyph and stays a sprite. Its
  requirement, measured at 117.5b: read on all six floors. In OKLab the
  amber X is 0.095 from desert's sand, 0.194 from tundra's ice and 0.30 or
  more from the other four. The user's eye found it fine on desert
  (2026-10-09), so nothing is built before the mark (`archive/post-109-worklog.md` §117.5b and
  "117.5c — the read").

- [ ] **SFX diversity** (verdict 7d) — a content item. The worklist now lives in code: the 14 `candidate` rows of `SILENT_EVENTS` ([eventSounds.ts](src/audio/eventSounds.ts), §104) — promoting one = move it to `EVENT_SOUNDS` + a `gen:sfx` recipe.

- [ ] **A hitsplat gallery dev key.** The 98d split was "very hard to test" (the user, 2026-09-16): a DoT number lives 0.6 s and needs a DoT-applying enemy on the board (the shortcut used: `?layout=isthmus&encounter=plagueDoctors`, then a DOM `MutationObserver` on `.hitsplat`). A Ctrl+Alt chord that spawns one sample of EVERY `HitsplatKind` on the first player unit (`~7` / `‡7` / `☠7` / `+7` / `12` / a crit / Miss) would make any number tweak a two-second eyeball check. `src/dev/devKeys.ts` is the home; the overlay's `spawnHitsplat` is private to BattleRenderer today — needs a dev hook through Game or BattleScene.

- [ ] **The band constants by eye** (98e) — amplitude 0.22 and one band per tile (98e-post: two read as a hazard stripe; the diagonal now runs in world space in both shaders); one constant each in terrain.frag (`DEEP_BAND_AMPLITUDE` / `DEEP_BANDS_PER_TILE`) and the literal pair in apron.frag.

- [ ] **The battle's hop chip does not fade** (seen in the stylesheet at
  117.5d, not measured): it is `chip hud-hop screen-fade`, and the chip
  plate's `transition` comes later in the sheet than `.screen-fade`'s and
  names no opacity, so the chip appears and goes at once while the HUD's
  other panes fade over 180 ms. `.control-chip` names the opacity for this
  reason; the hop chip needs the same line.

- [ ] **A tooltip leaves with its screen.** An open tooltip closes a
  frame after its trigger has left the document, so through a scene swap
  it stays whole for about 190 ms over a screen that is fading out, and
  a pinned one stays over an overlay opened from its own trigger (the
  sector map) until Esc. Measured 2026-10-13 in an offscreen window
  (`archive/post-118-worklog.md` §120, "The question, measured"; `scratch/120e/tooltip-swap.js`
  under the probe runner). The wiring: `closeTooltip()` where a screen's
  fade starts (`fadeOutAndRemove`, `src/ui/fade.ts`) when
  `openTooltipTrigger()` is inside the leaving element, and where an
  overlay opens. Census A-22 keeps both functions for it. It changes
  behaviour, so it is not Round 8.5's, and a read in Firefox goes with
  it.

### The board's accessibility dials

- [ ] **The glyph scale as an ACCESSIBILITY dial** (the §105 verdict, 2026-09-22) — the user read 105e's `scale` dial as a tie ("all pretty legible") and asked whether it becomes a player setting. 105e already threads a scale through the mirror pick and the two unit lifts from `src/dev` (units only, walls stay one tile); a shipped version is that threading moved into production + a settings row. Pose it with Round 11's accessibility list, not before.

- [ ] **Yaw as a PLAYER setting — decide WITH a reason** (the §105 verdict, 2026-09-22) — structurally safe under ortho (world-up projects to screen-up at any yaw; the fit, picks, sort and post are camera-generic; the N×N anchor must be yaw-parametric anyway), but every eyeball read would be multiplied by the range's ends. §106 art-directs at ONE value; expose only if a real need appears (a MIRRORED yaw for reading direction is free — [−45, −30]). `archive/post-104-worklog.md` §"THE VERDICT".

- [ ] **The overlays trail a camera move by one frame** (found at 112b's
  step zero). The loop moves the bars and badges inside `onFrame`, and
  three.js updates the camera's world matrix only inside the render, so
  the first frame after a camera change projects them with the old camera:
  in the pane, a yaw change put a bar at x = 0, then at its place a frame
  later. Invisible at 60 fps while fit is the only shipped view; it would
  show as bars lagging the board under a moving camera (scroll-mode
  panning today, a player-facing yaw in Round 24). The likely fix is
  `camera.updateMatrixWorld()` in `Renderer.start`'s loop before
  `onFrame`, as the probe kit's `frame()` does (`src/dev/probe/index.ts`).

- [ ] **The OS's reduced-motion setting, never followed live.** With the
  motion setting left to follow the system, the game reads
  `prefers-reduced-motion` (`src/render/motion.ts`), and only the
  resolution is pinned: the pane cannot emulate the query, and the dev
  key Ctrl+Alt+A sets the override instead. The check, a minute of the
  user's: Windows' "Animation effects" off, then a battle, where nothing
  should sway, fly or shake (census 5.7, L322; not done by Round 8.5's
  close, 2026-10-26).

### The tutorial, the run summary, text size

- [ ] **A key's name is its US label** (116e). The registry binds a
  `KeyboardEvent.code`, the physical key, and `keyLabel` shows that code's
  name, so on AZERTY the key marked A reads as Q in the settings' key rows,
  on the HUD's buttons and in the tooltips. It has been so since the HUD
  showed keys; the rebind rows make it visible. A fix would keep the
  pressed key's `key` beside its `code` at a rebind (the defaults have no
  press to read), or ask `navigator.keyboard.getLayoutMap()`, which
  Firefox doesn't have.

- [ ] **The run-end stats beyond the fallen** (the 102 kickoff, call D): the ledger records DEATHS only, so the 102d body cannot say fights fought / won, turns taken, damage dealt, bits earned, the daemons and packets a run ended with — each needs a second source (`turn:resolved`, the battle tallies, the Run state at the end). A content item for the polish round; the body's layout (totals + a table) has room for a second block.

- [ ] **Last run exports a finished run only** (118f's audit). The end
  screen's Export run and Settings › Data › Last run hand over the newest
  run that ended (`lastRunJournal`), so a player reporting a bug in the
  middle of a run has only Export everything, which carries the saved run
  and its journal among everything else. The itch page says so. A row
  that exports the run in progress would be the smaller file; unchecked:
  whether `npm run replay` takes a journal whose last segment is open.

- [ ] **Some text may be too small at the default size** (the user's
  read of 116k, 2026-10-07): "some things definitely just look better on
  the larger sizes", and the three that stood out were the events, the
  command chips in the HUD (read here as the objective buttons, Engage /
  Focus / Hold / Stop) and the hitsplats. No default is resized now, the
  user's call: it wants player feedback, and no playtester has ever
  flagged UI size. When it comes back, the lever is the `--text-*` token
  each of the three uses, and the survey
  (`shell/electron/probes/text-scale.js`) says what a larger default
  costs each window. A suggestion of the session's, not the user's: ask
  it at the round's playtest (was any text too small; did anyone change
  Text size).


## Round 25 — Ship

META-ROADMAP §"Round 25 — Ship" names each group (the old Round 12).

### The shell, packaged

- [ ] **Electron's major, chosen with the packaging** (signed 2026-10-23
  at §129, which took 44.9.3 for its advisory and left 45). The shell
  runs only the recorder and the probes until it ships, so its major is
  picked here, read on the recorder's check twin and its two planted
  controls and on the frame-rate probe.

- [ ] **One instance of the Electron shell per profile.** The two-tab lock
  is the browser's own, so a second instance of the shell on the same
  `userData` is not kept out: measured at 115f, it reads the lock as absent
  (`none`), saves as if alone, and its writes replace the whole
  `store.json`. The shell stays internal through Round 8; before it ships to
  players, `shell/electron/main.mjs` takes `app.requestSingleInstanceLock()`
  (the second instance quits and the first takes focus), with the probe and
  record runners, which pass their own `--profile`, still able to run beside
  a playing instance (unchecked: whether Electron's lock is per `userData`).
  The landing note is in `main.mjs` at the store file.

- [ ] **Under Electron every write sends the whole store** (116l, measured
  with `shell/electron/probes/diag-run.js`). `src/store/electron.ts`
  keeps one file and rewrites it at each save, so a save costs the page
  in proportion to everything stored: 0.09 ms with an empty journals
  section and 1.8 ms with it at its budget, and the main process then
  writes 1.2 MB to disk, untimed. Under a frame and at a gate, so nothing
  is owed while the shell is internal. Home: the phase that ships the
  shell, with one instance per profile ("§115 riders"); a file per
  section would make a save cost its own size.

- [ ] **The packaged shell's notices.** The desktop build will owe
  Electron's and Chromium's notices, at the phase that packages it; the
  shipped licence file covers the web build only. Unchecked too: whether
  the bundler's own run-time helpers, beyond the preload polyfill, are in
  the bundle (minified, they have no name to search for).

### The browser matrix and other hardware

- [ ] **The device pixel ratio is uncapped** (`Renderer.ts:168`): both
  composers and the bloom render at full device pixels, and fullscreen on
  a 4K laptop with integrated graphics is the bad case. Left for data, the
  user's call at the kickoff: the user's GPU can't show it, and a cap
  changes the glyphs' look. Players' reports (window, ratio, GPU) would
  come by the "Copy diagnostics" row ("§116 riders"). In Firefox that
  row names a class of card and not the card (118i: a GTX 980 "or
  similar" on a 4080 SUPER), so it tells an integrated chip from a
  discrete card at best.

- [ ] **A shader that fails to compile throws nothing** (117.5i, from
  memory of three.js, not run here): it logs to the console and draws
  nothing, so a driver that rejects a shader would give a black board
  under a working HUD and no plate. Hearing it means asking the program's
  link status after the first frame.

- [ ] **The battle plays on unseen while a lost context is waited for**
  (117.5i, measured under the runner: lost at tick 40, halted at tick
  120). The wait is four seconds; a loss that is restored inside it has
  cost that much of the fight's picture, and the sound still plays.
  Holding the playback for the wait (`PlaybackSpeed.hold`, as the
  settings modal does) would stop that.

- [ ] **A long error in the failure plate can't be scrolled by keyboard**
  (117.5i): Tab stops on Reload alone, and the box that scrolls is not a
  tab stop. Making
  the `<pre>` a tab stop would do, as the credits' body is one.

- [ ] **Object pooling for the hot per-tick allocators (GC-pause reduction, not memory).** The 2026-06-15 fuzz heap probe found each sim run allocates a firehose of short-lived objects — V8 grows ~155 MB of heap *headroom* to absorb the churn though the live set is only ~16 MB (no leak; `heapUsed` flat across 600 runs). The churn costs no *memory*, but pooling the hot allocators — pathfinding scratch arrays, event objects, transient grid vectors — would cut **GC pauses**, which matter more for **rendered-game frame-time smoothness** than for fuzz throughput. **Caveat: this is a *deterministic* sim — a pooled object reused with a stale field is a determinism bug that's brutal to trace, so reset discipline must be airtight (the determinism tests are the guard).** Surfaced at the N2 dwm-leak investigation ([archive/dwm-leak-diagnosis.md](archive/dwm-leak-diagnosis.md)).

### Store-page assets: the recorder

- [ ] **A clip of a continued run.** `npm run record -- --journal=<file>`
  replays a journal of one segment started from a seed and refuses more
  (`shell/electron/record-cli.mjs`, `openJournal`). Since 115d a run loaded
  from its save is a journal of several segments, so a clip of one needs the
  replay driver (`shell/electron/probes/replay-page.js`) to load each resume
  as the page did and go on. Filed at 115d (`archive/post-109-worklog.md` §115, "For the build
  stretch").

- [ ] **A replayed clip gives no cue of which choice was made** (the user's
  114g read). A command sent at `Game.dispatch` presses no button, so an
  event option, a map node or a recruit card is chosen with no flash and no
  click sound. Perfect highlighting isn't needed; a brief flash on the
  chosen control would do. The replay driver
  (`shell/electron/probes/replay-page.js`) knows each command before it
  sends it, so the cue can come from there or from the screens.

- [ ] **The recorder's open items at the §114 close** (`archive/post-109-worklog.md` §114f,
  §114g; a dev tool, so none blocks the round). At `--speed=3` a cue can go
  unheard (517 of 518 and 111 of 113 in two clips, none missing at 1×), not
  diagnosed, and it fails the clip when it happens. A run recorded across
  a real switch of the display, and a clean clip (not a check twin) across
  one, are unmeasured. The stamp's wipe copies the row's next 64 pixels
  over the stamp, which is a flat field in a battle and can be an edge on a
  run's screen.

### Human gauntlet #2

- [ ] **Human-gauntlet cells vs the starting event.** The §53 cell
  protocol pins its forced fight at the ROOT, which The Start now
  stamps as the starting event (74i-c) — the headless drive suppresses
  the catalog (cells.test), but a BROWSER cell run (`cellUrl`) opens
  the boon event before the fight, perturbing trace comparability
  with the 53g baseline. Revisit before the next human gauntlet
  (eventCatalog is programmatic-only, so the URL side needs its own
  answer — a `noevents` query dial or a protocol note).

### A decision point: a second language

- [ ] **A second language.** The game ships English alone. Round 7 built
  the string layer for more, the locale gets its row in Settings "with a
  second locale" (META-ROADMAP, Round 8), and no round schedules one. The
  user: "Supporting a second language should probably be an explicit to
  do". Census A-24 keeps the layer's way in for it (`registerLocale`, the
  stale-translation marks, the translators' credits), which only tests
  call today.


## Watches

Rows with a trigger and no round (§133, tranche 3). Each names what reopens it.

- [ ] **TypeScript 7, held at 6.0.3 at §129** (signed 2026-10-23). The
  7.0.2 package's root exports a version stub and its compiler API sits
  under `unstable/`, which eight of our files would need (one in `src`,
  `src/i18n/literalScan.ts`, behind a permanent gate); typescript-eslint
  8.72 takes TypeScript `<6.1.0`. Look again at a round's first phase:
  when typescript-eslint takes 7 and the API leaves `unstable/`, it is a
  step of its own, release notes first. The typecheck took 10.5 s warm
  on 6.0.3 (`archive/post-118-worklog.md` §129, "The kickoff").

- [ ] **`reach-diff` across a toolchain change** (§130's call 4). A V8 or
  transform change starts a statement a line away, so `reach-diff` refuses
  a pair of readings from two toolchains; `scratch/129/reach-common.mjs`
  compared what both count at 129h. The next toolchain bump (TypeScript 7
  above) decides whether it becomes a mode of `npm run oracle`
  (`archive/post-118-worklog.md` §129, "The close of §129").

- [ ] **nvm for Windows 2, at the next Node switch** (deferred at §129's
  129i, the user's call, 2026-10-23). 2.x needs no admin for `nvm use`,
  but here nvm 1.1.12's entries sit on the machine PATH ahead of a
  per-user install, so the move takes one admin cleanup, and no rollback
  is documented. Then: the stable 2.x of that day, in link mode (a
  junction, no shim process in front of `node`), `%APPDATA%\nvm` backed
  up first, Node held at one version across the swap (`archive/post-118-worklog.md` §129,
  "129i, step zero").

- [ ] **A severity flag for the friction log** (the user, 2026-10-28;
  `archive/worklog-phase-138.md`, "The friction log's third kind"). Not
  built while there has been one incident (137d's absolute `GIT_DIR`).
  Reopens on a second: then a yes/no `--incident` with a concrete test
  (damaged, or put at risk, something outside the step's own work: the
  checkout's git state, pushed history, the box, the user's files).

- [ ] **A watch on the harness feedback the user sent** (the Cursor's
  rider until 132h2). Four messages to the Claude Code team: on
  2026-09-20 the silent-turn reminder's timing and wording, and the
  keep-going guidance having no project override
  (`scratch/claude-code-feedback-1-reminder.txt`, `-2-pauses.txt`); on
  2026-09-27 the settings override never reaching the app's sessions
  (`-3-env.txt`); on 2026-10-23 the Bash tool halving backslashes
  (`-4-backslashes.txt`). If a release documents
  `CLAUDE_CODE_SILENT_TURN_REMINDER*` or changes either behaviour, correct
  CLAUDE.md's "The silent-turn reminder", `process/shell-and-windows.md`'s
  "Editing", and the backslash
  note's `MEASURED_ON` in the mod. The retired reword's evidence is in
  `archive/post-104-worklog.md` §"The Round 7.5 close".

- [ ] **A home for a performance number** (the probe's scenario 15, WORKLOG
  §132, "132h7 — the probe run, scored"). AGENTS "Where things go" sends
  measurements to a domain run-log, BALANCE.md or PATHING.md, and a frame
  cost or a render number belongs to neither. The user picks its home when
  the work that measures one is cut.

- [ ] **Euclidean distance in place of the chessboard's, on players'
  reports** (the user at §133, 133c). Most players come from autobattler
  searches, and a roguelike's diagonal may not read to them; it waits for a
  report that shows it.

- [ ] **The half-tile grid, if Round 19's swarms do not feel right** (the
  user at §133, 133c). A sim grid at twice the resolution, for small
  creatures and swarms; plan A, built first, is a small body drawn smaller
  on a whole tile and a swarm as one body drawn as a cluster. Its costs,
  read at 133c: movement correct for every footprint, every distance
  authored in cells converted, the movement protocol and the drift
  baselines re-pinned, and the sim's cost under the bot's look-ahead
  (`archive/post-118-worklog.md` §133, "the experiments").

- [ ] **The rules every editor's sheet repeats** (census B-19, a lead).
  The validation list, the hints, `.row`, `.workspace`, `.edit-pane,
  .side-pane` and `button.primary:disabled` are in all eleven config
  editors' sheets, about 630 lines that could move into
  `tools/editor-base.css`. No proof today: `css-compare` passes the move
  only when no editor rule can meet a moved one at one specificity, and
  showing that two never meet on one element takes the editors' markup
  and the classes their code sets, which no named oracle reads
  (`archive/post-118-worklog.md` §127, 127c and 127f). Reopens when an
  oracle reads them; carried from Round 8.5 into Round 10 untaken, so
  made a watch at Round 10's close (WORKLOG §147, 147d).

- [ ] **What players of the itch build report.** By 2026-10-23, the
  user's word: a handful of players and no comments. A stranger's
  finding lands here, as do the 7.5 close's two watches, frame rate on
  other machines and the overlay stack; none is recorded yet. Reopens
  with a player's report (moved from the HANDOFF Cursor at Round 10's
  close, WORKLOG §147, 147f).

## Not yet placed

The inbox for a new row until the next pass places it.

- [ ] **Beyond the Roman look.** The user, at §151's kickoff
  (2026-11-06): "More generally, I want to start diversifying from the
  Roman aesthetic also, but I think that can be a future point." Every
  daemon but the Cornucopia and the Patrician's Seal is a Roman god's,
  renamed at 151c for an object of the god; Round 17's daemons are the
  next new ones (WORKLOG §151, "The cut signed").

- [ ] **The redraw-fisher file is refused by its own schema.**
  `config/redraw-level-fisher.json` names 10 of the 23 archetypes, and
  `ScoredCardWeightsSchema` is strict over every one, so
  `npm run fuzz -- --count=1 --redraw=config/redraw-level-fisher.json` throws at
  `weights.archetype.reaver`; nothing in the suite loads the file. Fill
  in the missing archetypes at 0 or delete the file, whichever its
  reader still wants (`tests/fuzz/redrawPolicy.ts:60-64`; WORKLOG §144,
  the kickoff's audit).
