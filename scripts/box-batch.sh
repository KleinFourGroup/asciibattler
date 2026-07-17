#!/usr/bin/env bash
# 57g-pre — the detached remote-batch wrapper for the measurement box.
#
# Structures the ops doctrine banked at 57f2 (worklog §57f2): long remote
# batches run DETACHED (nohup + a box-side log + an exit-code sentinel), status
# reads are SHORT-LIVED ssh connections (a live pipe died twice — NAT idle
# timeout, exit-255-after-success), and commit parity — the byte-identity
# contract's precondition — is ENFORCED at launch, not remembered.
#
# The box address is always an argument (never baked in): the IP is ephemeral
# (the box dies at round close) and multiple boxes may run at once.
#
# Usage:
#   scripts/box-batch.sh <user@host> launch -- <fuzz args…>   # detach a batch, print its id
#   scripts/box-batch.sh <user@host> status [batch-id]        # one short poll (default: latest batch)
#   scripts/box-batch.sh <user@host> fetch  [batch-id]        # pull a FINISHED batch → output/box-batches/<id>/
#   scripts/box-batch.sh <user@host> kill                     # abort the running batch (sentinel still lands)
#   scripts/box-batch.sh <user@host> run    -- <fuzz args…>   # launch + poll loop + fetch (in-session batches)
#
#   scripts/box-batch.sh root@<ip> run -- --count=120 --scripts --jobs=8
#
# Parity is wrapper-to-wrapper: `fetch` prints sha256(summary.csv) (first 8
# chars as the short form) — compare that against another wrapper fetch or a
# local `sha256sum output/summary.csv`, per (commit, toolchain) pair.
set -euo pipefail

REPO_DIR=/root/asciibattler
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=10)

usage() {
  sed -n '/^# Usage:/,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
  exit 1
}

[ $# -ge 2 ] || usage
BOX=$1
CMD=$2
shift 2

# launch/run take the fuzz args after `--`; status/fetch take an optional id.
FUZZ_ARGS=""
BATCH_ID=""
case "$CMD" in
  launch | run)
    [ "${1:-}" = "--" ] || usage
    shift
    [ $# -ge 1 ] || usage
    # %q-quote each arg so it survives ssh + the remote `bash -c` layer intact.
    FUZZ_ARGS=$(printf '%q ' "$@")
    ;;
  status | fetch)
    BATCH_ID=${1:-}
    ;;
  kill) ;;
  *) usage ;;
esac

box() {
  ssh "${SSH_OPTS[@]}" "$BOX" bash -s -- "$@"
}

launch() {
  # The parity guard, local half: an uncommitted tree can't match any box HEAD.
  if [ -n "$(git status --porcelain)" ]; then
    echo "PARITY FAIL: local tree is dirty — commit (and push) before launching a batch" >&2
    exit 1
  fi
  local local_head id
  local_head=$(git rev-parse HEAD)
  id=$(date -u +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD)

  box "$REPO_DIR" "$local_head" "$id" "$FUZZ_ARGS" <<'REMOTE'
set -euo pipefail
repo=$1 local_head=$2 id=$3 fuzz_args=$4
cd "$repo"
lock_before=$(sha256sum package-lock.json)
git pull -q
# The parity guard, box half: the batch output is a pure function of (commit,
# toolchain) — never launch on a HEAD that isn't the local one.
head=$(git rev-parse HEAD)
if [ "$head" != "$local_head" ]; then
  echo "PARITY FAIL: box HEAD ${head:0:7} != local ${local_head:0:7} — push local main first" >&2
  exit 42
fi
if [ "$(sha256sum package-lock.json)" != "$lock_before" ]; then
  echo "lockfile changed — npm ci"
  npm ci --no-audit --no-fund
fi
bdir=output/batches/$id
mkdir -p "$bdir"
printf '%s\n' "$fuzz_args" > "$bdir/args"
nohup bash -c "npm run fuzz -- $fuzz_args --out=$bdir; echo \$? > $bdir/exit-code" \
  > "$bdir/batch.log" 2>&1 < /dev/null &
echo "launched $id (box pid $!) at ${head:0:7}"
REMOTE
}

