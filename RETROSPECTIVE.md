# RETROSPECTIVE — discussion queue for post-MVP review

The user wants a small retrospective after the MVP ships. This file is the scratchpad — drop anything worth talking about here as we go, so we're not reconstructing it cold weeks later.

Keep entries short. Link commits and files where useful. Group loosely by theme; merge or prune at retro time.

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
