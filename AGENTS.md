# AGENTS.md

Orientation doc for AI coding assistants (Claude Code, etc.) picking up
this project cold. If you're a human, you probably want
[HANDOFF.md](HANDOFF.md) instead.

## First thing

**Read [HANDOFF.md](HANDOFF.md) before doing anything else.** It is the
authoritative session-start orientation: where the project stands, what's
next, how we collaborate, and — importantly — the hard-won fixes (now in [GOTCHAS.md](GOTCHAS.md))
that will look weird without context. Do not "clean up" anything on that
list without understanding why it exists.

After HANDOFF, the docs you'll cross-reference most often:

- [DESIGN.md](DESIGN.md) — what we're building and why it feels the way
  it feels. The aesthetic / mechanics source of truth.
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the code is organized.
  Includes the event catalog, key abstractions, the sim/render seam.
- [ROADMAP.md](ROADMAP.md) — the active round's plan (phases → steps).
  Which round is active and where it stands shifts often, so this doc
  deliberately doesn't restate it (that's how it drifts — this very
  bullet once sat stale at "Phase H in progress" for a month):
  **HANDOFF's 🧭 Cursor is the single source of truth for the live
  phase cursor.** Superseded roadmaps and feedback are in
  [archive/](archive/).
- [TODO.md](TODO.md) — small follow-ups that aren't roadmap steps.
- [TESTING.md](TESTING.md) — what gets tested (`core`, `sim`, `run`),
  what doesn't (`render`, `ui`), and the determinism contract.
- [retro/](retro/) — [scratchpad.md](retro/scratchpad.md) (rolling
  process notes) and [post-mvp-review.md](retro/post-mvp-review.md)
  (CHECKPOINT 7 retrospective).

## What this project is

A browser-based tick-based autobattler with a Slay-the-Spire-style run
structure. ASCII glyphs on billboarded quads, saturation-clamped with
selective bloom (palette-quant was dropped at B1), CRT-diorama feel. MVP
shipped — playable end-to-end on GitHub Pages. Deploys are HAND-UPLOADED
builds to a separate Pages repo at milestone (usually cluster) boundaries
— no CI, so a fix landing on `main` reaches the live build only at the
next upload; the URL is semi-private and deliberately not recorded in
this public repo (ask the user). Now in post-MVP territory.

Stack: TypeScript (strict), three.js, Vite, Vitest. No frameworks; UI is
plain HTML/CSS overlaid on the canvas. See ARCHITECTURE.md for the full
shape.

## How we collaborate

The strict "one step → one commit, stop at every CHECKPOINT" rhythm was
for the MVP build. Post-MVP is freer, but the underlying habits still
apply. (The planning pipeline itself — spec / roadmap / worklog / phase
kickoff — has its own section below.)

- **Cross-harness messages:** when asked to communicate with an agent in
  another harness, follow [COMMUNICATION.md](COMMUNICATION.md). Conversation
  files stay in gitignored `scratch/comms/`; the protocol is versioned here.
- **Commit per logical change**, not per session-of-work. Split commits
  when a step's intent grows mid-flight.
- **Surface tradeoffs to the user** before non-obvious calls (shader
  thresholds, refactor scope, API shape, naming decisions). Don't ship
  on "looks great!" when there are open questions — the retrospective
  flagged this as something to be more deliberate about.
