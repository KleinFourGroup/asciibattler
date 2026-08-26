#!/usr/bin/env bash
# 85g5-post — the sanctioned overnight box driver (the v2 queue shape,
# promoted from the 83c/83d/83e/83f queue-file drivers, the 84d stand-down
# watcher, and the 85f/85g5 v2 scratch drivers).
#
# One cohort, one box, one HEAD: create the box → for each queue line,
# launch → short-poll → artifact-verified fetch → next → destroy the box.
# Any anomaly HOLDs (box kept, loud exit) instead of standing down — no
# cohort bills past its last fetch, and no fetch is trusted without its
# artifacts (the gotcha-#126 ghost-driver class: a driver's logged exit
# code can record a REFUSAL as success; the `fetched →` line + exit-code
# sentinel + a non-empty artifact are the only completion signals).
#
# Mechanized guards (previously remembered, now enforced):
#   - push-before-launch: refuses a dirty tree or HEAD != origin/main
#     up front (the 68f lesson — the box pulls to local HEAD at launch).
#   - ONE HEAD PER COHORT: re-checks HEAD + tree before EVERY launch and
#     refuses on a flip, instead of silently rerunning the rest of the
#     queue at the new HEAD. No commits, no doc edits, until the last
#     launch has fired.
#
# Usage:
#   scripts/box-drive.sh <queue-file> [--poll=900] [--est-hours=N] [--artifact=summary.csv]
#   scripts/box-drive.sh [flags] -- <fuzz args…>       # single-batch shorthand
#
#   Queue file: one batch per line = its fuzz args; blank lines and
#   #-comments are skipped. --artifact names the file that must be
#   non-empty in the fetched batch for stand-down to proceed (default
#   summary.csv; a search cohort passes --artifact=best-strategy.json).
#   --est-hours arms the 68h in-flight hatch: past 2× the estimate the
#   driver flags loudly every poll (still polling — killing is a human
#   call, and determinism makes a restart free).
set -uo pipefail

POLL=900
EST_HOURS=""
ARTIFACT=summary.csv
QUEUE_FILE=""
INLINE_ARGS=""

usage() {
  sed -n '/^# Usage:/,/^set -uo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --poll=*) POLL=${1#--poll=} ;;
    --est-hours=*) EST_HOURS=${1#--est-hours=} ;;
    --artifact=*) ARTIFACT=${1#--artifact=} ;;
    --)
      shift
      [ $# -ge 1 ] || usage
      INLINE_ARGS=$(printf '%s ' "$@")
      break
      ;;
    -*) usage ;;
    *)
      [ -z "$QUEUE_FILE" ] || usage
      QUEUE_FILE=$1
      ;;
  esac
  shift
done

# Exactly one source of batches: a queue file XOR inline args.
if [ -n "$INLINE_ARGS" ]; then
  [ -z "$QUEUE_FILE" ] || usage
elif [ -z "$QUEUE_FILE" ]; then
  usage
elif [ ! -f "$QUEUE_FILE" ]; then
  echo "no such queue file: $QUEUE_FILE" >&2
  exit 1
fi

ts() { date -u +%FT%TZ; }

# The queue, as an array of arg-lines.
QUEUE=()
if [ -n "$INLINE_ARGS" ]; then
  QUEUE=("$INLINE_ARGS")
