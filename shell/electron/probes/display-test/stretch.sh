#!/usr/bin/env bash
# The display test's stretches (114f), with the tones that tell the user when
# to leave, when a switch is coming and when to come back. Windows, from Git
# Bash, at the user's go: every switch turns their monitor off for 25 s.
# Each run is display-test.mjs; `one` passes its flags through.
#
#   bash stretch.sh tones   play the four signals once, to check they are heard
#   bash stretch.sh away    the user gone (and the PC left unlocked): start
#                           tones, a minute's settle, a control, two switches,
#                           the same three under a planted decode, then the
#                           lock leg (it locks the PC and lets Windows turn
#                           the display off), end tones three times. 15 min.
#   bash stretch.sh desk    the user working: a control, then two switches,
#                           one asked of every window and one of one window,
#                           each with a warn tone 6 s before it and a clear
#                           tone after the wake. 5 min.
#   bash stretch.sh one <name> <flags>     one run
#   bash stretch.sh signal start|end|warn|clear
#
# DISPLAY_TEST_DIR names the clips/ subdirectory (default display-test). Each
# run's console output goes to the system temp directory.
here="$(cd "$(dirname "$0")" && pwd)"
cd "$here" || exit 1
dir="${DISPLAY_TEST_DIR:-display-test}"
logs="${TEMP:-/tmp}/display-test"
mkdir -p "$logs"
signal() { printf 'beep %s\nquit\n' "$1" | powershell.exe -NoProfile -ExecutionPolicy Bypass -File win32-helper.ps1 > /dev/null; }
run() {
  echo "=== $1 $(date '+%H:%M:%S')"
  node display-test.mjs --dir="$dir" --name="$1" "${@:2}" > "$logs/$1.out" 2>&1
  echo "    exit $? $(date '+%H:%M:%S')"
  sleep 8
}
case "$1" in
  tones)
    signal start; sleep 1.5; signal warn; sleep 1.5; signal clear; sleep 1.5; signal end ;;
  away)
    signal start
    sleep 60
    run away-control --switch=no
    run away-quiet-1 --off-at=25.5
    run away-quiet-2 --off-at=25.5
    run away-load-control --switch=no --load=decode:8
    run away-load-1 --off-at=25.5 --load=decode:8
    run away-load-2 --off-at=25.5 --load=decode:8
    run away-lock --lock=40
    signal end; sleep 20; signal end; sleep 20; signal end
    echo "=== done $(date '+%H:%M:%S')" ;;
  desk)
    run desk-control --switch=no
    run desk-all --off=all --off-at=25.5 --warn=6
    run desk-one --off=one --off-at=25.5 --warn=6
    echo "=== done $(date '+%H:%M:%S')" ;;
  one) run "${@:2}" ;;
  signal) signal "$2" ;;
  *) echo "usage: stretch.sh tones | away | desk | one <name> <flags> | signal <name>"; exit 1 ;;
esac
