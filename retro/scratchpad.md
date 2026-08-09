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
run, at the 72f round close — promoted: the confirm-the-deficit and
twice-bitten-class-audit norms + the tsx-wedge note to AGENTS; the
baseline-batch, horizon-blindness, probe-shape, human-overperformance, and
dose-bracket rules to BALANCE §Caveats; the box-batch poll ceiling to TODO) →
[archive/retro-scratchpad-rollout-arbitration.md](../archive/retro-scratchpad-rollout-arbitration.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

- **A new serialized RNG stream = an automatic seed re-baseline — the cut
  line must predict it.** The 74b cut promised "fuzz byte-identical through
  74a–74d" by reasoning about event-node REACHABILITY; the `eventRng`
  construction fork shifted every downstream parent fork (the documented
  H5/L1/48b/50d append cost) and three seed-sensitive tests broke. The
  union-bump prediction rule (48b/49c) has an exact sibling here: a cut
  line that adds a serialized stream predicts the seed re-roll. Candidate
  AGENTS promotion at the round sweep. (`32c1726`, worklog §74b.)
- **Non-vacuousness canaries should SCAN, not pin.** The two-act-walk test
  pinned seed 11 on "an overpowered roster clears act 1 essentially
  certainly" — probing showed ~40% of seeds clear even at level 15 (boss
  pool-bleed is roster-strength-independent). Rewritten to scan for the
  first clearing seed (`openEventAtSeedScan` in Run.test is the same
  shape) — the §61 stream-break lesson ("only non-vacuousness canaries
  re-scan") upgraded to self-healing-by-construction. (`32c1726`.)
- **Bash-tool commit messages: `\$` inside double quotes emits a literal
  `$`, silently replacing an intended `§`.** The 74e commit body says
  "worklog $74e" for this reason (`bec98dd`) — the AGENTS multi-line-`-m`
  note's sibling papercut. Either write `§` directly in a single-quoted
  `-m` or accept ASCII. Cosmetic-only, caught by reading the landed
  message back (the verify-before-claiming reflex paying off small).
- **A ~0.4%-tail seed CAN be the first one you load — sweep before
  diagnosing.** Post-74e browser verify: seed 42 (the literal first
  manual check) was the ONE zero-event map in a 50-seed sweep (mean 3.74
  events/map). The confirm-the-deficit norm held: one in-browser 50-seed
  sweep separated "rare tail" from "broken live path" in a minute,
  before any mechanism story got authored. (`bec98dd`.)

## §75 build stretch (75d→75h2, 2026-08-08/09)

- The render-step browser gate EARNED it again: the headless 75e tests
  proved currentTarget directly and structurally couldn't see that
  clearResolvedObjectives reverted a camp engage order the same tick it
  landed — only driving the real objective path in the browser exposed
  it. Pattern: when a feature's sim half is proven via direct function
  calls, the WIRING path (commands → drains → scans) still deserves one
  live drive before the phase's render step signs off.
- The native-eyeball recipe left a temp edit in the user's tree; the
  layout formatter's verbatim pin caught it as a red suite one session
  later. Lesson: any "temp-edit config for verification" recipe should
  END with the revert as an explicit numbered step, and a fresh session
  should `git status` before diagnosing a red formatter pin (the pin
  failing IS the tell that a scratch config edit survived).
- Two user-feedback micro-steps (75h2 prime) rode the same-day loop
  cheaply because the drip drain had ONE body to parameterize — the
  extract-the-shared-body habit pays off at feedback time, not just at
  build time.
