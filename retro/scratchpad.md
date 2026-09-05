# Scratchpad — rolling notes on process, decisions, gotchas

Running notebook of "things worth talking about" — drop short observations here
as you build. **Swept at every round/cluster boundary** by the distillation
ritual (AGENTS.md §"The planning stack"): each entry gets **promoted** (to
AGENTS / GOTCHAS / TESTING / TODO) or **archived** with the round's docs, so
this file holds only undistilled observations from the current round. Keep
entries short; link commits; group by theme.

Prior eras: the MVP→H7 backlog was swept 2026-07-06 (the ritual's first run) →
[archive/retro-scratchpad-mvp-to-h7.md](../archive/retro-scratchpad-mvp-to-h7.md);
the process-audit + Cluster-3 backlog was swept 2026-07-11 (the second run, at
the micro-round kickoff) →
[archive/retro-scratchpad-cluster-3.md](../archive/retro-scratchpad-cluster-3.md);
the micro-round backlog was swept 2026-07-21 (the third run, at the Cluster-4
kickoff) →
[archive/retro-scratchpad-micro-round.md](../archive/retro-scratchpad-micro-round.md);
the Cluster-4 backlog was swept 2026-07-29 (the fourth run, at the 68h round
close) →
[archive/retro-scratchpad-cluster-4.md](../archive/retro-scratchpad-cluster-4.md);
the rollout-arbitration-interstitial backlog was swept 2026-08-04 (the fifth
run, at the 72f round close) →
[archive/retro-scratchpad-rollout-arbitration.md](../archive/retro-scratchpad-rollout-arbitration.md);
the Cluster-5 backlog was swept 2026-08-21 (the sixth run, at the §83g
cluster close) →
[archive/retro-scratchpad-cluster-5.md](../archive/retro-scratchpad-cluster-5.md);
the Round-6 (Instruments) backlog was swept 2026-09-02 (the seventh run, at
the 88e round close — promoted: six norms to AGENTS [the macro-plan code
audit · count-the-shape-before-timing + profile-between-levers · the
paired-bench warm-leg/subshell rule · verify-the-tree-died after any kill +
no `pgrep` in Git Bash · poll scales to batch size · adversarial review +
a read-only verifying peer], one caveat to BALANCE [exact zeros = an
instrument smell]) →
[archive/retro-scratchpad-round-6.md](../archive/retro-scratchpad-round-6.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

_(The post-Round-6 entries start here — the §89 interstitial.)_

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
