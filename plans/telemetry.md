# Plan — Online balance telemetry

A **§80 feasibility-audit doc**: audit + plan only, ZERO
implementation. Audited 2026-08-16 at `2d599c6`. The purpose:
balance reads from REAL players — the human-arm complement to the
bot instrumentation (the board protocol, decisions.csv, the §53g
hand-run human gauntlet's ~80% baseline).

## Current state

- **Zero infrastructure**: no server, no network code, no CI. The
  deploy is a hand-uploaded build to a separate Pages repo at
  milestone boundaries; the URL is semi-private (a small, known
  player population — this shapes everything below).
- **The collection pattern is proven**: bus-subscriber-that-never-
  emits, twice in-tree ([TelemetryAccumulator](../tests/fuzz/telemetry.ts),
  [TraceRecorder](../src/dev/TraceRecorder.ts)). The 53b trace
  format + localStorage ring already capture battles for replay.
- **Determinism is the superpower**: a run is fully reconstructible
  from `seed + player commands`. A telemetry payload therefore
  doesn't need metrics — a few KB of trace re-runs through the
  existing headless harness and yields decisions.csv-grade data
  offline. The client stays dumb; the analysis reuses the entire
  §68-era instrument kit on human runs.

## The recommended shape (honest cost read)

Three transport tiers, in ascending infrastructure cost:

1. **Manual trace export (recommended v1)** — an "export run trace"
   button producing a compact blob (seed + command log + build id);
   players paste/send it by hand. Zero infrastructure, zero
   consent machinery (sharing IS the consent act), and for a
   semi-private population of friends it plausibly captures most
   runs that matter. ~90% of the value at ~0 cost.
2. **A tiny ingest endpoint** — the on-demand hcloud box is the
   obvious host BUT it is deliberately on-demand (§62 ops model);
   an always-up ingest is a NEW standing ops burden (uptime,
   abuse, storage) that the current ops model was explicitly
   designed to avoid. Only worth it if tier 1's friction provably
   loses data we want.
3. **Third-party analytics** — rejected on principle for a
   semi-private hobby deploy: ships a tracker to friends to avoid
   writing a form handler.

**Judgment: build tier 1 in C6 (it's a UI button + the existing
trace machinery), decide tier 2 only on demonstrated need.**

## The audit's structural finding — build identity

Fixes landing on `main` reach the live build only at the next
hand-upload (the §79-post deploy-story lesson). Live players are
therefore routinely on a STALE build, and a trace replayed against
current-HEAD code silently diverges (any sim change since the
upload breaks byte-reproduction). **Every trace must carry a build
identifier** (commit hash baked at build time), and replay tooling
must check out that commit (a worktree, per the 47e pinned-baseline
pattern) before re-running. Without this, human-arm reads pool
across sim versions — the exact confound the board protocol exists
to prevent.

## What Cluster 6 must not break

- **The subscriber never emits, and PROD ships no live transport**
  under tier 1 — the export path is player-initiated only. If tier
  2 ever lands, it is opt-in via the C6 options menu (a consent
  row in the same settings store), default OFF.
- **The build id is baked at build time** into every trace — the
  hand-upload deploy story makes unversioned traces worse than no
  traces.
- **Trace capture must stay out of the sim** (Game-layer wiring,
  like the trace ring today): fuzz/headless runs produce no
  telemetry, and capture can never perturb determinism.
- **The DEV/PROD split is a build flag, not a convention** — the
  DEV trace ring and any PROD export path must be separately
  gated; a DEV instrument leaking into the shipped build is the
  §79f silent-fallback failure shape applied to player data.
