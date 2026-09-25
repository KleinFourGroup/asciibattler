# Verifying in Claude Code's Browser pane

Read this before any verify in the Browser pane (the `preview_*` and browser
tools). It is specific to Claude Code; see [CLAUDE.md](../CLAUDE.md). The
pane is Chromium, usually hidden, and the user plays in Firefox, so the pane
proves wiring. Feel, timing and Firefox-only behaviour belong to the user's
eye.

## Getting a live page

- Start the server with `preview_start` and the `dev-preview` config (port
  5191); the user's own dev server is usually on 5173. The desktop app can
  stop the server between turns, so expect to start it once per verify turn.
- `preview_start` returns before the page is live. A probe in the same turn
  reads browser defaults (zero stylesheets, 13.33 px buttons,
  `window.__game` undefined) and looks like a catastrophic regression.
  Reload with `location.reload()` through `javascript_tool` (a `navigate` to
  the URL the tab already holds can be refused), then poll until
  `document.styleSheets.length > 0 && window.__game` before believing any
  measurement. The wait isn't a fixed number.
- Set a fixture URL only after that poll succeeds. A `location.href` set in
  the first call after `preview_start` gets overwritten by the pane's own
  initial load.
- The user's tab and yours are separate page instances. A days-old tab that
  has absorbed many Vite hot patches can run old code; when the user's
  symptom contradicts your clean measurement, ask for a hard reload before
  hunting in the code.
- Vite fully reloads the tab when a `.ts` file changes, which resets module
  state (dev overrides, `window.__probe`). Check
  `performance.getEntriesByType('navigation')[0].type === 'reload'` before
  blaming code, and don't write a source file in the middle of a pane
  sequence.

## The hidden pane

A pane that isn't displayed runs no `requestAnimationFrame`, stalls the Web
Animations API, holds CSS transitions at their first frame, and can be zero
pixels wide.

- Before any layout or box read, `resize_window` to 1280×720 and dispatch a
  `resize` event (also the fix when the camera boots with aspect NaN). Reset
  to `desktop` afterwards.
- Drive the game loop by hand: `__game.activeScene.tick(1/60)` in a loop
  walks the countdown and playback. (Older recipe, still valid for a bare
  battle: `br.world.tick(); br.update(0.05)` on
  `__game.activeScene.battleRenderer`.) Chunk a long drive to about one
  battle per call; a long synchronous call can time out while the work
  finishes, so read the state before re-driving.
- A screenshot forces a real frame. Take one between changing something and
  reading the result: a probe that changes a dial and reads the DOM in the
  same eval reads the previous view. Computed styles of a `:focus-visible` or
  hover rule can show no effect until a frame runs.
- Park real-time clocks before forcing frames
  (`activeScene.countdown.advance = () => {}`), or a few screenshots can
  expire a countdown mid-probe. To freeze a whole run for a stable shot:
  `scene.clock.advance = () => {}`.
- A `javascript_tool` script that times out isn't dead. One suspended on
  `await requestAnimationFrame` resumes a step at every later screenshot and
  keeps acting for minutes. Reload the page after any timed-out script, and
  never await rAF in a pane probe; call the hooks synchronously.
- An `Element.animate()` or fade in the hidden pane sits at its start, and a
  programmatic `finish()` may never fire its event. Timing claims from the
  pane are wiring only. To catch a mid-progress visual, freeze
  `br.animator.update` and set the value by hand
  (`sprites.updateSprite(handle, { alpha: 0.5 })`), or lengthen the duration
  in config temporarily.
- A tab that un-throttles mid-session (becomes active) runs the battle to
  completion on the real loop, and `activeScene` may have moved on between
  evals. Keep probe state on `window.__x` so it survives a scene change.

## Reading state

- `window.__game` (DEV only) exposes `bus`, `renderer`, `run`, `activeScene`,
  `keybindings`, `sprites`. It is the top-level `Game`, so `__game.world` is
  `"none"`; during a battle, `__game.activeScene.world` is the live `World`
  (TypeScript `private` fields are readable at runtime). For logic, prefer a
  headless test.
- To check sim event timing, install a bus recorder on `window.__rec` in one
  eval, hand-drive `world.tick()` in the next, then read the array; it
  survives the scene swap. Hand-driving advances the sim but not the
  `performance.now()`-anchored render lerp, so this proves event timing,
  never on-screen motion. Unsubscribe and delete `window.__rec` afterwards.
- Drive a battle: `__game.dispatch({kind:'enterNode', nodeId})`, then
  `{kind:'advanceTurn'}` to pass the pre-turn screen.
