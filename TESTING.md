# TESTING.md

How we keep the simulation honest. Companion to `DESIGN.md`, `ARCHITECTURE.md`, and `ROADMAP.md`.

## What gets tested

- **`src/core`** — `RNG`, `EventBus`, `Clock`. Pure logic, trivial to assert against.
- **`src/sim`** — `World`, `Unit`, `Pathfinding`, `Targeting`, `archetypes`, behaviors. The whole point of the determinism contract.
- **`src/run`** — `NodeMap`, `Recruitment`, `Run`. Generation is seeded, so the same seed must produce the same map / offers.
- **`src/dev`** — the DEV-only trace tooling's pure logic (`TraceRecorder`, 53b; its `configHash` is tested in `src/config`). Co-located tests; the localStorage ring + `main.ts` wiring stay in the eyeball zone below.
- **`src/journal`** — the run journal's recorder, over a synthetic bus and over whole gated runs (`tests/integration/journal.test.ts`, driven by `tests/journalDrive.ts`), and its replay: a recorded run and its replay must leave the same `Run.toJSON()` bytes, and a journal with a command dropped, a tick moved or another config hash must not replay (`tests/integration/journal-replay.test.ts`, and `journal-replay-full.test.ts` for a run at the shipped length). The recorder's replay driver, which feeds a journal to the live page (`shell/electron/probes/replay-page.js`), is driven over a stand-in for the page's Game made of the real Run, Worlds and recorder: a run recorded headless must replay through it to the same bytes, and a changed journal must be refused or fail by name (`tests/integration/journal-replay-page.test.ts`). The page itself is not in `npm test`: a recording is the check there.

- **`src/failure`** — what counts as a failure (`rules.test.ts`): which `error` events and rejections do, the first failure only, a game halted before its plate, and the wait on a lost WebGL context on a clock moved by hand. The filters' shapes were read off a real page first (a ResizeObserver loop report carries no thrown value; a missing font file rejects with a `NetworkError`). `tests/failure-boot.test.ts` holds the watch third in `main.ts` and its import graph clear of everything that can fail it. The plate itself, the halt in `Game` and the planted failures (`?fail=`) are the browser's: a pane or runner check, and the user's read in Firefox.

- **The dev-code guard** (`tests/dev-guard.test.ts`) — no shipped source file reaches `src/dev` but by a DEV-gated dynamic import, read from the source text with planted faults; and the build scan's marker list covers every entry of `src/dev`. The scan of a real build is not in `npm test`: `npm run build` and `scripts/itch-zip.mjs` run it on what they build.

## The permanent gates

Never relaxed. Pin history per round lives in the archived worklogs.

