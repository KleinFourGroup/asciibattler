# WORKLOG — The Micro Round (Phases 53→57)

The per-round narrative log (AGENTS.md "The planning stack"): findings,
decision rationale, rejected alternatives, scope changes, and playtest
verdicts land here under the matching `## Phase N`; the ROADMAP stays a
plan (one-line mutations + a pointer back here). Created fresh at the
2026-07-11 kickoff; archives as a pair with [ROADMAP.md](ROADMAP.md) →
`archive/post-52-*` at the next round's kickoff. Prior round:
[archive/post-46-worklog.md](archive/post-46-worklog.md) (Cluster 3 —
Economy, 47→52).

Write-mostly: sessions orient from the HANDOFF 🧭 Cursor + ROADMAP and open
this file to APPEND or to investigate.

---

## Kickoff (2026-07-11)

The round opened per the planning-stack protocol, spec first:

- **Spec** ([micro-round-spec.md](micro-round-spec.md), `d79c2d1`) —
  distilled from the §52 three-act kickoff narrative
  ([post-46-worklog](archive/post-46-worklog.md) §52) + BALANCE §52; user
  shape-locked same day with no vetoes. The three ⚠ OPEN items were left
  open DELIBERATELY, each pinned to the phase kickoff that owns it: the
  gauntlet cell list → §53, script ↔ objective-model integration +
  arbitration → §54, the Rung-2 gate threshold → §55 (set from §54's
  numbers, not before).
- **Archive ritual** executed per the amended line (the §52b user catch):
  the Cluster-3 pair + spec → [post-46-roadmap](archive/post-46-roadmap.md)
  + [post-46-worklog](archive/post-46-worklog.md) +
  [cluster-3-spec](archive/cluster-3-spec.md).
- **Roadmap authored** — phases 53→57 map the locked rung ladder directly:
  Rung 0 (recorder + gauntlet, the instrument) → Rung 1 (the five traffic
  scripts) → Rung 2 (gated portfolio search) → the expressive economy
  vector → the REAL balance pass. The sequencing follows the 42→46
  audit-round shape (instrument before fix) and applies §52's own
  dead-compute rationale forward: no `--search` regen until the bot
  stabilizes.
- **Kickoff-precedent note:** the Cluster-3 open (`90aa51c` → `4fef643`)
  established that the archive renames and the new ROADMAP/WORKLOG must
  land in ONE commit — tests/docs.test.ts requires both files to exist
  (and the roadmap to parse ≥1 phase section) at every commit boundary.
  Followed here.
- **Scratchpad sweep** (the boundary distillation ritual, second run) —
  done 2026-07-11, immediately after the open-round commit. Promoted to
  AGENTS: the worktree-pinned before/after diff oracle, the AskUserQuestion
  same-turn-text note, the spec-vs-code audit, the serialized-union bump
  prediction, the deferral landing-note norm. Promoted to TESTING: the
  Game-layer wiring disciplines (`satisfies never`; no `this.run` handlers
  during run construction). Fixed in code: the pre-commit fuzz-trigger
  regex now covers `src/config/` (`7eba39e` — the 50f gap). Everything
  else archived verbatim →
  [archive/retro-scratchpad-cluster-3.md](archive/retro-scratchpad-cluster-3.md).

## Phase 53 — Rung 0: the recorder + the gauntlet

### Kickoff code-reality audit (2026-07-12)

Two parallel read-only survey sweeps (input/dev surfaces; battle
reproduction + content). The headline: **the phase is smaller and
better-seated than the spec's language implied.** Findings:

- **The player's entire live-battle input surface is objective-setting.**
  One UI class ([ObjectiveController.ts](src/ui/ObjectiveController.ts))
  translates clicks/keys into `setObjective`/`clearObjective`
  `WorldCommand`s via `world.enqueueCommand` — nothing else the player
  does mid-battle touches sim state (playback speed/pause scale the
  render clock only; sim outcome is speed-invariant). So the "tick-stamped
  command log" = the objective-command stream, nothing more. Commands
  apply at the deterministic top-of-tick drain
  ([World.ts:730](src/sim/World.ts), J1), and
  [objective.test.ts](src/sim/objective.test.ts) already proves same seed
  + same command stream → byte-identical battle. **The determinism
  doctrine really is the recorder's whole substrate.**
- **⚠ The drain-while-parked wrinkle:** during the pre-battle countdown or
  a pause, `BattleScene.tick` drains commands IMMEDIATELY off-tick
  ([BattleScene.ts:282](src/scenes/BattleScene.ts); rationale World.ts
  ~720 — safe because no unit acts while parked). Orders issued during the
  countdown are the COMMON case, not an edge case. Consequence: the trace
  must stamp commands at the moment they're *applied* (the drain), not
  enqueued — then a replay that injects each command just before its
  stamped tick's drain reproduces parked-issue semantics for free.
- **`BattleEncounter` ([Run.ts:180](src/run/Run.ts)) is already the
  self-contained battle fixture.** `{worldSeed, terrainSeed, layoutId,
  gridW/H, theme, playerTeam, enemyTeam, battleRules}` reconstructs a
  byte-identical battle with zero live-Run references — the fuzz harness
  and every per-archetype test build worlds from exactly this via
  `spawnEncounter`. A trace = configHash + BattleEncounter + stamped
  command list + outcome. A gauntlet cell = a pinned way to produce one.
