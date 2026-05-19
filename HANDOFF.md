# HANDOFF — Post-MVP pickup

A fresh-session orientation for ASCIIbattler. Read this first; then dive into the docs only where they're called out.

## Where we are

- **MVP shipped** at CHECKPOINT 7 — deployed to GitHub Pages, full loop playable.
- **Phase 0** (project setup) ✓
- **Phase 1** (core primitives — RNG, EventBus, Clock) ✓
- **Phase 2** (rendering — FontAtlas, SpriteRenderer, TerrainRenderer, PostProcess) ✓
- **Phase 3** (battle simulation, 3.1–3.9) ✓
- **Phase 4** (run structure, 4.1–4.6) ✓
- **Phase 5** (HUD, fade transitions, dev-affordance cleanup, dither + scanline polish) ✓
- **Tests:** 136 passed, 0 `it.todo()`. Run with `npm test`.
- **Dev server:** not running. Start with `npm run dev` → http://localhost:5173/ (port 5174 if 5173 is held by a stale process — check with `Get-NetTCPConnection -LocalPort 5173`; remember Vite spawns child Node processes that survive `taskkill` on the parent).
- **Build:** `npm run build`. `vite.config.ts` uses `base: './'` so the same `dist/` works at any subpath.

## What's next

Post-MVP work is now structured around [ROADMAP.md](ROADMAP.md) (Phase A foundation refactors → B style/visual → C gameplay expansion). [TODO.md](TODO.md) holds the small follow-ups that aren't roadmap steps.

**Phase A 4-of-5 landed: A1, A2, A3, A4.** A1 = action selector + cooldown/duration split + multi-tick effects. A2 = command channel + JSON snapshot plumbing. A3 = headless fuzz harness. A4 = config externalization (JSON balance + .glsl shaders). **A5 (scene system) is deliberately deferred** — it lands before the first feature that needs engine rendering outside battle (3D map view, animated recruit, etc.), not speculatively. Next up per ROADMAP:

1. **B6 — Audio**, **B3 — Floating per-unit HP bars + action progress bar.** Big perceptual wins for contained scope; B3 builds on A1's `activeAction` duration as the progress-bar source.
2. **C2 — New archetypes (mage, rogue, healer).** Unblocked by A1+A2; A4 makes adding their stat tables a `config/archetypes.json` edit.
3. **A5 — Scene system.** Deferred but flagged before any feature that needs engine rendering outside battle.

**Fuzz harness:** `npm run fuzz -- --count=N` runs N seeds × all strategies (currently pure-random + greedy), writes `tests/fuzz/output/summary.csv` and per-failure markdown traces. `npm run fuzz:smoke` runs vitest smoke on the harness itself (config: `vitest.fuzz.config.ts`). MVP baseline at 10 seeds: both strategies ~50% win rate, avg floor 3.6 — suggests recruit picks don't move balance much at 4-floor scope, which is data for tuning. (5-seed sample post-A4 hints at greedy edge, but N is too small to be sure — re-run at 100+ when something invalidates the cache.)

**Balance tuning:** numbers live in `config/*.json` (archetype stats, difficulty curve, recruitment composition, nodemap shape). Edit the JSON, refresh the browser — no recompile, just a Vite hot-reload. Schemas + validation in `src/config/*.ts` (zod). Malformed JSON throws at boot with a readable error trace.

Open the roadmap for the full plan and decision-point flags.

Beyond those, see [DESIGN.md](DESIGN.md) "Out of scope" for the gameplay backlog (shop, synergies, boss nodes, etc.) and [TODO.md](TODO.md) for the smaller code-level follow-ups.

## How we collaborate

The strict roadmap (one step → one commit, stop at every checkpoint) was for MVP. Post-MVP work is freer, but the underlying habits still apply:

- **Commit per logical change**, not per "session of work." Split commits when a step's intent grows.
- **Surface tradeoffs to the user** before making non-obvious calls (shader thresholds, refactor scope, API shape decisions).
- **Browser-verify visual work** — and verify at native resolution. The Preview MCP screenshots are unreliable for sub-pixel detail (see gotcha #15).
- **Keep `DESIGN.md` / `ARCHITECTURE.md` honest.** If a change reveals a documented decision is wrong, update the doc in the same commit.

See also: [TESTING.md](TESTING.md) for the testing policy (`core`/`sim`/`run` get tests, `render`/`ui` get visual verify), and [retro/](retro/) for the rolling scratchpad and the shipped-MVP review.

## Things that bit us — DON'T re-litigate

These hard-won fixes will look weird out of context. Don't "clean them up" without understanding why they exist.

1. **`scene.background = new THREE.Color(TERMINAL_BLACK)`, not `setClearColor`.** The clear-color path through the EffectComposer's HalfFloat render targets lands at a value that makes the palette-quant pass snap to `DARK_TERMINAL_AMBER`. Lives in [src/render/Renderer.ts](src/render/Renderer.ts). Commit `8491daa`.
2. **`OutputPass` at the END of the composer chain.** Custom `ShaderPass`es don't auto-convert linear → sRGB at the canvas blit; `OutputPass` does. Without it, every color displays as its linear value re-interpreted as sRGB. Commit `fb5e878`.
3. **Palette quantization uses a color-key approach** to skip background pixels and exclude `TERMINAL_BLACK` from the snap palette — stops dark terrain from "punching a hole" by snapping to the background color. Commit `2857c91`.
4. **Any post-process pass placed BEFORE palette-quant must respect the bg color-key.** The dither pass perturbed background pixels off the exact sentinel, which then made the quant pass snap them to a non-black palette entry — flashing the void around the arena bright green/amber. Fix: skip pixels where `distance(src, uBgColor) < 0.001`. Same `uBgColor` uniform pattern works for any future pre-quant pass. See [src/render/PostProcess.ts](src/render/PostProcess.ts) `DITHER_SHADER`. Commit `3334c27`.
5. **`Math.random()` is banned in `src/sim/` and `src/run/`** (ESLint enforced). Use `RNG` from `src/core/RNG.ts`; per-battle randomness via `parentRng.fork()`.
6. **Author durations in seconds, not ticks.** Use `secondsToTicks` / `ticksToSeconds` from `src/config.ts`. Changing `TICK_RATE` shouldn't require re-tuning balance — that's the contract.
7. **Cooldown semantics are "decrement-then-check," not "check-then-decrement."** [World.tick()](src/sim/World.ts) decrements every entry in `unit.actionCooldowns` once per tick before the selector runs; behaviors set the proposal's `cooldown` to the *full* `moveCooldownTicks` / `attackCooldownTicks` value (NOT `N-1`). The match between cooldown gap and event `durationTicks` is what keeps the sprite lerp from leaving a visible idle frame between moves. Lived in a shared `Unit.actionCooldown` field through MVP; refactored to per-action `Map<string, number>` plus `activeAction` duration lockout in A1.
8. **A1 model: per-action cooldown + activeAction duration lockout.** Each tick the selector polls every `Behavior.proposeAction`, filters proposals whose action is still on cooldown (`unit.actionCooldowns.get(id) > 0`), and picks the highest-scoring proposal. The chosen action sets its per-action cooldown and an `activeAction` with `startTick` / `finishTick` / `effectTicks`; while `activeAction != null`, the selector short-circuits (unit is busy). For single-tick actions like move/attack, `cooldown` and `duration` are equal — preserving the MVP "one action per tick" feel — but charge-ups and channels diverge them. Behaviors are stateless and produce per-proposal Action instances (see [src/sim/actions/MoveAction.ts](src/sim/actions/MoveAction.ts) and [src/sim/actions/AttackAction.ts](src/sim/actions/AttackAction.ts)). MovementBehavior scores 1; AttackBehavior scores 10. Score-tie handling is "first proposer wins."
9. **`World.tick()` iterates `this.units.slice()`, not `this.units`.** Inline death handling splices the list mid-tick (was DeathBehavior pre-A1); without the snapshot copy the loop skips the next unit after each removal. The death short-circuit at the top of the per-unit step also ensures dead-but-not-yet-removed units don't propose actions on the tick they die.
10. **`checkBattleEnd` guards on an empty world.** Without the guard, `World.tick()` fires `battle:ended` the very first tick before Game spawns anything — and also breaks any low-level World test that ticks without spawning. The guard happens to also cover the (currently impossible-with-current-stats) mutual-annihilation case.
11. **`exactOptionalPropertyTypes` gotcha.** When an object literal might assign `undefined` to a callback property, declare it as `prop: (() => void) | undefined` instead of `prop?: () => void` — the latter rejects an explicit `undefined`. Bit us in [SpriteAnimator's `ActiveFade`](src/render/animation/SpriteAnimator.ts).
12. **Subscription order matters between Run and Game.** Run is constructed before Game subscribes its own handlers, so on `battle:ended` Run advances `phase` *before* Game reads it. Game's `endBattle` and recruit/defeat/victory handlers all rely on this. If you ever construct Run after Game's subscriptions, the read-after-set ordering flips and things break. See [src/Game.ts](src/Game.ts) constructor.
13. **`Run.dispose()` unsubscribes on reset.** When the run resets (via the `resetRun` command), Game creates a new Run on the same bus. Without `dispose()` on the old Run, two Runs respond to every `battle:ended`. The unsubscribe pattern is captured-in-array; if you add a new `bus.on(...)` inside Run, push the unsub into `this.subscriptions`.
14. **Recruited units spawn via `distributeColumns`, not fixed-length arrays.** The original `MELEE_COLUMNS = [2, 6, 10]` blew up at index 3 once a recruit grew the team. Default 3M+2R formation is still preserved exactly by a fast-path; any other size uses an even-spread function. See [src/Game.ts](src/Game.ts) `spawnTeam`.
15. **Death fade gets cut short on `battle:ended` (acceptable).** When the killing blow is the final tick, `DeathBehavior.startFade` and `BattleRenderer.detach` happen in the same synchronous burst. The fade dies on the floor. The RecruitScreen / GameOverScreen modals come up immediately after and hide the cut-short visual, so it's invisible in practice. Note in [src/render/BattleRenderer.ts](src/render/BattleRenderer.ts).
16. **HUD `screen-fade` class instead of `hidden` attribute.** The HUD uses `is-visible` class toggling via [src/ui/fade.ts](src/ui/fade.ts) rather than the `hidden` HTML attribute, because `display: none` can't transition opacity. The persistent-element pattern (HUD) and the create-and-destroy pattern (Map/Recruit/GameOver) both opt into the same `.screen-fade` CSS rule. Commit `d4808f5`.
17. **Camera framing is aspect-aware.** [src/render/Renderer.ts](src/render/Renderer.ts) `fitCamera()` runs on every `handleResize` and computes camera distance from the arena AABB + pitch + FOV + aspect so the grid never clips off frame. If you change `FIT_HALF_EXTENTS` or `CAMERA_PITCH_RAD`, re-verify framing at multiple aspect ratios. Commit `f253ae5`.
18. **A2 inputs/outputs split: commands vs events.** Player intents (`enterNode`, `chooseRecruit`, `resetRun`) flow through `RunDispatcher` → `Run.dispatch` (synchronous), **not** the bus. Past-tense notifications (`run:started`, `battle:ended`, `recruit:offered`, `unit:*`, etc.) stay on the bus. Game implements `RunDispatcher` and is captured by every UI screen — that keeps the swap-Run-on-reset invisible to the UI. If you find yourself wanting to add an imperative to `GameEvents`, it's probably a `RunCommand` instead. See [src/run/Command.ts](src/run/Command.ts).
19. **A2 snapshot rehydration is two-phase for World.** Units are instantiated first (no `activeAction`), then `activeAction` references are resolved once every unit exists — an in-flight `AttackAction` may reference another unit by id, and that target has to be present first. `World.fromJSON` enforces this order; if you add a new Action whose `fromData` looks up world state, follow the same pattern. Same applies if multi-unit links (e.g. a "guard ally X" behavior) ever exist.
20. **Behavior/Action registry. `kind` is the contract.** New Behavior implementations declare `static readonly kind = '...'` AND `readonly kind = X.kind`, plus a factory in [src/sim/behaviors/registry.ts](src/sim/behaviors/registry.ts). New Action implementations declare an `id`, a `toData()`, a `static fromData(data, world)`, and register in [src/sim/actions/registry.ts](src/sim/actions/registry.ts). Skipping either side breaks `World.fromJSON` only for snapshots that mention the new kind — easy to miss until someone tries to save mid-battle.
21. **`Run.fromJSON` uses `Object.create` to bypass the constructor.** A fresh `new Run(seed, bus)` regenerates the NodeMap and emits `run:started`; neither is what we want when restoring a snapshot. The factory uses `Object.create(Run.prototype)` plus a mutable cast to set the readonly fields, then calls `subscribe()` to wire up `battle:ended`. Don't replace this with constructor surgery without preserving both behaviors.
22. **A3 fuzz CLI uses tsx, smoke uses a separate vitest config.** Node ESM can't resolve extensionless `.ts` imports natively, so `npm run fuzz` runs through `tsx` (added as devDep). `npm run fuzz:smoke` uses [vitest.fuzz.config.ts](vitest.fuzz.config.ts) — the default `vite.config.ts` *excludes* `tests/fuzz/**` from `npm test` to keep pre-commit fast, so the smoke needs its own config to flip the include. If you ever wire fuzz into CI, call `npm run fuzz:smoke` not `npm test`.
23. **Battle-setup logic lives in [src/sim/battleSetup.ts](src/sim/battleSetup.ts), not Game.** `Game.beginBattle` and the fuzz harness both call `spawnTeam` / `spawnEncounter` from this module. If formation columns ever change (or new behaviors are added to default-spawned units), it has to land there — both call sites pick it up automatically. Don't reintroduce a local copy in either consumer.
24. **A4 config split — JSON source of truth, TS validator.** Balance numbers live in `config/*.json`; each one has a zod schema + parsed export in `src/config/*.ts`. Validation runs at module load, so a malformed JSON crashes the app at boot with a readable zod trace — that's the intended failure mode. To add a new tunable: drop it in the JSON file, extend the schema in the matching TS module, import the parsed value at the call site. The `Archetype` TS union in [src/sim/archetypes.ts](src/sim/archetypes.ts) stays the canonical list of archetype keys; the JSON keys must match it. C2 (mage/rogue/healer) will add to both in lockstep.
25. **A4 shader split — `.glsl` files + `?raw` imports.** Shader sources moved out of TS string literals into `src/render/shaders/*.glsl`. Three post-process passes share `fullscreen-pass.vert.glsl` (everything that doesn't transform geometry just passes UV through). The palette fragment shader carries `__PALETTE_SIZE__` / `__BLACK_INDEX__` placeholders substituted by `substituteShaderConstants` at module load — GLSL ES 1.00 can't index a uniform array by a non-const variable, so these need to be integer literals at compile time. Don't substitute via `#define` (would require multi-pass shader assembly); the placeholder approach is fine because we never need to change these at runtime.

## Browser-verify tips (learned the hard way)

- **Preview MCP screenshots are unreliable for sub-pixel detail.** JPEG compression smears 1-2px features (scanlines, dither stipple) into uniform tints; resize timing can produce thumbnail-sized images that look like rendering bugs. **If a screenshot contradicts intuition, sample canvas pixels via `getImageData` first** — they're more reliable than the screenshot tool for detecting real issues. Even better: ask the user to look in their native browser.
- **`preview_click` selector dispatch sometimes lands outside the clickable region** in a narrow preview viewport. When click "succeeds" but no event fires, fall back to `preview_eval` with `element.click()`.
- **The preview MCP duplicates console output 6×** for reasons not yet understood. Log de-duplication is purely cosmetic; the events are still firing once per emit.
- **Force-verifying defeat/victory paths** when natural runs keep winning/losing the wrong way: temporarily add `(window as unknown as { __bus: typeof this.bus }).__bus = this.bus;` to Game constructor, then `window.__bus.emit('battle:ended', { winner: 'enemy' })` or `window.__bus.emit('run:victory', {})` from eval. Remove the hook before committing.
- **`getImageData` on a WebGL canvas can return cleared buffers** if `preserveDrawingBuffer` is false (Three.js default). Read pixels synchronously inside the same frame the render happened, or temporarily set `preserveDrawingBuffer: true` for debugging.

## Project shape

```
src/
  main.ts              # entry; top-level await on FontAtlas.create()
  Game.ts              # top-level orchestrator: Run lifecycle, per-battle World, screen mounts
  config.ts            # TICK_RATE=10, GRID_SIZE=12, secondsToTicks/ticksToSeconds
                       # (engine knobs; balance lives in config/*.json — see src/config/)
  config/
    archetypes.ts      # validated wrapper around config/archetypes.json (A4)
    difficulty.ts      # validated wrapper around config/difficulty.json (A4)
    recruitment.ts     # validated wrapper around config/recruitment.json (A4)
    nodemap.ts         # validated wrapper around config/nodemap.json (A4)
    schemas.ts         # shared zod helpers (RangeSchema) (A4)
  core/
    RNG.ts             # mulberry32, fork(), pick(), int()
    EventBus.ts        # typed pub/sub; on() returns unsub
    Clock.ts           # fixed-timestep accumulator
    events.ts          # GameEvents catalog (typed event payloads)
    types.ts           # GridCoord, Vec2
  sim/
    World.ts           # tick(), spawnUnit(), removeUnit(), findUnit(), checkBattleEnd
                       # selector + activeAction loop, inline death handling (A1)
                       # + command queue drain + toJSON/fromJSON (A2)
    Unit.ts            # Unit + UnitTemplate + UnitStats + Team + Behavior
                       # + actionCooldowns Map + activeAction (A1)
                       # Behavior gains `kind` for snapshot rehydration (A2)
    Action.ts          # Action / ActionProposal / ActiveAction interfaces (A1)
                       # + toData() on Action for snapshot rehydration (A2)
    Command.ts         # WorldCommand union — drained at tick boundary (A2)
    Pathfinding.ts     # A* king's-move, Chebyshev heuristic
    Targeting.ts       # findTarget — nearest enemy, ties by HP then id
    archetypes.ts      # MELEE/RANGED bounds, rollUnit, glyphForArchetype
    battleSetup.ts     # shared spawnTeam/spawnEncounter — Game + fuzz harness (A3)
    actions/
      MoveAction.ts          # logical position update + unit:moved event
      AttackAction.ts        # damage + unit:attacked event
      registry.ts            # action factories keyed by Action.id (A2)
    behaviors/
      MovementBehavior.ts    # proposeAction → MoveAction when out of range
      AttackBehavior.ts      # proposeAction → AttackAction when in range
      registry.ts            # behavior factories keyed by Behavior.kind (A2)
  run/
    Run.ts             # state machine: map|battle|recruit|defeat|complete + RNG + team + nodeMap
                       # + dispatch(RunCommand) + toJSON/fromJSON (A2)
    Command.ts         # RunCommand union + RunDispatcher interface (A2)
    NodeMap.ts         # DAG generation + dump
    Recruitment.ts     # rollOffer with archetype-variety guarantee
  render/
    Renderer.ts        # WebGLRenderer + EffectComposer + RAF loop + aspect-aware fitCamera
    FontAtlas.ts       # canvas2d glyph atlas → THREE.CanvasTexture
    SpriteRenderer.ts  # InstancedBufferGeometry + custom shaders
    TerrainRenderer.ts # fBm-displaced plane + palette shader
    BattleRenderer.ts  # sim/render seam: attach/detach per battle
    PostProcess.ts     # Dither + PaletteQuant + Scanlines ShaderPass factories (loads .glsl A4)
    palette.ts         # COLORS table
    shaders/           # .glsl source files loaded via Vite ?raw imports (A4)
    animation/SpriteAnimator.ts  # startLerp + startFade + clear()
  ui/
    ui.css
    fade.ts            # fadeIn / fadeOutAndRemove — shared screen transitions (Step 5.2)
    MapScreen.ts       # node map view + frontier click → dispatch enterNode
    RecruitScreen.ts   # 3-card recruit offer → dispatch chooseRecruit
    GameOverScreen.ts  # defeat / complete variants → dispatch resetRun
    HUD.ts             # in-battle HUD: floor, rosters, HP bars (Step 5.1)

tests/
  smoke.test.ts                              # vitest + module resolution
  integration/determinism.test.ts            # deterministic replay contract
  integration/snapshot-roundtrip.test.ts     # A2: World/Run JSON round-trip
  fuzz/                                      # A3: opt-in headless balance harness
    Strategy.ts                              #   pickNextNode / pickRecruit interface
    strategies/PureRandom.ts                 #   uniform-random baseline
    strategies/Greedy.ts                     #   prefer lowest-count archetype
    harness.ts                               #   runOne / runMany; RunResult shape
    reporters.ts                             #   CSV summary + markdown failure traces
    cli.ts                                   #   `npm run fuzz` entry point
    harness.test.ts                          #   smoke (run via `npm run fuzz:smoke`)
    output/                                  #   gitignored — regenerated each fuzz run

retro/
  scratchpad.md           # rolling scratchpad of process notes / gotchas
  post-mvp-review.md      # CHECKPOINT 7 retrospective written after MVP shipped

config/                              # A4: balance JSON source-of-truth
  archetypes.json                    # melee + ranged stat bands + glyphs
  difficulty.json                    # enemy size delta + per-floor HP scale
  recruitment.json                   # starting team + offer size
  nodemap.json                       # floor count + width bands + degree cap
```

Co-located `*.test.ts` next to source for unit tests. Integration tests under `tests/`.

## Pre-flight (run when picking up a session)

```bash
git log --oneline -5    # confirm latest commit
npm test                # 146 passed, 0 todo
npm run fuzz:smoke      # 7 passed — confirms the harness still runs
npm run dev             # opens at :5173 — verify the full run flow plays
```

In the browser you should see: dark terrain with subtle dither stipple and 4px-thick scanlines, map screen on load (right panel), click a frontier → battle plays out with in-battle HUD on the left → recruit modal (3 cards, at least one M + one a) → click a card → map screen at new node with visited trail. Win 4 in a row → green "Run Complete" screen. Lose → red "Defeat" screen. Button on either resets to a fresh map. All screen transitions fade over 180ms.

## Toolchain versions

- Node 25.5, npm 11.8
- TypeScript 6.0.3, Vite 8.0.13
- three.js 0.184.0, simplex-noise 4.0.3, @fontsource/jetbrains-mono 5.2.8
- vitest 4.1.6, ESLint 10.4.0, typescript-eslint 8.59.3, prettier 3.8.3

## Existing memories

- `project_asciibattler.md` — points here. Update at major phase boundaries.
- `feedback_context_estimates.md` — don't fabricate context-window %s; use qualitative terms or trust the user's actual number.