status() {
  box "$REPO_DIR" "$BATCH_ID" <<'REMOTE'
set -euo pipefail
repo=$1 id=${2:-}
cd "$repo"
[ -n "$id" ] || id=$(ls -1t output/batches 2>/dev/null | head -1 || true)
d=output/batches/$id
[ -n "$id" ] && [ -d "$d" ] || { echo "no such batch: '${id:-<none>}'" >&2; exit 1; }
if [ -f "$d/exit-code" ]; then
  echo "batch $id: DONE (exit $(cat "$d/exit-code"))"
else
  echo "batch $id: RUNNING ($(pgrep -cf 'tests/fuzz/cli[.]ts' || true) cli processes)"
fi
echo "--- batch.log tail ---"
tail -n 8 "$d/batch.log"
REMOTE
}

# Resolve the target batch and its done-state in one short connection; echoes
# "<id> <done|running>". Shared by fetch and the run poll loop.
probe() {
  box "$REPO_DIR" "$BATCH_ID" <<'REMOTE'
set -euo pipefail
repo=$1 id=${2:-}
cd "$repo"
[ -n "$id" ] || id=$(ls -1t output/batches 2>/dev/null | head -1 || true)
[ -n "$id" ] && [ -d "output/batches/$id" ] || { echo "no such batch: '${id:-<none>}'" >&2; exit 1; }
[ -f "output/batches/$id/exit-code" ] && echo "$id done" || echo "$id running"
REMOTE
}

fetch() {
  local id state
  read -r id state < <(probe)
  if [ "$state" != "done" ]; then
    echo "batch $id is still RUNNING — fetch only pulls finished batches (kill it or wait)" >&2
    exit 1
  fi
  local dest=output/box-batches/$id
  mkdir -p "$dest"
  scp -q -r "${SSH_OPTS[@]}" "$BOX:$REPO_DIR/output/batches/$id/." "$dest/"
  echo "fetched → $dest (exit $(cat "$dest/exit-code"))"
  if [ -f "$dest/summary.csv" ]; then
    local sum
    sum=$(sha256sum "$dest/summary.csv" | cut -d' ' -f1)
    echo "summary.csv sha256 ${sum:0:8} ($sum)"
  else
    echo "⚠ no summary.csv in the batch output" >&2
  fi
}

kill_batch() {
  box <<'REMOTE'
set -euo pipefail
# The bracket class keeps pkill's own command line from matching the pattern
# (the §57f2 self-match burn). Killing the cli.ts tree lets the nohup wrapper
# fall through and write the exit-code sentinel, so the batch reads as DONE
# (non-zero) rather than hanging forever as RUNNING.
if pkill -f 'tests/fuzz/cli[.]ts'; then
  echo "killed the running cli.ts process tree"
else
  echo "nothing running"
fi
REMOTE
}

run() {
  local out id state
  out=$(launch)
  echo "$out"
  # "launched <id> (box pid N) …" — the id is the 2nd field of the last line.
  id=$(printf '%s\n' "$out" | tail -1 | cut -d' ' -f2)
  BATCH_ID=$id
  local i
  for ((i = 0; i < 240; i++)); do
    sleep 15
    read -r id state < <(probe)
    if [ "$state" = "done" ]; then
      status
      fetch
      return
    fi
    echo "poll $((i + 1)): $id still running…"
  done
  echo "gave up polling after ~1h — batch $id is still running; use status / fetch later" >&2
  exit 1
}

case "$CMD" in
  launch) launch ;;
  status) status ;;
  fetch) fetch ;;
  kill) kill_batch ;;
  run) run ;;
esac
