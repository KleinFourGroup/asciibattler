#!/usr/bin/env bash
# 62b — the measurement-box lifecycle launcher (create → provision → destroy).
#
# Wraps the hcloud CLI so a box spins up on demand and dies when the batch is
# fetched. Auth is the active `hcloud context` — the API token lives in the
# user's hcloud config, never this repo (standing rule; same for addresses:
# the box IP is printed, not stored). Provisioning stays ssh-piped
# box-setup.sh — the one versioned provisioning truth — so a box remains a
# pure function of commit hash.
#
# Availability doctrine (shape-locked at §62): LOCATION falls back
# automatically (fsn1 → nbg1 → hel1 — same hardware, same price, no bearing
# on the byte-identity contract, which is per (commit, toolchain)), while
# SERVER TYPE fails loud: a type substitution changes core count, batch
# sizing (--jobs), and price, so it is always a human call — rerun with an
# explicit --type. Passing --location=<loc> pins that location (no fallback).
#
# Usage:
#   scripts/box-launch.sh create [name] [--type=cx43] [--location=<pin>] [--image=ubuntu-26.04]
#   scripts/box-launch.sh destroy [name]    # default: the single abox-* server
#   scripts/box-launch.sh list              # thin `hcloud server list`
#
#   scripts/box-launch.sh create            # → "box ready: root@<ip>"
#   scripts/box-batch.sh root@<ip> run -- --count=20 --scripts --jobs=8
#   scripts/box-launch.sh destroy
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

DEFAULT_TYPE=cx43              # the 57f2 box: 8 shared x86 cores (--jobs=8 sizing)
DEFAULT_IMAGE=ubuntu-26.04     # what 57f2 provisioned on (worklog §57f2)
FALLBACK_LOCATIONS=(fsn1 nbg1 hel1)
# accept-new (not box-batch's bare BatchMode): a fresh box's host key is by
# definition unknown, and accepting it here seeds known_hosts so box-batch.sh's
# stricter ssh calls work unprompted afterwards.
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new)

usage() {
  sed -n '/^# Usage:/,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
  exit 1
}

create() {
  local name=$1 type=$2 location=$3 image=$4
  [ -n "$name" ] || name=abox-$(date -u +%Y%m%d-%H%M%S)

  # Every ssh key registered in the Hetzner project goes on the box — key
  # NAMES are user-side config, so none get baked into the repo.
  local keys=() k
  while IFS= read -r k; do
    [ -n "$k" ] && keys+=(--ssh-key "$k")
  done < <(hcloud ssh-key list -o noheader -o columns=name)
  if [ ${#keys[@]} -eq 0 ]; then
    echo "no ssh keys in the Hetzner project — upload one first (hcloud ssh-key create --name <n> --public-key-from-file ~/.ssh/id_ed25519.pub)" >&2
    exit 1
  fi

  local locations=("${FALLBACK_LOCATIONS[@]}")
  [ -n "$location" ] && locations=("$location")

  local loc created=""
  for loc in "${locations[@]}"; do
    echo "creating $name ($type, $image) in $loc…"
    if hcloud server create --name "$name" --type "$type" --image "$image" \
      --location "$loc" "${keys[@]}"; then
      created=$loc
      break
    fi
    echo "⚠ create failed in $loc — trying the next location" >&2
  done
  if [ -z "$created" ]; then
    echo "FAILED: $type unavailable in: ${locations[*]}. Type never falls back on its own — retry later, or pick one EXPLICITLY (e.g. --type=cx53) and re-size --jobs to its cores." >&2
    exit 1
  fi

  local ip
  ip=$(hcloud server ip "$name")
  echo "created $name in $created → $ip · waiting for ssh…"
  # Hetzner recycles IPs aggressively; a stale known_hosts entry from a dead
  # box would hard-fail the handshake before accept-new gets a say.
  ssh-keygen -R "$ip" >/dev/null 2>&1 || true

  local i up=""
  for ((i = 0; i < 36; i++)); do
    if ssh "${SSH_OPTS[@]}" "root@$ip" true 2>/dev/null; then
      up=1
      break
    fi
    sleep 5
  done
  if [ -z "$up" ]; then
    echo "ssh never answered on $ip after ~3min — the box is LEFT RUNNING (billing!): debug by hand or \`scripts/box-launch.sh destroy $name\`" >&2
    exit 1
  fi

  echo "provisioning ($SCRIPT_DIR/box-setup.sh)…"
  ssh "${SSH_OPTS[@]}" "root@$ip" 'bash -s' < "$SCRIPT_DIR/box-setup.sh"

  echo "box ready: root@$ip"
  echo "  batches:  scripts/box-batch.sh root@$ip run -- <fuzz args…>"
  echo "  ⏱ billing runs until: scripts/box-launch.sh destroy $name"
}

destroy() {
  local name=${1:-}
  if [ -z "$name" ]; then
    local boxes count
    boxes=$(hcloud server list -o noheader -o columns=name | grep '^abox-' || true)
    count=$(printf '%s' "$boxes" | grep -c . || true)
    if [ "$count" -eq 0 ]; then
      echo "no abox-* servers running — nothing to destroy"
      return
    fi
    if [ "$count" -gt 1 ]; then
      echo "multiple boxes running — name the one to destroy:" >&2
      printf '%s\n' "$boxes" >&2
      exit 1
    fi
    name=$boxes
  fi
  hcloud server delete "$name"
  echo "destroyed $name"
}

[ $# -ge 1 ] || usage
CMD=$1
shift

case "$CMD" in
  create)
    NAME="" TYPE=$DEFAULT_TYPE LOCATION="" IMAGE=$DEFAULT_IMAGE
    for arg in "$@"; do
      case "$arg" in
        --type=*) TYPE=${arg#--type=} ;;
        --location=*) LOCATION=${arg#--location=} ;;
        --image=*) IMAGE=${arg#--image=} ;;
        -*) usage ;;
        *) NAME=$arg ;;
      esac
    done
    create "$NAME" "$TYPE" "$LOCATION" "$IMAGE"
    ;;
  destroy) destroy "${1:-}" ;;
  list) hcloud server list ;;
  *) usage ;;
esac
