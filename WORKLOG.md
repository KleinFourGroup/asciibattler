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

### 54g — cohesion focus (2026-07-13): the attribution A/B earns its keep

The first draft — `focus` mode on any reach-≥4 enemy within 6 — regressed
THREE cells (junction 18.0→22.0 & a lost clear, artillery 2.0→3.0,
fire-edge 6.3→7.7). The per-script registry A/B (the 54a array seam)
attributed and fixed it in two cuts:

1. **`focus` → `engage`.** The full-preempt beeline walks the team
   through waves/fire to reach the piece. The human's own mix was the
   tell, under-weighted at design time: 3 focus commands in 197 — their
   assassination tool is the LEASHED `engage:enemy` (12/15 junction,
   16/27 artillery). Artillery recovered 3.0 → 1.3 (now BETTER than the
   unjam-damaged 2.0 baseline — engaging the catapult helps).
2. **Reach bar 4 → 6.** Reach-4 swept in every reach-5 caster; chasing
   mages behind the junction champion wall was the whole junction
   regression (attackRange table: mage/warlock/ice_mage/stormcaller 5,
   banshee 4, catapult/shaman 6). "The one TRUE assassination target"
   means the siege pieces literally. Junction restored to 18.0/1-of-3
   (= the unjam-only level); a mage-silence premise test pins the lesson.

**Final 10-cell spot-check:** focus-river BYTE-IDENTICAL (the null-action
cell stays untouched — the tight trigger never fires there);
alpha-funnel 12.7→10.7 (a small unexpected win); artillery 0.3→1.3 and
junction 16.3→18.0 — **both residuals attributed 100% to UNJAM**
(falling back under ranged fire), not to focus. → the 54e amendment
proposed next: the regroup cell must sit OUTSIDE enemy reach, else the
null action stands. Running tally vs passive: fire-edge 10.7→6.7,
corridors 4.0→3.0, stall 4.0→0.0, alpha-spiral 8.7→7.3, alpha-funnel
12.7→10.7; labyrinth/isthmus/river 0.0 HELD. 61 bot tests green.

### 54e-amendment — the under-fire rally filter (2026-07-13, user-approved)

Two-round fix, the full-board spot-check earning its keep:

1. **The hard filter overcorrected.** "Regroup cell outside EVERY enemy's
   reach" fixed artillery (unjam's +1.7 → 0.0, better than passive) but
   the 10-cell board caught what the 3-cell attribution couldn't:
   reach-3/5 coverage (bows, mages) pushed rallies out of the local area
   entirely — corridors 3.0→4.3 (WORSE than passive), alpha-spiral
   7.3→10.7, labyrinth deaths 10→26 at +66% ticks. A local re-sort had
   become a deep retreat march.
2. **Artillery-only is the faithful fix.** The actual 54g finding was
   falling back under CATAPULT fire — so the filter now counts only
   `ARTILLERY_REACH` (≥6) enemies, promoted to a shared sensors constant
   (cohesion focus's assassination bar aliases it — one classification,
   one home). Everything restored: corridors 3.0, alpha-spiral 7.3,
   labyrinth at its 54e level; artillery protected (residual 1.3 = the
   focus engage, on record).

**54i inputs on record:** junction's unjam +1.7 (melee fall-back cost in
the ambush layout — NOT under-fire-related); artillery's focus +1.3;
labyrinth's minor unjam cost (threshold candidate). Lesson promoted to
practice: attribution A/Bs target the diagnosis, but every amendment
re-runs the FULL board — three cells can't see a fourth's regression.

### 54h — attrition stall (2026-07-13, `d608cb6`): three cuts to a clean null

