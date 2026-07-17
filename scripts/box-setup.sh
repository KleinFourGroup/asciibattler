#!/usr/bin/env bash
# 57f2 — measurement-box provisioning (Hetzner CX-line VPS, Ubuntu LTS x86_64).
#
# The box is a pure function from commit hash to batch output: stock OS image +
# this script + a commit = the whole environment. No snapshots — the script IS
# the versioned truth (the derive-don't-cache doctrine, applied to infra).
#
# Usage (from a fresh box, as root):
#   ssh root@<box-ip> 'bash -s' < scripts/box-setup.sh
# Idempotent: safe to re-run — skips the Node install if the pin already
# matches, pulls instead of re-cloning.
set -euo pipefail

# The Node pin MUST match the local toolchain (AGENTS.md §Toolchain): the
# cross-machine byte-identity proof (worklog §57f2) holds per (commit,
# toolchain) pair — the box tracks the local version deliberately, not latest.
NODE_VERSION=v25.5.0
REPO_URL=https://github.com/KleinFourGroup/asciibattler.git
REPO_DIR=/root/asciibattler

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl xz-utils >/dev/null

if ! command -v node >/dev/null 2>&1 || [ "$(node --version)" != "$NODE_VERSION" ]; then
  cd /tmp
  curl -fsSO "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz"
  # Checksum-verify against the official manifest before unpacking into /usr/local.
  curl -fsS "https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt" \
    | grep "node-${NODE_VERSION}-linux-x64.tar.xz\$" | sha256sum -c -
  tar -xJf "node-${NODE_VERSION}-linux-x64.tar.xz" -C /usr/local --strip-components=1
  rm -f "node-${NODE_VERSION}-linux-x64.tar.xz"
fi

if [ ! -d "$REPO_DIR" ]; then
  git clone -q "$REPO_URL" "$REPO_DIR"
fi
cd "$REPO_DIR"
git pull -q
npm ci --no-audit --no-fund

echo "box ready: $(git rev-parse --short HEAD) · node $(node --version) · $(nproc) cores"
