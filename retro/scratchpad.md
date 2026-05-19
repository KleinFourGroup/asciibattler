# Scratchpad — rolling notes on process, decisions, gotchas

Running notebook of "things worth talking about" — drop anything useful here as you build, so we're not reconstructing it cold weeks later. Most of this fed into the MVP retrospective at [post-mvp-review.md](post-mvp-review.md); keep adding new observations as post-MVP work continues.

Keep entries short. Link commits and files where useful. Group loosely by theme.

---

## Process / collaboration

- **Roadmap convention held up well in Phase 3.** "One step → one commit, stop at every checkpoint" produced clean, reviewable history and surfaced the right decisions at the right time (e.g., the grid-mapping decision at CHECKPOINT 4, the pacing/lineup decisions at CHECKPOINT 5).
- **The "trust but verify" loop.** Several misreads got caught only by the user eyeballing the running game (drift-to-left from path bias, idle-frame stutter between move lerps, "did units go idle?" hypothesis on the cooldown bug). Tests can't see these. Worth keeping the visual-verify discipline post-MVP.
- **Splitting commits when a step's intent grew mid-flight.** Step 3.7 ended up shipping the AttackBehavior alone; the cooldown bump and the shared-cooldown refactor went as their own commits afterward. The discipline of "this changed scope, so split the commit" preserved bisectable history. Keep doing that.

## Decisions worth revisiting

- **Behavior-order-as-priority is a stopgap.** With only `[Movement, Attack, Death]`, array order is fine. The first new behavior that doesn't fit the move-or-attack mental model (status effects, abilities, archetype-specific actions) will force the explicit action-selector refactor logged in TODO.md. Discuss whether that should land before *or* after the first post-MVP gameplay feature.
- **`unit.actionCooldown` lives on Unit, not in a Behavior.** Means Unit now has runtime state that belongs to behaviors. If we add more shared-but-behavior-owned state (current target cache, threat tables, etc.) Unit might bloat. Could split into a `UnitRuntime` companion record. Wait until we have a second example before extracting.
- **Color is renderer-side, not on Unit.** Made sense, but means every unit-spawn event triggers a `world.findUnit` lookup in BattleRenderer to read team. If unit count climbs into the hundreds, consider attaching team/glyph snapshots to spawn-events to avoid the lookup. Premature optimization for now.

## Gotchas that cost time (process learning, not just "things that bit us")

- **The idle-frame stutter between move lerps.** Pure visual symptom; root cause was an off-by-one in cooldown reset. Hours of "is there acceleration? am I misjudging dt?" before tracing the tick table. Worth a small note in any future "writing tick-based behaviors" doc.
- **`exactOptionalPropertyTypes` rejected `undefined` in object literals.** Trivial fix once known; surprising the first time. Could be worth a one-liner in CLAUDE.md or a project linter rule that catches it before TS does.
- **Stale Vite process on port 5173.** The dev server hung around from a previous session and grabbed 5173, so a fresh `npm run dev` silently fell back to 5174. Diagnosed via `Get-NetTCPConnection`. Maybe HANDOFF should call out "check ports before starting."

## Architectural calls that held up

- **Sim/render seam via the EventBus.** Adding `unit:moved`, `unit:attacked`, `unit:died` each took one new handler in BattleRenderer and zero changes to sim code. The seam earned its keep.
- **Single InstancedMesh for all sprites.** Hasn't been stressed yet (10 units), but the API hasn't fought us either. Sprite handles as opaque numeric IDs let us swap visual concerns (color, alpha, position) without leaking three.js into sim.
- **Per-archetype seconds-authored cooldowns.** Bumping the durations for the CHECKPOINT 5 pacing was a one-file data edit. The `secondsToTicks` contract paid off the first time we used it.

## To consider for next project structure

- **Move geometry helpers (`chebyshev`, `inBounds`) to a shared module.** Currently duplicated in `Pathfinding`, `Targeting`, `MovementBehavior`. Rule of three was hit; we deferred extraction to avoid a wide refactor mid-step. Worth extracting before more callers appear.
- **Behaviors as functions vs classes.** Now that they're stateless w.r.t. cooldown, `update(unit, world)` could be a plain function. Class-instance-per-unit is overhead. Defer until a second stateful field appears (then revisit whether to extract per-unit runtime).

