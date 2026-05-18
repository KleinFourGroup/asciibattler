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
