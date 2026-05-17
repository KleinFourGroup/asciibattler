# Post-MVP review

Brutally honest retrospective written at CHECKPOINT 7 after MVP shipped. Not
onboarding material — kept here for history and future-session learning.

Companion to [`retro/scratchpad.md`](scratchpad.md) (formerly
`RETROSPECTIVE.md`), which was the running scratchpad we filled as we built.

---

## 1. Particularly thorny issues, and how to avoid them

**The cooldown idle-frame stutter (Phase 3).** A pure visual symptom — root
cause was an off-by-one in cooldown reset. The unit tests passed because
they tested ticks-in-isolation, not tick-cadence-relative-to-lerp-duration.
Less time-expensive to diagnose than it felt in the moment, but the lesson
holds: **for any system where the cadence of events matters, write down the
expected wall-clock cadence in plain English before coding.** If "a unit
moves every 0.7s with a 0.7s lerp" is the contract, a contract test should
check it. Otherwise you only catch cadence bugs by eye.

**The palette-quant color-key got broken twice.** Once when terrain darks
were nearly snapping to background (commit `2857c91`), and again in Step 5.4
when the new dither pass perturbed the background sentinel. HANDOFF lists
this exact failure mode as gotcha #3 and we still stepped on it.
**Prevention:** before adding a new pass to an existing pipeline, re-read
the constraints on adjacent passes. Reading HANDOFF at session-start isn't
enough — re-consult it when designing anything that touches a load-bearing
seam. "What assumptions am I about to perturb?" should be a pre-mortem on
every cross-cutting change.

**The Preview MCP screenshot misdirection (Steps 5.3, 5.4).** Twice this
session the preview screenshots looked broken (tiny arena in top-left, then
no visible scanlines) and we chased phantom rendering bugs before pixel
sampling proved the actual canvas was fine. The screenshot tool was lying
both times — JPEG compression and viewport sampling artifacts.
**Prevention:** the HANDOFF already warns the preview MCP is unreliable.
A hard rule going forward: **if a screenshot contradicts intuition, sample
canvas pixels before re-engineering anything.** Adding to the gotchas list.

**The off-grid recruit bug (Step 4.4).** Unit IDs incremented (so the unit
*existed*) but its position was `{x: undefined, y: 2}` because of a
fixed-size column array. Pathfinding silently returned NaN distances and
the unit went inert. **Prevention:** a one-line guard in `World.spawnUnit`
(throw if `!Number.isInteger(position.x)`) would catch this whole class of
bug at the seam where it actually matters. Worth adding.

## 2. Issues likely to arise in the future

**Technical:**

- The **action-selector refactor** (queued in TODO.md) gets harder the
  longer it's deferred. The moment one non-trivial behavior lands (status
  effects, abilities), the implicit array-order priority will fight back.
  Do it *before* the first new gameplay feature, not after.
- **`world.findUnit` is O(n)** linear search, called per spawn/attack/death
  by both `BattleRenderer` and `HUD`. Fine at 10 units, painful at 100+.
  Cheap fix when it bites: keep a `Map<id, Unit>` alongside the array in
  `World`.
- **Shared `actionCooldown` on Unit** will fight the action selector.
  Abilities probably want independent cooldowns. Plan for cooldown-per-action
  during the refactor.
- **Color/glyph computed renderer-side** forces a `findUnit` on every spawn
  event. If we ever spawn in bursts (e.g., a summon ability), denormalize
  team/glyph onto the spawn event payload.
- **No serialization story.** Save/load is on the post-MVP list. Class-
  instance behaviors and live RNG state will need a rehydrate path. Worth
  designing once before adding more stateful systems.

**Workflow:**

- **HANDOFF-discipline is load-bearing.** The "one step → one commit" + "read
  HANDOFF first" combo only works as long as we keep doing it. If a future
  session skips it, gotchas resurface immediately (this session was proof).
- **Visual-verify won't scale.** Adding gameplay = adding edge cases the eye
  has to catch. Consider a tiny "deterministic replay" system: record
  (seed, recruit choices, node path), replay it, screenshot key frames,
  diff. Catches regressions without the user having to play through.
- **Browser-verify via Preview MCP is fragile for visual changes.** For
  complex visual diffs, ask the user to check at native resolution instead
  of chasing tooling artifacts. Default to "you check at native resolution"
  for anything sub-pixel.

## 3. Things the user could have done better

(Asked for explicitly. Nudges, not failings — Matt collaborated really well
overall.)

- **Sometimes shipped on "looks great!" when there were open tradeoff
  questions.** The dither/scanline tuning, for instance — Claude made
  shader-threshold calls based only on output screenshots, with no
  intermediate chance for Matt to weigh in. When Claude proposes a
  multi-step iteration, occasionally short-circuit it ("show me three
  intensities side-by-side" / "let me look in my browser before you tune").
- **Didn't push back much on recommendations.** Sometimes that's efficient
  when Claude is right; sometimes it means a wrong call ships unchallenged.
  The HP-bars conversation was a great model — Matt asked about difficulty
  *before* deciding. More of that, especially for non-obvious tradeoffs.
- **Let Claude drift into rabbit holes a couple of times** (the 5.3 camera-
  screenshot mess, the 5.4 scanline-visibility chase). A "sanity-check the
  tool first" interrupt earlier saves turns. Be more aggressive about
  cutting Claude off when it's clearly chasing the wrong thread.
- **Shipped before retro on a couple of steps.** Not a big deal at MVP
  scale; for bigger projects, retro-before-ship catches "wait, this isn't
  really done" before it's published.

## 4. Other lessons and suggestions

- **The seconds-authored cooldowns pattern is the single best architectural
  call we made.** `secondsToTicks` paid off the first time we tuned pacing
  and again every time after. Steal this template for any future tick-based
  system.
- **The sim/render seam via EventBus** held up under every new event. Worth
  repeating in any future "deterministic simulation + nice rendering" project.
- **CHECKPOINT structure of the roadmap is excellent** for catching decisions
  at the right altitude. CHECKPOINT 5 (battle pacing) and CHECKPOINT 6 (anti-
  snowball difficulty) both surfaced exactly the right design tradeoff at
  exactly the right moment. Keep this pattern.
- **Determinism from day one paid off.** Even though we never used the
  replay capability in MVP, it's free now that everything threads through
  a seeded RNG. Bug reports will be trivially reproducible.
- **TODO.md + scratchpad-retro is a great workflow**, but it relies on both
  collaborators contributing. Claude added most of the entries; if the
  scratchpad is meant to capture Matt's perspective too, drop notes in
  there as you go.
- **Add a `.gitattributes` to normalize line endings.** Every commit logs
  "LF will be replaced by CRLF" warnings on Windows. Trivial fix, but it's
  noise we've been ignoring.

**Suggested first three post-MVP moves** (in order):

1. **Action selector refactor** — foundation work; makes every gameplay
   feature after it cheaper.
2. **Floating per-unit HP bars + bake grid into terrain shader** — visual
   polish Matt's already flagged.
3. **Audio.** Massive perceptual win for contained scope. The autobattler
   genre lives or dies on attack/death sound feedback.
