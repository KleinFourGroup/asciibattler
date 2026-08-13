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
- **A new consumer of an old seam walks the seam's untested branch.**
  The 75j2 pull re-author made the ENEMY team issue ordered engages on
  neutrals — a path only the player had exercised — and immediately
  surfaced a latent freeze (ordered engage behind destructible rubble
  never reaches the auto-break fallback; the 75k fix). The player arm
  had the same hole for two phases; nobody's play happened to walk it.
  Candidate promotion: when a change ADDS A CONSUMER to an existing
  capability (vs adding a capability), the test sweep should cover the
  capability's edge branches under the NEW consumer, not just the new
  consumer's happy path.

## §77d2/d3 (2026-08-12) — stream-break fallout triage: prefer derivation/self-healing over fresh literals

Three fallout classes at the keyed-derivation remap, three repair shapes, ranked by durability: (1) the seven Run.test pool pins were repaired BY DERIVATION (read the selected encounter's authored healthPool from the catalog) — the next stream break can't stale them at all; (2) the arbitration dock fixture was hardened from a scan-for-dock to a scan-for-dock-WITH-FUNDS — self-healing, its real requirement made explicit; (3) only the port canary took a new pinned literal (3→2), and it's the one artifact whose ritual comment already documents per-break re-pinning as its contract. Pattern for the sweep: when a stream break trips a test, ask "what does this test actually require?" before re-pinning — most 'seed pins' are lazy proxies for a derivable condition, and each one converted to derivation permanently shrinks the next break's bill (this break: 11 failures; the class it leaves behind: 1 ritual canary + 4 version pins).

## §77e–77g (2026-08-13) — three observations from the braid round

- **Gate-first TDD on statistical mechanisms works.** The n=500 corpus
  gate was written BEFORE the mechanisms it checks were finished; its
  first three runs each caught a real design gap (width-sawtooth d2
  forcing, a cancelled early-bias weight, cone-blind elites) that
  invariant tests structurally couldn't see, and each red row converted
  to a mechanism fix in the same session (`a019b81`). The pattern
  generalizes: when a signed sheet exists, make it executable FIRST
  and let the generator earn green.
- **Default-seed sampling bias is real: seed 1 was the single worst
  drifter in 500.** The viz opens on seed 1; the user's "I see a bias"
  spot check was seeded by the most extreme map the corpus can produce.
  When an eyeball impression contradicts an instrument, check what the
  default view happened to show before either is trusted (77e2b — the
  instrument settled it: ensemble clean, per-map drift real).
- **The mid-phase counter-design was the round's best call.** The user
  replaced my incremental 77e plan with the braid model at the design
  round; taking the overhaul (rather than defending sunk planning) cost
  one bigger step and bought a generator whose primitives STATE the
  signed guarantees. Design rounds exist to be lost; the timing
  argument (the re-baseline was already being paid) is reusable for
  future "replace vs patch" calls.