## A1 — Action selector + cooldown/duration split (post-MVP foundation)

- **Behavior-produces-Action picked over Action-first.** Kept `Behavior` as
  the decision-making noun; it returns scored `ActionProposal`s consumed by
  a selector in `World.tick()`. Allows future behaviors to wrap/decorate
  each other without restructuring archetypes.
- **`activeAction` state-machine picked over queued effects.** Single
  in-flight action per unit; selector short-circuits while busy; effect
  ticks fire from the active action's listed offsets. Gives a clean "what
  is this unit doing?" read for the future per-unit progress bar (B3).
- **Mid-impl refinement: `cooldown` / `duration` / `effectTicks` live on
  `ActionProposal`, not on `Action`.** Per-unit stats give per-unit
  timings; if those fields lived on `Action` as readonly, `MoveAction`
  would need to be per-unit (or carry methods reading from unit). Putting
  them on the proposal keeps Actions as pure verbs.
- **Score gap 1 (move) vs 10 (attack)** leaves headroom for future
  behaviors (healers scoring ~15 when ally critical, rogues using score for
  kiting decisions, etc.). Score-tie tiebreaker is "first proposer wins" —
  flag in C2 if it bites.
- **DeathBehavior deleted; death folded into `World.tick`** as a
  top-of-loop short-circuit. Cleaner than a "pseudo-behavior with priority
  Infinity" workaround. Death tests moved from `DeathBehavior.test.ts` to
  `World.test.ts` so the contract survives the file deletion.
- **Per-action cooldown via `Map<string, number>` on Unit.** Keyed by
  `Action.id`. Loses some serialization niceness vs an array — A2 should
  decide whether to keep Map or shift to a typed record.
- **Determinism test didn't need a re-baseline.** It asserts equality
  *between* two runs at the same seed, not absolute event values. The
  refactor preserved determinism intrinsically; no snapshot fixture to
  update. Worth remembering: equality-of-replays beats absolute-value
  assertions for refactor-tolerance.
- **Cadence tests survived the refactor unchanged.** Movement / Attack /
  shared-cooldown tests passed without edits — the new model produces the
  same "N ticks apart" cadence for move/attack as the old shared
  cooldown. The retro's "write down expected cadence" lesson held: those
  tests already encoded the load-bearing contract.

## Phase 4 notes (run structure)

- **`Run` as pure meta-state, `Game` owns World lifecycle.** Run never touches World — it only emits `battle:started` with an encounter snapshot, and Game spins up the actual `World`. Kept the sim/meta seam clean and made the per-battle teardown (BattleRenderer.detach + world=null) easy to reason about. This pattern is worth repeating for any future "meta vs sim" split.
- **Subscription-order coupling between Run and Game.** Run subscribes to `battle:ended` first (constructed earlier in Game's ctor), so its `phase` is updated before Game's handler reads it. Works, but it's a load-bearing implicit ordering. If Run-vs-Game ordering ever has to flex, we should make it explicit (e.g., Run.advance() called from Game's handler) instead of relying on subscription order.
- **`Run.dispose()` was added late but is essential.** The defeat → reset path creates a new Run; without `dispose()`, the dead Run keeps responding to events on the shared bus. The captured-unsub-array pattern is fine but feels boilerplate-y; if more long-lived components grow this, a base class might earn its keep.
- **Fixed-size column arrays for unit placement bit us when the team grew.** The 4.4 followup fix (off-grid recruits) was a five-minute debug because unit IDs incremented (so the unit *existed*) but its position was `{ x: undefined, y: 2 }`. Pathfinding silently returns NaN distances and the unit goes inert. Worth a general lesson: any data structure indexed by "team size" needs a growth story up front.
- **CHECKPOINT 6 anti-snowball tuning worked first-try.** Enemy team = `playerSize - 1` with `+5% HP per floor` made the first battle a comfortable 5v4 and the terminal battle a genuine threat — confirmed by losing battle 4 organically during 4.6 verification. Holding the +1 player advantage constant is a clean knob; consider this pattern (delta + floor multiplier) when balancing future content.
- **Browser-verify rough edges.** `preview_click` selector-based clicks didn't reliably land on visible cards in narrow viewports; `preview_eval` with `element.click()` worked every time. Also: the preview MCP appears to multiplex console output 6×, which is purely visual noise but easy to mis-read. Worth flagging both in any future onboarding doc.

