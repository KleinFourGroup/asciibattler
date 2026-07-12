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
