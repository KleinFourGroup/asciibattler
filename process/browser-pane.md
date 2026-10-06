# Verifying in Claude Code's Browser pane

Read this before any verify in the Browser pane (the `preview_*` and browser
tools). It is specific to Claude Code; see [CLAUDE.md](../CLAUDE.md). The
pane is Chromium, usually hidden, and the user plays in Firefox, so the pane
proves wiring. Feel, timing and Firefox-only behaviour belong to the user's
eye.

## Start with the probe kit

`window.__probe` (DEV only; `src/dev/probe/`) holds the pane's known traps
in code. Start the server with `preview_start` and the `dev-preview` config
(port 5191; the user's own dev server is usually on 5173, and the desktop
app can stop the server between turns). Then:

- **The first call is `await __probe.ready()`**, and it is the first call
  after any navigation or reload. It waits until the page is live and
  returns a report: the URL, whether frames are running (`frames:
  'stopped'` in a hidden pane), the canvas and viewport, the scene, the
  run phase, `page` (the load; a reload changes it), the build's ID,
  the store's status (its adapter, whether it can save) and `lock`, the
  tab's side of the two-tab lock (`held`, or `elsewhere` in a second tab of
  the same origin, which then saves no run). It fails by name
  rather than let a read see a broken page. Each failure says what to do:
  - "not live after 30 s": call it again. The dev server's stand-in
    `__probe` waits while a fresh server holds the page's modules, which
    takes under a second. It took 40 s while the server's file watcher
    covered the fuzz output (`server.watch.ignored` in `vite.config.ts`
    now skips it), so a slow first load again means it is watching too
    much.
  - a stylesheet that failed to load (editing `vite.config.ts` restarts
    the server and can drop a request in flight): `location.reload()`.
  - a 0×0 page or canvas (a hidden pane): `resize_window` to 1280×720.
    Reset to `desktop` when you're done; after a reset the hidden pane
    can be 0×0 again.
  - a canvas box that isn't the page: the layout is off.
  - a URL that isn't the one `go()` asked for (below).
  A stale drawing buffer is fixed by one `resize` event, and the report
  says `resized: true`.
- **`__probe.go(query)` sets the URL** (`go('bp=board-quarry')`), only
  after a `ready()` on this page: a URL set earlier can be replaced by the
  pane's own first load. The call ends in a navigation (the tool says the
  script was cut off); the next call is `await __probe.ready()`, which
  names any pair the new URL lacks. A board fixture replaces the run dials
  in its URL, so `bp=board-…` with `seed=` beside it fails there.
- **`__probe.frame(dt = 0)` before any read that follows a change.** A
  hidden pane runs no frames, so a read after a camera or dial change
  otherwise sees the previous view. It runs one frame of the loop's own
  body (the scene tick, the depth sort, the render); `frame(0)` never
  advances the sim. The loop itself draws the overlays one frame behind a
  camera move (TODO §112); `frame()` accounts for it.