## A2 — Headless input + serialization plumbing

- **Inputs / outputs split was the right framing.** Up-front question — "should commands be a new event family on the bus, or a separate channel?" — clarified quickly once we noticed the bus events are all past-tense (`subject:verbed`) by convention, and the migrated three (`run:nodeEntered`, `recruit:chosen`, `run:resetRequested`) were all imperatives sneaking in. Separating them into a `RunCommand` union and a `RunDispatcher` interface read naturally. Bus is for "X happened"; channel is for "do X." If you find yourself adding a new past-tense bus event that's really an imperative, it's a `RunCommand` instead.
- **Synchronous Run.dispatch vs queued World commands — different invariants, different shapes.** Run isn't tick-driven so its commands apply immediately (UI clicked → state updates → screen swap). World *is* tick-driven so its commands queue and drain at a deterministic apply-point (top of tick). Trying to unify these into one queue would have either lost the synchronous UI flow or added phantom queueing on the Run side. Two channels was simpler than one.
- **`resetRun` doesn't belong on Run.** A Run can't reset itself — disposing and recreating it has to happen one layer up. Game intercepts that command kind and routes it to `resetRun()`. Run.dispatch sees `resetRun` and silently no-ops. The silent no-op is documented but mildly ugly; alternative is to type-narrow `Run.dispatch`'s parameter to exclude `resetRun`, but that fragments the `RunCommand` union. Left the no-op as the simpler choice.
- **`Game implements RunDispatcher`.** UI captures `Game` (not `Run`) as their dispatcher, so swapping `this.run` on reset is invisible to the UI screens — they don't have to be re-wired. Worth remembering this indirection pattern any time a long-lived component depends on a short-lived one.
- **Two-phase World rehydration was a real concern.** First pass had `Unit` constructed with `activeAction` set in one step — broke because an in-flight `AttackAction` references another `Unit` by id, and target may not be in the world yet (units are pushed in iteration order; target may be later in the snapshot list). Split into: instantiate every bare unit first, then resolve activeAction references once `world.findUnit` works. Add an `if (target?) target.foo` defensive guard for the case where a snapshot's target died mid-roundtrip. (For move/attack basic actions this is academic since they finish their work in `start`, but the pattern needs to handle the C2 multi-tick charge attacks already on the radar.)
- **`Run.fromJSON` bypasses the constructor.** A fresh `new Run(seed, bus)` regenerates the NodeMap and emits `run:started`; neither is right for restoring a snapshot. Used `Object.create(Run.prototype)` + a `-readonly` cast to populate the fields, then called `subscribe()` to wire up `battle:ended`. Documented in gotcha #21 — if someone "cleans up" by collapsing this into a constructor variant, they need to preserve both behaviors.
- **Behavior `kind` is doubled — static + instance.** `static readonly kind = '...'` lets the registry key off the class without instantiating; `readonly kind = X.kind` lets `unit.behaviors.map(b => b.kind)` work at serialize time. Slightly redundant but the alternative (only static, with a type-side mapping) requires more incantation. Worth the symmetry.
- **Vitest didn't need re-baselining.** A1's lesson held — the determinism test asserts equality *between* runs at the same seed, not absolute values. The A2 refactor preserved that determinism intrinsically. New snapshot-roundtrip test added 5 cases; the existing 136 tests passed unchanged (modulo updating the migrated Run tests to call `run.dispatch(...)` instead of `bus.emit(...)`, which is a mechanical change not a semantic one).

## A3 — Headless fuzz harness

