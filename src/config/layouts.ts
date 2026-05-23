/**
 * C1d.A: hand-authored encounter layouts as validated config.
 *
 * Source of truth at `config/layouts.json` — a flat array preserving
 * order (the order seeds `rng.pick` in `Run.handleEnterNode`, so
 * reordering changes determinism for past seeds — append only).
 *
 * Each layout pins a tactical situation onto the 12x12 arena: a wall
 * topology, an optional water topology, plus a `name` + `description`
 * for the editor UI and future picker hooks. The grid-size assumption
 * is enforced by `generateTerrain` at resolve time, not the schema.
 *
 * Validation runs at module load. Malformed JSON throws a zod trace at
 * boot — the loud-failure mode A4 settled on for balance configs.
 *
 * Adding a layout:
 *   1. Append an entry to `config/layouts.json` (use the editor at
 *      `tools/layout-editor/` to paint and export).
 *   2. The `id` must be unique. `name` and `description` are required.
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

const LayoutSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
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
