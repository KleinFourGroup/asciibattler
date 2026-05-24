/**
 * C1d.A: hand-authored encounter layouts as validated config.
 * D3: each layout now declares its own `gridW` × `gridH` (8-32).
 *
 * Source of truth at `config/layouts.json` — a flat array preserving
 * order (the order seeds `rng.pick` in `Run.handleEnterNode`, so
 * reordering changes determinism for past seeds — append only).
 *
 * Each layout pins a tactical situation onto a rectangular arena: its
 * own grid size, a wall topology, an optional water topology, plus a
 * `name` + `description` for the editor UI and future picker hooks.
 * `generateTerrain` enforces in-bounds on every wall/water cell against
 * the layout's own dimensions.
 *
 * Validation runs at module load. Malformed JSON throws a zod trace at
 * boot — the loud-failure mode A4 settled on for balance configs.
 *
 * Adding a layout:
 *   1. Append an entry to `config/layouts.json` (use the editor at
 *      `tools/layout-editor/` to paint and export).
 *   2. The `id` must be unique. `name`, `description`, `gridW`, `gridH`
 *      are required.
 *   3. Validate by running `npm test` — the layouts test suite checks
 *      grid bounds, spawn-row reservation, duplicate coords, and
 *      connectivity between spawn rows.
 */

import { z } from 'zod';
import layoutsJson from '../../config/layouts.json';

const CoordSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

/** Hand-authored layouts pick their own grid size in this range. */
export const LAYOUT_MIN_SIDE = 8;
export const LAYOUT_MAX_SIDE = 32;

const SideSchema = z.number().int().min(LAYOUT_MIN_SIDE).max(LAYOUT_MAX_SIDE);

const LayoutSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  gridW: SideSchema,
  gridH: SideSchema,
  walls: z.array(CoordSchema),
  water: z.array(CoordSchema).optional(),
});

const LayoutsSchema = z.array(LayoutSchema).min(1);

export type LayoutDef = z.infer<typeof LayoutSchema>;

const LAYOUTS_LIST: readonly LayoutDef[] = LayoutsSchema.parse(layoutsJson);

const seenIds = new Set<string>();
for (const layout of LAYOUTS_LIST) {
  if (seenIds.has(layout.id)) {
    throw new Error(`layouts.json: duplicate layout id "${layout.id}"`);
  }
  seenIds.add(layout.id);
}

export const LAYOUTS: readonly LayoutDef[] = LAYOUTS_LIST;
export const LAYOUT_IDS: readonly string[] = LAYOUTS_LIST.map((l) => l.id);

const LAYOUTS_BY_ID: Record<string, LayoutDef> = {};
for (const layout of LAYOUTS_LIST) LAYOUTS_BY_ID[layout.id] = layout;

export function getLayout(id: string): LayoutDef | undefined {
  return LAYOUTS_BY_ID[id];
}
