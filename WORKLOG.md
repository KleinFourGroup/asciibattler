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