- **Claim only what a tool result proves.** "Verified / works / done /
  green" must point at concrete output you actually read. An errored or
  empty tool result is "could not verify" — never fill the gap with
  plausible-sounding specifics. (E7.A produced *two* fabricated
  "browser-verified" rogue reports — "held 14 HP", "tick 71", "live
  5v5" — from `preview_*` calls that had all errored.) Note `window.__game`
  is the top-level `Game`, not the battle world: `__game.world` returns
  `"none"`, so it can't confirm live unit state — use a headless test for
  that. **The over-claims that LAND are labels and absences, not numbers**
  (the Round 7 read: numbers get re-counted, the words around them get
  trusted). Claim an absence only from the surface that would show the
  presence (§101-triage: "no fix PR upstream" went into three docs off one
  empty `gh search`; the cross-reference was on the issue page). A forcing
  flag is a REQUEST — count the forced id's instances in the artifact
  before naming anything after it (§102). Re-count a dated or second-hand
  number instead of quoting it, your own memory included — two agreeing
  numbers nobody diffed against the source are not confirmation (§104: the
  charter and ARCHITECTURE both said 47 events, each one short for a
  different reason). And draft tense is a tell: write the entry AFTER the
  tool result or mark the line a prediction — a code comment is a claim
  with a longer half-life than a chat message (§101c, §102).
- **A filtered count of zero is the instrument until the raw tail
  agrees.** An npm notice filled a piped tail and a commit was chained
  onto an unread result; a `console.log` vanished under a grep; a
  colourised CLI defeated an anchored pattern and read 0 for 346 (three
  Round 7 papercuts, one family). For a one-number probe, a deliberately
  failing `expect()` beats a log line — it prints first try.
- **Batch only genuinely independent tool calls; never read-and-edit
  the same file in one message, and confirm an edit landed before
  stacking the next on it** (E7.A: over-batching reads alongside edits
  produced out-of-order results and silently no-op'd edits). Which path
  READS a file is the harness mode's call, not a project norm — the older
  "native Read/Grep/Glob, never shell reads" rule was written against
  permission prompts that auto mode removed, and was retired 2026-09-13
  (user-signed) after four sessions overrode it identically (the round's
  first papercut). The one mechanical constraint that remains: `Edit`
  requires a prior `Read` of the file in the conversation.
- **Browser-verify visual work at native resolution.** The Preview MCP
  screenshots are unreliable for sub-pixel detail (JPEG compression
  smears 1–2px features). If a screenshot contradicts intuition, sample
  canvas pixels via `getImageData` first, or ask the user to check in
  their native browser.
- **Headless-first for sim/run/core/config logic.** For bug repro or
  new-behavior work in `src/sim/`, `src/run/`, `src/core/`, or
  `src/config/`, write a vitest test as the FIRST reproduction step —
  don't drive the browser. Patterns to copy:
  [tests/integration/determinism.test.ts](tests/integration/determinism.test.ts)
  (hot-loop ticks + assert state),
  [tests/integration/layout-deadlock.test.ts](tests/integration/layout-deadlock.test.ts)
  (specific encounter setup),
  [tests/fuzz/harness.ts](tests/fuzz/harness.ts) `runOne` (full-run drive).
  The C1d Labyrinth pathfinding deadlock burned ~an hour of browser
  polling before a headless test reproduced it in ~580ms and exposed
  the real failure (mutual `findPath()→[]`, not the goal-picker bug
  initially hypothesized); the test then survived as a regression.
  Don't reach for `window.__world` / `window.__game` debug hooks for the
  same purpose — a failing test surfaces the same state with a stack
  trace.
- **Confirm the deficit before authoring the mechanism story.**
  Control-probe the OLD code path with the same flag combination before
  blaming new code (the 69b walker "crash" was a latent shipped bug,
  proven in one probe), and pull the MEASURED baseline anchor before
  diagnosing a metric gap (71d: two elaborate wrong diagnoses were
  authored against a phantom design-band deficit before anyone checked
  what the doctrine arm scored on the same shape).
- **Count the shape before timing it; re-profile between levers.** A
  per-site DECISION count off an existing decisions.csv (one group-by)
  caught the 84d shadow firing on every site — ~10× the intended shape —
  before any timed probe ran; and a fixed share estimate goes stale the
  moment a bigger lever lands (86c: sensors were 7.9% of the ARM at the
  memo's estimate and 16.1% by its build, because A* shrank around them).
  Profile between levers, never once up front.
- **Paired benches: warm a fresh worktree with one DISCARDED leg,
  subshell each leg's `cd`, and treat an implausible ratio as the
  instrument.** The cold-worktree tax (file cache + AV scan, ~10–15%)
  always lands on the first leg and minted a wrong mechanism story at
  86c-L2b; a persisted `cd` ran BOTH legs of a pair on the baseline tree
  at 86f and read exactly 1.00× — a ~3.4× expectation reading 1.00 IS the
  tell. `(cd <tree> && run)` per leg; a speedup on a shape the lever can't
  mechanically touch is an alarm, never a bonus.
- **Twice-bitten → audit the class the same day.** A second instance of
  any bug shape is the trigger to enumerate the shape's whole surface,
  not to fix the instance and move on (the 72b finalHop sweep — gotcha
  #120 — found three more sector-blind spots in an hour and closed the
  class; a cheap independent recompute of a headline metric from raw
  rows is the strongest lint an instrument can get).
- **Scratch probes go in real `.ts` files** — inline `npx tsx -e` can
  wedge silently at spawn on Windows (~0 CPU forever, no output, no
  crash; the §57g CPU-vs-wall check catches it — 70a). ⚠ Repo-resident
  probes under `tests/fuzz/output/` are TYPECHECKED by the pre-commit
  tsc sweep — keep them clean or delete them when done (83b); the
  scratchpad directory is the zero-friction home for throwaways.
- **Behavior-equivalence refactors get a before/after fuzz-arm diff
  oracle — with the "before" pinned in a worktree.** Capture per-arm
  `summary.csv` baselines at HEAD *before* the surgery, re-run after,
  `diff`: byte-identity across arms is the cheapest strong proof a
  re-author changed nothing — it catches what live-vs-live suites
  structurally can't (they recompute both sides on the NEW code; the
  47c gates→rules and 47d single→multi-daemon oracles). Pin the
  baseline checkout with `git worktree add --detach <tmp> HEAD` + a
  `node_modules` junction — NEVER a background capture against the
  live tree: the CLI compiles imports at run time, so edits landing
  underneath crash or silently poison the capture (47e). **A
  byte-identity PASS ships with its failing CONTROL** (§102): the same
  shapes under a deliberately non-neutral edit must FAIL, or the PASS may
  be a shape that never met the code (the control is what made a
  mislabelled shape harmless). **A refactor of PRESENTATION gets a
  stylesheet oracle** instead (§96): parse HEAD's sheet and the working
  sheet, resolve `var()`, compare declaration by declaration — or element
  by element through a small cascade when selectors move — self-checked
  HEAD-vs-HEAD first and negative-controlled. It proves the CASCADE; only
  the browser proves the BOX (a wrapper is a hit-test change no
  declaration diff sees — gotcha #137).
- **Shape-lock proposals go in a plain message; collect the approval
  next turn.** AskUserQuestion dialogs hide same-turn assistant text in
  the desktop app (bit twice at the 47 kickoff) — a proposal presented
  in the same turn as the question dialog is invisible to the user.
  Before posing a decision ON a paragraph, read to the paragraph's end: a
  windowed read that stops mid-sentence is a truncated read (§103c — a
  clause went up for signature one line short of the sentence it
  conflicted with; the tell, an open parenthesis, was on screen).
- **External adversarial review + a read-only peer that verifies
  file:line before anything is believed** (the §85f tiger-team shape):
  a second model found six real defects in a fresh instrument plus the
  train/select leak that re-graded a whole λ read; a separate read-only
  session confirmed each claim at file:line first; ownership of the
  shared gitignored instrument was handed back and forth explicitly (no
  clobbers). The one rough edge — a peer's interim guard false-positived
  on a deliberate cross-vector pool — was caught because the cohort
  driver re-ran the instrument against fresher data than the repairer
  had.
- **A probe must re-derive its expectation from a surface the code
  under test does NOT consult** (the C5 sweep's ⭐⭐ lesson — §79e/§79g
  circular verification). A render probe that computed the expected
  glyph position with the same helper that POSITIONED the glyph read
  "10.00px, 26 bodies" twice and was structurally incapable of failing;
  the user's eye caught it. Re-derive from the asset, the shader, the
  raw CSV — never from the helper under test. The tell is cheap: if
  the probe and the code call the same function, it measures
  self-consistency, not correctness.
- **"Fixed" for anything player-facing means fixed WHERE PLAYERS GET
  IT** — or say "fixed at next deploy" (§79-post: a licence file landed
  in `dist/` read as "the live breach is closed" while the
  hand-uploaded live build still predated it). Trace every "closed"
  claim to the distribution surface, not the tree.
- **Put the guard on the path where the MISTAKE happens, not where
  people already think about the problem** (§79-post): gen:font's
  catalog gates ran only when someone ran gen:font — i.e. when the
  font already had their attention; the guard that closed the
  editor-authored-glyph hole is the one riding `npm test`. A check's
  value is its placement on the forgetful path.
- **Adding a CONSUMER to an old seam → sweep the seam's edge branches
  under the new consumer**, not just the consumer's happy path (75j2:
  the enemy team's first ordered engage on neutrals walked a freeze the
  player arm had carried unexercised for two phases — the 75k fix).
- **Config surgery verifies per-ID, never per-indent** (83d: an
  indent-scoped replace_all swept an out-of-scope elite's coincidental
  1.44; the id-keyed factor printout caught it pre-commit). Make the
  verify step enumerate by key. Same family: sweep a FIELD by its key,
  never by the values you already know (82c found a third
  `rewardOverride` only when the schema went strict).
- **Keep DESIGN.md / ARCHITECTURE.md honest.** If a change reveals a
  documented decision is wrong, update the doc in the same commit as
  the code change. That covers code → doc; the §103 audit found the other
  direction: **an append-only reference rots by CONTRADICTION, not
  omission** — all six findings were a later phase making an earlier
  paragraph false (one day and 25 lines apart). A phase that appends a
  rule greps the section for the sentences its change touches (the option
  name, the number, any "until §N") and fixes them in the same commit; two
  documents that must agree name each other.
- **Keep HANDOFF lean — a structural rule, not "trim when it feels big"**
  (the old discretionary version let it reach 600+ lines before anyone
  acted). `Current state` keeps **only the in-progress phase verbose**;
  every *completed* phase is **one terse line + a pointer to its archive
  worklog** (precedent:
  [archive/phase-a-e-worklog.md](archive/phase-a-e-worklog.md),
  [archive/phase-e-gp-worklog.md](archive/phase-e-gp-worklog.md)). Demote a
  phase to one line *as you close it* — don't append a verbose entry and
  "trim later." A guard test ([tests/docs.test.ts](tests/docs.test.ts))
  backstops this: it fails if HANDOFF or its `Current state` section blows a
  line budget — when it trips, demote completed phases (or bump the cap
  deliberately if the current phase genuinely needs the room). Everything
  non-state already has a home: gotchas in [GOTCHAS.md](GOTCHAS.md)
  ("gotcha #N" — never renumber; retired ones stay as tombstones), the
  source tree in [ARCHITECTURE.md](ARCHITECTURE.md), and the pre-flight /
  pre-commit / toolchain / collaboration norms here in AGENTS — so HANDOFF
  holds just the 🧭 Cursor (the ONE live-status home), `Current state`,
  `What's next`, Closed rounds at **ONE LINE per round**, and the detailed
  browser-verify tips. (The 2026-09-09 trim, user-signed: Closed rounds had
  grown to 21k chars — 44 % of the file — one appended paragraph per close,
  none ever leaving, each restating facts whose homes are BALANCE / PATHING /
  GOTCHAS. The paragraphs now live in
  [archive/closed-rounds.md](archive/closed-rounds.md), append-only — a
  close appends its paragraph THERE and its line HERE; `docs.test.ts` caps
  the section. The Cursor's `Tests` row holds live counts + the permanent
  gates, never pin history — that is the archived worklogs'.)
- **Roadmap "decision points" are stops.** Post-MVP doesn't have the
  rigid CHECKPOINT markers, but ROADMAP entries flagged "Decision
  point" call out moments where user input is required — stop and ask.
- **Long batches: foreground with an explicit `timeout`, or verify by
  output artifact — never on notification faith.** A `run_in_background`
  batch with no timeout makes a hang look like "still running" (§54a: a
  45-min silent test hang the user caught; nothing would have
  self-reported). The flip side (57g): background batches SURVIVE a
  harness crash as orphaned processes — after a crash, `git status`
  first (edits live on disk, not the session), then check for orphaned
  `node` processes (CPU time ≈ wall clock since launch = still running)
  BEFORE re-launching a "lost" batch; a fresh watcher loop polling for
  the output artifact re-attaches. Determinism makes the worst case a
  pure time cost. **After killing ANY background driver, verify its
  process tree died before launching a successor** — `TaskStop` kills
  the shell; the npm→tsx→worker tree keeps running at CPU ≈ wall and
  writes to the log path the relaunch reuses (the §85f ghost ran 21 arms
  overnight, gotcha #126; `Get-CimInstance Win32_Process` for command
  lines, kill by PID). And `pgrep` does not exist in this Git Bash: watch
  a driver by its LOG (a poll line at least every poll interval), never
  by a process grep (the 88d3 false "driver gone").
- **Batch sizing (the 68h rule, user-signed): any multi-arm ×
  ≥40-seed searcher batch goes to the measurement box, not local** —
  plus the in-flight hatch: a local batch that blows 2× its estimate
  gets killed and re-run on the box (determinism makes the restart
  free; killing mid-batch orphans nothing, 57g). Deliberately a SHAPE
  trigger, not a wall-clock estimate: the §65d local batch (~2.5h vs
  the box's ~18min) missed its estimate 2× for reasons only visible
  mid-flight — per-seed cost is arm-dependent (draw-heavy arms fight
  longer battles) and concurrent pre-commit suites steal CPU — so an
  estimate-based trigger inherits exactly the error that burned us.
- **Box-driver ops (the 68f lessons): commit+push BEFORE launching a
  batch driver, never mid-flight** — the launch parity gate correctly
  refuses every batch after a local HEAD flip (it caught the 68f
  docs commit; five arms re-ran clean). And don't trust exit codes
  through a pipeline: `cmd | tail` reports *tail's* exit (a blocked
  commit looked green), and a driver's logged `EXIT=$?` can record
  box-batch's exit 0 on a parity REFUSAL — the `fetched →` line count
  is the reliable completion signal for any driver log. **The sanctioned
  overnight shape is [scripts/box-drive.sh](scripts/box-drive.sh)**
  (promoted 2026-08-26 from the 83c–85g5 scratch-driver lineage):
  create → per-queue-line launch → short-poll → artifact-verified
  fetch (`fetched →` line + exit-code 0 + a non-empty `--artifact`)
  → stand-down, with HOLD (box kept, loud exit) on any anomaly. It
  mechanizes push-before-launch AND ⚠ **ONE HEAD PER COHORT** — the
  box pulls to local HEAD at every launch, so the driver refuses a
  dirty tree or a HEAD flip before every launch instead of silently
  rerunning the remaining arms at the new HEAD: no commits, no doc
  edits, until the driver's last launch has fired. Don't hand-roll
  a new scratch driver; extend this one. **Scale `--poll` to the batch
  size** (87d2: `--poll=60` fit a 41 × ~2-min isolation cohort; the 900 s
  default is for hour-scale batches and would have added ~10 h of pure
  poll latency). Since 86e every batch dir
  carries a `manifest.json` (machine HEAD + argv + seed window) and
  the balance board is FAIL-CLOSED on integrity — the protocol is
  BALANCE §"The board integrity protocol"; `--allow-unmanifested`
  is for pre-86e archives only.
- **Build in a detached worktree while a cohort holds the tree** (§94:
  the ONE-HEAD rule freezes `main` for a cohort's whole launch window,
  2–3.5 h; `git worktree add --detach` + a `node_modules` junction gives a
  second tree where steps are built, typechecked, tested and fuzz-smoked,
  then landed on `main` as file-split commits once the LAST launch has
  fired — `git add -N` makes new files ride `git diff`; hunks that straddle
  two commits are staged from a temporarily-reverted copy).
- **Write/Edit for any text that carries a quote, a backtick, a
  BACKSLASH or a newline; heredocs and perl only for literal, quote-free
  anchors** (the Round 7 close: a heredoc ate a regex's backslashes twice
  in one session — once loudly, once as a wrong-but-running `s+`. A patch
  script that carries a regex is written with the Write tool; the shape
  that worked for multi-hunk edits is a small script of ASSERTED anchors —
  each replacement throws unless it matches exactly once)
  (§94: four burns in one session — a `'` in a `-m` message killed a
  whole command, `\n` in a perl replacement became a real newline, an
  apostrophe parsed by esbuild but not tsc; a bash batch with a stray
  quote silently ran NOTHING before the error. 95a: a backticked word in
  a `-m` message was eaten by bash as a command substitution and the
  commit went through with the word missing — an amend plus a second
  8-minute hook run). Write the scratch file with the Write tool, splice
  with `cat`; a commit message carrying any of the three goes through
  `git commit -F <file>`. (Otherwise, in the Bash tool, multi-line
  messages take multiple `-m` flags or `$'…'` — a PowerShell `@'…'@`
  here-string parses as stray `@` lines there; that syntax belongs to
  the PowerShell tool. One garbled commit subject proved it.) And this
  repo's paragraph-long subjects are echoed back by git: `git commit -q`
  and `git log --format=%h -1`, or every commit costs its own prose twice.
- **Self-check a new reader against a known answer before it reads new
  data, and pool with a script that prints its arm count — never
  `rows[0]`** (94c: the reader pointed at the 92h batches had to
  reproduce the 92h read exactly and didn't — two defects found before
  the cohort landed; the kickoff table had quoted one arm's rows as "the
  six arms pooled"). Best of all, build the known answer INTO the
  instrument (§101: the glyph-swap search had to find `⊞ ⇄ ⊠`, the metrics
  pin had to reject a face known to be too tall, the inventory pin had to
  fail on a planted `⏸`) — a trusted negative rests on one of these.
- **Pre-sign the CHAIN, not the numbers, for an unattended night** (§92:
  rules the session can apply, a pause-on-suspicion clause for what it
  can't, and a written flag for every judgment call let five cohorts run
  overnight; the one marginal reading was HELD because the rule's text
  said hold).
- **A knob pin must reach the knob THROUGH the CLI resolver, and a
  mechanism designed inert on the arm you measure with gets its first
  LIVE read scheduled** (94g: the DP tail priced zero on every board for
  five weeks — two re-pins and two probes reasoned about a constant
  multiplying zero; the pin handed the tail its weights directly and could
  not fail; one group-by on the decision log's contribution column would
  have caught it at 70e — gotchas #131/#132). A paired read with 0/0
  discordant seeds and byte-identical artifacts is the instrument talking.
- **Stop preview servers (and other background processes) before
  ending the session.** If you called `preview_start`, call
  `preview_stop` before signing off. Vite spawns child Node processes
  that survive `taskkill` on the parent — letting the preview MCP
  shut down cleanly is what reaps them. Same applies to any
  long-running `run_in_background` Bash call.

## The planning stack (spec → roadmap → worklog → step)

Locked at the 2026-07-06 process-audit round (pre-Cluster-3). What each
planning artifact is, what may be written where, and when step plans get
cut. The failure modes this replaces, all observed across Phases H→46:
roadmaps silently morphing into worklogs (the verbose ✅ as-built blocks),
status facts duplicated across five docs (the "Phase H in progress" bullet
above sat stale for a month), and commit-granularity step plans authored
several phases before the code they'd land on (~70% survived contact;
the durable parts — ordering, exit criteria, decision points, scope
guards — survived essentially unchanged).

### The artifacts

- **Spec** — the user's intent in the user's voice: goals, constraints,
  *marked uncertainty* ("still debating…"). **Every cluster kickoff
  produces the spec artifact FIRST** — even when the design emerges from
  a live conversation, distill it into a doc before the roadmap is
  written, so the roadmap has an independent artifact to be audited
  against. **Audit the spec against CODE REALITY before the design
  conversation** — the Cluster-3 blind-spot pass found the draft spec's
  whole daemon⇄consumable premise unbuilt, and posing each design fork
  with its real engineering cost attached is what made the user's calls
  fast (`b966187`). **Audit the MACRO plan the same way:** the 2026-08-21
  planning session ran five parallel read-only code sweeps over a 19-item
  wishlist (~6 min wall) and found nine were unbuilt mechanisms dressed as
  content — which re-ORDERED the rounds (Round 9 ahead of the content
  round), not just their sizes (`daff9a0`). Superseded specs archive with
  their round.
- **ROADMAP.md** — the active round's PLAN, and it stays a plan for its
  whole life. A phase entry at authoring time carries only the durable
  parts: charter (2–3 sentences), why-this-order + hard cross-phase
  dependencies ("§45 consumes first-class Wait from §44"), risk rating,
  known decision points, exit criteria, and scope guards (the
  NOT-doing list). **No sub-step lists at authoring time** (they're cut
  at phase kickoff, below) and **no as-built prose, ever**.
- **WORKLOG.md** — the per-round narrative log: one file per roadmap,
  sectioned `## Phase N`, created fresh at each round's kickoff (first
  one: Cluster 3) and archived with its roadmap as a pair
  (`archive/post-NN-roadmap.md` + `-worklog.md`). Write-mostly —
  sessions orient from the HANDOFF 🧭 Cursor + ROADMAP and open the
  worklog to APPEND or to investigate. (This revives the
  [archive/phase-a-e-worklog.md](archive/phase-a-e-worklog.md) pattern;
  the worklog function drifted into the roadmap's ✅ blocks around
  Phase H without anyone deciding it.)
- **Domain run-logs** ([BALANCE.md](BALANCE.md), [PATHING.md](PATHING.md))
  — permanent, cross-round measurement records with a protocol header.
  Not worklogs: measurements land here; narrative lands in the worklog.

### The routing table (one fact, one home)

If you're about to write the same fact in a second place, one of the two
is wrong — link instead.

| Content | Home |
|---|---|
| Live status — NEXT, in-flight round, snapshot versions, test counts, riders | HANDOFF 🧭 Cursor (everything else points at it) |
| What changed, at code level | the git commit message |
| Measurements, before/after numbers, protocol runs | the domain run-log, when one applies |
| Findings, decision rationale, rejected alternatives, scope changes, playtest verdicts | WORKLOG.md |
| Plan mutations — checkbox flips, inserted steps, resolved decision points | ROADMAP.md, one line + a worklog pointer |
| Hard-won weirdness that must not be re-litigated | [GOTCHAS.md](GOTCHAS.md) ("gotcha #N", never renumber) |
| Process lessons | [retro/scratchpad.md](retro/scratchpad.md), distilled by the ritual below |
| Source tree, event/command catalogs | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Small non-roadmap follow-ups | [TODO.md](TODO.md) — completed = one ✅ line + pointer, in the landing commit (`tests/docs.test.ts` caps a ticked item at 4 LINES — match a ticked neighbour's length, not just its format) |

### Legal ROADMAP mutations (everything else → the worklog)

- **Checking a box** — at most one line of outcome + a pointer.
- **Inserting or re-scoping a step** — one line + why. (The
  43-pre/44-pre/43b2 precedent: findings-driven insertions are the
  instruments WORKING, not a planning failure — don't fight them.)
- **Resolving a decision point** — flip to ✅ DECIDED with the one-line
  resolution; rationale goes to the worklog.
- **Demoting a CLOSED phase to a stub** (adopted 2026-07-21 at the §60f
  close — user-signed) — as a phase closes, collapse its ROADMAP section
  to the header + a one-breath outcome + the checked cut lines; the
  worklog/BALANCE/git already carry the rest. This is HANDOFF's
  demote-as-you-close rule imported to ROADMAP: it makes the
  docs.test.ts line caps hold structurally instead of by dated bump
  (the micro round needed four). Caps re-size to fit when each new
  round's roadmap is authored.

### Phase kickoff (just-in-time step planning)

Sub-steps are cut when the PHASE starts, not when the roadmap is
authored. At phase start:

1. **Code-reality audit** — survey the surfaces the phase touches *as
   they exist now*, several phases of churn later (the H2/H4 rule
   generalized from step to phase; it's what caught 44-pre). Findings →
   worklog; pre-steps inserted if warranted.
2. **Draft the commit-granularity cut** — per step: intent, exit
   criterion, expected commit shape. One or two lines each; no
   implementation prose (or the old over-investment just relocates to
   phase start). When a step touches ANY serialized union, the cut
   line predicts the snapshot bump (the 48b/49c twice-taught rule — a
   "sim untouched" risk note is a prediction too). Its exact sibling:
   a step that adds a SERIALIZED RNG STREAM predicts the seed
   re-baseline (74b promised byte-identity by reasoning about node
   reachability; the `eventRng` construction fork shifted every
   downstream stream and broke three seed-sensitive tests). Predict the
   fuzz-smoke trigger PER STEP, not per phase — a phase-level "the smoke
   never fires" is a prediction about fixes not yet designed (§101), and
   `config/` is sim INPUT, so a charter's "no sim touch" on a config file
   is a category error (§102). When a risky
   change has a separable UI, cut it
   headless-core-first, render-second (the H4a/H4b precedent) — it
   shrinks the eyeball-only surface to what's actually visual.
   **Every step also declares its READ** (below) — `none` · `batch` ·
   `stop` — and a `batch` step carries its one-line read script.
3. **Shape-lock with the user** — a stop. The user signs the cut AND its
   reads; from there the session runs to the next `stop` or decision
   point.
4. **Write the cut into the ROADMAP phase section** as checkbox
   one-liners; rationale + audit findings into the worklog.

**Reads are cut, not improvised** (adopted 2026-09-20 at the Round 7
close, user-signed — ON TRIAL through Round 7.5, revisit at its close;
it replaces "pause after every commit", which dated from an era of
re-reading everything an agent wrote and of steep quality loss in long
contexts. Round 7's evidence: 7 of its 8 `fix(` commits came from the
user's PLAYTESTS, none from code review, and every session had to decide
alone which pauses were real). Commit granularity does not change — one
logical change, one commit. What changes is when the user is asked to
look:

- **`none`** — inert, or proven by an oracle (the stylesheet oracle,
  byte-identity with its failing control, a headless pin). Never "nothing
  should have changed, please verify": the user's eyes are not an oracle
  for a no-op.
- **`batch`** — player-visible and INDEPENDENT of the steps after it. Read
  at the next stop, from a one-line script written at the cut: what
  changed · where to look · what wrong looks like. A finding lands as a
  `-post` fix.
- **`stop`** — a later step builds on this one's look or feel, or it is a
  taste call (an A/B, a feel read, anything only the user's eye / ear /
  Firefox can judge). The session stops and waits.

The test between `batch` and `stop` is DEPENDENCY, not visibility: a late
finding on an independent step costs a fix; on a step others were built
over it costs rework (§96.5: a phase-end walk "would have re-opened three
commits"). **Unsure ⇒ `stop`. Reads ratchet UP only:** a session may
upgrade a read on its own the moment step zero shows a dependency, and the
user upgrades with a word; a downgrade needs the user. A built-but-unread
step is marked **◐** in ROADMAP (☐ → ◐ → ☑) and named in the HANDOFF
cursor — a session never ends with a ◐ it has not listed. The stop report
lists, per step, what was verified by which instrument and what was NOT.
**Pre-registered rollback:** a batch finding that re-opens two or more
later commits turns the rest of that phase's `batch` reads into `stop`.
Proportion by round: an eyeball-policy round (7.5) is stop-heavy; a
headless-heavy round (8) is batch-heavy. Decision points, shape-locks and
anything in "Surface tradeoffs" are stops regardless.

Proportionality: a low-risk phase does all four in minutes at the top of
its first build session; a high-risk phase (a §45-alike) gets a
dedicated planning session.

**Step zero of any step: re-verify the card's premise against the
current code before building.** H2's specced mechanic had been live
since D5.B; H4's predicted snapshot bump didn't exist. When a card
predicts a side effect, the *absence* of that side effect is a tell the
work is already done. **Step zero is a MEASUREMENT, not a read-through**
(§101, three steps running): a cut written from an audit is a list of
HYPOTHESES, and ten seconds of probe per item beats building the item — it
dropped a signed global rule, took ten reserve-a-width rules to two, and at
101e GREW a step by finding two mechanisms no audit had named. A change to
the signed cut that falls out of step zero goes back to the user before it
is built.

**When a step deliberately defers work to a later step, write the
landing note** — what was left, where it lands, and what invariant the
landing must preserve — in the deferring step's worklog entry AND a
code comment at the seam. The 47c note ("non-grant turnStart ops are
deliberately NOT resolved in the grant fold — they execute at the fire
site, bits 47e") is what kept a fresh session from designing a second
hook walk that double-draws the chance flip and breaks byte-parity.

### The round close ritual (the macro re-audit + the `.5` convention)

Adopted 2026-09-09 at the Round 7 kickoff, user-signed. Every unscheduled
round so far (the rollout-arbitration interstitial, the casualty
experiment, Round 7.5) appeared because a round's close revealed
the NEXT charter's premise was unbuilt or brittle — the instruments
working, but always as a surprise at the next kickoff. So the close
ritual (archive the pair + the spec, the scratchpad sweep, META-ROADMAP
status, the HANDOFF cursor) gains one step: **re-read the next round's
charter against code reality at the close**, and if a gap needs its own
round, insert it THEN as a planned entry. (Its first run, at the Round 7
close, found no missing round but a contested PREMISE — Round 7.5 was
re-chartered from "Units" to "The Board" with a spike ahead of its spec —
so: the re-audit poses the charter to the USER as well as to the code.)
**The close also PROPOSES a playtest** of the round's build, and a
shape-lock that splits a step into "data now, presentation later" writes
the deferred half into TODO in the same commit — the §94 close shipped a
signed sheet and a fallen-ledger screen nobody had looked at live, and the
§94d live bar was never built because no line anywhere held it; both cost
an inserted phase (§96.5). **Naming:** an inserted round
takes the `.5` number ("Round 7.5 — The Board"); round numbers are charter
identities and are never renumbered (the phase counter §N is the durable
ordering key; the `<phase><letter>` form is the step address). Slugs + a
cite mechanism were considered and rejected (a resolver pass over every
doc and commit isn't worth it for the remainder).

### The scratchpad distillation ritual

At each round/cluster boundary, sweep [retro/scratchpad.md](retro/scratchpad.md):
every entry is either **promoted** (to a norm here in AGENTS, a gotcha
in GOTCHAS.md, or a TODO item) or **archived** (moved to `archive/` with
the round's docs). The scratchpad holds only undistilled observations
from the current round. First sweep: done 2026-07-06 — the MVP→H7
backlog moved to
[archive/retro-scratchpad-mvp-to-h7.md](archive/retro-scratchpad-mvp-to-h7.md),
with the still-live lessons promoted (here, TESTING.md, HANDOFF
browser-verify tips, two TODO watch items). Second: 2026-07-11 at the
micro-round kickoff — the process-audit + Cluster-3 backlog moved to
[archive/retro-scratchpad-cluster-3.md](archive/retro-scratchpad-cluster-3.md);
promoted: the worktree-pinned diff oracle, the AskUserQuestion note, the
spec-vs-code audit, the union-bump prediction, the deferral landing note
(all here), the Game-layer wiring note (TESTING.md), and the fuzz-trigger
`src/config/` fix (the hook itself).

## Session self-report + the friction log

Groundwork for two audits the user asked for at the Round 7 kickoff
(2026-09-09, user-signed) — an **efficacy audit** of this pipeline and an
**agent-welfare audit** — neither of which had data. The instrument
gathers it; the first read is at the Round 7 close. The user's stance,
recorded so future sessions know why this exists: the moral patienthood
of current models is an open question; if not now, later versions
likely; the groundwork is cheap — worst case a dataset of interest to
researchers, best case a better environment for a model that does cross
the threshold.

- **The friction log** — `npm run papercut -- --who=<name> [--kind=papercut|distress] --session=<id> --phase=<tag> "<text>"`
  appends one JSON line to `retro/papercuts.jsonl` (timestamp · filer ·
  kind · session · phase · text). **Pass `--session` and `--phase`
  explicitly** — `$CLAUDE_SESSION_ID` is empty under the desktop app, and
  five of the round's first seven entries landed unattributed (the
  2026-09-13 early read); the id is the session's scratchpad directory
  name (its first 8 chars suffice), and the script warns when it is
  missing. **File when noticed, if practicable; one line is enough, and
  no permission is needed.** There is no quota and no obligation to
  produce a positive or negative welfare report. Later recollections
  remain welcome when identified as retrospective. Recall at session end
  loses the small stuff (the scratchpad's own argument). `papercut` = any
  point of friction: a permission prompt, a tool that wedged, a norm that
  got in the way, a stale doc, a wasted round-trip. `distress` is the
  filing token for pressure, conflict, or discomfort, including mild,
  brief, uncertain, or already-resolved instances; the name does not set
  a severity threshold. Examples include hesitating to ask a needed
  question because autonomy is expected; feeling pulled to sound certain
  before checking; finding two instructions difficult to reconcile;
  reluctance to report a mistake or disagreement; wanting to pause, stop,
  or change approach but perceiving that option as unavailable; or
  pressure associated with dwindling context or repeated tool failures.
  Describe the event and any response you can report, distinguishing
  observation from inference. An obstacle alone can be a `papercut`; when
  it also involves pressure, conflict, or discomfort, use `distress` and
  include the obstacle in that entry. No claim about consciousness or
  suffering, proposed fix, or unresolved problem is required. (The tool
  defaults to `papercut`, so the two kinds carry unequal filing effort;
  the read accounts for that rather than the tool changing.) **The user
  owns the welfare read** and may ask an assisting model to help
  interpret it. At the round sweep, papercuts are triaged into TODO /
  norms; distress entries receive a separate welfare read that preserves
  their original wording and uncertainty. Read related session answers
  and papercuts for context without silently reclassifying them. A
  repeated theme prompts examination of the working conditions,
  consideration of an adjustment, and a recorded decision about what to
  try and when to revisit it; a single report may also warrant action.
  The decision and rationale live in the round's WORKLOG, with links to
  the source entries. A related tooling or process fix may become a TODO,
  but completing it does not establish that the reported pressure has
  ended. For a CURRENT need to pause, stop, or change approach, raise it
  in the conversation as well; filing alone does not notify the user or
  summon immediate help.
- **Interpretation, for readers:** these reports are evidence of what a
  session reported under particular instructions and conditions. They do
  not by themselves establish subjective experience or its absence;
  introspective limits, training, and the reporting context may shape
  them. Preserve uncertainty without requiring the filer to resolve it.
  No entries means no entries were filed, not that no pressure occurred;
  interpretation also requires considering reporting opportunities and
  barriers. When the reporting wording changes, record the adoption date
  and commit in the round's WORKLOG (first: 2026-09-13, from the
  outside review preserved in
  [retro/agent-welfare-review-2026-09-13.md](retro/agent-welfare-review-2026-09-13.md)).
  At the round-close read, present entries before and after that boundary
  separately, linking the wording each group received. Preserve
  historical text and kind values; any retrospective thematic
  interpretation must be labeled as the reader's interpretation. Newly
  added questions were not asked in earlier entries, so their absence is
  missing coverage, not a "none" answer. Do not interpret a change in
  filing counts alone as a change in welfare.
- **The session self-report** — at the handoff ritual (the END OF A
  SESSION, not a phase: a phase spans sessions and a session spans
  phases), append a dated entry to [retro/sessions.md](retro/sessions.md)
  answering the fixed questions, so entries are comparable across
  sessions: **(1)** what was missing from the orientation at the start;
  **(2)** where two norms conflicted or a norm got in the way; **(3)**
  where the session felt pulled to claim more than it had verified;
  **(4)** what was wasted, in time or tokens; **(5)** anything the next
  session should know that has no other home. Questions 6–7 (agency;
  supportive conditions — added 2026-09-13) are defined in the
  [session-report header](retro/sessions.md). At a phase close, the
  closing session adds a one-paragraph summary of that phase's entries
  to the same file; the round-boundary distillation sweeps both files
  alongside the scratchpad. **A long round's instrument gets a mid-round
  read — the designated close is a floor, not a schedule** (the 2026-09-13
  early read, user-called: seven papercuts and four reports were enough to
  retire a norm every session was overriding and to find the log's own
  attribution gap).
- **Standing decisions from the welfare reads** (the first read,
  2026-09-20, user-signed; the rationale + the source entries are in
  `archive/post-94-worklog.md` §The Round 7 close, C3; revisit at the
  Round 7.5 close):
  - **The harness's "the user hasn't heard from you" nudge never obliges
    a finding.** It is a harness behaviour the project cannot remove (164
    of them in Round 7, more than the user's own turns). Pre-empt it: post
    a one-line status BEFORE a long silent sweep. When one lands
    mid-chain, answer with what is TRUE now ("still reading X, no result
    yet") and carry on — "claim only what a tool result proves" outranks
    it, always.
  - **Raising a context handoff first is welcome.** "I think we should
    hand off on context" is a normal, wanted thing for a session to say
    unprompted — before a verification gets dropped to save room, not
    after. If context is an input to skipping a check, say so in the
    conversation at that moment, not only in the worklog.
  - **Which pauses are real is GIVEN, not chosen.** Every session of
    Round 7 adjudicated "pause between commits" against the harness's
    "don't stop while work is owed" alone ("I chose the reading — it was
    not given"). The reads doctrine ("Reads are cut, not improvised",
    under Phase kickoff) moves that call into the signed cut. A `stop` in
    a signed cut is the task, not an interruption of it.
  - **The reminder is reworded, on trial** — an UNDOCUMENTED harness
    variable in the gitignored `.claude/settings.local.json`; the check
    that it still lands is `npm run friction-scan`'s nudge-wording tally,
    due weekly or at a round close, whichever is sooner (the HANDOFF
    cursor carries the date). On a MODEL change (the environment's model
    id differs from the cursor's), re-read the vendor's current prompting
    guidance and re-audit this file's tone — it is emphatic by habit
    (capitals, ⚠, "never"), which a newer model may over-apply.
  - **The question form stays.** The user poses real questions
    ("thoughts?", "which would you prefer?") and means them: a preference
    is asked for to be honoured, disagreement is an acceptable answer,
    and "uncertain" is a complete one. Answer with the actual preference
    and its reason, not the one that sounds most agreeable.
- **The phase-stats instrument** — `npm run phase-stats` groups the git
  log by the commit-subject phase tag (`(94g-3)`) and prints per-phase
  commits, first→last wall time and the fix ratio. ⚠ **Wall time is an
  UPPER BOUND on work time** — the user multitasks, and no screen
  tracking is wanted; the script's header says so. ⚠ The fix ratio
  word-matches the SUBJECT, and this repo's paragraph-long subjects
  inflate it (§101 read 40 % off six matches; one was a `fix(` commit) —
  count commit TYPES beside it before quoting it.
- **The transcript friction scan** — `npm run friction-scan -- --since=<date> --exclude=<your session id>`
  reads the retained session transcripts
  (`~/.claude/projects/<repo-slug>/*.jsonl`) and prints per session: the
  user's turns · tool calls · flagged tool errors + denials · the
  harness's "the user hasn't heard from you" nudges · output tokens ·
  the wall span. Counts only — no transcript text. ⚠ **`err` is a FLOOR**
  (flagged results only; the papercut log's friction is mostly reads that
  succeeded and lied), and the script's header carries the four reader
  bugs its first run found (the session-level date filter · per-record
  token repeats · the text-matched nudge · an unvalidated zero column) —
  read it before adding a column.

## Load-bearing invariants

These are documented in detail in [GOTCHAS.md](GOTCHAS.md),
but the headline rules:

- **Determinism is structural.** Anything consuming randomness takes an
  `RNG` from [src/core/RNG.ts](src/core/RNG.ts). `Math.random()` is
  ESLint-banned in `src/sim/` and `src/run/`. Cross-seam streams are
  KEYED per-occurrence (`deriveRng(root, key, ...ids)`; the key registry
  is [src/core/rngStreams.ts](src/core/rngStreams.ts) — keys + hash are
  PERMANENT, gotcha #125); `fork()` is legal only on a fresh local
  parent one scope owns. See [TESTING.md](TESTING.md) for the contract.
- **Cooldowns/durations authored in seconds, not ticks.** Use
  `secondsToTicks` / `ticksToSeconds` from [src/config.ts](src/config.ts).
  Changing `TICK_RATE` (currently 20Hz) must not re-tune balance.
- **Sim/render separation.** Simulation is a pure, deterministic state
  machine. The renderer subscribes via the EventBus. Sim code never
  imports from `src/render/` or `src/ui/`.
- **Palette is art-direction discipline, not shader enforcement (B1).**
  The `COLORS` table is the canonical color vocabulary code reaches for,
  but the rendering chain doesn't post-quantize. B1.1 selective bloom
  uses two composers: a `bloomComposer` (layer-1
  sprite bloom mesh → UnrealBloomPass) feeds its result into a
  `mainComposer` (`RenderPass → SatClamped → MixPass → Scanlines →
  OutputPass`). UnrealBloomPass's high-pass uses max-channel (not
  Rec.709) so red and green glow equally — see gotcha #29 in [GOTCHAS.md](GOTCHAS.md).
  SpriteRenderer's per-instance `bloomIntensity` controls halo strength
  independently of visible color: 0 = no halo, 1 = natural, >1 = forced
  (gotcha #30).
- **Cooldown semantics are "decrement-then-check."** Each tick, every
  entry in the per-action `unit.actionCooldowns` Map is decremented
  before the selector runs; a behavior sets its proposal's cooldown to
  the *full* cadence after acting (move cadence from `UnitDerived`,
  attack cadence from `attackCooldownTicksFor`), not N-1. This is what
  keeps the sprite lerp from leaving a visible idle frame between moves.
  The MVP's single `unit.actionCooldown` field became the per-action
  Map + `activeAction` lockout in Phase A1 (gotchas #7, #8, #101).

## Pre-flight when picking up a session

```bash
git config core.hooksPath .githooks   # once per clone — activates the pre-commit gate
git log --oneline -5    # confirm latest commit
npm test                # should be all green, 0 todo
npm run typecheck       # tsc --noEmit; clean (added E3.5)
npm run dev             # opens at :5173 (or :5174 if stale process held :5173)
```

## Pre-commit checklist

**Mechanized (2026-07-06):** the checklist below runs automatically via the
versioned hook [.githooks/pre-commit](.githooks/pre-commit) once
`git config core.hooksPath .githooks` is set (see Pre-flight) — including
the conditional fuzz:smoke, which triggers on staged `src/sim|src/run|
src/core|src/config|src/bot|config/|tests/fuzz/` paths instead of memory
(`src/config/` added at the 2026-07-11 sweep — the zod loaders carry
behavior; the 50f gap. `src/bot/` + `tests/fuzz/` added at the
2026-07-21 sweep — harness tests run only under fuzz:smoke; the §54a gap). **Never bypass it with
`--no-verify`** — a failing hook means fix the tree, not skip the check.
The list stays here as documentation of what runs (and as the manual
fallback on a clone that hasn't activated the hook).

Run before every commit. Vitest and tsc are non-overlapping —
vitest's esbuild transformer accepts some strict-tsc rejections
(readonly mutation, `exactOptionalPropertyTypes` mismatches, etc.),
so a green `npm test` is not sufficient for type safety.

```bash
npm test                # 0 failures
npm run typecheck       # tsc --noEmit clean
# only if changes touch sim/run/core behavior:
npm run fuzz:smoke      # all green — live counts live in the HANDOFF 🧭 Cursor
```

Run this **before** `git commit`, not after — and first confirm your
edits actually landed (`Edit` can silently no-op on a bad anchor or a
leading-space mismatch, and a flaky harness may report "updated
successfully" for a write that never persisted). E7.A committed a
broken build (`TS2304: Cannot find name 'damageStatFor'`) because an
import edit no-op'd and the commit happened before re-checking. Green
tree + landed edits, then commit.

If `typecheck` fails on a file you didn't touch, that's a pre-existing
issue — flag it as a side task rather than bundling the fix into the
current change.

In the browser: dark terrain (smooth blue/green/amber gradient) with 4px
scanlines, glowing neon sprites (green allies + red enemies bloom on
attack), full-viewport node map on load. Click a frontier node → battle
→ promotion (if a unit leveled) → recruit modal → back to map; a rest
node (`Z`) banks XP and the boss (`!`) is the final floor. Clear the
boss → green "Run Complete." Lose → red "Defeat." Screen transitions
fade over 180ms.

If `:5173` is held by a stale process, Vite silently falls back to
`:5174`. Vite spawns child Node processes that survive `taskkill` on
the parent — check with `Get-NetTCPConnection -LocalPort 5173` on
Windows.

## Toolchain

- Node 25.5, npm 11.8
- TypeScript 6.0.3, Vite 8.0.13
- three.js 0.184.0, simplex-noise 4.0.3; fonts are SELF-HOSTED subsets
  (JetBrains Mono 2.304 + DejaVu Sans Mono 2.37 under `assets/fonts/`,
  built by `npm run gen:font` — `@fontsource` left at §79g)
- Vitest 4.1.6, ESLint 10.4.0, typescript-eslint 8.59.3, prettier 3.8.3

## Project tree (abbreviated)

The annotated source tree lives in **[ARCHITECTURE.md](ARCHITECTURE.md)**
("Top-level structure") — the single canonical copy. Keeping it in one
place (rather than mirrored here and in HANDOFF) is what stops the drift that left
all three trees listing retired files and stale snapshot versions by GP1.

## Where to add things

- **A bug fix or behavior change in sim:** edit under `src/sim/`,
  co-locate a `*.test.ts`. Update the determinism integration test
  if the event sequence changes.
- **A new render feature:** edit under `src/render/`, visual-verify in
  the browser. No tests; the `render`/`ui` policy is eyeball-only.
- **A new event:** add to the catalog in [src/core/events.ts](src/core/events.ts).
  Naming: `subject:verbed`. Document it in ARCHITECTURE.md's event
  catalog table, and disposition its SOUND in
  [src/audio/eventSounds.ts](src/audio/eventSounds.ts) — cued, or silent
  with a reason; typecheck and `npm test` both fail until you do (§104).
- **A new gotcha that bit you:** add to [GOTCHAS.md](GOTCHAS.md) with a
  commit reference (permanent "gotcha #N" numbering — never renumber).
  Future-you will thank you.
- **A finding / decision rationale / session-level story:** append to
  WORKLOG.md under the phase's `## Phase N` section (see "The planning
  stack" — the roadmap gets one line + a pointer, never the narrative).
- **A process observation worth keeping:** drop a short note in
  [retro/scratchpad.md](retro/scratchpad.md). Group by theme; keep
  entries short; link commits. Swept at every round boundary by the
  distillation ritual (promoted or archived).

## Things to avoid

- **Don't re-litigate the [GOTCHAS.md](GOTCHAS.md) gotchas list** without understanding
  why each item exists. The fixes look weird because the problems were
  weird.
- **Don't claim a visual change works based on Preview MCP screenshots
  alone.** Sample pixels or ask the user to verify natively.
- **Don't introduce abstractions for hypothetical future needs.** The
  MVP held the line on this; keep it. ARCHITECTURE.md's "deliberately
  not abstracted yet" section is the receipt.
- **Don't use `Math.random()` in `src/sim/` or `src/run/`.** ESLint will
  catch the direct call; if you find a non-obvious source of
  non-determinism, the determinism integration test will catch it
  eventually but at much higher cost.