- Prefer bus-event payloads to DOM reads around scene changes:
  `fadeOutAndRemove` keeps the outgoing screen in the DOM for ~180 ms, so a
  query right after a swap can return the old screen. Subscribe, drive, read
  the array. The BattleRenderer's handlers run first (subscription order), so
  in your handler the hitsplat or projectile already exists.
- Catch transient DOM (hitsplats) with a `MutationObserver`, not a
  screenshot.
- Count calls by wrapping methods on the prototypes
  (`Object.getPrototypeOf(activeScene.battleRenderer)`, `__game.renderer`)
  instead of reading pixels.
- Screenshots are JPEG and smear 1–2 px detail (scanlines, stipple). When a
  screenshot contradicts intuition, sample canvas pixels with `getImageData`,
  or ask the user to look natively. On a WebGL canvas `getImageData` can
  return a cleared buffer (`preserveDrawingBuffer` is false): read in the
  same frame as the render, or set it to true temporarily for debugging.
- A pixel A/B of the board: park the countdown, hold shader
  time (`scene.advanceShaderTime = () => {}`), hide the sprites
  (`__game.sprites.mesh` and `bloomMesh` `.visible = false`), then render
  and read in one eval: `renderer.onFrame(0); renderer.renderTwoPass();
  gl.readPixels(...)`, twice after a change so a recompile has settled. Plant
  a known error and confirm the comparison fails it: a flat-pixel check
  passed a wrong mark size that a per-shape area check caught.
- The pane repeats console output six times. It's cosmetic; events fire
  once.
- The `find` tool can't see text outside a control (a run of stars in a
  plain span); use a DOM query or coordinates.
- Cap a probe's output (`.slice(0, 8)`); an uncapped diff can cost thousands
  of tokens.

## Input

- The pane is Chromium; the user is on Firefox. A dev chord that passes a
  synthetic `KeyboardEvent` in the pane can be one Firefox takes for itself
  (Ctrl+Alt+R is Reader View; gotcha #134). A new Ctrl+Alt chord has to
  clear three sets (the keybinding registry's codes, `devKeys.ts`, and the
  browsers' own) and get one real press in Firefox before it counts.
- The pane's key tool delivers an empty `KeyboardEvent.code`, so anything
  bound through the code-based keybinding registry needs a synthetic
  `keydown` that carries the code.
- Enter on a focused native `<button>` does nothing in the pane: focus moves,
  no click fires. A synthetic `KeyboardEvent` runs JS listeners but never a
  native default action, so every Enter-on-button route is wiring-only here
  and a Firefox read for the user.
- Firefox's Tab order runs off the page into the browser UI, where the pane
  wraps silently; Tab-order bugs at the page edges can't be seen here.
- A click can land outside the clickable region in a narrow viewport. If it
  "succeeds" but nothing fires, use `element.click()` through
  `javascript_tool`.

## Fixtures

- URL dials pin a run: `?seed=<n>` with `?layout=`, `?character=`,
  `?firstNode=`, `?roster=`. For example
  `?layout=isthmus&seed=7&character=soldier` gives an event at node 0 and a
  battle at node 1. `?roster=` fields any archetype. `?encounter=` forces
  only nodes of a matching kind, so `?firstNode=elite` is the real elite
  fixture. An unseeded reload starts a different run, so never compare
  before and after across one.
- A whole screen can be fixtured in one eval on the same run through the
  run's private fields and the bus: set `run.pendingRewards` or call
  `run.rollPortStock(n)`, then emit `reward:offered` or `port:entered`.
- To force a defeat or victory, temporarily add
  `(window as unknown as { __bus: typeof this.bus }).__bus = this.bus;` to
  the `Game` constructor, then emit `battle:ended` with `{ winner: 'enemy' }`
  or `run:victory`. Remove the hook before committing.
- Default views can mislead: a visualizer once opened on seed 1, the worst
  case in a 500-seed corpus. When an impression contradicts an instrument,
  check what the default view happened to show.

## Layout measurements

- Compare before and after on the same page with a same-run toggle: inject a
  `<style>` that reverts the change ("before"), remove it ("after"). CSS
  edits hot-swap without a reload; a `.ts` edit doesn't.
- The box oracle: key every visible `#ui *` rect by its DOM path, diff across
  the toggle, and report only what moved outside the surface you meant to
  change.
- The content sweep: write a longer value into one element, list every other
  element whose rect moved, restore. Mutate nodes production never rewrites;
  a per-frame refresh resets the rest.
- `ResizeObserver` and rAF consumers need a frame; take a screenshot to force
  one.
