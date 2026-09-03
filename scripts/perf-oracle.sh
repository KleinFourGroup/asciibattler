#!/usr/bin/env bash
# 86b — the mechanized 47e byte-identity oracle (the §86 lever gate).
#
# Compares the LIVE working tree (the candidate — committed or dirty, as-is)
# against a worktree-pinned BASELINE ref on fixed fuzz shapes, and demands
# summary.csv + decisions.csv come out sha-IDENTICAL. A perf lever passes
# iff every compared artifact matches; any mismatch = the lever changed
# behavior = a doctrine question for the user, not a speedup (ROADMAP §86).
#
#   bash scripts/perf-oracle.sh [baseline-ref]     # default: HEAD
#
# Mechanics (the 47e doctrine, mechanized):
#   - the baseline is PINNED via `git worktree add --detach` — never a
#     background capture against the live tree (edits landing underneath a
#     run-time-compiled CLI crash or silently poison the capture);
#   - node_modules reaches the worktree via a JUNCTION (no copy, no admin);
#     cleanup removes the junction with `cmd /c rmdir` (unlinks the junction
#     only, NEVER recurses into the real node_modules) BEFORE the worktree
#     teardown — do not "simplify" this ordering;
#   - timings.csv is deliberately NOT compared (wall clock — the 86a sidecar
#     is nondeterministic by design; summary+decisions are the contract);
#   - shapes (the 85g3 oracle-probe precedent): a scored pure-sim spread
#     (n=4, hops=4 — includes defeat outcomes) + the full ARM at hops=5
#     (searcher + arbitration + fold → a non-empty decisions.csv).
set -euo pipefail

BASE_REF="${1:-HEAD}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

BASE_SHA="$(git rev-parse --short "$BASE_REF")"
DIRTY=""
[ -n "$(git status --porcelain)" ] && DIRTY=" (live tree DIRTY — candidate includes uncommitted edits)"
echo "perf-oracle: baseline=$BASE_REF ($BASE_SHA) vs live tree$DIRTY"

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/perf-oracle-XXXXXX")"
WT="$SCRATCH/baseline-tree"

cleanup() {
  # Junction FIRST (rmdir unlinks the junction only), then the worktree.
  if [ -d "$WT/node_modules" ]; then
    cmd //c rmdir "$(cygpath -w "$WT/node_modules")" >/dev/null 2>&1 || true
  fi
  git worktree remove --force "$WT" >/dev/null 2>&1 || true
  git worktree prune >/dev/null 2>&1 || true
  rm -rf "$SCRATCH" || true
}
trap cleanup EXIT

git worktree add --detach "$WT" "$BASE_REF" >/dev/null
# `//J` (not `/J`): MSYS path-conversion would rewrite a bare `/J` before cmd
# sees it — the double slash collapses to the real switch.
cmd //c mklink //J "$(cygpath -w "$WT/node_modules")" "$(cygpath -w "$ROOT/node_modules")" >/dev/null

VECTOR="--strategy=tests/fuzz/fixtures/59-regen-vector.json"
SHAPE_SCORED="--count=4 --hops=4 --character=soldier $VECTOR"
SHAPE_ARM="--count=1 --hops=5 --character=soldier $VECTOR --searcher --audition --redraw=level:2 --empower=level:hi --arbitrate --prior-lambda=0.5"
# 91c — an OPTIONAL third shape from the environment: `ORACLE_EXTRA_SHAPE="<fuzz
# flags>"` runs it as shape 'extra' on both trees (e.g. the n=20 ARM walk twin
# `--count=20 --character=soldier $VECTOR <ARM> --per-encounter --emit-results
# --jobs=8` — the 91a2 oracle, ~4 min, the default exit for any byte-identity
# claim per retro/scratchpad). Every CSV the run emits is compared; results.json
# is NOT (it carries the new telemetry fields a seam commit adds by design).
SHAPE_EXTRA="${ORACLE_EXTRA_SHAPE:-}"

run_shape() { # run_shape <tree-dir> <out-dir> <flags...>
  local tree="$1" out="$2"
  shift 2
  (cd "$tree" && node --import tsx tests/fuzz/cli.ts "$@" --out="$(cygpath -w "$out")" >/dev/null 2>&1) ||
    { echo "FAIL: fuzz CLI exited non-zero in $tree (shape: $*)"; exit 1; }
}

FAILURES=0
compare() { # compare <name> <file> <base-dir> <cand-dir>
  local name="$1" file="$2" base="$3/$2" cand="$4/$2"
  local be=0 ce=0
  [ -f "$base" ] && be=1
  [ -f "$cand" ] && ce=1
  if [ "$be" != "$ce" ]; then
    echo "  FAIL  $name/$file — exists baseline=$be candidate=$ce"
    FAILURES=$((FAILURES + 1))
    return
  fi
  [ "$be" = 0 ] && { echo "  n/a   $name/$file — absent on both sides"; return; }
  local bs cs
  bs="$(sha256sum "$base" | cut -c1-12)"
  cs="$(sha256sum "$cand" | cut -c1-12)"
  if [ "$bs" = "$cs" ]; then
    echo "  PASS  $name/$file  sha=$bs"
  else
    echo "  FAIL  $name/$file  baseline=$bs candidate=$cs"
    FAILURES=$((FAILURES + 1))
  fi
}

SHAPES="scored arm"
[ -n "$SHAPE_EXTRA" ] && SHAPES="$SHAPES extra"
for shape in $SHAPES; do
  case "$shape" in
    scored) flags="$SHAPE_SCORED" ;;
    arm) flags="$SHAPE_ARM" ;;
    extra) flags="$SHAPE_EXTRA" ;;
  esac
  echo "shape '$shape': $flags"
  # shellcheck disable=SC2086 — flags are a deliberate word-split flag list.
  run_shape "$WT" "$SCRATCH/base-$shape" $flags
  run_shape "$ROOT" "$SCRATCH/cand-$shape" $flags
  # summary + decisions are the contract on every shape; the per-encounter /
  # alpha-strike / rosters CSVs exist only when the shape asks for them (n/a
  # otherwise, never a failure) — timings.csv stays out (wall clock).
  for file in summary.csv decisions.csv per-encounter.csv alpha-strike.csv rosters.csv; do
    compare "$shape" "$file" "$SCRATCH/base-$shape" "$SCRATCH/cand-$shape"
  done
done

if [ "$FAILURES" -gt 0 ]; then
  echo "perf-oracle: FAIL ($FAILURES mismatch(es)) — the candidate CHANGED BEHAVIOR vs $BASE_SHA."
  exit 1
fi
echo "perf-oracle: PASS — live tree byte-identical to $BASE_SHA on every shape ($SHAPES)."