- **Strategy as an interface, not a class hierarchy.** `FuzzStrategy` has two methods (`pickNextNode`, `pickRecruit`) and a `name` field. No base class. Both shipped strategies are ~20 LOC. If a future strategy genuinely needs shared scaffolding (priority-weighted lookahead, simulated rollouts), then refactor — until then the duplication is two `rng.pick(frontier)` calls.
- **Recruit signal at MVP scope is weak.** PureRandom and Greedy both finish at 50% win rate with average floor 3.6 over 10 seeds. The CHECKPOINT 6 difficulty curve was tuned for the original 4-floor scope where one recruit doesn't reshape the team enough to matter; expect this to diverge once C2 adds more archetypes or C6 stretches runs to 10+ floors. The harness will tell us when. Keep an eye on the 50/50 signal — if it stays flat after archetypes land, balance lever needs to move somewhere else (per-floor scaling, encounter composition, etc.).
- **Node ESM + extensionless TS imports = friction.** Tried `node tests/fuzz/cli.ts` first — Node 25's native TS strip works for a single file, but it won't resolve extensionless relative imports (the entire existing codebase uses them). Vite/vitest have their own resolvers so this doesn't surface in `npm test`. Added `tsx` (one dev dep, ~20KB) for the CLI; gotcha #22 in HANDOFF. If we ever add another node-side script, use tsx — don't try to make stock Node ESM work.
- **Vitest exclude is path-based; positional args don't override it.** First attempt was `npm run fuzz:smoke = vitest run tests/fuzz`, hoping the path arg would re-include the excluded dir. Vitest treats positional args as filters, not include overrides — got "No test files found" until I switched to a separate `vitest.fuzz.config.ts`. Worth remembering: vitest filters subset the discovered tests; they don't expand the set.
- **Two-channel battle setup payoff.** Pulling `spawnTeam` out of Game.ts into `src/sim/battleSetup.ts` so the fuzz harness can use it was a forced extraction (DRY would have argued for it earlier; the harness made it impossible to keep both copies in sync). The cleanup also tightened Game.ts — `Game.spawnTeam` had imported `MovementBehavior` and `AttackBehavior` purely to inject them at spawn time. Now Game.ts has zero direct behavior-class imports. Worth being on the lookout for similar forced extractions when adding tools that exercise the engine.
- **`battle:started` listener registers before `new Run`.** The harness wires its `bus.on('battle:started', ...)` *before* `new Run(seed, bus)`. If Run's constructor synchronously dispatched a node-enter command in its ctor (it doesn't, but hypothetically), the listener would miss the resulting battle:started. The "subscribe before construct" pattern is the same one Game uses (gotcha #12). Mention this if anyone asks why the harness sets up listeners against a closure-captured `run` that doesn't exist yet — the closure resolves at call-time, not declare-time.
- **Per-failure markdown trace beats per-tick log.** Was tempted to include the full event stream in the failure trace — useful for replay debugging but balloons the file size, and most failure investigations only need "what happened per floor, what did I recruit." Kept the trace tight; if a specific failure needs more, the determinism contract means re-running the seed regenerates the full event sequence.

## A5 — Scene system

- **Landed speculatively to close out Phase A.** Roadmap said "don't do A5 until a feature pulls on it" — sensible YAGNI, but the user opted to ship Phase A as a coherent unit rather than reopen these files later. Worth remembering: "don't refactor speculatively" is a strong default, but "ship the foundation as one coherent thing" can outweigh it when the touch surface is already understood. The decision is project-specific; don't fold this into a general rule.
- **Single-active over stack.** Roadmap text said "scene-stack manager" but the codebase has at most one visible phase at a time. Building a Scene[] would have added push/pop machinery with no current consumer; single `activeScene: Scene | null` plus a `swap(next)` method does everything the current loop needs. Easy upgrade later if a real overlay use-case (e.g. pause menu) shows up. The lesson: read "stack" in a roadmap as "polymorphic seam" not "stack data structure" — pick the simplest shape that satisfies the constraints.
- **Context bundle over constructor injection.** Scenes have no deps until `mount(ctx)`. Constructors are zero-arg (or take scene-specific args like the recruit offer). Makes scenes cheap to instantiate and lets `Game.buildContext()` rebuild the bundle each swap — important for surviving `resetRun`, which replaces `this.run`. If we'd injected via constructor, the dispatcher reference held by an in-flight Scene would still be valid (Game persists) but `ctx.run` would be stale; this avoids that entire class of bug.
- **HUD became per-battle.** Pre-A5 HUD was a singleton because Game spawned it once and reused `show()/hide()`. With BattleScene owning the HUD, each battle gets a fresh instance — so HUD grew `dispose()` (unsubscribes captured-array, fadeOutAndRemove on root) matching the BattleRenderer pattern. Forced symmetry across the three battle-time components (World, BattleRenderer, HUD) — they all now have a real teardown story. Worth being on the lookout for similar singletons during future migrations: when they get pulled into a Scene, they need a dispose.
- **Bus-driven swaps, with one explicit exception.** Five of the six transitions ride bus events (`battle:started`, `recruit:offered`, `run:victory`, `run:defeated`, and reset which is local). The sixth — recruit→map after a chooseRecruit — fires no bus event because Run.handleChooseRecruit just sets `phase = 'map'` and stops. Two options: add a `run:nodeAdvanced` event for one consumer, or branch in Game.dispatch. Branched in Game.dispatch; one explicit `if (run.phase === 'map') swap(new MapScene())` is cheaper than a new event with one subscriber. Worth remembering when an event would have a 1:1 emitter:subscriber ratio — that's usually a sign it shouldn't be an event.
- **Tests didn't need changes.** None of the 146 tests import Game.ts, BattleRenderer.ts, or any UI screen. The seam was already clean before A5 — the scene refactor just renamed where things live, not what they do. The fuzz harness (which directly uses `spawnTeam` + drives `World.tick()` headlessly) needs no Game/Scene at all, so it's untouched too. Confirms the original sim/render/ui separation paid off.

## A4 — Config externalization

- **Two-layer config: JSON source-of-truth, TS validator.** Each balance file gets a `config/*.json` (the editable surface) and a `src/config/*.ts` (zod schema + parse + typed export). Consumers import the *parsed* value, not the JSON directly. The schema layer is the only place that knows the JSON shape — call sites are typed against zod's inference, so a JSON edit that breaks the schema fails at boot, not at the first call site that touches the bad field. Worth keeping the pattern as more configs land (mods, user-saved seeds, etc.).
- **Zod was the right call over hand-rolled validators.** Initially leaned hand-rolled — five small files, the validator code would be ~30 lines per. But zod's range-with-refinement (`RangeSchema = z.tuple([z.number(), z.number()]).refine(...)`) ended up being reused across three of the four files. Without zod I'd have hand-coded the same range check four times. ~30KB gzip is fine for the editor ergonomics + reuse.
- **`Archetype` union still hand-written.** TS type `Archetype = 'melee' | 'ranged'` doesn't derive from the JSON keys (you'd need a const-asserted array or `keyof typeof ARCHETYPES`). Tried `keyof typeof ARCHETYPES` first — works but `ArchetypesSchema = z.object({ melee, ranged })` has the literal keys baked into the schema, so adding C2's mage means updating both the schema and the union together. Acceptable for the small set; revisit if archetype count climbs.
- **GLSL ES 1.00 can't index uniform arrays by non-const variables.** The palette shader has `uPalette[__PALETTE_SIZE__]` and a `for (int i = 0; i < __PALETTE_SIZE__; ...)` loop — both need integer literals, not uniforms. Tried passing the size as a uniform first; the shader compiler rejected it. Hence the `__NAME__` placeholder + substituteShaderConstants helper. Worth flagging if anyone wonders why we don't just put it in a uniform: WebGL 1's GLSL is more restrictive than vanilla GLSL on this.
- **Shared `fullscreen-pass.vert.glsl` across all three post-process passes.** They each had an identical 5-line pass-through vertex shader before. Pulling it into one file means a future change to the post-process quad (e.g. flipping Y for a different render target) is one edit, not three. Wished I'd done this when the dither pass was added.
- **Vite `?raw` imports don't trigger HMR for the .glsl file.** Editing a shader file requires a full reload to pick up. Acceptable for now (we don't iterate on shaders constantly), but if shader tuning becomes a tight loop, look at vite-plugin-glsl or a manual HMR handler. Flag for B-phase visual work.
