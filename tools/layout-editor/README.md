# Layout Editor

A standalone Vite page for painting hand-authored encounter layouts and
exporting them to `config/layouts.json`.

## Launch

```bash
npm run dev
```

then open <http://localhost:5173/tools/layout-editor/> in a browser.

The editor is **not** included in the production build — `vite build`
only bundles the game entry. The `tools/` tree is served as static
files by the Vite dev server and never lands in `dist/`.

## Layers

Authoring is split across three radio-toggled layers. Only the active
layer accepts edits; the other two render dimmed at 30% opacity so the
overall composition stays visible.

- **Terrain** — paints surface tile kinds. Sub-tool radio picks among:
  - `water` (~) — pathing cost 2.
  - `chasm` (.) — impassable (Infinity cost). LOS-transparent.
  - `fire` (^) — cost 1; chips HP per tick on occupants.
  - `healing` (+) — cost 1; heals per tick on occupants.
- **Neutral units** — paints solid entities sitting on top of the floor.
  Sub-tool radio:
  - `wall` (#) — blocks pathing AND line of sight.
  - `half-cover` (╥) — blocks pathing; LOS-transparent (ranged shots
    pass through).
- **Spawn regions** — paints into the active region (see below). Each
  region must be exactly 8 tiles at export time and carries an
  `availability` flag (`player` / `enemy` / `both`).

Cell content is mutex per cell — the layer system is a UX overlay, not
a multi-layer per-cell data model. Painting a wall onto a water cell
replaces the water; painting water onto a wall is rejected by the
active-layer scope (you'd need to switch to terrain layer first).

## Controls

- **W / H** dropdowns — set the arena width and height (8–32 each).
  Resizing preserves cells that still fit; any content outside the new
  bounds is dropped and surfaced as a validation warning. Spawn regions
  also reset to the per-size procedural default when dimensions change.
- **Left-click + drag** — paint with the active layer's selected kind.
  The stroke kind is fixed at mousedown and applies to every cell the
  cursor crosses until the next global mouseup.
- **Right-click + drag** — erase **only the active layer's content**.
  Right-click on a wall while the terrain layer is active is a no-op;
  right-click on water while neutral-units is active is also a no-op.
  Sub-tool also scopes the erase: `erase-fire` only clears fire cells
  and leaves water/chasm/healing untouched.
- **Mid-stroke switches** — clicking another sub-tool radio or another
  region pill while a paint stroke is in progress synchronously commits
  the current stroke before swapping.

## Spawn regions

The spawn-regions layer is interactive. A pill row above the grid shows
each region's index, current tile count, and color swatch.

- **Pill click** — set the active region.
- **+ Add region** — append an empty region with `'both'` availability
  and make it active.
- **Delete region** — removes the active region. Disabled at the
  schema minimum (`MIN_SPAWN_REGIONS = 2`).
- **Availability radio** (player / enemy / both) — mutates the active
  region in place.
- **Left-click** into the active region with an 8-tile FIFO cap — a 9th
  paint evicts the oldest tile (drag-paint trails the cursor).
- **Right-click** removes a tile from the active region.

Each region's color comes from a fixed 4-color palette (amber / blue /
red / green) indexed by region position mod 4. Multi-region tile
overlap renders as stacked corner badges (one per region membership).

## Themes

The Metadata card has a **Theme** dropdown (`default` / `rock` /
`volcanic`). Floor cells in the editor re-tint live via a CSS variable
to preview the in-game palette — a single representative color per
theme (water / chasm / fire / healing keep their fixed D7 palettes
regardless of theme). The in-game faceted-prism gradient can't be
replicated cheaply in CSS, so the editor preview is a flat
approximation.

## Y-axis orientation

The editor renders `y=0` at the BOTTOM of the grid, matching the game
camera (`gridToWorld` maps `cell.y=0` to `+Z`, the near edge of the
camera frame). If you load an asymmetric layout authored elsewhere with
the standard top-left convention, it'll appear vertically mirrored —
that's the editor matching the game, not a bug.

## Validation

The panel mirrors the same invariants `config/layouts.ts` (zod) and
`layouts.test.ts` enforce:

- Required metadata: `id`, `name`, `description`, `theme`.
- `id` is a slug (letters / digits / underscore / hyphen) and doesn't
  collide with an existing entry.
- No tile-kind overlap: walls / water / half-covers / chasms / fires /
  healings are mutex per cell.
- Spawn regions: each region exactly 8 tiles, no duplicates within a
  region, no overlap with walls / water / half-covers / chasms / fires /
  healings.
- At least `MIN_SPAWN_REGIONS = 2` regions.
- At least one valid `(player, enemy)` region pair where the two
  regions differ (subsumes "≥1 player-available" and "≥1
  enemy-available" rules, AND catches the degenerate "one 'both'
  region" case where the enemy pool would be empty after the player
  draws).
- Connectivity: a path exists between the centroids of the first two
  spawn regions (using the same king's-move neighborhood `Pathfinding`
  uses in-game; walls / chasms / half-covers block, fire / healing /
  water are passable).
- Resize-clip warning: count of cells dropped on the most recent W/H
  change.

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
   `layouts.test.ts` suite.

## Punted / future work

- **Test-play button.** A standalone editor can't easily swap a
  painted layout into the live game without URL-encoded handoff or
  localStorage shared state. Skipped for now; revisit if it becomes
  load-bearing.
- **Pick weight / floor-depth gating fields.** Add when there's a
  concrete picker rule to implement.