- `tests/nodemap-metrics.test.ts` (the signed 77c sheet at n=500)
- `src/audio/eventSounds.test.ts` (every bus event has a sound or a silent reason)
- `src/audio/AudioPlayer.test.ts` (every sound key has a file, every file a key)
- `src/render/fxRegistry.test.ts` (a projectile launch has travel time; every ability authors `fx` and every periodic tick a sound, or is listed with its reason)
- `tests/font-coverage.test.ts` (the UI glyph inventory, fallback coverage, the line-box pin)
- `tests/ui-focus.test.ts` (every `:hover` has its `:focus-visible` twin)
- `tests/ui-motion.test.ts` (every animation has its reduced-motion twin)
- `tests/ui-tooltips.test.ts` (zero native `title=`)
- `tests/i18n-literal-pin.test.ts` (the literal baseline stays empty)
- `src/render/statusDisplay.test.ts` (every buff key has a colour)
- `src/sim/terrainGen.test.ts` (per-theme tiles)
- `tests/prior-table-coverage.test.ts` (the derived-artifact tripwire)
- `tests/roster-table-coverage.test.ts` (its twin for the roster table: the catalog, the buckets, the sector ids by position)
- `src/config/packets.test.ts` (no run-duration packet)
- `tests/fuzz/roster/rosterTable.test.ts` + `tests/fuzz/commands/sampledRosterArg.test.ts` (the roster table and sampled mode)
- `tests/docs.test.ts` (the doc caps, the links, the filing text's hash, no home-folder path in a tracked file)
- `tests/board/cameraFit.test.ts` (the lean pin, permanent once ortho ships)
- `tests/board/slab.test.ts` (the N×N slab rule, production since 107b)
- `tests/board/clip.test.ts` (upright depth: no terrain behind a standing glyph hides it, 107d-post)
- `tests/store-guard.test.ts` (headless code never reaches `src/store`)
- `tests/store-boot.test.ts` (the store is `main.ts`'s first import and reaches no catalog)
- `tests/replay-guard.test.ts` (the game's entry never reaches the journal replay, whose tool-only options go past a config mismatch)
- `tests/save-fingerprint.test.ts` (a change to `RunSnapshot`'s structure needs a `RUN_SCHEMA_VERSION` bump, then `npm run save:fingerprint`)

## What does NOT get tested here

- **`src/render`** — three.js, shaders, DOM. Visual verification by eyeball. Trying to unit-test render code with jsdom is a tax we choose not to pay for an MVP.
- **`src/ui`** — DOM screens. Same reasoning.
- **Game-layer wiring (`Game.ts` / `main.ts`)** — same untested zone, with a
  sharper consequence (the 48c/48d lesson, swept 2026-07-11): every headless
  path calls `run.dispatch` directly, so the live command channel and the
  event handlers wired in `Game` fail ONLY in the browser — per-commit
  browser-verify IS their test surface. Two disciplines that came out of it:
  any hand-re-enumerated union (e.g. `Game.dispatch`'s switch) gets a
  `satisfies never` default so a new member can't be silently dropped, and
  event handlers reading `this.run` via closure must not fire during run
  construction (`run:started` emits mid-construction).

If the renderer ever grows pure-logic helpers (e.g. atlas UV computation), those can live in a tested utility module.

## Tools

- **Vitest 5** — shares the Vite config, so module resolution Just Works.
- Run all tests once: `npm test` (all green, 0 todo — run it for the current count rather than trusting a number baked in here).
- Watch mode: `npm run test:watch`
- Imports are explicit (`import { describe, it, expect } from 'vitest'`) — no globals.
- **Fuzz smoke:** `npm run fuzz:smoke` — opt-in vitest run on the headless
  balance harness (A3). Uses [vitest.fuzz.config.ts](vitest.fuzz.config.ts);
  the default `npm test` excludes `tests/fuzz/**` to keep pre-commit fast.
  The smoke leaves out the `--jobs` parity test, which
  `npm run fuzz:jobs-parity` runs: the hook when `tests/fuzz/` is staged,
  and before a `--jobs` batch (`process/measurement.md`).
- **Chaos sweep:** `npm run chaos -- --seeds=N [--dials=<query>]` plays the
  chaos driver (`tests/chaos/chaos.ts`, 115c) over seeds 1..N: random commands
  of every kind at every gate, legal and illegal, and random battle orders,
  checking that an illegal command is a no-op, the round trip at every phase
  change, occupancy after every tick, and that the run's journal replays to the
  same bytes. A failure names its seed and writes its journal under
  `output/chaos/`. Four seeds run on every `npm test` (`chaos.test.ts`). It is
  a crash and invariant instrument, never a balance input.
- **The journal corpus:** `npm run corpus` replays 30 stored run journals
  (`tests/fuzz/corpus/`) and holds each against what it reached when it was
  recorded: a digest of every event of every battle, the end's hash, and
  which commands changed the run in which phases. It is the proof that a
  change left behaviour alone across commits, which a test that runs one
  seed twice on the same code cannot give. A journal's own replay checks
  each battle's winner and tick count and the end's hash only; a planted
  change to a wandering camp member's step left all of those unmoved on one
  of the 30 runs, and the event digests caught it. Neither `npm test` nor
  the smoke runs it, since a change meant to alter behaviour would fail it
  in the gate: it runs by hand, as `npm run corpus` or as `corpus.test.ts`
  with its plants (the smoke's script leaves the file out), on a change
  that claims to leave behaviour alone. `corpus.ts` says when the baseline may be
  retaken (`--rebaseline`, `--record`) and what has to be shown first. Its
  reach has limits: four port trades never change a run in it, and a
  changed number shows only on the runs that meet it (a rest healing half
  instead of a quarter diverged 3 of the 30).
- **The path-by-path proofs:** `npm run oracle -- json-diff <before>
  <after>` compares two JSON files, or two folders of them, and lists every
  difference by kind and path shape (`tests/oracle/`). A hash says two
  values differ; this says where, which is the proof when a change is meant
  to differ in one place only. Two uses. For a change that slims the save:
  `npm run corpus -- --snapshots=<dir>` on the tree before and the tree
  after, then the diff, where the dropped field must be the only shape
  listed. For a change that moves config between files: `npm run oracle --
  config-dump <out>` on each tree, then the diff, where `CONFIG_SOURCES`
  (the raw files, keyed by file name) is expected to differ and no parsed
  export's value may.
- **A comment-only change:** `npm run oracle -- comment-strip HEAD`, before
  the commit, holds the working tree against the ref with every comment
  taken out (`tests/oracle/comments.ts`, `strippedCompare.ts`) and exits 1
  when any file's code differs, naming the first piece that does.
  TypeScript is split by the compiler's parser, GLSL and CSS by a small
  scanner, and a file of any other kind is held byte for byte. A comment a
  tool reads (`i18n-ok`, `@ts-expect-error`, an `eslint-disable`, a
  coverage hint) counts as code: a file that changed one is named apart,
  with those comments before and after, once its code with every comment
  out, those too, is shown to be the same, and the run still exits 1,
  since a tool reads the change. A test's title (the first argument of
  `it`, `test` or `describe`, a string or a template) is held with its
  words masked on both sides, so a reworded title passes, while its quotes,
  its substitutions and the call it names stay code. It proves the
  program's tokens are the same; it does not read the comments or the
  titles, so whether a rewritten one is still true is a reader's
  question. Every run carries its failing
  control: each file that passed is compared again with one code edit
  made in memory (`plant.ts`'s middle edit, or a line appended to a file
  it finds none in), and a file the compare doesn't name then fails the
  run, so a comment pass needs no worktree.
- **A stylesheet move:** `npm run oracle -- css-compare <ref> [sheet…]`
  holds each page's sheets against the ref's by their cascade
  (`tests/oracle/cssCompare.ts`). A page is its entry sheet (by default
  every `tools/<page>/editor.css`) with the sheets it `@import`s by a
  relative path, in their places. It exits 1 when the declarations in
  effect differ (the last of each property for one selector in one
  `@media`) or when two of them changed order where order decides: they
  set overlapping properties, a shorthand overlapping its longhands, at
  one importance and one specificity, on selectors that can style one box
  (two that name different element types, ids or pseudo-elements cannot).
  It reads no document, so a pair it names may never meet on one element,
  and the order the browser loads the sheets in is checked in the
  browser: every element's computed style on each page, before and after,
  read in the pane. Values are compared as
  written, and an at-rule other than `@media` and `@import` is refused.
  Every run appends one rule to each page that passed, in memory, and
  fails if the compare does not name it.
- **The step-code ceiling:** `tests/comment-codes.test.ts` holds the count
  of step codes in the comments and test titles under `src` to
  `tests/comment-codes-baseline.json`, file by file, so it can only fall.
  The rule for what counts is the header of `tests/oracle/stepCodes.ts`.
  `npm run oracle -- comment-codes` prints the count by folder and
  `--record` lowers the ceiling; `npm run oracle -- comment-length [path…]`
  prints how much of each folder is comment, in lines and in words, where a
  path is a file or a folder, in the repo or out of it (a ref's copy
  measured where `git archive` put it).
- **The build against a ref:** `npm run oracle -- build-hash [ref]` builds
  the working tree and the tree at the ref (default HEAD) with the build's
  ID pinned, hashes every built file and names the ones that differ
  (`tests/oracle/buildHash.ts`; about 20 s). Equal hashes mean the two trees
  ship the same game, byte for byte: the proof for a deletion of code the
  game never runs, and the one proof that reaches the renderer, the UI and
  the scenes. `--dev` compares the development-mode builds, the only ones
  that hold `src/dev`. It cannot see code the entry never reaches (the bot,
  the journal's replay, the tools, the tests), and a shader's comment moves
  it, because the `.glsl` files ship as text.
- **What a proof reaches:** `npm run oracle -- reach-record [proof…]` runs
  the behaviour proofs under the coverage tool (`@vitest/coverage-v8`, held
  at Vitest's exact version) and writes each one's reading to
  `output/reach/`; `npm run oracle -- reach [folder…]` prints the share of
  each folder's lines each proof ran, and `reach --at=<file>[:<a>[-<b>]]`
  answers for one file or range, with the functions there and their calls
  (`tests/oracle/reach.ts`). A reading is of the tree and the toolchain it
  was recorded on: record again after the code moves, or after Node or
  Vite does, since a new V8 or transform can start a statement a line away
  and `reach-diff` then refuses the pair (about seven minutes for all six).
  Reached is not proven, and unreached is a finding: "The oracle map"
  below. `reach-diff <before> <after>` lists what the first reading runs
  and the second does not, which is the check for a deleted test; given
  two folders, it does so for each proof both hold. These and `plant` take
  the whole suite as `npm-test` or `suite`.
- **A planted break:** `npm run oracle -- plant --at=<file>:<line>` makes
  one mechanical edit at the line (a condition negated, a comparison's
  boundary moved, `+` and `-` traded, a number raised by one, or a call
  removed; `--list` prints the ones the line admits) in a worktree under
  `output/plant/`, runs the proofs named by `--proofs` (corpus, suite,
  smoke, fuzz-diff; the first two by default), each on the clean worktree
  first, and puts the file back (`tests/oracle/plant.ts`,
  `plantProofs.ts`). It exits 0 when every proof caught the edit, so it is
  the failing control for a proof that passed on a change at that place,
  and the way to settle "reached, but proven?" for one line. An edit no
  proof notices is a question about the line and not yet a hole: dead code,
  a blind spot, or an edit of no effect.
- **Who reads a name:** `npm run oracle -- refs <file>[:<name>]` prints each
  export a file declares with its reads by kind of reader (the game, the
  dev build, the bot and fuzz instruments, tools, scripts, tests, its own
  file) and where it stands: unread, own-only, test-only or used. `--keys`
  asks the same of a config loader's zod schema keys, `--members=<Type>` of
  an interface's fields, and `--list` prints every reference
  (`tests/oracle/refs.ts`). It asks TypeScript's language service, so it
  tells `startingBits` the config key from `startingBits` the `RunConfig`
  field, which a grep cannot. `refs --all=<out.json>` scans every source
  file under `src` (about a minute). It does not see a read by a computed
  key, a spread, or anything outside the type check (the `.mjs` scripts,
  the shell), and it reports a schema typed by a hand-written interface as
  wholly unread: no reference is a candidate, and the site is still read.
- **Fuzz CLI:** `npm run fuzz -- --count=N` runs N seeds × all strategies,
  emits CSV + per-failure markdown traces under `tests/fuzz/output/`.

## File conventions

- **Unit tests:** co-located next to source as `*.test.ts`. Example: `src/core/RNG.test.ts`.
- **Integration tests:** under `tests/integration/`. These cross module boundaries.
  See the directory for the current set; the load-bearing ones:
  - `determinism.test.ts` — the replay contract backstop (see below).
  - `snapshot-roundtrip.test.ts` — World/Run JSON round-trip (A2).
  - `continuation.test.ts` — a run saved to text and loaded again at every gate
    plays as the same run played straight through, byte for byte (115b).
  - `resume-gates.test.ts` — a loaded run's `resume()` re-emits the gate event
    the live run emitted on arriving there (115a).
  - `layout-deadlock.test.ts` — each registered layout resolves within 2000 ticks
    (regression pin for the C1d Labyrinth fix).
  - `variable-size.test.ts` — procedural battles at multiple board sizes (D3).
  - `spawn-overflow.test.ts` / `spawn-placement.test.ts` — D5.C overflow queue + SpawnAction.
  - `encounter-loop.test.ts` — the Phase-H health-pool multi-turn loop.
  - per-archetype battle tests — `rogue` / `healer` / `mage` / `catapult-battle.test.ts` (E7).
- **Toolchain smoke / cross-module fixtures:** under `tests/`.

## The determinism contract

This is the single most load-bearing invariant in the project, called out in `DESIGN.md` and pinned by `ARCHITECTURE.md` principle #2. The replay test in `tests/integration/determinism.test.ts` is the runtime backstop for it. It runs one seed twice on the same code, so it shows that a tree agrees with itself; what shows that a change left behaviour alone across a commit is in "The oracle map" below.

Concretely, the contract says:

1. **Seed in → state out, deterministically.** Given the same RNG seed and the same initial `World` configuration, calling `world.tick()` N times must produce byte-identical final state and an identical event sequence.
2. **Cross-seam streams are KEYED, not positional (77d2/77d3).** Every Run/battle-setup stream derives per-occurrence as `deriveRng(root, key, ...stableIds)` — key strings come from the closed registry in `src/core/rngStreams.ts` and are PERMANENT (renaming one, or changing the frozen hash, is a deliberate global stream break; the pinned vectors in `rngStreams.test.ts` enforce it). An occurrence is atomic between snapshots, or carries a serialized counter. `fork()` survives for LOCAL self-contained use only (a test/tool forking off a fresh parent it owns end to end): it produces a child stream deterministic in its own right, advancing the parent by exactly one step.
3. **No hidden randomness.** No `Math.random()`, no `Date.now()` as entropy, no iteration-order-as-randomness. ESLint catches direct `Math.random()` in `src/sim` and `src/run`; the replay test catches everything else.

The snapshot-roundtrip test extends the contract across serialization: a `World` deserialized from `toJSON()` must produce an identical event trace from that point forward. The continuation check extends it across a save: a `Run` loaded from its text at any gate, with the run's own config, must play the same commands to the same bytes as the run never saved. A round trip alone (text, load, text) compares the save code with the load code, so it cannot see state both leave out; a continuation can, because the left-out state changes what happens next.

## The oracle map

Which proof to name for a change that claims to leave behaviour alone (a
deletion, a comment pass, a reshaping on trial), by part of the code: what
each proof runs there, what it was shown to fail on, and what it missed or
cannot see. Measured at `a45a7af` on 2026-10-12. The planted breaks are
recorded site by site in the Round 8.5 worklog ("119g"), and the shares
move as the code does: `npm run oracle -- reach` prints today's.

**A proof across a commit keeps something from before the change.** The
journal corpus keeps stored runs and what each reached. The fuzz diff
keeps a worktree at a ref. The build compare and the comment-stripped
compare read a ref. The config dump and the snapshot diff are taken on the
tree before. The determinism test, the continuation check and the chaos
driver's own replay hold a tree against itself, and a tree agrees with
itself after most changes of behaviour, so those are gates and prove
nothing about sameness. The suite's expectations are stored too, and they
cover what someone thought to assert.

**Name a proof only where it reaches.** `npm run oracle -- reach
--at=<file>:<lines>` says which proofs run a candidate's lines; a line no
proof runs has no proof, whatever its folder's share. Reached is still not
proven, since a proof can run a line and never look at what it computes: a
saved run that came back without its journal passed every test of
`src/store`, whose lines the suite runs to the last one. A planted break at
the site settles it.

**How often a proof notices, on a drawn sample** (2026-10-12; 200 lines
drawn by a seeded draw, one mechanical edit at each; the Round 8.5
worklog, "120a"). On lines the corpus runs it noticed 109 of 140 edits:
52 of 60 in `src/sim`, 39 of 50 in `src/run`, 10 of 10 in `src/core` and
8 of 20 in `src/config`, where most of a loader is validation that valid
config never trips. The suite noticed 12 of the 31 it missed, eight of
them in `src/config`. On sim and run lines only tests run, the suite
noticed 27 of 30; on lines it runs in shipped code no headless proof
loads, 25 of 30. The kind of edit decides most of what is missed: a
negated condition, a removed call or a traded sign went unnoticed 6 times
in 141, a moved boundary or a number raised by one 21 times in 59, and by
a read of each site most of those change nothing a run can see. The sites
where behaviour changed and no proof looked were 7 of 200, with 6 more
unsettled, and six of the eight unnoticed sites on the run model's lines
are in `src/run/NodeMap.ts`: for a change to map generation, plant a
control at the site (`npm run oracle -- plant`). The fuzz diff and the
smoke noticed none of the 18 sim and run sites that the corpus and the
suite both missed, so what those two miss, the pre-commit hook misses;
and with every hit dealing one more the smoke failed in one file of 65,
the corpus's own test.

**By part.** "Corpus" is `npm run corpus` (30 journals, run by hand: the
pre-commit hook does not run it); "fuzz diff" is
`bash scripts/perf-oracle.sh [ref]`; "build compare" is
`npm run oracle -- build-hash [ref]`.

- **`src/sim`.** Proof: the corpus, then the fuzz diff. They run 87 % and
  86 % of its lines, 90 % between them; the suite runs 99 %. Shown to fail
  on: every hit dealing one more (30 of 30 journals, both fuzz shapes, 13
  test files); a wandering camp member's mirrored step (18 of 30, one of
  them by its events alone); a heal restoring one more (10 of 30); the
  path search's estimate changed (8 of 30). Missed: the path-search change
  by the fuzz diff and by every unit test; the mirrored step and the heal
  by every unit test. So a sim change that claims to change nothing is
  proven by the whole corpus, run by hand, since no unit test caught the
  mirrored step or the heal.
- **`src/run`.** Proof: the corpus, then the fuzz diff: 69 % and 65 %, 73 %
  between them; the suite 97 %. Shown to fail on: a declined reward made a
  no-op (8 of 30, one fuzz shape, the chaos census); the map splitting a
  lane three ways half as often (4 of 30, and one test file,
  `journal-replay-full.test.ts`). Missed: a
  unit bought at a port and never added to the roster, by both proofs,
  because no stored run completes that trade; `src/run/Run.test.ts` alone
  caught it. Under the declined-reward break `npm test` did not fail: a
  test loop never ended (TODO "Round 8.5").
- **`config/*.json` and `src/config`.** Proof: the corpus and the fuzz
  diff for behaviour, and `npm run oracle -- config-dump` with `json-diff`
  for a move between files. The corpus runs 84 % of the loaders' lines.
  Shown to fail on: a rest healing half the pool (3 of 30, and the dump
  names the key); a loader handing out the wrong multiplier (30 of 30,
  both fuzz shapes). Missed: the changed number, by every run that never
  rests, the fuzz diff's two shapes among them. A match after a config
  change says the number moved nothing on those runs and never that it is
  dead; the evidence for a dead knob is the search for its reader.
- **`src/core`.** Proof: the corpus and the fuzz diff, 79 % between them.
  Shown to fail on: another constant in the keyed streams' derivation (30
  of 30, both fuzz shapes, 8 test files). The hash the corpus's own
  digests are made with (`fnv1a.ts`) moves all 30 journals and leaves the
  fuzz diff alone, which is right: no run changed.
- **`src/bot`.** Proof: the fuzz diff alone, 86 %; the suite runs 99 %.
  Shown to fail on: a won rollout scored as a draw (the arbitrated shape
  and `evaluator.test.ts`). The corpus and the build compare cannot see
  the bot: no stored run and no shipped page loads it.
- **`tests/fuzz`, the instruments.** Proof: the fuzz diff for what its two
  shapes run (27 %), the smoke's own tests for more (65 %; 69 % between
  everything). Shown to fail on: the scored strategy counting a recruit's
  level twice (the scored shape alone: the smoke's own tests passed under
  it, `scored.test.ts` among them). `npm test` does not load this folder,
  so it saw nothing. Three lines in ten are run by no
  proof the coverage tool can read: 16 files hold most of them, chiefly
  the command-line entries (the search, the sweep, the arena, since
  deleted, the parallel runner, the board), which run as command lines and under no
  test.
- **`src/journal`.** The recorder's proof is the suite and the build
  compare: an order recorded one tick late failed 8 test files and moved
  the build's hash, and neither the corpus nor the fuzz diff noticed,
  since neither records. The replay is a tool the game never loads (the
  build compare cannot see it); the corpus runs through it on every
  journal.
- **`src/render`, `src/ui`, `src/scenes`, `Game.ts`, `main.ts`.** No
  headless proof loads them, and the suite runs 41 %, 10 % and 9 % of the
  first three. Proof that the game is the same bytes: the build compare,
  shown to fail on a render constant, a shader's number, a UI constant, a
  stylesheet declaration and a constant in `Game.ts`, none of which any
  test noticed (a rule in `src/scenes/menuRules.ts` moved the hash and
  failed its own test as well). Proof that the page still plays a run: the page drive
  (`npm run probe -- shell/electron/probes/drive-run.js --seed=<n>`, about
  18 s; the same seed gives the same log hash and state hash), shown to
  fail on a turn that is never advanced and on a sim change. It refuses a
  phase whose scene is not on screen (`PHASE_SCENES`,
  `src/dev/probe/scenes.ts`), shown to fail with the map swap after a rest
  removed; it misses a change that is only drawn. A shader that fails to
  compile leaves the drive's hashes alone and shows in the report's
  `console` list, with `--window=offscreen` so the battle renders. A
  change to code the game runs always moves the build's hash, so the build
  compare proves a deletion of dead code or a comment pass and cannot tell
  a careful reshaping from a break; for a reshaping here the proof is the
  eye, with the pane's pixel and box procedures
  ([process/browser-pane.md](process/browser-pane.md)).
- **`src/audio`, `src/store`, `src/settings`, `src/failure`,
  `src/diagnostics`, `src/i18n`.** Proof: the build compare, which caught
  each of four plants, and their own tests, which the suite runs 70 % to
  100 % of and which caught one of the four: a sound's rule, and not the
  saved run without its journal, the failure wait or a diagnostics text.
  `src/settings` and `src/i18n` had no plant.
- **`src/dev`.** Proof: `build-hash --dev`. A production build drops the
  folder, so the plain compare read a changed dev key as the same bytes
  and the development-mode compare did not.
- **`tools/`, `scripts/`, `shell/`.** No proof across a commit. An edit to
  the run-config tool's flag parser failed nothing. `tests/tools` runs 4 %
  to 20 % of each editor's lines and none of the run-config tool's, the
  five `.ts` scripts run as command lines under no test, and the coverage
  tool does not read the `.mjs` files. The editors' stylesheets are the
  exception: `css-compare` (Tools, "A stylesheet move"), shown to fail on
  a changed value, a dropped declaration, an added rule and two rules at
  one specificity reordered, each planted in the camp editor's sheet; a
  reorder across specificities passed, as it must.
- **A deleted test.** `npm run oracle -- reach-record npm-test` on the tree
  before and on the tree after, each into a `--dir` of its own, then
  `reach-diff` on the two folders: nothing the suite ran may be lost. Two readings of one
  tree lose nothing to each other. With `src/store/backup.test.ts`
  deleted the diff names 20 lines, 4 functions and 23 branch arms of
  `backup.ts`; with `src/run/enemyBudget.test.ts` deleted, no line and two
  branch arms, because other tests run the rest. It shows the suite still
  runs what it ran, and not that it still asserts on it: a test that
  passes the diff may hold the only expectation on some value, which is
  settled by planting the break the test was written for. For a test
  deleted with its code, take the first reading on the ref before and the
  second on the working tree, and pass `--from=<ref>`: each file changed
  since the ref is compared through its `git diff -U0`, a line the change
  removed counts as deleted, and a lost line is named by its line now.
  Without the flag a changed file is refused, since its lines would not
  line up.
- **An export nothing imports.** Delete it, then the type check and the
  build compare. With a used export removed the check fails by naming its
  importers; an unused export added leaves the build's bytes alone. The
  check does not look for unused exports: it proves a deletion left
  nothing dangling, and finding the candidates is a search. The word
  `export` taken off a constant its own file reads can move the bytes:
  the bundler inlines an exported constant's value and keeps a local one
  as a variable, which renames the rest of the minified bundle. There the
  proof is both trees built with `--minify false` and compared, where the
  constants and the comments are the only differences.
- **A comment.** `npm run oracle -- comment-strip <ref>` for every `.ts`,
  `.glsl` and `.css` file under `src`, and the build compare beside it for
  TypeScript and the stylesheet (a comment there leaves the hash alone; a
  shader's comment ships in the bundle and moves it).
- **The save's shape.** `npm run corpus -- --snapshots=<dir>` on both
  trees and `json-diff`, where the dropped field must be the only shape
  listed; `tests/save-fingerprint.test.ts` holds the version bump.

**What has no proof today:** a reshaping of code that only draws; the
four port trades no stored run completes
(buying a unit, buying a daemon, selling a packet, paying to remove a
unit); the tools' pages, but for their stylesheets' cascade, and the
build scripts; the lines neither the
corpus nor the fuzz diff runs, a tenth of `src/sim` and a quarter of
`src/run`. A candidate that lands in one of these names the suite, or
waits for a proof to be built.

## Adding a test

**Headless first** for `src/sim/`, `src/run/`, `src/core/` and
`src/config/`: reproduce a bug or pin new behaviour with a Vitest test
before opening a browser. Patterns to copy:
[tests/integration/determinism.test.ts](tests/integration/determinism.test.ts),
[tests/integration/layout-deadlock.test.ts](tests/integration/layout-deadlock.test.ts),
and `runOne` in [tests/fuzz/harness.ts](tests/fuzz/harness.ts). A failing
test hands you the state with a stack trace, which browser polling
usually doesn't.

For pure-logic modules: co-locate `Module.test.ts` next to `Module.ts`. Keep tests narrow and named for the behavior, not the function: `it('returns empty array when no path exists', ...)` over `it('findPath case 4', ...)`.

For anything that consumes randomness: take a seeded `RNG` instance as an explicit argument; never reach for global entropy. The tests prove this is doable; lint enforces it.

Patterns that earned their keep (promoted from the retro scratchpad — first two 2026-07-06, next two 2026-07-21, next three 2026-08-21, one 2026-09-20, last one 2026-10-11):

- **Conservation / partition invariants.** When state moves between buckets, assert the union is invariant at every step — one assertion catches a lost entry, a duplicate, a stale index, and a botched reshuffle all at once (H5's deck test: `[...drawPile, ...discardPile, ...hand].sort()` always equals `[0..n-1]`, asserted every turn through several reshuffles).
- **Test the mechanism's invariant, not a downstream proxy.** When a metric keeps flagging legitimate behavior, the metric is testing the wrong thing. E5's corridor-flow test went through three proxy metrics (distance regression, long-axis distance) that flagged legal maneuvers before pinning the actual mechanism (`targetId` change count) — robust to layout topology because it measures the thing the fix fixed.
- **Bounded steps: a loop that waits on a tick or a command counts its tries.** `World.tick()` no-ops once `ended` is set, freezing `currentTick`, so a `while (world.currentTick < N)` loop spins forever if anything ends the battle mid-test (killing a team's last unit does). A `while (!w.ended) tickTurn(w)` loop spins if a live tick stops advancing, and a loop that sends a command until the state moves (`while (run.phase === 'reward') …`) spins once the command stops taking effect; any of them hangs `npm test` and the pre-commit hook where they should go red. So tick a known number of times, or at most `MAX_TURN_TICKS` (the turn's cap ends every battle by then), and send a command at most a known number of times, then assert the state the loop waited on, so a failure is a red assert, not a hang. A loop that stops when a step makes no progress is bounded too (`tests/fuzz/gateWalks.ts`). Keep 2+ units per team in crafted worlds when a test kills one.
- **Test inside the window, not just around it.** When an action has a WINDOW with an interior boundary (e.g. the §36 move-flip at 50%), test the state BETWEEN the boundary and the finish, not only before/after — the §56 chain test cleared `activeAction` at the flip, conflating "flip landed" with "window over", and the mid-window partner re-grab bug walked straight through it (caught only by user feel-testing).
- **Non-vacuousness canaries SCAN, never pin a seed.** 74b's two-act-walk test pinned seed 11 on "an overpowered roster clears act 1 essentially certainly" — probing showed ~40% of seeds clear even at level 15. Scan for the first qualifying seed (`openEventAtSeedScan` in Run.test is the shape): self-healing by construction across every future stream break.
- **When a stream break trips a test, ask what it actually REQUIRES before re-pinning** (§77d2/d3 triage): seven pool pins were repaired BY DERIVATION (read the authored value off the catalog), one fixture was hardened to scan-for-its-real-condition, and only the ritual canary took a fresh literal. Most "seed pins" are lazy proxies for a derivable condition; each one converted shrinks the next break's bill permanently (that break: 11 failures → the class it leaves: 1 canary + 4 version pins).
- **Gate-first TDD on statistical mechanisms** (§77e–g): the n=500 corpus gate was written BEFORE the generator mechanisms it checks; its first three runs each caught a real design gap invariant tests structurally couldn't see. When a signed sheet exists, make it executable first and let the generator earn green.
- **A test that restates ENGLISH is a hook failure waiting** (§100 — three in one phase: a target hint, `'Paused'`, the delta labels). UI copy is CONTENT, and content moves: derive the expectation from the table (`t()` / `UI_EN`), exactly as a balance test derives from the config module. The "primitive tests pin literals" habit does not extend to strings a writer will edit.
- **New pins that pass on their first run are checked by planting** (Round 8, 2026-10-11). A batch of tests for new code that is green the first time says little about whether it can fail. Take a list of `{ file, from, to, test }`, each change removing one rule; for each, replace the text (refusing an anchor found zero or two times), run that test file, list the tests that failed, and put the file back in a `finally`; run the clean tree last as the control. It is an oracle's failing control (`process/oracles.md`) applied to ordinary unit tests, and it has caught a comment that claimed more than its test proved.