- **Human ≈ bot at the same seam.** The bot's J4 proclivity draw
  ([objectiveStrategy.ts](tests/fuzz/objectiveStrategy.ts)) enqueues the
  same `setObjective` commands from a per-battle stream forked off
  `worldSeed`; `--objective=none` is byte-identical to a click-less human.
  Paired-seed comparison needs no new machinery at the sim seam.
- **Browser-launch gap (the one real plumb):** `forcedEncounterId` is
  programmatic-only — no `?encounter=` URL form
  ([RunConfig.ts:62](src/run/RunConfig.ts)) — and forcing an encounter
  does NOT pin its layout (the roll survives,
  [selection.ts:179](src/run/selection.ts)). A 1-hop run with
  `?seed&layout&roster&daemon` is the closest existing "play exactly this
  battle." Adding `?encounter=` closes the gap and makes every gauntlet
  cell a shareable URL that BOTH the human (browser) and the bot
  (headless `runOne`, same RunConfig) consume — the paired-seed symmetry
  falls out of the existing config round-trip.
- **All three named killer cells exist as real content, two by literal
  name:** `artillery` ("Artillery Company", catapult waves) ×
  `strafingFunnel`; `ronin-vs-mages` × `strafingFunnel`/`spiralFireLife`
  (adjacent `both`-availability spawn regions = the alpha-strike
  geometry); `junctionAmbush` (player-surrounded) × an elite
  (`brigand-champions`). 13 encounters / 11 named layouts total; none of
  the three carries a fit-filter, so any pairing is legal.
- **Config identity is net-new:** no hash/fingerprint exists anywhere; no
  aggregate config object (~26 independent zod-loaded consts) — the
  recorder hashes the raw `config/*.json` sources.
- **Dev-key precedents:** NO dev keybinding exists, and the keybindings
  zod schema requires every action present in the shipped JSON — so dev
  keys must NOT enter the registry; the pattern to copy is the
  `import.meta.env.DEV` block in [main.ts:28](src/main.ts) (a separate
  window listener). `Run.fromJSON`'s doc-comment already anticipates a
  "fresh bus for replay-trace comparison" caller — zero callers exist;
  both the export/load key and the replay path are its first consumers.
- **Stale-doc flag → false positive:** the survey flagged ARCHITECTURE's
  "RUN_SCHEMA_VERSION 16" (line ~162), but the tree annotation is a
  deliberate historical trail ending "Live version: HANDOFF 🧭" — correct
  per one-fact-one-home; no fix needed.

**Snapshot-bump predictions (the cut rule):** none expected anywhere in
this phase — the recorder/replay/gauntlet are DEV+harness surfaces; the
`command:applied` seam is a new bus EVENT (not serialized state);
`?encounter=` reuses the existing programmatic `forcedEncounterId`.
Step-zero must verify RunSnapshot doesn't embed RunConfig before trusting
the 53d line.

### 53b — the recorder (2026-07-12)

New `src/dev/` home (first entry in the tree): `TraceRecorder` (passive bus
subscriber, storage-agnostic via `onTrace`) + `configHash` + the
`traceStore` localStorage ring. Build findings beyond the audit:

- **`battle:started` grew the full `BattleEncounter`** — the payload only
  carried `worldSeed`; the fixture the trace needs was otherwise
  unreachable by a passive subscriber. Additive, Run-only emitter, no
  sim/run reader → no baseline impact. (`Run.beginTurn` got a local-name
  collision with the U3 `encounter` — the new local is `battleEncounter`.)
- **`configHash` uses plain JSON imports, NOT `import.meta.glob`** — the
  fuzz/gauntlet CLIs run under **tsx**, where Vite-only APIs don't exist.
  The hand-maintained 30-file registry is backstopped by a drift-guard
  test that walks `config/` (`readdirSync` ↔ registry keys, both ways).
- **Recorder lifecycle rules:** a second `battle:started` while a trace is
  open DISCARDS the open one (an abandoned battle has no outcome); a
  `battle:ended` with no open trace is ignored (Run.test emits synthetic
  ends). Encounter deep-copied at start (`structuredClone`) so the Run
  moving on can't mutate a recorded trace.
- **Deferral landing notes:** the export/download KEY rides 53f's dev-key
  listener (console surface today: `__game.dumpTraces()` /
  `clearTraces()`); trace VALIDATION (version + configHash check) lands at
  53c's replay entry, not the recorder.

### 53c — the replay + the stamp amendment (2026-07-12)

**The step-zero audit caught 53a's stamp being replay-ambiguous.** A
mid-battle PARKED drain stamped the frozen tick N — but tick N's units had
already acted without the command; its first observable tick is N+1. A
normal in-tick drain's stamp N IS observed at N. Same stamp, two required
injection points — a replay couldn't distinguish them. **Fix: stamp the
EFFECTIVE tick** (the first tick whose unit actions can observe the
command): in-tick drain → `tickCount`, parked drain → `tickCount + 1`
(`World.drain(effectiveTick)`, both entry points delegate). One uniform
replay rule falls out: inject everything stamped E before tick E. The
countdown case lands at stamp 1 naturally. 53a's tests + docs amended in
place.

**`replayTrace` (src/dev/replayTrace.ts):** strict refusal on version or
configHash mismatch (a silently-diverging replay poisons paired-seed
comparisons); reconstruction ≡ both production construction sites (the
audit verified BattleScene ≡ `spawnEncounter`: same `applyTerrain` →
`setupRngFor` → `pickSpawnRegions` → `spawnTeam`×2 off one fork — the
interleaved render calls touch no RNG); the drive loop mirrors
BattleScene's clock body verbatim (resolveAsDraw at the N2 cap), so
draw-at-cap traces replay as draws; leftover stamped commands after the
battle ends throw (a divergence tell).

