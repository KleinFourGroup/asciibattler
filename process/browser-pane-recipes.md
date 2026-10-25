# Browser-pane recipes

Recipes for particular checks in Claude Code's Browser pane: a build, the
store, the failure plate, the settings and data rows, a run's screens, a
layout. Read [browser-pane.md](browser-pane.md) first; every verify starts
there.

## Builds, the store and failures

- **The production build** has no `__probe` and no `__game`. Build it
  (`npx vite build`), then `preview_start` with the `dist-preview` config
  (port 5192, `vite preview` over `dist/`). Wait for `#ui` to hold three
  children before reading; `<html data-build>` says which build it is. It
  is another origin, so its `localStorage` is not the dev server's.
- **The itch build** (`node scripts/itch-zip.mjs [--diag]`) is served to
  the pane by the `itch-preview` config (port 5193, `vite preview` over
  `output/itch/current/`), a third origin with its own `localStorage`.
  With `--diag` the page has `window.__diag` (`report()`,
  `measureLimit()`, `bench()`) and no `__probe`. The pane's quota is
  52,428,800 characters, which `measureLimit()` must find there: its
  known answer on a real browser.
- **The store** (`src/store/`) is the page's first module. On the dev
  server, `(await import('/src/store/index.ts')).store` is the page's own
  instance. `?store=deny` (DEV only) boots the game with its storage
  refused, the way a browser with site data blocked does: the store reads
  can't-save and touches nothing. `?store=full` (DEV only) boots on the
  page's own storage, able to save, and refuses every write from then on,
  the way a full quota does: the first failure is the game's own write (a
  run's first autosave at the character pick, or a setting), which is when
  `.cant-save-chip` shows. Neither plant is a run dial, so both boot the
  menu, and the full plant never recovers. To check what is stored, read
  `localStorage` (or Electron's `store.json`) itself, not the store. The
  pane's `localStorage` takes about 50 Mi characters, some ten times a
  stock browser's, so a quota is never measured here.
- **The failure plate** (`src/failure/`, `src/ui/FailurePlate.ts`): any
  uncaught error on the page halts the game under `.failure-plate`
  (`.failure-plate__error` is the error's text, and `__game.halted` is
  true behind it). That includes a probe's own: a timer or a listener a
  probe leaves behind that throws stops the game, where an error thrown
  inside a tool call is the tool's and never reaches the window. The
  plants are DEV only and are not run dials: `?fail=webgl` and
  `?fail=font` fail the boot; `?fail=frame` (every frame throws) and
  `?fail=context` (the WebGL context is lost and never restored) fail two
  seconds into the first battle. Those two need real frames, which a
  hidden pane doesn't run: use the runner with `--window=offscreen`, or
  fail a live page by hand with `setTimeout(() => { throw new Error('x') }, 0)`.
  A context plate comes four seconds after the loss. On the production
  build there is no plant: take the two font files out of `dist/assets/`
  for a real failed boot, and put them back. Then close the tab and open
  a new one: the old tab keeps the failed font in memory and shows the
  plate again on every reload, with the files back and served.
- **A bundle that never ran** (the classic script in `index.html`'s
  head): on the production build, keep a copy of `dist/assets/index-*.js`
  and cut the file short (`head -c 300000`) for a script that can't be
  parsed, or remove it, or remove the `three-*.js` chunk it imports. Each
  leaves `#boot-line` reading the watch's sentence, `<html data-build>`
  unset and no `.failure-plate`. Put the files back and compare them with
  the copies (`cmp`).

## Settings and data

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
- **The text size** (`src/ui/textScale.ts`): the consumer is the root
  element's inline `font-size` (`''` at 100 %, else a percentage). A size
  chosen in the modal is stored at once and drawn when the modal closes;
  `__game.settings.set('textScale', 1.25)` with the modal shut draws at
  once. For a layout question across sizes or screens, run
  `shell/electron/probes/text-scale.js` under the runner instead of
  reading the pane: a hidden pane holds every fade at its first frame, so a
  pane that has faded out and one whose fade-in never ran look the same
  there (both `screen-fade` without `is-visible`, both at opacity 0), and
  a survey counts screens nobody would see.
- **The data rows** (Settings › Data): check an export without saving a
  file by putting a spy in the download's place before the click: wrap
  `URL.createObjectURL` to keep each blob by its URL, and replace
  `HTMLAnchorElement.prototype.click` with a function that records
  `this.download` and the blob for `this.href`. Compare the blob's text
  with `localStorage` read directly. To pick a file, build a `File`, put
  it on the row's hidden `input[type=file]` through a `DataTransfer`
  (`input.files = dt.files`), dispatch `change`, and wait some 200 ms for
  the file's text. Import and reload ends the script with a reload, so
  keep what the next call compares in `sessionStorage`. A rejected save
  is the slot's own text with its `v` lowered by one.
- **The Diagnostics row** copies by `navigator.clipboard.writeText`, then
  by `document.execCommand('copy')`, then saves a file. To choose which
  one answers, put a stand-in for the first with
  `Object.defineProperty(navigator, 'clipboard', …)` and replace
  `document.execCommand`, with the download spy above for the third, and
  read the row's `.settings-row__hint` after some 50 ms. A hidden pane has
  no focus, so the real clipboard's answer is never read here.
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

## Runs and screens

- **A local `.html` file opens as a snapshot without its relative
  pictures,** and the pane has refused a single-file copy with them
  inlined (at 7 MB and at 760 KB). A mock page that needs its pictures
  goes to the user with its layout unread by the session, and says so.
- **A continue check reloads in the middle of a gate too.** A screen can
  hold state the Run doesn't save (the reward screen's taken rows), and a
  reload on arriving at a gate never shows that. Make a first choice
  there, then reload and continue, and compare the screen as well as the
  hash.
- **The Escalation unlocks** are the store's `progress` section. To plant a
  win, write the key and reload:
  `localStorage.setItem('asciibattler:progress', JSON.stringify({ v: 1, build: 'plant', data: { creditsSeen: true, bestWin: { soldier: 1 } } }))`.
  Character select then shows a picker under that character, up to the
  level above its best win. Remove the key when you're done. A card's
  click saves a new run over the pane's run slot, so keep the slot's text
  first if a later check needs it. Under the runner,
  `shell/electron/probes/escalation-picker.js` does the same from a
  planted `store.json`.

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
