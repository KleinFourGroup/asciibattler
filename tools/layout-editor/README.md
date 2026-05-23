# Layout Editor

A standalone Vite page for painting hand-authored encounter layouts onto
a 12×12 grid and exporting them to `config/layouts.json`.

## Launch

```bash
npm run dev
```

then open <http://localhost:5173/tools/layout-editor/> in a browser.

The editor is **not** included in the production build — `vite build`
only bundles the game entry. The `tools/` tree is served as static
files by the Vite dev server and never lands in `dist/`.

## Controls

- **Click** a cell — toggle wall.
- **Shift + click** — toggle shallow water.
- **Right-click** — erase (back to floor).
- **Load existing** — populate the grid + metadata from a layout in
  `config/layouts.json`. Useful for tweaking what's already shipped.
- **Clear grid** — reset everything to floor.

Reserved spawn rows (taken from `config/terrain.json` →
`spawnRowsClear`) are shown with a diagonal-stripe overlay. Painting on
them is allowed but flagged as an error in the validation panel
because the game would refuse to load such a layout.

## Validation

The panel mirrors the same invariants the layouts test suite enforces:

- Required metadata: `id`, `name`, `description`.
- `id` is a slug (letters / digits / underscore / hyphen) and doesn't
  collide with an existing entry.
- No walls or water on reserved spawn rows.
- Connectivity: a path exists between the topmost spawn row and the
  bottommost spawn row (using the same king's-move neighborhood
  `Pathfinding` uses in-game).

## Export

The Export panel keeps a live JSON snippet matching the
`config/layouts.json` schema. **Copy** puts it on the clipboard;
**Download** saves it as `<id>.json`.

Workflow:

1. Paint and fill metadata until validation is clean.
2. Click **Copy JSON** (or **Download**).
3. Open `config/layouts.json` and append the snippet as a new array
   entry. Order is preserved as `LAYOUT_IDS`, which seeds `rng.pick`
   determinism for past seeds — **append only**, never reorder.
4. Run `npm test` to confirm the new entry passes the
   `layouts.test.ts` suite (grid bounds, spawn-row reservation,
   duplicate-coord check, connectivity).

## Punted / future work

- **Test-play button.** A standalone editor can't easily swap a
  painted layout into the live game without URL-encoded handoff or
  localStorage shared state. Skipped for now; revisit if it becomes
  load-bearing.
- **Pick weight / floor-depth gating fields.** The roadmap left those
  out of the C1d schema; add them when there's a concrete picker
  rule to implement.