**The fidelity keystone test** drives a live battle through all three real
input timings (countdown-parked → stamp 1 · between-ticks → stamp 10 ·
mid-battle-pause-parked → stamp 26) and asserts the replay reproduces the
winner, the tick count, the sim-event stream, and the byte-identical final
`world.toJSON()` (RNG state included). **One deliberate scope note:** the
bare `tick` markers are excluded from the event comparison — a live parked
drain emits its command markers BETWEEN tick markers, the replay emits
them just after tick E's marker; pure bus interleaving, zero
unit-observable effect, and the world-state oracle pins the rest
byte-exactly. First divergence caught by the test during development was
exactly this artifact — the oracle works.

### 53d — the `?encounter=` param (2026-07-12)

A small plumb, exactly as audited: the Run-side `forcedEncounterId` (X2)
already existed — only the URL form was missing. `parseEncounter` validates
against the live `ENCOUNTER_IDS` catalog, CASE-SENSITIVE (the catalog mixes
kebab and camelCase ids — `parseLayout`'s drop-don't-throw discipline
otherwise); `runConfigToQueryString` round-trips it; the CLI accepted the
flag for free (it iterates `RUN_CONFIG_PARAMS`) and gained a help line; the
launcher GUI grew an encounter select with kind-labeled options ("(elite)"/
"(boss)" — a forced encounter only fires on kind-matching nodes). Step-zero
prediction held: RunConfig is never persisted (its own header says so), no
snapshot bump. Browser-verified end-to-end:
`?seed=777&hops=2&layout=strafingFunnel&encounter=artillery` launches
"Artillery Company on Strafing Funnel" — gauntlet cell #3 as a shareable
URL, and the same RunConfig drives the headless CLI (`--encounter=`), which
is the paired-seed symmetry 53e builds on.

### 53e — the gauntlet (2026-07-12)

`tests/gauntlet/`: the shape-locked 10-cell catalog as code
([cells.ts](tests/gauntlet/cells.ts) — cell = encounter × layout × 3 fixed
seeds, launched as a minimal run with `daemon=none` so the human's and the
bot's turn-1 BattleEncounter are identical), the opt-in `npm run gauntlet`
CLI (cells × seeds × objective arms, reusing `parseObjectiveFlag` + the
strategy registry + `runOne` — `BattleResult.encounterId` from X2 made
outcome extraction free), and a main-suite integrity test (ids/kinds/
layouts/seeds + one live 1-hop drive). `--urls` prints the 53g session's
30 launch URLs; `--csv` writes the raw rows.

Build findings:

- **A 3-hop map can NEVER host an elite** — the scatter's min-spacing
  excludes it structurally; a 401–460 seed scan found 0 hits at hops=3,
  8 at hops=4. The elite cell re-shaped to `hops: 4` with scan-verified
  seeds (407/409/416); the driver's loud bad-seed warning (`n/a` +
  a ⚠ list) is the regression guard. **The boss cell's known impurity**
  (a pool-rolled root battle precedes the forced boss) is documented in
  the cells header — both sides share it.
- **Cell-clearing saturates at fresh-team strength**: the bot clears every
  normal cell 3/3 on both arms. Not a surprise in hindsight — the §52
  killers were reported from MID-RUN contexts (worn rosters, real pools);
  a hops=2 cell starts fresh. The discriminating metrics are deaths /
  draws / ticks + the elite and boss cells (boss: none 2/3 vs random 0/3 —
  the only arm gradient). The 53g paired read is per-cell deltas on the
  SAME seeds, so the comparison stands within this context — the caveat is
  pinned in BALANCE §53e. If Rung 1's re-measure needs a harder context,
  a roster/level knob on the cells is the natural extension (the cells
  file already carries the RunConfig seam).

### 53e.2 — the standard roster + the pool-damage metric (2026-07-12)

