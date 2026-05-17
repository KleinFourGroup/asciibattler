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

Post-MVP backlog lives in [TODO.md](TODO.md). The CHECKPOINT 7 review in [retro/post-mvp-review.md](retro/post-mvp-review.md) recommends, in order:

1. **Action-selector refactor.** Foundation work — replace behavior-array-order priority with an explicit action selector before any new gameplay feature with status effects, abilities, or archetype-specific actions lands. The current `[Movement, Attack, Death]` array works only because it's exactly two priority levels (plus death). Anything more nuanced will fight back.
2. **Floating per-unit HP bars** + bake grid into terrain shader. Visual polish the user has already flagged for larger arenas.
3. **Audio.** Big perceptual win for contained scope.

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
7. **Cooldown semantics are "decrement-then-check," not "check-then-decrement."** [World.tick()](src/sim/World.ts) decrements `unit.actionCooldown` once per tick before behaviors run; behaviors set it to the *full* `moveCooldownTicks` / `attackCooldownTicks` value after acting (NOT `N-1`). The match between cooldown gap and event `durationTicks` is what keeps the sprite lerp from leaving a visible idle frame between moves. Commit `3b5083f` is where this was first found and fixed in the per-behavior form; `d67593d` refactored it into the shared cooldown.
8. **Behaviors share one `actionCooldown` on Unit.** Movement, Attack, and Death all read/write `unit.actionCooldown`. The shared cooldown is what enforces "one action per tick" — without it, a unit can move into melee range AND attack on the same tick, which made hits feel weightless. Behaviors are stateless w.r.t. cooldown; safe to share instances across units. Priority falls out of array order in `unit.behaviors` (queued for refactor; see TODO.md "action selector").
9. **`World.tick()` iterates `this.units.slice()`, not `this.units`.** DeathBehavior splices the list mid-tick; without the snapshot copy the loop skips the next unit after each removal. The behaviors themselves early-return on `unit.currentHp <= 0` so dead-but-not-yet-removed units don't get posthumous swings.
10. **`checkBattleEnd` guards on an empty world.** Without the guard, `World.tick()` fires `battle:ended` the very first tick before Game spawns anything — and also breaks any low-level World test that ticks without spawning. The guard happens to also cover the (currently impossible-with-current-stats) mutual-annihilation case.
11. **`exactOptionalPropertyTypes` gotcha.** When an object literal might assign `undefined` to a callback property, declare it as `prop: (() => void) | undefined` instead of `prop?: () => void` — the latter rejects an explicit `undefined`. Bit us in [SpriteAnimator's `ActiveFade`](src/render/animation/SpriteAnimator.ts).
12. **Subscription order matters between Run and Game.** Run is constructed before Game subscribes its own handlers, so on `battle:ended` Run advances `phase` *before* Game reads it. Game's `endBattle` and recruit/defeat/victory handlers all rely on this. If you ever construct Run after Game's subscriptions, the read-after-set ordering flips and things break. See [src/Game.ts](src/Game.ts) constructor.
13. **`Run.dispose()` unsubscribes on reset.** When the run resets (`run:resetRequested`), Game creates a new Run on the same bus. Without `dispose()` on the old Run, two Runs respond to every event. The unsubscribe pattern is captured-in-array; if you add a new `bus.on(...)` inside Run, push the unsub into `this.subscriptions`.
14. **Recruited units spawn via `distributeColumns`, not fixed-length arrays.** The original `MELEE_COLUMNS = [2, 6, 10]` blew up at index 3 once a recruit grew the team. Default 3M+2R formation is still preserved exactly by a fast-path; any other size uses an even-spread function. See [src/Game.ts](src/Game.ts) `spawnTeam`.
15. **Death fade gets cut short on `battle:ended` (acceptable).** When the killing blow is the final tick, `DeathBehavior.startFade` and `BattleRenderer.detach` happen in the same synchronous burst. The fade dies on the floor. The RecruitScreen / GameOverScreen modals come up immediately after and hide the cut-short visual, so it's invisible in practice. Note in [src/render/BattleRenderer.ts](src/render/BattleRenderer.ts).
16. **HUD `screen-fade` class instead of `hidden` attribute.** The HUD uses `is-visible` class toggling via [src/ui/fade.ts](src/ui/fade.ts) rather than the `hidden` HTML attribute, because `display: none` can't transition opacity. The persistent-element pattern (HUD) and the create-and-destroy pattern (Map/Recruit/GameOver) both opt into the same `.screen-fade` CSS rule. Commit `d4808f5`.
17. **Camera framing is aspect-aware.** [src/render/Renderer.ts](src/render/Renderer.ts) `fitCamera()` runs on every `handleResize` and computes camera distance from the arena AABB + pitch + FOV + aspect so the grid never clips off frame. If you change `FIT_HALF_EXTENTS` or `CAMERA_PITCH_RAD`, re-verify framing at multiple aspect ratios. Commit `f253ae5`.

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
  core/
    RNG.ts             # mulberry32, fork(), pick(), int()
    EventBus.ts        # typed pub/sub; on() returns unsub
    Clock.ts           # fixed-timestep accumulator
    events.ts          # GameEvents catalog (typed event payloads)
    types.ts           # GridCoord, Vec2
  sim/
    World.ts           # tick(), spawnUnit(), removeUnit(), findUnit(), checkBattleEnd
    Unit.ts            # Unit + UnitTemplate + UnitStats + Team + Behavior + actionCooldown
    Pathfinding.ts     # A* king's-move, Chebyshev heuristic
    Targeting.ts       # findTarget — nearest enemy, ties by HP then id
    archetypes.ts      # MELEE/RANGED bounds, rollUnit, glyphForArchetype
    behaviors/
      MovementBehavior.ts    # uses Pathfinding + Targeting; sets actionCooldown
      AttackBehavior.ts      # damage + unit:attacked + sets actionCooldown
      DeathBehavior.ts       # currentHp<=0 → removeUnit + unit:died
  run/
    Run.ts             # state machine: map|battle|recruit|defeat|complete + RNG + team + nodeMap
    NodeMap.ts         # DAG generation + dump
    Recruitment.ts     # rollOffer with archetype-variety guarantee
  render/
    Renderer.ts        # WebGLRenderer + EffectComposer + RAF loop + aspect-aware fitCamera
    FontAtlas.ts       # canvas2d glyph atlas → THREE.CanvasTexture
    SpriteRenderer.ts  # InstancedBufferGeometry + custom shaders
    TerrainRenderer.ts # fBm-displaced plane + palette shader
    BattleRenderer.ts  # sim/render seam: attach/detach per battle
    PostProcess.ts     # Dither + PaletteQuant + Scanlines ShaderPass factories
    palette.ts         # COLORS table
    animation/SpriteAnimator.ts  # startLerp + startFade + clear()
  ui/
    ui.css
    fade.ts            # fadeIn / fadeOutAndRemove — shared screen transitions (Step 5.2)
    MapScreen.ts       # node map view + frontier click → run:nodeEntered
    RecruitScreen.ts   # 3-card recruit offer → recruit:chosen
    GameOverScreen.ts  # defeat / complete variants → run:resetRequested
    HUD.ts             # in-battle HUD: floor, rosters, HP bars (Step 5.1)

tests/
  smoke.test.ts                       # vitest + module resolution
  integration/determinism.test.ts     # 6 real (no more it.todo)

retro/
  scratchpad.md           # rolling scratchpad of process notes / gotchas
  post-mvp-review.md      # CHECKPOINT 7 retrospective written after MVP shipped
```

Co-located `*.test.ts` next to source for unit tests. Integration tests under `tests/`.

## Pre-flight (run when picking up a session)

```bash
git log --oneline -5    # confirm latest commit
npm test                # 136 passed, 0 todo
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