- **`__probe.pixels({ x, y, w, h })` reads a crop of the canvas** in CSS
  pixels from the top-left, rendered and read in one call (the drawing
  buffer isn't kept between tasks): a hash, the mean, distinct colours, and
  each pixel as `#rrggbb` for a crop of 256 pixels or fewer. `{ show: true }`
  also draws it magnified in the page's top-left for a screenshot (the
  `zoom` action can't crop); `__probe.hide()` removes it. The crop is the
  WebGL canvas only: the bars, badges and hitsplats are DOM.
- **`__probe.drive(opts)` plays the run**: each phase's command, battles
  fought by hand-driven frames through their outro, a seeded pick for the
  choices (`seed`, `policy: 'first'`). It returns at the run's end, at
  `until` (a phase), or at its 20 s limit, where the next call carries on;
  `audit(frame)` runs on every `every`-th battle frame (10), rendered
  first, and each string it returns is a finding. The report has the
  phase, battles, commands per phase and a log hash (the same seed and
  options, the same hash). A command that changes nothing throws, since
  the run would stand still.
- **`__probe.journal()` is the run's journal** as Game holds it: the one
  being recorded, or the finished one once the run is over (null with no
  run). Every drive report carries `stateHash`, the hash a replay of that
  journal must reach. Under the runner, `drive-run.js` with
  `'--arg={"journal":true}'` puts the journal in the report, and
  `npm run replay -- <report.json>` replays it under Node and compares the
  two hashes (a dev build of a dirty tree is stamped `-dirty`, which the
  tool refuses without `--force`).
- **`__probe.check()`** is the canvas check every kit read makes.
- **A call the tool gave up on** (it stops waiting at 45 s) keeps running
  in the page. A long kit call stops as soon as a later kit call starts;
  `__probe.running()` lists what is still running. Your own scripts get no
  such guard, so never `await requestAnimationFrame` in a pane probe: a
  suspended one resumes a step at every later screenshot. Call `frame()`.
- **Scripted probes can skip the pane.** `npm run probe -- <script.js>
  [--seed=<n> | --board=<id> | --query=…]` runs a page script after
  `ready()` in an Electron window the user never sees and returns one JSON
  line and an exit code (README "Probing in a hidden window";
  `shell/electron/probes/drive-run.js` plays a whole run).

The kit's use is counted for Round 8's close (`npm run friction-scan`, the
`pane` / `kit` / `runner` columns; META-ROADMAP §Round 8).

## The page and the server

- The user's tab and yours are separate page instances. A days-old tab
  that has absorbed many Vite hot patches can run old code; when the
  user's symptom contradicts your clean measurement, ask for a hard reload
  before hunting in the code.
- Vite fully reloads the tab when a `.ts` file changes, which resets module
  state (the kit's driver, anything on `window`). `ready()`'s `page` tells
  you it happened; don't write a source file in the middle of a pane
  sequence.
- The dev server stamps the build's ID into each page it serves, so
  `ready()`'s `build` names the commit and the tree's state as of that
  load (`-dirty` while anything is uncommitted), not as of the server's
  start.
- Editing `vite.config.ts`, or a file it imports (`src/buildId.ts`,
  `scripts/build-id.mjs`, the probe's `bootstrap.ts`), restarts every
  running dev server, the user's included. Two such edits back to back
  have left a server on the config between them: after reverting a
  planted change there, `touch vite.config.ts` and read the server's HTML
  (`curl http://localhost:5173/`) before trusting it.
- `window.__game` (DEV only) is the top-level `Game`: `bus`, `renderer`,
  `run`, `activeScene`, `keybindings`, `sprites`. `__game.world` is
  `"none"`; during a battle `__game.activeScene.world` is the live `World`
  (TypeScript `private` fields are readable at runtime). For logic, prefer
  a headless test.
- **The production build** has no `__probe` and no `__game`. Build it
  (`npx vite build`), then `preview_start` with the `dist-preview` config
  (port 5192, `vite preview` over `dist/`). Wait for `#ui` to hold three
  children before reading; `<html data-build>` says which build it is. It
  is another origin, so its `localStorage` is not the dev server's.
- **The store** (`src/store/`) is the page's first module. On the dev
  server, `(await import('/src/store/index.ts')).store` is the page's own
  instance. `?store=deny` (DEV only) boots the game with its storage
  refused, the way a browser with site data blocked does: the store reads
  can't-save and touches nothing. To check what is stored, read
  `localStorage` (or Electron's `store.json`) itself, not the store. The
  pane's `localStorage` takes about 50 Mi characters, some ten times a
  stock browser's, so a quota is never measured here.
- **The settings modal** (`src/ui/SettingsOverlay.ts`): the menu's
  Settings row or, in a run, `.settings-chip` opens `.settings-modal`.
  While it is open `__game.playback.isHeld` is true and
  `__game.keybindings.suspensions` is 1; a battle behind it is read with
  `__probe.frame(dt)` before, during and after (the countdown's
  `remaining`, `world.currentTick`). A row is driven by its control's own
  click, or for a slider by setting `value` and dispatching `input` then
  `change`. A key row (`.settings-keys .settings-key`): click it, then
  dispatch a `keydown` that carries `code` on it, and a `keyup` after.
  The pane's own key tool sends an empty `code`, which a waiting row
  swallows. `document.hasFocus()` is false in a hidden pane, so `focus()`
  on another element fires no `blur`: dispatch a `FocusEvent('blur')` to
  check that a lost focus ends a wait.
- **The settings** (`src/settings/`): `__game.settings` is the page's
  model. `set(key, value)` stores the value and applies it at once, and
  `get()` reads them all. What a consumer holds is read from the consumer:
  `__game.audio` (`masterVolume`, `sfxVolume`), `__game.keybindings`,
  `__game.playback.selectedSpeed`, `<html data-motion>`, and on the dev
  server the module state behind `import('/src/ui/lossFx.ts')` and
  `import('/src/render/auraFx.ts')`. A setting written in a check stays in
  the pane's `localStorage` for the next session: remove
  `asciibattler:settings` when you're done. On the production build, plant
  the key's text and reload; `data-motion` is the one consumer a page
  without `__game` shows.
- **Two tabs of one origin** (`tabs_create`, then `navigate`): the first
  to boot holds the run lock and the second reads `lock: 'elsewhere'`,
  can't continue and writes nothing to the run slot, for its life. So a
  tab left open from an earlier check makes the next one a second tab:
  close it (`tabs_close`) before a save or continue check. Closing the
  holder frees the lock for the next boot, not for a tab already open.
  A `.ts` edit reloads every tab on the dev server at once, and the lock
  goes to whichever boots first; a tab opened on run dials then saves its
  own new run over the slot (seen at 115g).
- **A continue check reloads in the middle of a gate too.** A screen can
  hold state the Run doesn't save (the reward screen's taken rows), and a
  reload on arriving at a gate never shows that. Make a first choice
  there, then reload and continue, and compare the screen as well as the
  hash.

## What the kit doesn't hold

- A hidden pane stalls the Web Animations API and holds CSS transitions at
  their first frame. A screenshot forces a real frame: take one between
  changing something and reading a computed style (a `:focus-visible` or
  hover rule can show no effect until a frame runs).
- Park real-time clocks before forcing real frames
  (`activeScene.countdown.advance = () => {}`), or a few screenshots can
  expire a countdown mid-probe. To freeze a whole run for a stable shot:
  `scene.clock.advance = () => {}`. (`drive()` starts each fight itself.)
- An `Element.animate()` or fade in the hidden pane sits at its start, and
  a programmatic `finish()` may never fire its event. Timing claims from
  the pane are wiring only. To catch a mid-progress visual, freeze
  `br.animator.update` and set the value by hand
  (`sprites.updateSprite(handle, { alpha: 0.5 })`), or lengthen the
  duration in config temporarily.
- A tab that un-throttles mid-session (becomes active) runs a battle to
  completion on the real loop, and `activeScene` may have moved on between
  evals. Keep probe state on `window.__x` so it survives a scene change.

## Reading state

- To check sim event timing, install a bus recorder on `window.__rec` in
  one eval, drive in the next, then read the array; it survives the scene
  swap. Hand-driving advances the sim but not the `performance.now()`-
  anchored render lerp, so this proves event timing, never on-screen
  motion. Unsubscribe and delete `window.__rec` afterwards.
- Prefer bus-event payloads to DOM reads around scene changes:
  `fadeOutAndRemove` keeps the outgoing screen in the DOM for ~180 ms, so
  a query right after a swap can return the old screen. The
  BattleRenderer's handlers run first (subscription order), so in your
  handler the hitsplat or projectile already exists.
- Catch transient DOM (hitsplats) with a `MutationObserver`, not a
  screenshot.
- Count calls by wrapping methods on the prototypes
  (`Object.getPrototypeOf(activeScene.battleRenderer)`, `__game.renderer`)
  instead of reading pixels.
- Screenshots are JPEG and smear 1–2 px detail (scanlines, stipple). When a
  screenshot contradicts intuition, read the pixels with
  `__probe.pixels()`, or ask the user to look natively.
- A pixel A/B of the board: park the countdown, hold shader time
  (`scene.advanceShaderTime = () => {}`), hide the sprites
  (`__game.sprites.mesh` and `bloomMesh` `.visible = false`), then read
  with `__probe.pixels()`, twice after a change so a recompile has
  settled. Plant a known error and confirm the comparison fails it: a
  flat-pixel check passed a wrong mark size that a per-shape area check
  caught.
- A pixel A/B across a reload (a code change between the captures): also
  set `material.uniforms.uTime.value = 0` on the scene's `terrain`,
  `apron` and `backdrop`, since a hold keeps whatever time the page had
  reached. Hash the whole canvas, and take the baseline twice across a
  reload before trusting a match. `archive/post-104-worklog.md` §108f has
  the procedure and its controls.
- A same-page shader A/B: swap `material.vertexShader` (with the change cut
  out) on both sprite materials, set `needsUpdate`, then read with
  `__probe.pixels()`, with a standing unit as the pixel-identical control.
- The pane renders on the machine's own GPU through ANGLE (the frame-cost
  bench's report names it), so a timing there is real hardware, in
  Chromium. An emulated viewport larger than the pane gets a canvas at
  full size, but the pane is noisier for timing than a real window.
- The pane repeats console output six times. It's cosmetic; events fire
  once.
- The `find` tool can't see text outside a control (a run of stars in a
  plain span); use a DOM query or coordinates.
- Cap a probe's output (`.slice(0, 8)`); an uncapped diff can cost
  thousands of tokens.
- Keep a long probe's source in the page's `localStorage` and run it with
  one short eval, rather than pasting it into every call; the pane's
  storage survives reloads.

## Input

- The pane is Chromium; the user is on Firefox. A dev chord that passes a
  synthetic `KeyboardEvent` in the pane can be one Firefox takes for itself
  (Ctrl+Alt+R is Reader View; gotcha #134). A new Ctrl+Alt chord has to
  clear two sets (`devKeys.ts` and the browsers' own) and get one real
  press in Firefox before it counts. The keybinding registry ignores a
  keydown with Ctrl, Alt or Meta held, so its codes are no longer a third.
- The pane's key tool delivers an empty `KeyboardEvent.code`, so anything
  bound through the code-based keybinding registry needs a synthetic
  `keydown` that carries the code.
- Enter on a focused native `<button>` does nothing in the pane: focus
  moves, no click fires. A synthetic `KeyboardEvent` runs JS listeners but
  never a native default action, so every Enter-on-button route is
  wiring-only here and a Firefox read for the user.
- Firefox's Tab order runs off the page into the browser UI, where the pane
  wraps silently; Tab-order bugs at the page edges can't be seen here.
- A click can land outside the clickable region in a narrow viewport. If it
  "succeeds" but nothing fires, use `element.click()` through
  `javascript_tool`.

## Fixtures

- A bare URL boots the menu (`ready()` reads `scene: 'MenuScene'`, `phase:
  null`): a continue check clicks its Continue, and a new run goes through
  New run and a character card, with no run until the card. Any run dial
  that parses, or a `bp=` bookmark, skips the menu (`src/scenes/menuRules.ts`),
  and `drive()` needs a run, so a driven check still puts `character=` in
  the URL. A page booted by a dial ends a run the old way (a new run, or
  character select), where a menu boot returns to the menu. `?store=deny`
  is no run dial, so it boots the menu.
- A `go()` ends the script it is called in: read what you need in one call
  and navigate in the next, or the value is lost.
- URL dials pin a run: `seed=<n>` with `layout=`, `character=`,
  `firstNode=`, `roster=`, `hops=` (a short run, to the boss). For example
  `layout=isthmus&seed=7&character=soldier` gives an event at node 0 and a
  battle at node 1. `roster=` fields any archetype. `encounter=` forces
  only nodes of a matching kind, so `firstNode=elite` is the real elite
  fixture. `bp=board-<id>` opens a board-explorer fixture straight into its
  battle (`src/dev/boardPanel/fixtures.ts`). An unseeded reload starts a
  different run, so never compare before and after across one.
- A battle by hand: `__probe.drive({ until: 'battle' })`, or
  `__game.dispatch({kind:'enterNode', nodeId})` then `{kind:'advanceTurn'}`
  to pass the pre-turn screen.
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

- Compare before and after on the same page with a same-run toggle: inject
  a `<style>` that reverts the change ("before"), remove it ("after"). CSS
  edits hot-swap without a reload; a `.ts` edit doesn't.
- The box oracle: key every visible `#ui *` rect by its DOM path, diff
  across the toggle, and report only what moved outside the surface you
  meant to change.
- The content sweep: write a longer value into one element, list every
  other element whose rect moved, restore. Mutate nodes production never
  rewrites; a per-frame refresh resets the rest.
- `ResizeObserver` and rAF consumers need a frame; take a screenshot to
  force one.