The saturation finding went to the user with three options (difficulty
multiplier · simulate the mid-run starting state · pool damage taken as the
metric); the call: **(b)+(c), skip (a)** — the multiplier is a second
invented anchor (§52's lesson), while the roster route uses the game's own
relative scaling. The STANDARD ROSTER derives from the user's real habit
(~no recruiting ⇒ the default 6-melee+4-ranged comp, leveled to their
reported 7–8 band + one 9). User tweak on record: <50% of real runs carry a
recruited healer/shaman (rogues on Laverna runs) — majority-shape stands;
**real comp frequencies come from recorded FULL runs later in the round.**
Pool damage taken rides the existing telemetry pool chips (whose own doc
calls the enemy chip "the X balance metric") — `telemetry: true` in the
driver, one filtered sum. `--fresh` keeps the superseded context reachable.

**The result (BALANCE §53e.2): the gradient is back and it points at the
§52 killers** — alpha-funnel ~12 / elite up to 16.3 (1/3 cleared) / boss
~22 (0/3) vs the traffic cells at 0–4. One surprise for §57:
artillery-funnel collapses to ~0.2 at leveled strength (a fresh-team-only
threat, maybe). The cell URLs auto-carry `roster=`, so the 53g human
session plays the identical context.

### Shape-lock (2026-07-12)

User approved the full proposal, no vetoes. Locked: stamp-at-apply via
the new `command:applied` event; recorder persistence = a localStorage
ring buffer (last ~40 battles) + an export-all dev key (no per-battle
save friction); the gauntlet driver = an opt-in fuzz-CLI sibling
(`npm run gauntlet` — a vitest suite would bloat `npm test` by ~30
battles × arms). The cut: ROADMAP §53.

**The locked gauntlet cell list** (× 3 seeds each ≈ 30 battles ≈ the
1-hour human budget; all ids verified against config at the audit):

| # | Cell | Why |
|---|---|---|
| 1 | `ronin-vs-mages` × `strafingFunnel` | Named killer: adjacent-spawn alpha strike |
| 2 | `ronin-vs-mages` × `spiralFireLife` | The adjacent-spiral spawn variant |
| 3 | `artillery` × `strafingFunnel` | Named killer: "Artillery Company on Strafing Funnel" |
| 4 | `brigand-champions` × `junctionAmbush` | Named killer: junction ambush vs heavies (elite) |
| 5 | `brigands` × `endlessCorridors` | Traffic: unjam (mixed melee+ranged in corridors) |
| 6 | `elementalTrio` × `spiralFireLife` | Traffic: terrain-edge hold (burning spiral) |
| 7 | `highwaymen` × `isthmus` | Traffic: choke hold (all-melee on the land bridge) |
| 8 | `adventurer-with-guards` × `spiralFireLife` | Traffic: attrition stall (opposite-spawn burn cheese) |
| 9 | `elementalTrio` × `river` | Traffic: cohesion focus (assassinate the catapult) |
| 10 | `bandit-king` × `desertFortress` | The boss cell (boss-wall relevance, stages grammar) |
| 11† | `brigands` × `labyrinth` | Traffic: unjam, maze variant (53g-pre amendment — see §53g-pre below) |

### 53f — the dev export/load key (2026-07-12)

Shape-locked in conversation, no vetoes: `Ctrl+Alt+S` export /
`Ctrl+Alt+L` load in a new [devKeys.ts](src/dev/devKeys.ts) window
listener (the main.ts DEV-block pattern), backed by public
`Game.devExportRun()`/`devLoadRun(snap)` so the swap-ordering discipline
lives beside `resetRun` instead of in private-cast glue. **Load is
map-phase only** — the user probed the deferral cost explicitly and
agreed it's ~zero: the hard half (gate-save serialization semantics) is
already round-trip-tested in Run, and the deferred half's natural
mechanism is a Run-side "re-emit the gate event from current state"
that reuses the live `turn:starting` builder (Run.ts ~1420) — building
Game-side payload reconstruction now would just create a parallel path
to keep in sync through Clusters 4–5. **Deferral landing note (Cluster 6
menu-grade save/load):** remount-from-cold-state should land as a Run
method that re-emits the current phase's gate event from its own fields
— never a second Game-side payload builder; the seam comment on
`devLoadRun` points here.

Two build findings:

- **The bare-code chord collision:** `Keybindings.handleKeyDown`
  dispatches on raw `KeyboardEvent.code` with no modifier check, so a
  `Ctrl+Alt` chord on any bound code (E/F/H/T, digits, Space) would
  co-fire the battle hotkey. S and L are unbound; the trace-export
  rider's key moves `Ctrl+Alt+T` → **`Ctrl+Alt+D`** (dump) for this
  reason. Pinned as a comment in devKeys.ts for future chord additions.
- **The `pauseAtTurnGates` trap (the audit's catch, confirmed live):**
  `Run.fromJSON` leaves the headless default (`false`) — an unset flag
  silently skips every pre/post-turn screen. `devLoadRun` re-sets it,
  and the browser-verify's last check drove the RESTORED run into an
  encounter to prove the gate pauses (turn-intro + PreTurnScene ✓).

Browser-verified via dev-preview evals: chord fires once (bare S inert;
the doubled console line = the known cosmetic preview duplication),
non-map save hard-rejects with the live run untouched, map save
restores (run swapped · MapScene · bits/team/node byte-equal · gate
flag re-set), restored run plays. **User native check: PASS 2026-07-12**
(download + file picker + round-trip, "worked perfectly").

**Riders (second commit):** `Ctrl+Alt+D` dumps the whole trace ring as
one JSON download (empty ring warns instead of downloading a `[]`), and
`TRACE_RING_CAP` 40→80 — the 53g session is ~30 battles plus retries in
one sitting; a 40-deep ring could evict its own early traces before the
end-of-session export. Console `dumpTraces()`/`clearTraces()` stay.

### 53g — the human baseline session (2026-07-13)

The session ran in three exchanges: a mid-session pipeline check (16
traces — providential, see the eviction incident), the full dump, and a
4-URL top-up. **Every number and finding: BALANCE §53g** (the paired
table; the ~80% self-report retired). Story and method here:

- **Pipeline check first (the user's idea):** a partial export after the
  first cells let ingest prove replay fidelity (16/16) before the hour
  was invested. It also revealed the dump carried 6 pre-session warm-up
  traces (fresh roster, casual play) — the ring persists across page
  loads by design; filtered at ingest by roster level.
- **⚠ The ring-eviction incident:** the session (33+ encounters of
  multi-turn battles + retries + warm-ups) overran `TRACE_RING_CAP` 80 —
  the full dump had silently evicted alpha-funnel entirely, alpha-spiral
  202/203, and artillery 301. Recovered: alpha-funnel lived in the
  mid-session partial; the rest re-played in the top-up. **Protocol for
  future sessions: `clearTraces()` at session start + export
  mid-session.** (The 53f cap bump 40→80 was sized to "~30 battles" —
  the miss was counting encounters, not turns; a battle ≈ 1–6 turns.)
- **Ingest method (scripts in session scratchpad, results in BALANCE):**
  union dumps deduped by worldSeed (newest wins) → join to cell×seed by
  worldSeed against deterministic bot re-runs of `cellRunConfig` → a
  layout+enemy-comp fingerprint fallback for path-diverged runs (the
  human's junction-407 route and boss-1003 differed from the bot's
  draws) → per-turn pool damage via `battle:ended.survivorPower` on
  replay → a pool ledger per encounter (cleared/defeated). En-route
  battles on forced-layout runs (8) excluded from cell reads.
- **104/104 unique turns replay byte-identical.** The union is COMMITTED
  as [tests/gauntlet/fixtures/53g-human-traces.json](tests/gauntlet/fixtures/53g-human-traces.json)
  (315KB, era `e5c8a0fd`) with
  [humanFixture.test.ts](tests/gauntlet/humanFixture.test.ts) keeping
  three representative turns under regression — ERA-BOUND by design: the
  test skip-guards on configHash so §57's balance changes retire the
  fixture instead of blocking the tuning (the 53c keystone keeps the
  mechanism covered continuously). This closes the phase exit criterion
  on real human data.
- **Two fast-close discards** (junction-416's fatal seventh turn; the
  boss-1003 abandonment): the recorder's discard-open-trace rule means
  "wait for the post-turn screen before closing" belongs in the session
  protocol. 416 recorded as DEFEATED at pool damage 20 (user-confirmed
  loss; footnoted in BALANCE).
- **The user's boss report (verbatim input for §57):** "I've never
  actually fought the boss on desert. I don't think it's winnable. The
  mercenary wave is hard enough, but if you make it to the final stage,
  you just die to mage AoE because the sand slows you down enough that
  you can't close to melee range." Measured: 0-for-3, both completed
  attempts full-pool wipes — the boss wall is content, not bot fiction.
- **The spiral spawn scramble (user report):** spawn-region geometry is
  seed-rolled, so the three spiralFireLife cells' why-labels (adjacent
  alpha / edge hold / opposite stall) describe tendencies, not
  guarantees — "it ultimately evened out to good coverage, but treat
  those as scrambled." Watch item in TODO: pin or classify spawn
  geometry if §54's re-measure needs it controlled.
- **The finding that reshapes §54's cut: the gap is localized** (traffic
  cells only; parity on geometry killers and the boss) **and the null
  action is strong** (the passive bot beats the human on labyrinth and
  river — arbitration must be able to choose "do nothing"). Command
  intensity (~10/encounter on corridors/labyrinth/boss vs ~3–5
  elsewhere) maps the user's attention to exactly the script families.

### 53g-pre — the labyrinth cell (2026-07-12)

User catch just before the session: the gauntlet had no labyrinth cell,
and their corridors-vs-labyrinth play uses DISTINCT strategies — exactly
the introspected-edge signal the §54 traffic scripts derive from. Locked
in conversation: **cell 11 `unjam-labyrinth`** = `brigands` × `labyrinth`
(seeds 1101–1103, normal/hops-2) — the corridors cell with ONLY the
layout swapped, a clean layout A/B on the same encounter. The cells
guard test's 10-cell pin re-pinned to 11 (a deliberate amendment — the
baseline discipline). Bot baseline appended to BALANCE §53e.2 (same
protocol, no bad seeds): **the arm split INVERTS vs most cells** —
passive walks the slow maze clean (0.0 pool dmg), random orders bleed
(4.3, 33 deaths, ~70% longer) — labyrinth punishes bad traffic orders
more than passivity. ⚠ doctrine unchanged: labyrinth stays the
intentional slow maze; long bot battles there are signal. The session
grows ~30→~33 battles (ring cap 80 has ample headroom).

