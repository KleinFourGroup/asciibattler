# Scratchpad — rolling notes on process, decisions, gotchas — THE CASUALTY EXPERIMENT (§89–§94) — ARCHIVED

> **Archived 2026-09-08 at the §94i close, the eighth sweep.** Promoted to AGENTS: build in a detached worktree while a cohort holds the tree · Write/Edit for any text that carries a quote (heredocs and perl burned four times in one session) · self-check a new reader against a known answer and pool with a script that prints its arm count (never `rows[0]`) · pre-sign the CHAIN, not the numbers, for an unattended night · a mechanism designed inert on the arm you measure with gets its first LIVE read scheduled, and a knob pin reaches the knob through the CLI resolver (gotchas #131/#132) · one artifact KIND per cohort (already in HANDOFF's standing tools; the driver rider is in TODO). The rest is archived here as the round's record.

## §91 build session (2026-09-03) — process notes

- **Review BEFORE the sign, not after.** Running the adversarial review
  against the DRAFT cut (before shape-lock) meant the user signed a
  reviewed cut in one turn; the review found the mutual-wipe/cap conflation
  and the rollback-order defect that would otherwise have been built in.
  Cost ≈ 18 min wall, ~370k subagent tokens, two Fable instances
  (reviewer + read-only file:line verifier).
- **The tree is CRLF on disk (git normalizes).** Any script that anchors on
  multi-line text must normalize `
` first — the first 91a1 edit matched
  nothing. Shell-quoting a multi-line JS string is the other trap (apostrophes
  in prose): scripts in files, not `node -e`, for anything with prose.
- **The Browser pane hidden ⇒ no animation frames ⇒ the battle clock stops.**
  A preview battle that “stalls” while tools run is that, not a sim bug;
  drain a queued world command with one manual `world.tick()` +
  `battleRenderer.update()` when probing (91-pre2b).
- **A signed render rule got re-opened by a playtest report** (79d2 → 91-pre2):
  the record said “not a bug”, the user said “I misread what I signed”. The
  right move was to bring the record back with the options, not to re-decide
  silently in either direction.
- **The worktree diff oracle at n=20 took ~4 min for both legs in parallel** —
  cheap enough to be the default exit criterion for any byte-identity claim,
  not a special occasion.

## §91 build session (2026-09-03 → 09-04, 91c → the close)

- **The HANDOFF CHAR cap trips before the line cap now** (48k chars; 91c
  tripped it at 48,378 with the line caps green): dense one-line rows are
  the failure mode, and the fix is the structural demotion (P–Qb and S–W
  Current-state bullets → one archive line each, ~3k chars), not word
  trimming — the first trim (378 over) left 188 over. Demote a completed
  round's bullets the moment the cap is within ~2k.
- **A "rule-agnostic" test fake is only agnostic under the rule set it was
  written against.** The 91e two-vocabulary mirror was exact under a
  ONE-rule pair and doubled under the two-rule surcharge (gotcha #129) —
  derive the fake's halves from `rulesForTurn`, never from the pair you
  happen to ship today.
- **Pre-register by ARM, not pooled.** The 91f-pre desk read pooled both
  finalists' death rates and missed that the twins would split 28:1 vs
  27:16 on the same rule; the arm that spent units under the old rule is
  the one the new rule punishes. And never count a kill the ledger won't
  book (gotcha #130 — summoned ghouls were the whole darkMagicPosse miss).
- **`perf-oracle.sh` doubles as the behaviour-CHANGE control:** a FAIL on
  every CSV (91b, the table) is the proof a config change is live, the
  mirror of a PASS proving a seam inert (91c). Run it both ways on purpose.
- **The box wall-time estimate must come from the SAME table:** the 90d
  legs (~30 min each) predicted 2.5 h; the new-table survivors legs fought
  ~30% more turns and the cohort ran 3.6 h. The 2× hatch never armed, but
  an estimate carried across a table change is a guess.
- **The log monitor pattern worked cleanly** (`tail -f | grep --line-buffered
  "launch|fetched|HOLD|refus|error|destroy|EXIT"`, persistent, TaskStop
  after the driver's EXIT) — every transition surfaced, no polling, and the
  ONE-HEAD hold on the tree was easy to honour because the fourth launch
  line was an event, not a guess.
- **Reading a fetched leg mid-cohort is fine as a DIRECTION check** (the
  regen casualties leg was read after fetch 1) as long as the write-up
  waits for the full cohort — the partial was labelled a sanity glance and
  the signing table came from all four legs.

## §92 session notes (2026-09-04/05 — the overnight chain)

- **Pre-sign the chain, not the numbers.** Four pre-signatures (the argmax
  rule, the stale-prior acceptance, the same-night launch, a MECHANICAL
  adjustment rule with a pause-on-suspicion clause) let five cohorts run
  unattended across a night; the one judgment call (the evaluator's
  exchange rate) was recorded, not decided silently, and the one marginal
  reading (the swarms at 3.04 vs 2.5) was HELD because the rule's text and
  the user's own band both said hold. The shape to keep: rules the session
  can apply, a clause for what it can't, and a written flag for every call.
- **One artifact KIND per cohort.** `box-drive.sh` takes one `--artifact`;
  a queue mixing a shadow batch (summary.csv) with a search
  (best-strategy.json) HELD its box after a clean derive. Split mixed
  cohorts, or teach the driver a per-line `# artifact=` override (a TODO).
- **A new FIELD sweeps every EMITTER, not just every reader.** 92e wired
  `power?` through the schema, the resolver, the ledger, the risk line and
  the editor's field — and the formatter dropped it on emit; the 92d
  surgery's diff (twelve pool lines, zero power lines) caught it before the
  editor's Save would have discarded a designer's number silently. The
  AGENTS "adding a consumer to an old seam" rule, in reverse.
- **A pin whose comment names the phase that may move it is the best kind.**
  `DP_TAIL_SCALE = 5` carried "re-pin it with the re-search (§92), never
  silently" — when the pool max doubled it, the failure was a prompt to
  record a deliberate arm change, not a puzzle.
- **Pool-relative instruments scale with the pool max; sheets written in
  pool HP do not.** The seam band (15–18), the overkill threshold (3) and
  the evaluator's ordinals all carried pool-20 numbers; the threshold was
  caught (92d-pre), the evaluator's terms scale by construction, and the
  seam band reads at 41% of the new max — the DRAFT lineage re-expresses
  it as a fraction. Grep a config move's UNIT, not just its key.
- **Wall-time at the new table (the 91 note's sequel):** a derive 2.1 h at
  pool 20 → 4.0 h at the frozen config; an n=120 walk leg 55 min (91f) →
  38 min (92f, fewer longer fights) → ~35 min on the board; the 33-line
  closing cohort 12 h. Estimates carried across a config change are
  guesses both ways.
- **The direction check mid-cohort is worth it, and read the CSV columns
  by NAME.** A `cut -f` on pacing.csv mis-associated turns-per-won with
  cost-per-turn and read the bosses at 3.1 turns for ten minutes; the
  independent recompute settled it. Print the header with the row.
- **Two boxes at once is fine when the cohorts are independent:** the 92h
  closing cohort launched while the 92g derive still cooked (the derive is
  a read, not a config input) — ~2 h saved, no shared state.

## §94 session notes (2026-09-05/06 — the kickoff through 94c)

- **Build in a detached worktree while a cohort holds the tree.** The
  ONE-HEAD rule freezes main for a cohort's whole launch window (2–3.5 h);
  `git worktree add --detach` + a node_modules junction gave a second tree
  where 94d/94e/94f/94g/94h-pre were built, typechecked, tested AND
  fuzz-smoked, then landed on main as file-split commits once the last
  launch fired. The worktree is reset with `reset --hard <HEAD>` between
  rounds; `git add -N` makes new files ride `git diff`. Landing split by
  hunk (`printf answers | git add -p`) works in Git Bash; a file whose
  hunks straddle two commits is staged from a temporarily-reverted copy.
- **Heredocs and perl are not a substitute for Write/Edit when the text
  carries quotes.** Four burns in one session: a `'` in a `-m` message
  killed a whole command; `\n` inside a perl replacement became a real
  newline three times (the fix was a node rewrite with `String.fromCharCode`);
  an apostrophe in a single-quoted TS string parsed by esbuild, not tsc
  (tsc passed, the fuzz smoke's transform failed). Write the scratch file
  with the Write tool, splice with `cat`/`head`; perl only for literal,
  quote-free anchors.
- **A printout of `rows[0]` is one arm, not the pool.** The kickoff table
  quoted the first walk arm's pacing rows as "the six ARM walk arms
  pooled"; the pooled numbers differed (plagueSpreaders' cap share 16.6%,
  not 11.7%). Caught when the 94c reader's self-check reproduced 92h from
  the raw files. Pool with a script that prints its arm count, never a
  dump of the first file.
- **A pacing change moves every fixture that measures its reach in
  turns.** Two hook catches on one config commit: the level-cap migration
  invariant (a stamped cap must bind — two went dead at the new counts)
  and the 70e frontier scan (6 turns deep no longer reaches the braid's
  first split under 3-turn openers → depth 12). Widening the wrong axis
  first (trials 8 → 16) cost a minute; the scratchpad probe that printed
  the walk's stop position found the real axis in one run.
- **The burn per turn saturates at the player's kill throughput, not the
  wave's size.** The 94b desk model (pool ≈ fielded power × turns) held on
  the 92d bandit swarms and overshot on the tougher held rows (a ×1.2
  guard wave of ~7 bodies burns ~5 a turn). The pre-signed proportional
  trim is the correction; the override lever is the alternative that
  keeps the numbers on screen large.
- **Self-check a new reader against a known answer before trusting it on
  new data.** `read-94c.mjs` pointed at the 92h batches had to reproduce
  the 92h read exactly; it didn't (survivors twins pooled in; turns/won
  approximated) — two defects found before the cohort landed.
- **The browser pass finds what the grep sweep misses.** The morale rename
  swept every `Pool` label by grep; the live pre-turn screen still said
  "up to 6 pool", and the reward + sector-seam lines carried two more.
  Read the rendered page's text for the old word, not the source.
- **The persistent-chip column is measured, not assumed.** The pool chip's
  first draft sat on the sector-map chip (the 78e third chip hides on the
  map screen, where the first measurement happened). Measure on the screen
  where every sibling is shown.