else
  while IFS= read -r line; do
    line="${line%%#*}"
    [ -n "${line//[[:space:]]/}" ] && QUEUE+=("$line")
  done < "$QUEUE_FILE"
  if [ ${#QUEUE[@]} -eq 0 ]; then
    echo "queue file $QUEUE_FILE holds no batches" >&2
    exit 1
  fi
fi

# --- pre-flight: push-before-launch, and pin the cohort HEAD -----------------
if [ -n "$(git status --porcelain)" ]; then
  echo "[$(ts)] REFUSED: dirty tree — commit and push before a cohort launches" >&2
  exit 1
fi
if ! git fetch -q origin; then
  echo "[$(ts)] REFUSED: git fetch failed — can't verify push parity offline" >&2
  exit 1
fi
COHORT_HEAD=$(git rev-parse HEAD)
ORIGIN_MAIN=$(git rev-parse origin/main)
if [ "$COHORT_HEAD" != "$ORIGIN_MAIN" ]; then
  echo "[$(ts)] REFUSED: HEAD ${COHORT_HEAD:0:7} != origin/main ${ORIGIN_MAIN:0:7} — push (or pull) first" >&2
  exit 1
fi
echo "[$(ts)] cohort HEAD ${COHORT_HEAD:0:7} · ${#QUEUE[@]} batch(es) · poll ${POLL}s · artifact $ARTIFACT${EST_HOURS:+ · est ${EST_HOURS}h}"

# --- create the box ----------------------------------------------------------
echo "[$(ts)] creating the box"
CREATE_OUT=$(bash scripts/box-launch.sh create 2>&1 | tail -5)
echo "$CREATE_OUT"
BOX=$(echo "$CREATE_OUT" | grep -oE 'root@[0-9.]+' | tail -1)
BOXNAME=$(echo "$CREATE_OUT" | grep -oE 'abox-[0-9-]+' | tail -1)
if [ -z "$BOX" ] || [ -z "$BOXNAME" ]; then
  echo "[$(ts)] BOX CREATE FAILED — nothing launched" >&2
  exit 1
fi
echo "[$(ts)] box $BOX ($BOXNAME)"

hold() {
  echo "[$(ts)] $1 — HOLDING BOX $BOXNAME ($BOX; billing until destroyed)" >&2
  exit 1
}

# --- drain the queue ---------------------------------------------------------
FETCHED=()
N=0
for LINE in "${QUEUE[@]}"; do
  N=$((N + 1))

  # ONE HEAD PER COHORT — refuse a mid-queue flip instead of silently
  # rerunning the remainder at the new HEAD.
  if [ -n "$(git status --porcelain)" ]; then
    hold "batch $N/${#QUEUE[@]}: tree went DIRTY mid-cohort"
  fi
  if [ "$(git rev-parse HEAD)" != "$COHORT_HEAD" ]; then
    hold "batch $N/${#QUEUE[@]}: HEAD flipped off cohort ${COHORT_HEAD:0:7} mid-queue"
  fi

  read -r -a ARGS <<< "$LINE"
  echo "[$(ts)] batch $N/${#QUEUE[@]}: launching — ${ARGS[*]}"
  LAUNCH_OUT=$(bash scripts/box-batch.sh "$BOX" launch -- "${ARGS[@]}" 2>&1)
  echo "$LAUNCH_OUT"
  BATCH_ID=$(echo "$LAUNCH_OUT" | grep -oE 'launched [0-9]{8}-[0-9]{6}-[0-9a-f]+' | awk '{print $2}')
  if [ -z "$BATCH_ID" ]; then
    hold "batch $N/${#QUEUE[@]}: LAUNCH FAILED (no batch id in the launch output)"
  fi
  echo "[$(ts)] batch id: $BATCH_ID — polling every ${POLL}s"

  START=$(date +%s)
  while true; do
    sleep "$POLL"
    STATUS=$(bash scripts/box-batch.sh "$BOX" status "$BATCH_ID" 2>&1 | head -1)
    ELAPSED=$(( ($(date +%s) - START) / 60 ))
    echo "[$(ts)] +${ELAPSED}m: $STATUS"
    echo "$STATUS" | grep -q 'DONE' && break
    # awk, not $(( )) — --est-hours takes decimals (the §59f anchor is 8.85).
    if [ -n "$EST_HOURS" ] && awk -v e="$ELAPSED" -v h="$EST_HOURS" 'BEGIN { exit !(e > h * 120) }'; then
      echo "[$(ts)] ⚠ past 2× the ${EST_HOURS}h estimate — the 68h hatch: still polling, flag for the user"
    fi
  done

  echo "[$(ts)] batch $BATCH_ID DONE — fetching"
  FETCH_OUT=$(bash scripts/box-batch.sh "$BOX" fetch "$BATCH_ID" 2>&1) || {
    echo "$FETCH_OUT"
    sleep 60
    FETCH_OUT=$(bash scripts/box-batch.sh "$BOX" fetch "$BATCH_ID" 2>&1) || {
      echo "$FETCH_OUT"
      hold "batch $BATCH_ID: FETCH FAILED TWICE"
    }
  }
  echo "$FETCH_OUT"

  DEST="output/box-batches/$BATCH_ID"
  if ! echo "$FETCH_OUT" | grep -q 'fetched →'; then
    hold "batch $BATCH_ID: no 'fetched →' line"
  fi
  EXIT_CODE=$(cat "$DEST/exit-code" 2>/dev/null || echo MISSING)
  if [ "$EXIT_CODE" != "0" ]; then
    hold "batch $BATCH_ID: exit-code=$EXIT_CODE"
  fi
  if [ ! -s "$DEST/$ARTIFACT" ]; then
    hold "batch $BATCH_ID: $ARTIFACT missing/empty in $DEST"
  fi
  echo "[$(ts)] batch $N/${#QUEUE[@]} verified: exit 0, $ARTIFACT present → $DEST"
  FETCHED+=("$DEST")
done

# --- stand down --------------------------------------------------------------
echo "[$(ts)] queue drained (${#FETCHED[@]}/${#QUEUE[@]} verified) — standing the box down"
bash scripts/box-launch.sh destroy "$BOXNAME" 2>&1 | tail -2
echo "[$(ts)] cohort complete at ${COHORT_HEAD:0:7}:"
printf '  %s\n' "${FETCHED[@]}"