## Phase 54 — Rung 1: the five traffic scripts

### Kickoff: the code-reality audit (2026-07-13)

Surfaces surveyed ahead of the design round (script ↔ O1 integration +
arbitration — the spec's big ⚠ OPEN). Findings:

- **The objective model is per-TEAM and single-valued.** `TeamObjective`
  ([src/sim/objective.ts](src/sim/objective.ts)) = `atWill | engage(target)
  | hold | focus(target)`; stored on World as `{player, enemy}`, read via
  the one seam `world.objectiveFor(team)`, mutated ONLY through
  `setObjective`/`clearObjective` commands in the top-of-tick drain, with
  the auto-revert scan landing everything back on the shared `AT_WILL`
  singleton. Last-write-wins; **arbitration has zero precedent in code.**
- **The snapshot stores `TeamObjective` verbatim** (WorldSnapshot v34,
  hard version-equality reject, no migration). Precedent both ways: v23/
  v25/v32 bumped for objective-SHAPE changes; O2 `hold`/O3 `focus` added
  modes with NO new serialized field and did NOT bump (focusTile.ts's own
  header notes it "rides O1's snapshot"). So: scripts that only *emit
  existing commands* = no bump; new modes with payload fields or a
  serialized layer above = bump.
- **⭐ The human baseline is an expressiveness proof.** The 53g session —
  including fire-edge 0.0 and the 93% non-boss clear rate — was played
  entirely through `ObjectiveController`'s existing command vocabulary
  (team-wide engage/focus/hold/clear; 104/104 turns replay from those
  commands alone). The four modes + targets are SUFFICIENT to express the
  human edge, by construction; the recorded traces are per-cell worked
  examples of each script family.
- **The bot seam is proven twice.** Objective driving in the harness is a
  per-option branch in the battle loop (tests/fuzz/harness.ts ~499–513):
  `objective` (J4 proclivities, no-thrash gate = refill only at `atWill`)
  and `coverageObjectives` (O5 churn driver) — mutually exclusive, both
  = byte-identical no-op when unset. A scripts bot slots in as a third
  branch; anchors stay frozen for free. The gauntlet CLI's `--arms`
  vocabulary is proclivity-only today and needs a scripts-arm resolution
  path (mirrors the harness split it doesn't yet expose).
- **The enemy team's objective plumbing is real but inert** (only the O5
  coverage driver ever exercises it) — a per-team script driver gets
  symmetric machinery for free, but nothing depends on it.
- **Sensor gaps (spec-vs-code mismatches):** (1) `fire` tiles carry NO
  damage field — hazard damage is burn-status-mediated (`statusOnEnter`
  + `applyTileStatuses`), so "terrain-edge hold" reads status-application
  tiles, not a damage number; (2) NO runtime chokepoint query —
  layoutConnectivity is setup-time classification; (3) NO standing
  jam/congestion state on World — the jam signal exists only as the
  transient `unit:moveDecision` event stream (`queue`/`pinned`/`boxed`);
  a script must aggregate or derive (vacancy ETAs/claims in occupancy.ts
  are derived-never-serialized, per doctrine); (4) no `objective:changed`
  event — only `objective:set`/`objective:cleared`.
- **The 53g reshape stands as design input:** gap localized to traffic
  cells; the null action beats the human on labyrinth/river — "do
  nothing" must be a first-class arbitration arm with a threshold to
  beat, not a fallback; command intensity (~10/enc on the traffic cells)
  maps where scripts should be willing to act.

Design forks + the shape-lock proposal → presented in conversation;
resolutions land here next entry.

### The design round — ✅ ALL FOUR FORKS LOCKED (user, 2026-07-13)

1. **Integration = a layer ABOVE the objective model.** Scripts are a
   bot-side driver emitting the existing four modes through the existing
   command channel — the same vocabulary the 53g human session proved
   sufficient (the expressiveness proof, audit above). No new objective
   kinds; no Targeting/Movement branches; **no snapshot bump — v34
   holds** (the O2/O3 no-new-field precedent).
2. **Arbitration = dumb-deterministic at §54.** Per-script trigger
   predicate + proposed command; fixed priority order breaks
   simultaneous triggers (straw order at lock: terrain-edge hold ›
   unjam › choke hold › cohesion focus › attrition stall — safety
   first, opportunism last); **the null action is the arm to beat**
   (explicit trigger threshold, else emit nothing — the 53g
   labyrinth/river finding); a min-dwell no-thrash gate (the J4
   atWill-refill precedent). Rationale for NOT scoring here: §55's
   portfolio rollout search IS the principled scorer, gated on exactly
   this phase's residual — a clean residual from priority+thresholds is
   the best possible gate input.
3. **Sensors = pure functions of world STATE, never event history.**
   §55 rollouts evaluate on cloned snapshots, so any sensor needing the
   `unit:moveDecision` stream would be un-rollout-able. Derived reads
   only (claims/`vacancyEtaOf`, tile `statusOnEnter`, `survivorPower`,
   positions); choke cells from per-battle setup-time layout analysis;
   derive-don't-cache; nothing serialized.
4. **Scripts live in `src/bot/`** (new; sim-pure imports only; nothing
   shipped calls it) — `src` never imports from `tests`, and §55 (and a
   possible future enemy-team consumer) sit on the src side.

Trigger conditions per script: derived from the 53g traces (state at
the human's command times), not invented a priori — a dedicated
trace-mining step in the cut.

### 54a — the driver skeleton + the harness arm (2026-07-13)

Built per the locked shape. `src/bot/TrafficScriptDriver.ts`: the
`TrafficScript` interface (trigger + proposal fused — `evaluate` returns
non-null only past the script's own threshold), the empty priority-ordered
`TRAFFIC_SCRIPTS` registry, and the driver — fixed-priority first-match
arbitration, `MIN_DWELL_TICKS` no-thrash (2s PROVISIONAL, 54c calibrates),
null-action release, and an ownership rule that emerged during build: the
driver only ever clears an order IT issued (`standingScriptId`), so a
foreign `setObjective` (the UI path, a future second driver) is never
clobbered by the null action. Idempotent adoption outranks the dwell gate
(nothing emitted → nothing to thrash). NO RNG anywhere — the eslint
Math.random ban now covers `src/bot/` too.

Harness: `trafficScripts?: boolean | readonly TrafficScript[]` — `true` =
the standard registry, an array = a custom registry (the test seam that
let 54a prove LIVENESS with a stub instead of waiting for 54d to expose a
dead branch). Mutual exclusion with `objective`/`coverageObjectives` is
ENFORCED with a throw (not just CLI convention): an anchor arm silently
layered with scripts would unfreeze the comparison floor.

Tests: 9 co-located driver tests (real 20×20 World, both command paths
drained for real) + 5 harness tests (no-op parity ×2, determinism,
liveness-via-stub, the exclusion throw). fuzz:smoke 220/220 (215+5).
As predicted: NO snapshot bump, no baseline/drift change.

The build story: a 45-min hang — an unbounded `while (currentTick < N)`
test loop over a world whose battle had ENDED (`tick()` no-ops when
ended, freezing the counter; killing the crafted world's only enemy ended
it). Rules adopted + the fuzz-config discovery (tests/fuzz runs ONLY
under `vitest.fuzz.config.ts`; the pre-commit fuzz trigger doesn't fire
for `src/bot/`/`tests/fuzz/` — manual fuzz:smoke on harness-touching
commits): retro/scratchpad.md §54a.

### 54b — the sensors (2026-07-13)

`src/bot/sensors.ts` — the five reads, all pure functions of world state
(the fork-3 lock), each with crafted-world tests (19). Findings + the
deviations from the cut's assumptions, in build order:

- **The jam sensor's flagged unknown resolved WITHOUT the fallback.** The
  local read — idle + out of acting range + ≥1 passable progress cell
  (8-way, strictly Chebyshev-closer to the nearest enemy) + every progress
  cell occupied/claimed with no free cell, ≥1 blocker a TEAMMATE, and no
  teammate blocker vacating within `JAM_VACANCY_WINDOW_SECONDS` (0.5s
  provisional) — composes cleanly from `unitAt`/`claimantOf`/
  `vacancyEtaOf`. Approximations on record in the doc comment: one-step
  locality (corner jams register only when the column stalls) and
  canonical-corner positions for N×N units. Whether it fires where the
  human clicked is 54c's question, as planned.
- **Hazard = a MIRROR of two sim apply sites**, not a tile-def read alone:
  `fire` is a hardcoded ungated sustain (`World.applyTileStatuses`),
  `statusOnEnter` (mud→poison) is gated by `TILES_CONFIG.
  applyStatusOnEnter`, `healing`/rejuvenate is beneficial (periodic op
  kind `heal` ≠ hazard), impassable kinds are walls-not-hazards. Lockstep
  comment at the sensor; the mud test derives its expectation from the
  config flag (balance-proof style).
- **⚠ Walls are neutral-team UNITS, not tiles** — there is no `'wall'`
  TileKind (three first-draft tests died on `TILE_DEFS['wall']` =
  undefined). Consequence for choke: a terrain-only articulation scan
  would read every walled corridor map as an OPEN FIELD. `chokeCells`
  folds living neutral bodies (walls / half-cover / rubble, via
  `cellsOccupiedBy`) into the passability mask; mobile combatants stay
  out (bodies move; choke is the arena's shape); rubble death re-opens
  cells on the next call (derive-don't-cache). Both representations
  tested (chasm tiles + `spawnWall` units). The jam sensor was already
  correct on unit-walls for free (a neutral blocker is not a teammate).
- **`World.survivorPower` is PRIVATE** — `attritionRead` re-derives the
  formula (Σ `effectiveStats.power`, living units) with a lockstep
  comment; DoT counts def-resolve `effects[].key` and count only
  damage-kind periodics.
- **"Reuse `scored`" was impossible by import direction** (it lives in
  tests/fuzz — an anchor arm; src never imports tests). Deliberate call:
  `focusTargetFeatures` exposes RAW per-enemy features (archetype /
  hpFraction / power / attackRange / distToNearestOwn) and the WEIGHTS
  stay 54g's job, set from 54c's table. The frozen proclivity keeps its
  own model untouched — better for the anchor than sharing code anyway.

### 54c — trace mining (2026-07-13)

Built `npm run trace-mine` (tests/gauntlet/traceMine.ts) + the one enabling
change: `replayTrace` grew an optional OBSERVATION-ONLY `beforeTick` hook
(fires on the pre-tick state — exactly what the live player saw when
issuing that tick's commands; a mutating hook voids the fidelity contract
by construction; covered by a 6th fidelity test). The miner: era-guard →
worldSeed-anchor join (33 bot re-runs, the 53g ingest method reproduced;
layout+enemy-multiset fallback for the path-diverged tail) → replay all
joined traces sampling the 54b sensors every tick → per-cell
background-vs-at-command contrast table + a 197-row CSV. Joined 76/104;
17 off-target + 11 stray/diverged excluded LOUDLY (no silent drops).

Results → **BALANCE §54c** (the trigger-threshold table). The three
findings that reshape the script steps:
1. **engage:tile is the human's workhorse (~55%)** — scripts steer by
   rally tiles; `hold` is nearly unused (3/197). 54d–54h proposals
   should emit tile-engages, not holds.
2. **The corridors human plays PREVENTIVELY** — zero jam lift on
   unjam-corridors (0.13→0.13) while every other jam cell shows 1.7–3×;
   54e's reactive trigger calibrates on jamFraction ≥ ~0.2 and accepts
   under-firing on corridors v1 (the preventive re-sort is a possible
   54e stretch, decided there).
3. **⚠ chokeCells reads ZERO on the isthmus** — the land bridge is
   ≥2 wide; articulation points only catch 1-wide chokes (labyrinth
   reads fine). 54f opens with a width-tolerant choke read decision
   (min-cut / bottleneck generalization) — flagged in BALANCE, not
   silently absorbed.

Also on record: fire cells show hazardApproach as a STANDING ~3.9
condition (54d's value is the edge-tile proposal, not trigger timing);
the stall cheese is measurable (enemyDot ≈ 2 while powerΔ ≥ 0); boss
commands cluster at powerΔ −8 (content, again).

### 54d — terrain-edge hold (2026-07-13)

The first registered script (priority #1). Trigger: `unitsApproachingHazard`
≥ 2 (54c: the fire cells' standing ~3.9 read; provisional). Proposal:
`engage` on the computed EDGE TILE — passable non-hazard hazard-neighbor,
STRICTLY our side by Chebyshev (a ties-to-us side test leaked through
diagonal corners: a far-side corner tied our distance then won on enemy
proximity — caught by the wall-geometry test, fixed to strict), closest to
the enemy, then closest to our approaching units, then row-major.
`engage`-not-`hold` per 54c (the human's 15/18 tile-rallies; engage keeps
units fighting whatever crosses). Known v1 limits on record in the doc
comment: Chebyshev (not path) side test; A* prices fire at 1 so a route TO
a safe rally can cross fire in convoluted geometry — sim pathing stays
untouched (scope guard).

Registry live → **the 54a parity contract re-pinned (deliberate test
amendment):** absent/false/explicit-`[]` remain byte-identical; the `true`
arm is the live bot (determinism-pinned). 35 bot tests + 5 harness green.

**Spot-check (3 seeds/cell, greedy, vs §53e.2 — full re-measure at 54i):**
`none` rows REPRODUCE §53e.2 exactly (method validity). fire-edge
**10.7 → 5.7** pool, 2/3 → 3/3 cleared, 80 → 57 deaths, ~20% faster;
alpha-spiral **8.7 → 6.7** (deaths 43→26); stall-spiral **4.0 → 0.0**
(human: 0.7 — edge-holding at the fire IS most of the burn cheese);
unjam-corridors **byte-identical** (no hazards → the script never fires —
the null-discipline proof on non-fire maps).

### 54e — unjam (2026-07-13)

Priority #2. Trigger: `jamFraction ≥ 0.2` (54c: the human's command levels
0.25–0.29 on the jam-forming cells; labyrinth bg 0.03). Proposal: `engage`
on a REGROUP tile — open (max free 8-neighbors), near the jammed centroid,
NO CLOSER to the enemy (≥ not >, so a map-edge jam can rally laterally),
non-hazard, unoccupied. The elegant part is free: engage's 3-step
targeting means the ENGAGED FRONT holds its fight and only the unengaged
(= the jammed rear) walk to the rally — fall back → re-sort; re-engage is
the driver's null-action release when the jam clears. Corridors' v1
under-fire (the preventive human) accepted per 54c.

**Spot-check (3 seeds/cell vs §53e.2 + the 54d rows):** corridors **4.0 →
3.3** (target ✓; human 2.3); labyrinth **0.0 → 0.0 pool HELD** but not
free (deaths 10→14, ~16% slower — transient spikes cross 0.2; ⚠ 54i
threshold-bump candidate, deliberately NOT tuned off one spot-check);
stall-spiral 0.0 held. **⚠ Script interaction observed:** fire-edge 5.7 →
6.3 and alpha-spiral 6.7 → 7.3 vs 54d-ALONE (both still ≪ passive
10.7/8.7, deaths better) — post-release re-engagement jams now pull back.
3 seeds can't separate noise; 54i's paired re-measure arbitrates.

### 54f — choke hold + the armyMinCut sensor (2026-07-13)

**The sensor decision (flagged at 54c, user-approved):** replaced the
articulation question with the right one — `armyMinCut` (sensors.ts) = the
min vertex cut between the armies on the free-passable grid, via explicit
node-split Edmonds–Karp with an early bail past `CHOKE_MAX_CUT` (3). Any
passage width, one algorithm: the 2-wide isthmus bridge reads as a cut of
exactly 2 (the articulation blindness is pinned as a regression test), a
labyrinth door as 1, open ground bails to null. First draft used a
forward-only path search — caught in self-review before commit: without
reverse residual arcs the flow is maximal-not-maximum and the reachability
cut extraction reads a bogus frontier; rewritten as a true residual.

**Script (priority #3):** trigger = cut ≤ 3 ∧ enemies ≥ 2× cut (the
funnel trade; the isthmus signature — the session's highest enemy counts
and its only `hold` uses) ∧ cut STRICTLY our side (the 54d diagonal-tie
lesson). Proposal = `engage` on the cut's central cell. Release = the
null action when the conditions break.

**⭐ User correction on record:** the human's isthmus play was NOT a
geometric plug — it was a TERRAIN-ADVANTAGE hold at the water's edge
(force the engagement with the enemy still in shallow water's −10
attacker-accuracy; own units on sand's −6 evasion — a positive trade
despite the sand). The geometric funnel stands on its own value; the
water's-edge play is a documented candidate EXTENSION of terrain-edge
hold (hazard → combat-penalty tiles), deliberately unbuilt while
choke-isthmus shows no damage gap (0.0 everywhere). Re-open if 54i shows
a residual where tile mods decide fights.

**Spot-check (7 cells × 3 seeds):** isthmus 0.0 HELD (+19% ticks — the
hold is a wait; fine); focus-river BYTE-IDENTICAL (silent); corridors
3.3 → 3.0 (bonus — corridors has real ≤3-cuts); **labyrinth identical to
54e (0.0 pool) — the user's approval gate MET, no door-camping**;
fire/spiral pools unchanged (6.3/7.3/0.0). 52 bot tests green.