The last script (priority #5). Trigger from the 54c on-record shape
(`enemyDot ≥ 1 ∧ powerΔ ≥ 0`); proposal = `engage` on a stand-off tile.
The step's framing held exactly: stall-spiral already reads 0.0 via
edge-hold, so the exit bar was prove-it-triggers + hurts-nowhere — and
getting to "hurts nowhere" took three spot-check-arbitrated cuts (all
board runs = quartet [54g+amendment] vs quintet in ONE scratch script —
per-cut attribution built in):

1. **Back-off scoring regressed the spirals.** The first stand-off
   preferred the cell FARTHEST from the enemy within radius 4 — every
   re-issue backed the team off again: continuous retreat under ronin
   pursuit, units strung out and picked off in detail (alpha-spiral
   7.3→9.3, WORSE than the 8.7 passive; stall-spiral deaths 11→19).
   Two fixes came out of it: the **contact gate** (`armiesInContact`,
   new sensor — either side's own reach counts; user-approved) — the
   54c table itself was the tell, the stall signature standing-true in
   alpha-spiral's BACKGROUND where the brawl is already joined — and
   **stand-pat scoring** (nearest-centroid first; the human "holds by
   rallying SHORT", never by walking away).
2. **Stand-pat still leaked on its own showcase** (stall-spiral
   0.0→2.0). The arbitration probe (wrapper scripts on the 54a array
   seam, transition timeline) put it at the OPENING: the stall fired at
   t8–t98 while enemies crossed the spiral, froze the team at spawn,
   the burns expired mid-approach, and the fight happened healthy on
   neutral ground — pre-empting the advance that lets edge-hold take
   over at the fire's edge. The same overlap produced fire-edge's
   7.0→5.3 as an accidental wider-radius edge-hold backstop.
3. **⭐ The hazard deferral (option A, user-locked): terrain in play is
   edge-hold's domain WHOLESALE.** A first, narrower "hazard between
   the armies" deferral still leaked (fire-edge 7.0→7.3, +9 deaths):
   in post-crossing windows nothing reads "between" anymore, but
   standing pat while the crossers' burns EXPIRE wastes the finish —
   on a hazard map even stall-positive-looking windows act
   stall-negative. Final rule: ANY hazard cell on the map → null. The
   fire-edge −1.7 was deliberately given back (architecture over a
   spot-check number — one behavior, one owner) and banked as a 54i
   candidate: widen `EDGE_HOLD_APPROACH_STEPS` (3 → ~5) so edge-hold
   itself owns the backstop.

**Final board: all 11 cells BYTE-IDENTICAL to the quartet** — the
stall's remaining domain (DoTs with NO terrain in play: poison /
on-hit-status content) doesn't exist on this board, quartet-identity is
the DESIGNED outcome, and the trigger is pinned by 10 co-located tests
(poison-crafted worlds fire end-to-end through the real registry; the
positive-path tests deliberately use `applyStatusEffect` — a fire-tile
burn now correctly defers). On-record v1 cost: a corner mud patch
disables the stall map-wide; §55's scorer is the principled arbiter.
2132 main + 220 fuzz:smoke (manual — registry commit) green.

### 54i — the paired re-measure closes §54 (2026-07-13, `b8e8bb5` + docs)

The gauntlet CLI grew the `scripts` arm (`--arms=scripts` →
`trafficScripts: true`, no objective — the arm shapes are mutually
exclusive by the harness's frozen-anchor contract; smoke-tested on
focus-river, 0.0 both arms). Full run `--arms=none,scripts --csv`:
**every `none` row reproduced §53e.2 exactly** — the anchors stayed
frozen through the entire five-script build, measured not assumed.

Results + reads → **BALANCE §54** (the round-log home). One breath:
the traffic-six human–bot gap closed **~81%**, the scripts bot is
at-or-better-than-human on **7/11 cells** (including BEATING the human
on stall-spiral, focus-river, labyrinth, alpha-funnel), and the residual
concentrates in three attributed cells — junction +11.3 (the unjam
melee fall-back, the one scripts-worse-than-passive cell), fire-edge
+7.0 (edge-perfection; the `EDGE_HOLD_APPROACH_STEPS` 3→~5 candidate is
banked), alpha-spiral +4.0 (jam depth). That per-cell table IS §55's
gate input: what a scoring layer must beat is now a number, cell by
cell. §54 exit criteria all met — five scripts live, anchors
byte-frozen, drift gates green with nothing relaxed, no baseline
re-pin needed, the re-measure on record.

## Phase 55 — Rung 2: distribution generalization (re-scoped)

### §55-pre — the probe that re-scoped the phase (2026-07-14, `9bc1950` + docs)

**The user re-framed the gate before it was decided** — and the re-frame
was the finding. Their stream-of-consciousness read: the goal isn't a bot
that beats them on the gauntlet; it's a BALANCE TESTER that produces
numbers matching real play — the gauntlet is a chosen-cell instrument, so
the gate input should be "does the full-run needle move with scripts on?",
not the per-cell residual. (Goodhart named and dodged. The three residual
cells might just be "too hard" — or might not matter at real-run
frequencies.)

Built the fuzz `--scripts` run-mode arm (`9bc1950`; search/sweep/arena
bail loudly — a mode silently ignoring the flag would measure the OLD bot
under a flag claiming otherwise) and ran the §46b/§48g fixed-vector
doctrine: §46b's winning vector unchanged (+ a neutral `path.port: 0` —
the vector predates §50's schema axis), 6 × 120-run batches. **Result:
scripts-on regresses full-run win rate in every pairing** (−3.3 in /
−15.0 held / −1.7 greedy) — full tables + per-layout localization in
**BALANCE §55-pre**. The §54 per-cell story survives (corridors/isthmus/
funnel stay positive in the wild); what the gauntlet couldn't see is
fetidPond's mud-read-as-fire (−16.7; the scripts were calibrated entirely
on fire), the boss cost compounding at the last gate of every winning run
(8 of 22 flips died at hop 10 — the §54 table's +1.4 was visible and
discounted), and spiral flipping sign under real comps/daemons/attrition.

**The cutoff conversation (worth keeping):** the user asked for an
explicit time-sink guard — if distilling strategic insight into scripts
is less tractable than believed, feature-completeness + (their floated)
ML or player telemetry might be the better path. The pushback that
landed: cell-level distillation WORKED (81% gap closure); what failed is
calibration breadth, a punch-list not a research problem — and ML/
telemetry are heavier than they sound (training infra + its own realism
question; post-launch by definition). **Agreed resolution: scope-bounded
cutoff, not effort-bounded** — gate/threshold fixes only, a new-script/
new-sensor demand IS the cutoff bell, one re-probe, and a binding
decision rule (beat scripts-off on both seed sets or the default stays
off and the §46a-shape NO closes the rung). Full rules: ROADMAP §55.
Either verdict closes the question — that's what makes it not a sink.

Method notes on record: the probe re-runs are byte-deterministic (the
off re-run reproduced 33/120 exactly, then grew --per-hop/--per-layout);
the OFF arms' in-vs-held spread (27.5/38.3) says 120-run absolute levels
carry wide seed variance — paired same-seed deltas and layout
attribution carry the finding, not absolute levels.

### 55a — the barrier split (2026-07-14, `60097f5`)

The cut said "damage magnitude"; the build found something better — a
STRUCTURAL split with no tunable: the sim already distinguishes
sustained per-tick tile damage (`applyTileStatuses`: fire → burn, every
tick you stand there — a WALL) from on-enter one-shots
(`applyTileEnterEffects`: mud → one poison — a TOLL BOOTH).
`isBarrierHazard` mirrors that exactly. Terrain-edge hold's trigger +
frontier now read barriers only; the rally-spot avoidance (unjam/stall
stand-off cells) and the attrition stall's map-wide deferral
deliberately KEEP the broad hazard read — mud is still terrain and
still a bad parking spot (a stall keyed on mud-poisoned enemies across
a pond would be the §55-pre pathology from the other direction).

Measured: the gauntlet scripts arm all 11 cells BYTE-IDENTICAL (the
fire gate holds — every mined 54c cell's hazard was fire, so the
calibration numbers are untouched by construction); the in-sample
fixed-vector pair: scripts-on 24.2% → **28.3%, now ABOVE the off arm's
27.5%**; fetidPond per-wave 61.8 → 72.9 (off 78.5 — the residual ~5.6
is acceptable v1: mud still shapes rally spots); spiral 56.0 / desert
66.4 essentially unchanged (55b's targets, as predicted); the five
positive layouts held or improved (rubbleQuarry 72.5 → 77.2). Held-out
verification deliberately deferred to 55d's full re-probe — the
decision rule reads both seed sets there.

### 55b — the attribution pass (2026-07-14): two culprits, both named

Per-script leave-one-out via the 54a array seam, two isolates:

- **desertFortress → UNJAM.** The boss-cell A/B (12 arms × 3 seeds):
  only-unjam reproduces the full registry's 20.7/68 exactly;
  minus-unjam reads 17.3/47 — BETTER than passive (19.3/52) — because
  removing unjam also stops it preempting cohesion-focus (priority #2 >
  #4), whose only-arm alone reads 17.3 (engaging the siege pieces
  helps). Unjam-alone is also worse than nothing, so the harm is the
  trigger, not just the shadow.
- **spiralFireLife-wild → TERRAIN-EDGE HOLD.** Forced-spiral full runs
  (fixed vector, 40 seeds, 7 arms): minus-edge-hold 50.0% vs full 25.0%
  vs none 52.5% — full recovery from one removal; every other arm ≈
  full. Mechanism chain, probe by probe: cap-draws 4× (17/832 vs 4/771)
  = the standing-hold stall; the standard-roster variant EXCLUDED the
  comp/team-size axis (worse still: 20.0% vs 57.5%); the per-encounter
  split named **deserters** (fleers: 51% loss vs passive 21%, 10 of 13
  draws) with ronin-vs-mages mildly worse (shellers).

### 55c1 — prey-in-force (2026-07-14, `3574acf`): three cuts, one bell

The prey condition landed in three measured cuts: (1) ≥1 enemy
approaching-or-on-the-barrier — killed the cap-draw stall (draws 17→9)
but not the losses (isolate 27.5%); (2) counting mid-crossers ON the
barrier as prey (a crosser's own cell is its nearest hazard, so the
between-test misses it); (3) the COUNT FLOOR — prey ≥
`EDGE_HOLD_MIN_UNITS`, symmetric with our own trigger. The isolate and
the board DIVERGED on variant choice (the floor read worse on the
forced isolate, better everywhere real); the natural-run probe
arbitrated: floor and ≥1 tie at 29.2% overall, floor wins the spiral
row (60.9 vs 57.8) and the gauntlet board (fire-edge 7.0→5.7, all else
held-or-better). **The deserters residual survives every variant
(~50% loss in the isolate) — separating committed attackers from
fleers is INTENT detection, a new sensor family: the arc's first
CUTOFF BELL, documented not built (the §55 rules working as designed).**

### 55c2 — the unjam sweep (2026-07-14, `d1a29c9`): a documented no-change

The full A/B: 0.25 and 0.30 fixed the four WATCHED cells (boss 20.7 →
18.7 → 17.3 = the minus-unjam optimum; junction → 16.3 passive;
labyrinth deaths 14 → 10) — 0.25 broke corridors (3.0 → 6.0, worse
than passive), 0.30 didn't restore it (5.3). The contact gate (the 54h
sensor reused — "a rear queue behind an active front is healthy") was
FALSIFIED: corridors' win is partly mid-fight re-sorting (4.7), the
boss barely moved (20.0 — the harm also fires between waves), and
alpha-funnel regressed (10.7 → 13.3). Then the natural-run probe
delivered the real verdict on 0.30: **29.2% → 15.8%** — a
distribution-wide collapse (icebergs −13 / quarry −11 / corridors −11
/ isthmus −10 per-wave). Unjam at 0.2 quietly carries most layouts;
the gauntlet's corridors cell was merely the only WITNESS — the
cell-level Goodhart trap, sprung twice in one arc and caught twice by
the same instrument. 0.2 CONFIRMED (the doc comment now carries the
receipts); the boss/junction mid-fight-rally cost = a measured,
accepted residual.

### 55d — the re-probe: the verdict is NO (2026-07-14)

The §55-pre protocol re-run at the final state (off arms reused —
scripts-off is code-untouched; the on-in batch reproduced the working
tree BYTE-IDENTICALLY, the determinism check): fixed-in +1.7 ·
**fixed-held −14.2 (24.2 vs 38.3)** · greedy-in +0.8. **The binding
decision rule fails on the held-out set → the §46a-shape NO: the
passive bot remains the balance anchor, `--scripts` stays opt-in.**
Caveats on record (BALANCE §55): the off-held 38.3 is a hot seed set;
the 55c selection iterated in-sample (part of the +5.0 in-sample
recovery is selection overfit — held-out transfer +0.9). What the arc
bought anyway: the opt-in scripts arm at its best-ever state (the
most human-real CELL-LEVEL instrument, available for §57), three
named-with-mechanism residuals, and the §52 doctrine reconfirmed —
relative reads govern the balance pass.

## The §55 reopen + the renumber (2026-07-15)

**The user reopened the question the day after the close — and the
challenge held up.** Their five-point read (worklog-worthy because three
of the five became phase charters): (1) the cutoff was set under a
time-pressure mindset the project doesn't actually have — EV positive,
reopen; (2) [headspace — for the record: the §55-pre re-frame that
caught the Goodhart trap twice was THEIR call; the self-doubt was
miscalibrated]; (3) **the crux: portfolio search scores OUTCOMES, so a
script that's worse than null simply doesn't get picked — the §55 NO
tested "can trigger fixes make static scripts safe," never "does
rollout arbitration make them safe."** Confirmed against the record:
every §55 failure (fetidPond mud-as-fire, unjam's boss trigger + its
priority shadow, edge-hold vs deserters) is trigger/arbitration-class —
exactly what rollouts dissolve (triggers demote to nomination; the
priority list disappears; the null arm floors at passive). Rung 2
proper was parked on a prediction, not a measurement. (4) **Unjam is
an engine smell, not a skill** — and the user's correction landed:
placement is SEED-ROLLED, so there is no player formation decision for
engine self-sorting to render moot; melee-behind-ranged is
seed-determined jank today. Generalize `SwapAction` (GP5 #5) instead of
scripting around the jam. (5) The deserters residual doesn't need
intent detection — reachability math on derived state ("the stranded
healer can't do damage"), or the searcher arbitrates hold-vs-advance
with no sensor at all.

**Resolution (user + assistant, shape-locked in plain conversation):**
the reopen rides §55's own scope guard ("the parked charter re-opens
ONLY via a future roadmap round" — this is that round). Renumber:
**§56 swap → §57 Rung 2 proper (re-ask gate first) → §58 threat read
(no-op exit legal) → §59 economy → §60 balance pass + close-out.**
Round 53→57 becomes 53→60. The §55 VERDICT NO stands unrevised — it
answered its own question. Costs named at shape-lock (spec AMENDMENT):
full re-baseline at §56 (drift gates trip deliberately), the 53g human
fixture's replay fidelity breaks at the engine change (no new human
fixtures until §56 lands; §60's re-anchor was always fresh), rollout
horizon/noise/cadence is §57's real hard part, and the seed protocol
widens so no future verdict carries the −14.2's hot-seed asterisk.

Rider: the stall-detection idea from the draw/timeout-unification era
(engine prompt "this looks stalled; accept a draw?" instead of a silent
tick-cap wait) finally got captured — TODO.md Polish/pre-launch,
2026-07-15. Docs commit: spec AMENDMENT + ROADMAP restructure + HANDOFF
cursor + this entry.

## Phase 56 — Generalized swap (engine self-sorting)

### The kickoff code-reality audit (2026-07-15)

**Headline: GP5 built the entire swap periphery; only the PROPOSER is
healer-only.** `SwapAction` is atomic, serialized (registry entry, no
new action kind), §35b-exempt by design (no `destinationCell` — its `to`
is intentionally occupied); `unit:swapped` is in the event catalog, the
renderer dual-lerps it, AND the pathing metrics harness already counts
it as two committed steps (tests/pathing/metrics.ts:41, tested). No
instrumentation pre-step needed — the suspected "metrics must learn
swaps first" 56-pre evaporated on inspection.

**The natural seam is `stepAlongRoute`'s blocked branch**
(src/sim/movement.ts): the maxCells≤1 cascade is currently §45b
wait-gate (blocker vacating soon → queue) → E5.B sidestep → 'blocked'
abstain. A holding in-band ranged blocker has NO vacancy ETA, so it
falls through wait, and in a corridor the sidestep fails → today's
permanent queue. A swap probe slots into that cascade; everything
upstream (goal lists, route choice, §45c stability) is untouched.

**⭐ The audit's design gift — ONE predicate does all the work:**
"the blocker, standing on MY cell, would still hold" — i.e. the
mover's cell is inside the blocker's firing band (range AND LOS, the
44-pre-c `firingBandCell` machinery, reusable). This single check:
- protects the yielder (never swap a ranged unit out of its shot);
- kills melee-through-melee ping-pong automatically (a front melee
  displaced one cell back is at range 2 → out of band → ineligible);
- kills ranged-through-ranged pathologies the same way (incl. the
  LOS-gated case — the predicate carries LOS);
- needs NO persistent state → hysteresis-free anti-oscillation, no
  snapshot bump, potentially ZERO new config knobs.
Friendly bodies do NOT block LOS (only neutral `blocksLineOfSight`
units — positioning.ts `collectLosBlockers`), so a displaced ranged
unit shoots over the passer's head; only wall geometry can break the
displaced shot, and the band predicate checks exactly that.

**Economics differ from the healer yield, in a good way:** GP5's yield
has the BLOCKER pay (healer's cooldown) while the fighter advances
free. Mover-initiated inverts it: the advancing melee pays a normal
move cooldown for a normal forward step; the displaced blocker is
relocated free (SwapAction semantics — partner keeps its cadence).
Nobody gets a free ADVANCE; the yielder is compensated for being
moved. Cleaner than the healer shape, no changes to SwapAction needed.

**The partner-in-flight hazard (audit catch):** `SwapAction.start`
relocates the partner regardless of its `activeAction`. A mid-MOVE
partner (logical position holds until the §36b flip, claim
outstanding) would be teleported and then have its own impact overwrite
`position` — claim/position corruption territory. The healer flow
never hits it (a strictly-blocked ally can't be mid-move), but the
generalized rule must gate on it: partner has no in-flight action
(derivable — `activeAction === null`; `claimedDestinationOf` covers
the move case specifically). V1 recommendation: idle-or-waiting
partners only.

**Drift gates (tests/pathing/drift.test.ts):** all floors/bounds, not
pins — corridor throughput (≥0.75/1.50 per 100t) should IMPROVE;
riverFork moves ≤100 gains 2 counted steps per swap (headroom: reading
was ~23 backtracks vs 100 bound); oscillation ≤0.5 unthreatened when
the yielder holds post-swap (the predicate guarantees it wants to).
Prediction: gates HOLD un-relaxed; `baseline.test.ts` exact pins
re-pin deliberately; PATHING.md gets its append per header protocol.

**Scope reality:** `advance` is shared by MovementBehavior (enemy team
included — symmetry is automatic, same behavior class) AND tile-rally
pursuit (a rally column jams identically — swap reach is a design
call). The healer's bespoke `stepToward` and the dash/leap path are
separate seams — v1 leaves both untouched (healer keeps its GP5 yield).

**Snapshot prediction: NO bump — v34 holds.** Stateless rule, existing
action + registry entry, proposal sites don't serialize. (The
twice-taught rule: this line is the prediction.)

### The design round + shape-lock (2026-07-15)

**The audit's in-band predicate DIED at the design round — the user's
edge case killed it, and the post-mortem matters:** a ranged unit
approaching down a corridor stops at the FIRST in-band cell =
`nearestActingCell` = MAX RANGE, so any backward displacement exits the
band and the predicate refuses the swap — in exactly the canonical
melee-behind-ranged jam the phase exists to fix. The predicate proved
a tidy no-loser property while excluding the primary use case. The
user's temporal read is the right model: the archer's band loss is
TRANSIENT (the passer keeps marching and vacates; the archer re-enters
a beat later) — a human archer holds fire while the swordsmen file
past.

**Adopted (user heuristics, both):**
1. **Role order** — melee passes ranged, never the reverse
   (`attackRange > 1` = ranged; backward displacement is neutral-to-
   good for every ranged archetype incl. minRange kiters). The
   anti-oscillation property survives the predicate swap: ANTISYMMETRY
   replaces "displaced blocker doesn't want to move" — swaps flow one
   direction in the role relation, so a pair can never swap twice.
   Still stateless, no snapshot bump, zero tunables.
2. **Flee-swap** — a boxed fleeing unit swaps with a neighbor whose
   cell strictly increases distance from the threat. Two derivable
   gates: partner NOT fleeing (two panickers ping-pong) and NOT
   support (a healer displaced into panic range retreats right back;
   it also has its own GP5 machinery). Convergent by construction:
   the fleer's threat distance strictly increases per swap, and the
   displaced fighter is handed a step it already wanted.

**Deferred (user call): speed-order** (melee-passes-melee by mobility —
the rogue-behind-tank march case). The worry on record: a lone fast
unit darting in solo and dying to the whole enemy army. Revisit with
playtest evidence, not theory. V1 holds the coarse two-role line.

**The 56a bug, upgraded from the audit note:** `SwapAction.start` does
`unit.position = this.to` UNCONDITIONALLY — the "partner gone" degrade
assumed a free cell. A present-but-mid-move partner passes the position
check (logical position holds until the §36b flip), gets teleported,
then its own move-impact overwrites its position (claim/position
corruption). And a naive eligibility check WITHOUT restructuring
`start` would land the actor on a still-occupied cell. Fix is
two-sided: proposer gates (synchronous propose→start makes them
race-free) + a no-op branch in `start` (covers the post-rehydrate
path). The healer's `blockedAlly` can construct the hazard TODAY with
a mid-move adjacent ally — a latent GP5 bug, so 56a leads the cut.

### 56a — the SwapAction hardening (2026-07-15)

Built as cut: the no-op branch in `start` (present-but-in-flight
partner → positions untouched + `unit:moveAborted`, the renderer's
settle-in-place path) + the `activeAction === null` proposer gate in
the healer's `blockedAlly`. Tests: the mid-move-partner no-op (seated
the §45a way — active action + claim, pre-flip) and the healer
abstaining on the corridor-swap shape with a mid-move ally.

**The byte-parity prediction was WRONG, and the miss is the finding:
the hazard was LIVE, not latent.** fuzz:smoke flipped exactly one test
— the 50g port-arm non-vacuousness canary (greedy SHORT seed 10 no
longer buys) — meaning real fuzz runs contained healer swaps against
mid-move allies (the corrupted teleport-then-overwrite shape) and
fixing them re-dealt battle trajectories. Handled per the canary's own
protocol: re-scan (seeds 12/15/24 buy), re-pin 10→12. No other pin
moved (219/220 held); main suite + typecheck green throughout.

### 56b — the role-order swap probe (2026-07-15)

Built as shape-locked, all in the shared seam so every consumer
(MovementBehavior combat pursuit, tile-rally, both teams) gets it:

- `stepAlongRoute` gained the acting `unit` and the LAST-RESORT probe
  (§45b wait → E5.B sidestep → swap → 'blocked'); `swap_through` joined
  `MoveDecisionKind` (the metrics histogram picks it up automatically —
  it enumerates `MOVE_DECISION_KINDS`).
- `swapThroughProposal` gates, in order: melee mover (attackRange 1) ·
  footprint-1 both sides · a live BODY on the forward cell (a claimed-
  but-empty cell yields no partner) · friendly · idle (`activeAction
  === null`, the 56a doctrine) · ranged blocker (attackRange > 1) · not
  support (kind literal — importing SupportMovementBehavior is a module
  cycle; the healer reads as ranged because heal range IS attackRange,
  so the explicit exclusion is load-bearing).
- `swapProposal` moved healer-local → movement.ts (one definition, two
  proposers). The probe's duration is `stepDurationTicks` (M6 wade
  scaling, move-consistent); the healer's yield keeps its raw cadence.

9 tests: the canonical jam (proposal shape + the `swap_through`
decision) · both role-order refusals · enemy · support · mid-move-
blocker (resolves upstream via the §45b WAIT — the 56a doctrine never
reached) · open-field (router detours; probe never fires — last-resort
proven) · anti-oscillation (the displaced archer's reverse poll queues;
antisymmetry) · the 3-deep chain jam (column sorts iteratively, archer
files to the rear).

**Gate results — quieter than predicted, and the quiet is informative:**
drift gates HELD, `baseline.test.ts` exact pins HELD (the pathing
fixtures are same-role comps — no swap can fire there), and fuzz:smoke
220/220 with NO canary flips. The one casualty was the pre-registered
one: the 53g human fixture stopped replaying (its configHash era-guard
only sees CONFIG eras; 56b ended its ENGINE era) — retired with an
explicit `engineEraRetired` flag + doc block per the spec AMENDMENT
cost line; traces stand as pre-swap history; the consistency test still
runs. ⚠ The smoke quiet does NOT mean swaps are rare in the wild —
distribution-level liveness + impact is exactly 56d's measurement.

### 56c — the flee-swap (2026-07-15)

Built as shape-locked: `proposeFlee`'s null branch (retreatCell boxed)
falls through to `fleeSwapProposal` — an adjacent ally STRICTLY farther
from the threat, greatest-distance-first with ties to the fixed
NEIGHBORS order (no RNG). Gates as designed: partner not fleeing
(`behaviorFlags` — panicker pairs ping-pong) · not support (GP5 owns
the healer) · plus the 56b structural set (idle/friendly/footprint-1).
New decision kind `flee_swap` (the `boxed` doc amended — a fleeing
boxed now also means "no swap partner qualified").

5 tests on a rout geometry (fleer boxed against a full rear rank —
retreatCell null by construction): the steady-ally bubble-back (the
fellow panickers are ineligible, which doubles as the not-fleeing-gate
proof) · whole-rank-panicking cowers · healer never yanked · mid-action
partner refused · the corner pin proves STRICT distance gain (no
lateral shuffle). All gates + 220/220 canaries held again — a boxed
panicker adjacent to a steady idle ally is a narrow intersection in
fuzz runs; 56d owns the distribution read.

### 56c2 — the two-sided swap protocol (2026-07-15, inserted)

**Source: a user field report from labyrinth watching — three observed
bugs, all real, and the design conversation that followed reshaped the
mechanic.** The observations: (1) a firing archer never yields; (2) a
melee loops up/down beside a pinned archer instead of passing it;
(3) an `aMM` corridor double-swapped to `MMa` within one tick.

**The diagnosis chain (each step corrected the previous):**
- (1) is STRUCTURAL starvation, not a race: `resolvePhases` stretches a
  `'fill'` phase to consume the whole cadence, so an engaging archer is
  NEVER poll-visible idle — the 56a/56b `activeAction === null` gate can
  never pass. First fix idea (relocate mid-attack partners) died on the
  user's gambit catch (attacks CAN carry repositions) + animation bleed;
  second idea (a no-pending-effects predicate) died on the user's
  fill-WINDUP catch (artillery-style defs spend the whole cadence
  pre-impact — a content-shape assumption, exactly what we don't build
  invariants on). The user then proposed a swap-REQUEST system (busy
  blocker evaluates at its next selection point) — whose stateless
  reduction is the shipped design: **the request is re-derivable at the
  blocker's poll** (the GP5 `blockedAlly` question), so no message
  queue, no stored state, no snapshot bump.
- (2) re-read by the user: the adjacent bandit is inside the archer's
  minRange → the archer is the Qb#3 PINNED kiter, genuinely idle — the
  swap never fired because the CASCADE never asked: an equal-distance
  sidestep "succeeds" (the §45b progress guard allows laterals), locks
  the mover a full move window, and loops. Pure cascade-order evidence.
- (3) two defects the user named exactly: GP5's swap flipped positions
  INSTANTLY at `start` (predating §36b), and the partner is never
  seated with anything — so the just-displaced archer was a fresh idle
  body for the next mover in the same tick.

**Shipped (all stateless, v34 holds):**
- **The deferred flip** — SwapAction is the §36b twin: `start` emits
  only; the exchange lands in `applyEffect` at the 50% impact boundary,
  where ALL validation now lives (start never re-runs post-rehydrate,
  so the flip is the only stale-state point): exchange / degrade-to-
  step / abort (§36c shape: cooldown reset, lockout released). No
  claims needed — both cells read occupied from outside all window.
  Fix-along: both units now get `applyTileEnterEffects` at the flip —
  the instant GP5 model never fired tile-enter for EITHER party (a
  latent mud-dodge exploit, closed).
- **The pre-flip partner reserve** — `isPreFlipSwapPartner` (derived
  scan of live activeActions): World.tick skips the partner's selector
  (it must not start an action the flip would invalidate) and every
  proposer's shared `isSwappablePartner` gate refuses it — which IS the
  one-hop-per-window chain throttle for (3).
- **The ranged YIELD** — GP5's `blockedAlly` extracted to a shared home
  (blockedAlly.ts, eligibility now a caller filter); MovementBehavior's
  ranged units run it at their selection polls behind a cheap
  adjacent-melee pre-filter, proposing the yield at YIELD_SWAP_SCORE=12
  — ABOVE ability priority (all shipped defs are 10, dash 5, pinned by
  a balance-proof test): a fill-phase attacker re-attacks the instant
  its action ends, so a yield at move-score would starve at the
  SELECTOR — the archer skips ONE attack cycle to let the melee pass
  (user-signed). Fixes (1); the healer keeps its GP5 semantics.
- **The cascade reorder** — role-eligible blockers are never
  sidestepped around: swap when between actions, else QUEUE (poll-dense
  for the yield window). Fixes (2); the sidestep survives for
  role-ineligible blockers.

**Tests:** SwapAction suite reworked to the deferred model (start-only /
exchange / degrade / abort / busy-partner-at-flip / the reserve pin);
movement 56b block reworked + the pocket-geometry pair (busy → queue,
idle → swap-over-sidestep) + the one-hop-per-window chain (the old
version had ENCODED bug 3 — two start() calls back-to-back labeled
"iterative"); rangedYield.test.ts new (the yield rules, the balance-
proof score pin, the tick-driven scenario-1 drain regression, the
World.tick reserve skip); flee-swap execution updated.

**Gates:** typecheck + 143 files + 220/220 fuzz canaries ALL held (the
port pin survived this re-deal). The §45c stable-route machinery and
drift gates untouched. Distribution impact still deliberately unread —
56d follows.

**User native verification (2026-07-15, same day):** labyrinth re-watch
confirmed all three observations resolved — "looks great, and there's a
visible and prominent sorting effect." The 56e formal close still rides
after 56d (labyrinth doctrine eyeball + the full-board verify), but the
mechanic itself is user-confirmed on the live renderer. Session handed
off at the 56d boundary (context budget); the cursor carries the state.

### 56d — the FULL re-baseline (2026-07-15)

Measurement, not build — the deliberate distribution read the whole
phase deferred (every gate/canary stayed quiet through 56a–56c2 because
the pathing fixtures are same-role comps where no swap can fire).
Pre-flight green first (2165 + 1 skip / 143 files, typecheck clean),
then six instruments: the 20-seed default sweep, the three fixed-vector
probe arms (§46b/§55-pre protocol, `55pre-vector.json`, 120 runs/arm,
scripts OFF), the full gauntlet board (11 cells × 3 seeds ×
none/random/scripts, CSV refreshed), and `npm run pathing`.

**The headline (BALANCE §56d): the swap engine raised the full-run
ceiling on every arm** — fixed-in +12.5 (27.5→40.0), fixed-held +2.5
(38.3→40.8), greedy +6.7 (12.5→19.2), hangs 0 everywhere. Second-order:
the §55 in-vs-held spread (27.5/38.3) collapsed to 40.0/40.8 — the "hot
held-out seed set" was substantially traffic-jam variance the sort
smoothed. The gauntlet traffic cells improved SCRIPT-FREE (labyrinth
random 4.3→0.0, deaths 33→12; junction better on all arms) — the swap
engine does part of unjam's job passively.

**The movement tables (PATHING §56d):** fixtures byte-identical to §45d
→ `baseline.test.ts` pins HELD, NO re-pin (the "deliberate re-pins"
card resolved to identity — the receipt is the reproduced rows, exactly
the H2-rule shape: the predicted side effect's absence means the work
is measurement-only); all drift gates held un-relaxed; `yield_swap`
live at last-resort mass (≤2 per team-seed vs advance/queue in the
hundreds); `swap_through`/`flee_swap` zero in shipped 3+2 comps (the
cascade resolves via the ranged unit's own yield first — liveness of
those kinds is proven by their unit tests + the 56b/56c geometries, not
by these comps). ⚠ Labyrinth doctrine RE-CHECKED and intact: ttfc
491/491/489, ticks mixed-direction (935/880/723 vs 864/893/843) — the
maze is still the maze; traffic sorts inside it.

**Findings that go forward (not §56 actions):** the spiral cells
regress on the board (alpha-spiral up on all three arms) while
spiralFireLife improves in full runs — the §55 cell-Goodhart shape with
the sign reversed; doctrine unchanged, full-run anchor governs. Filed
as §57/§58 inputs: the spiral rows, fire-edge scripts 5.7→8.0
(edge-hold calibrated on pre-swap movement), artillery-funnel none
0.3→4.3 (the "fresh-team-only threat?" note re-opens). Boss wall
unchanged (~20, 0/3) — §60 owns it. **The 56d board supersedes
§53e.2/§54i as the cell anchor for §57+**; scripts stay opt-in per the
§55 verdict.

### 56e-pre — the full-window partner reserve (2026-07-15, inserted)

**Source: the user's 56e feel test — "I thought I saw one swap again
only halfway through."** Real, deterministic, and designed-in: 56c2
anchored the partner reserve to the FLIP (`isPreFlipSwapPartner` — "GP5's
acts-normally-next-tick contract, now anchored to the flip"), so for the
back half of the window the partner (never seated with an action) passed
`isSwappablePartner` and re-entered World.tick's selector — grabbable
for a second swap while the renderer's full-window dual lerp was still
sliding it. The shipped "one-hop-per-window throttle" was really one hop
per HALF-window, and the partner could also start attacks/moves post-flip
— both contrary to the design intent the user stated at the report: the
swap is fundamentally the partner's action too.

**Why the 56c2 tests missed it:** the chain-jam test cleared the actor's
`activeAction` at the flip — conflating "flip landed" with "window over"
— so post-flip-mid-window (activeAction seated, the real World.tick
shape) was never visited. The repro was written headless FIRST (the
doctrine paying off again), confirmed the mid-window re-grab, then
flipped into the regression pin.

**Shipped:** `isPreFlipSwapPartner` → `isReservedSwapPartner` (the name
must not lie): the impactOffset check dropped — reserved while ANY live
swap names the unit, seat through finishTick (or the abort branch
clearing early). Both consumers (World.tick selector skip +
`isSwappablePartner`) inherit; still fully derived, NO snapshot bump
(v34 holds). The partner still pays no cooldown — "merely relocated"
survives; only the mid-window freedom is gone. Chain re-sorts now
genuinely one hop per window (slower by up to a half-window per hop —
the user's accepted cost: "swaps are rare, and this even rarer").

**Tests:** the movement.test.ts regression pin (post-flip mid-window →
M2 queues; window closes → the hop proposes) · the SwapAction reserve
suite reworked (reserved through the window, freed at clear) · the
rangedYield World.tick-skip test extended through the back half (flip
lands, partner still starts nothing). 2166 + 1 skip green; typecheck
clean (one strict-tsc readonly catch the esbuild path accepted — the
AGENTS vitest≠tsc note, again); fuzz:smoke 220/220, NO canary flips.
Distribution re-read (the 56d battery re-run) follows as the same-day
amendment — 56d's numbers were measured on the half-window engine.

**56e-pre re-measure (same day):** the battery re-ran on the full-window
engine. Fixtures byte-identical (no re-pins, gates held, 0 hangs
anywhere); the fixed probe arms gave back part of the 56d gain — in
33.3 (−6.7) / held 30.8 (−10.0) / greedy 18.3 (−0.8) — on ~42% seed
churn with soft significance (paired 29/21 and 32/20; jointly p≈0.06).
vs pre-swap the engine keeps +5.8 on both in-sample arms; held-out (the
§55 flagged-hot seed set) lands −7.5. Probable mechanism: symmetric
rule, asymmetric benefit (§46b shape) — attackers swap more, and the
reserve taxes each swap up to a half-window of partner tempo. The
gauntlet board is volatile both directions at 3-seed granularity (boss
flat; spiral stays a §57/§58 input). Numbers: BALANCE §56e-pre; tables:
PATHING §56e-pre. The semantics is the user's design ruling; whether
the ceiling cost changes anything rides the 56e close — §57's re-ask
gate re-runs this protocol regardless.

### 56e-pre2 — unit:swapAborted, the two-body settle (2026-07-15, inserted)

**Source: the user's 56e playthrough — a labyrinth unit melee-attacking
tiles from its true cell after a tab-throttle resume, a hole in the
frontline where it stood; one glimpse, unreproduced.** Diagnosis from
code receipts (renderer untouched since Phase 40 — the bug is new EVENT
shape feeding old renderer code): 56c2's deferred flip introduced
failure branches (abort at impact; actor removed pre-flip) where the
exchange never lands — but `onUnitSwapped` starts BOTH sprites' dual
lerp at `start`, and nothing settles the PARTNER on failure (the abort
emitted the one-body `unit:moveAborted` naming the actor; actor death
emitted NOTHING — the flip just never fires). The partner's sprite
completes a slide the sim never honored and rests on the wrong tile
until its next absolute-target move re-syncs it — a stationary frontline
melee never re-syncs. Throttle = amplifier not cause (the resume burst
packs deaths and swap windows densely); magnitude caveat ON RECORD: one
failed swap = one cell, compounding requires repeated failures without
intervening moves, so the user's "several tiles" reading is either
compounding or a second mechanism — the TODO reconciliation-sweep item
(dev-warn) is the instrument that would name it.

**Shipped (user call on the event shape — dedicated, not reused):**
`unit:swapAborted {unitA, unitB, cellA, cellB}` — the failure is a
two-body fact, so one first-class event replaces what would have been
TWO role-swapped `unit:moveAborted` emissions per site (LESS code, not
more). Emitters: SwapAction's abort branch + `World.removeUnit` (via the
resurrected pre-flip walk, now `preFlipSwap` — a partner removed
pre-flip needs nothing, the actor's own flip degrades/aborts; post-flip
removal needs nothing, the exchange landed). Consumers: BattleRenderer
(`settleSpriteTo` extracted from the §36c handler; settles BOTH, missing
handles skipped) + the pathing `MovementMetricsCollector`, which had THE
SAME one-sided hole (committed both steps at `unit:swapped`, reverted
only via one-body aborts) — the instrument and the renderer are fixed by
the same event. Catalog + ARCHITECTURE rows added (unit:swapped's row
was MISSING since GP5 — backfilled). No state change, no snapshot bump.

**Tests:** abort branch asserts the two-body payload · removeUnit
pre-flip death emits (+ partner logically unmoved) · post-flip death
emits NOTHING · metrics revert-both case. Renderer stays eyeball-only
(the settle reuses the proven §36c lerp; the abort itself is
near-unreachable live, which is why it hid). TODO.md gains the
reconciliation-sweep follow-up (cheap self-heal + dev-warn reporter;
compositor sized only if the warn ever fires).

### §56 CLOSE (2026-07-16)

**User verdict: close it out** — the 56e native passes happened
continuously through the arc (the 56c2 field report, the "visible and
prominent sorting effect" confirm, the 56e-pre sighting, the 56e-pre2
desync catch), and the final call closes the phase with the FULL-WINDOW
reserve KEPT (the ceiling read accepted as instrument noise vs design
correctness — the user's ruling, on record at BALANCE §56e-pre).

Exit criteria, checked: swap rules live + co-located tests ✅ (56a–56c2,
oscillation + chain-jam explicit) · gates re-derived deliberately with
receipts ✅ (fixtures byte-identical TWICE — the receipt was identity;
nothing relaxed) · the FULL re-baseline on record ✅ (BALANCE §56d +
§56e-pre; PATHING §56d + §56e-pre) · browser-verified natively ✅ ·
the 53g fidelity break acknowledged ✅ (56b, `engineEraRetired`).

**What the phase leaves behind:** the engine self-sorts (yield_swap live
at last-resort mass; unjam's job partially passive now — §57's re-ask
input) · the 56e-pre BALANCE board + probe (33.3/30.8/18.3) = the
CURRENT anchors for §57+ · the ⚠ NO-new-human-fixtures freeze LIFTS at
this close (new fixtures record the new engine era) · filed forward:
spiral cells (§57/§58) · fire-edge scripts drift · artillery-funnel
wake-up · the renderer reconciliation sweep (TODO). Two feel-test
catches the gate suite structurally couldn't see (56e-pre, 56e-pre2)
— the eyeball-only render policy carried its weight both times.

## Phase 57 — Rung 2 proper: portfolio rollout search

### Kickoff: the code-reality audit + shape-lock (2026-07-16)

**The audit (surfaces as they exist at `a06ee8b`), seven load-bearing
facts:**

1. **The clairvoyance hazard is REAL and confirmed at the source.**
   `World.toJSON()` serializes BOTH RNG streams verbatim (`rng` +
   `combatRng`, World.ts ~2137) — by design, for save/load determinism;
   the snapshot round-trip tests assert byte-identical futures BECAUSE
   of it. A naive rollout clone therefore foresees the live battle's
   exact future rolls, and nothing anywhere calls `fork()` post-
   `fromJSON` today. 57d's divergence seam + foresee-the-rolls test are
   load-bearing, not ceremony.
2. **The clone primitive exists and is proven MID-battle.**
   `snapshot-roundtrip.test.ts` round-trips mid-move (deferred position
   + held claim), mid-heal, mid-charge, mid-wind-up, mid-dash, and
   asserts trace-identical resumes. v34 carries `activeAction`, claims,
   cooldowns, `pendingCommands`. Rollout plumbing is a seam on a proven
   base.
3. **Two counters live OUTSIDE the world snapshot:** the driver's
   `lastCommandTick` + `standingScriptId` (TrafficScriptDriver.ts ~111,
   deliberately unserialized). A rollout clone must carry them or the
   rolled-forward driver diverges from what the live one would do.
4. **The sensor-audit decision point resolves at zero cost:** every 54b
   sensor is a pure function of serialized state by construction (the
   54b header explicitly rejected event-history reads), incl. the 54h
   contact gate `armiesInContact`. Scripts hold no cross-tick state.
   All rollout-compatible as-is.
5. **No rollout/lookahead machinery exists anywhere** — evaluator,
   searcher, and RNG-divergence seam are all fresh build. The driver is
   harness-only ("nothing shipped calls it"), so the DEV-only scope
   guard holds structurally.
6. **The clone-cost flag for 57c:** a clone today is
   `fromJSON(JSON.parse(JSON.stringify(toJSON())))` — per candidate ×
   per rollout × per re-search, that round-trip is the compute hot
   spot; budget is an explicit 57c design item.
7. **Anchor-reuse caveat:** the OFF anchors were measured at `880901e`;
   56e-pre2 (event-emission only) landed after. The 55d precedent
   applies — reuse the OFF arms only after a byte-identity spot-check
   at HEAD (57a's first act).

**The retune question (user asked; resolved into the shape):** all
script triggers were calibrated on pre-swap movement (the 54c table was
mined from the now era-retired 53g fixture; fire-edge drifted 5.7→8.0
at 56d). 57a/57b deliberately do NOT retune first — (a) the gate's
question is "what did the engine change about the existing scripts'
value," which needs the scripts byte-frozen at §55-final or the delta
conflates two causes; (b) retuning before measuring is the §55-pre
mistake in reverse; (c) under rollout arbitration triggers demote to
nomination, so a stale threshold stops deciding whether a script ACTS —
possibly dissolving the retune entirely (a 57c fork: if nomination =
"all scripts always candidates," trigger calibration stops being
load-bearing). The staleness therefore goes on record as a GATE-READ
CAVEAT: a scripts-ON regression at the gate reads "stale static scripts
regress," NOT "scripts are worthless" — it biases the gate away from a
NO-BUILD close, known going in. If static triggers stay load-bearing
anywhere (e.g. gate outcome (a) flips the default ON), a retune becomes
its own step — and the right instrument would be NEW-ERA human fixtures
(freeze lifted at §56 close), flagged as a user-time decision point,
not slipped in.

**The gate's three legal outcomes, agreed:** (a) ON beats OFF on all
sets → the §55 rule finally passes, default flips ON, close NO-BUILD;
(b) residual gone/negligible → close NO-BUILD; (c) residual persists
(expected) → build 57c–57h. The user's calibrated expectation on
record: "whatever plan we come up with for the gate steps is unlikely
to survive contact with the actual numbers" — the 43-pre/44-pre
insertion pattern is anticipated, not a failure.

**Shape-locked (user, 2026-07-16):** the 57a–57h cut + the amendments
(scripts AS-IS at the gate; the 57c calibration fork) + the
pre-registered BINDING close rule (beat passive on ALL THREE seed sets
or §46a-shape NO) + unjam leave-one-out AT the gate. Cut and rule:
ROADMAP §57. Instrument note for the LOO: the harness's
`trafficScripts` already accepts a registry array (the 54a seam); only
the CLI needs a subset spec — a small instrument commit, parity-tested.

### 57a + 57b — the re-ask gate runs (2026-07-16)

Sequential batches (the 47e no-edits-under-a-live-capture rule
observed: the `--scripts=<spec>` instrument commit, `4d93ee2`, landed
in the quiet window between the primary arms and the LOO arms;
fuzz:smoke 226/226 run manually — the hook trigger doesn't watch
`tests/fuzz/`). The OFF determinism spot-check reproduced
`56e-pre-fixed-in` byte-identically on all three CSVs — the anchors
are valid at HEAD, and 56e-pre2's event-emission-only claim is now
PROVEN at distribution scale rather than argued from the diff.

**The numbers: BALANCE §57-gate.** The shape in one breath: the §55
−14.2 held-out pathology did not survive the swap engine (paired flips
near-symmetric on all four pairings), but static scripts still
lose-or-tie everywhere (−2.5 / −0.8 / −4.2 / 0.0); the unjam LOO
inverted 55b — minus-unjam ≈ OFF, only-unjam worse than nothing, so
unjam is post-swap dead weight exactly as 56d predicted; and
spiralFireLife is the ONLY layout negative in all four pairings (the
deserters residual, still alive, still trigger/arbitration-class). The
old villains (desertFortress boss harm, fetidPond mud-as-fire) are
resolved or flat.

**Where this leaves the STOP:** outcome (a) (static ON beats OFF —
flip default, close NO-BUILD) did not materialize; outcome (b)
(residual gone) did not either — the bot sits at 33–37% against the
human ~80% class. The assistant read is outcome (c) BUILD: every
surviving failure is the class rollout arbitration dissolves, and the
arbitration question remains unmeasured — which is the phase's charter.
The user's verdict is pending; 57b's box stays open until it lands.

**Verdict (user, 2026-07-16): BUILD — outcome (c).** The 57c design
round opens at education depth by explicit user request ("we're very
far outside my normal wheelhouse — give me as much detail on tradeoffs
as you can, any blind spots"): every fork presented with tradeoffs +
recommendation, blind spots named, dials provisional until the 57d
clone/tick micro-benchmark prices them.

### 57c — the design round, v2 SHAPE-LOCKED (user, 2026-07-16)

Two proposal rounds. V1 presented seven forks (horizon · scoring · K ·
cadence · nomination · the opponent model · the compute budget) plus
the blind-spot list (the searcher referees, it can't invent · battle
≠ run optimization · 57g in-sample contamination · absolute win rates
= the calibration trap). The user pushed on three points and the
pushback IMPROVED the shape:

1. **The VPS (user float; honest-cost read: genuinely cheap, unlike
   most floated infra).** Headless Node harness → `git clone && npm
   ci`; determinism makes remote numbers VERIFIABLE (one batch,
   byte-compare vs local — a proof most distributed setups never get);
   the dwm leak (N4's indefinite deferral!) is Windows-compositor-only.
   Slot: **57f2, after the searcher exists** (real costs size the box)
   and before 57g's wide measurement. Round infrastructure, not phase
   infrastructure — §59/§60 inherit it; N4's overnight verify rides.
   ⭐ The design consequence: the two compute-driven compromises
   (nomination pre-filter, K=2) convert from LOCKED FORKS into 57g
   MEASURED A/Bs on the box — the round's instrument-then-decide ethos
   applied to its own design. Cost named: 57e/57f must build the
   propose-regardless `nominate()` seam NOW (scripts fuse
   trigger+proposal; evaluate()→null proposes nothing to roll) so
   audition-everyone is A/B-able without later surgery. The provider
   talk (hourly vs flat, host, budget) = a 57f2 education session
   (user has limited experience here — flagged in advance).
2. **K=2 discomfort (user statistical instinct).** The teach: with
   common random numbers K is a PAIRED-comparison sample, not an
   estimation sample — shared luck cancels (the round's own same-seed
   methodology, applied inside the searcher); movement is RNG-free by
   doctrine so rollout variance is combat-rolls only; small-K error
   concentrates where candidates are near-equal (low regret). The real
   residual risk = knife-edge coverage (a crit-dependent cascade both
   shared seeds miss) — a COVERAGE problem, measured directly by the
   57g K-sensitivity arm (2/4/8, count winner-flips).
3. **Scoring: "up on pool damage but surrounded" (user).** Named: the
   horizon-edge problem (the chess horizon effect's cousin). Two v1
   mitigations already cover most of it — cadence OVERLAP (4s re-search
   under an 8s horizon: the NEXT search sees the trap inside its
   window; a re-planning agent's defense that fixed-depth chess lacks)
   and the battle-end bonus (doom-within-H is watched, not inferred).
   The residual blind band (doomed-after-H but committed-before) is
   real → **the 57g scoring investigation**: ONE threat-exposure
   experiment term built from the EXISTING derived sensors (jamRead /
   chokeCells / armiesInContact — snapshot-computable, near-free),
   judged on the spiral isolate (a sharp test: material says hold,
   right answer is advance). ⚠ Every term carries a λ and a wrong λ is
   systematic bias at scale, amplified confidently — the chess lesson;
   λ-fitting bandwidth on 120 in-sample seeds is thin, so the term
   must EARN the slot. Parked alternative on record: quiescence
   rolling (score at the next quiet state ≤ H_max) — the classic
   horizon-effect cure, fiddly in a tick sim, variable cost.

**The v2 locks (ROADMAP §57 decision block):** local dials H=8s ·
K=2+CRN · cadence 4s + death/contact re-search · ε from 57g ·
nominate = evaluate()+null+standing · scoring = terminal material +
end bonus + HP fractions, ties→NULL (the anti-thrash floor) ·
player-team only (the enemy stays engine-driven; game-theoretic
nesting deliberately out of scope — §58 may revisit) · budget: local
batches ≤ ~1hr, the heavy tier moves to the box; the 57h close may be
an overnight-batch affair, accepted in advance.

### 57d — the clone seam + the micro-benchmark (2026-07-16)

[rollout.ts](src/bot/rollout.ts): divergence at the DATA level — the
wire snapshot's two RNG fields re-seeded as independent forks of the
`rolloutSeed` stream BEFORE `fromJSON`; World itself untouched, live
world never mutated, fresh bus per clone. The foresee-the-rolls test
was written FIRST and keeps a CONTROL case: a plain toJSON→fromJSON
clone DOES share the live streams (documents the hazard the seam
exists for — v34 serializes both streams by the A2 design). Five
co-located pins: guard (+control) · live-world purity · same-seed
byte-identity (the CRN contract's foundation) · different-seed
divergence · bus isolation.

**The driver-state-carry card resolved to a NO-OP** (the H2 rule —
the predicted work's absence, explained): v1 rollouts apply ONE
candidate command and tick; no script evaluation happens inside a
horizon, so the live driver's counters can't matter to a clone. The
landing note (if a later design runs scripts mid-rollout, carry
`lastCommandTick`/`standingScriptId`) lives in the rollout.ts header.

**The benchmark (`npx tsx tests/fuzz/benchRollout.ts`, committed as a
re-runnable instrument):** clone **0.07 ms** (16 units mid-battle —
the JSON-round-trip fear was unfounded; the dedicated `World.clone()`
optimization is NOT needed, the no-premature-abstraction receipt) ·
**~94k clone-ticks/sec** incl. cloning · projection ~4 ms/search at
the v2 dials (4 candidates × K=2), ~40 ms/battle at 10 searches.
⚠ Floor-cost caveats ON RECORD: sword-merc comp only (no casters/
statuses/projectiles — real battles tick slower) and rollouts end
early in a melee comp, so ticks/sec is the honest unit and the true
in-situ multiplier gets measured at 57f (which sizes the 57f2 box).
Even at 10× pessimism the ≤1hr local budget holds; the box's value
concentrates in the heavy 57g arms + the 57h close.
