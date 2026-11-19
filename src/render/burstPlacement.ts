/**
 * Where an `explosion` burst is drawn and how far its ring of sparks flies,
 * from the ability's selector. Pure, so the choice is pinned headless; the
 * BattleRenderer draws what it returns.
 *
 * A blast aimed at a cell is drawn on the cell the action surfaced (the
 * `action:phase` payload's `targetCell`). A blast anchored on its caster
 * surfaces no cell, since its centre is wherever the caster stands when it
 * fires, so it is drawn on the caster's live cell, as the interpreter
 * centres it. The ring flies RING_SPREAD world units per cell of radius,
 * so a radius-1 blast's sparks land where they always have.
 */

import type { GridCoord } from '../core/types';
import type { AbilityDef } from '../sim/effects/schema';

/** World units the spark ring flies for a radius-1 blast (cells are 1×1, so
 *  1.1 lands the sparks at a 3×3 blast's edge). Tuned by eye. */
export const EXPLOSION_RING_SPREAD = 1.1;

export interface ExplosionPlacement {
  /** The cell the flash and the ring are centred on. */
  readonly cell: GridCoord;
  /** How far the ring flies, in world units. */
  readonly ringSpread: number;
}

/**
 * The explosion's cell and ring, or null when there is no cell to draw on
 * (an aimed blast whose cell was not surfaced, a caster no longer in the
 * world). `selector` is the ability's `target`; a non-area selector draws
 * on the surfaced cell with a radius-1 ring.
 */
export function explosionPlacement(
  selector: AbilityDef['target'] | undefined,
  targetCell: GridCoord | undefined,
  casterCell: GridCoord | undefined,
): ExplosionPlacement | null {
  const area = selector?.kind === 'aoe' ? selector : undefined;
  const cell = area?.anchor === 'caster' ? casterCell : targetCell;
  if (cell === undefined) return null;
  const radius = Math.max(1, area?.radius ?? 1);
  return { cell: { ...cell }, ringSpread: EXPLOSION_RING_SPREAD * radius };
}

/** How many sparks a spin sweeps round its caster: the explosion's ring. */
export const SPIN_SPARKS = 8;

/**
 * Where spark `index` of a spin sits at `t` (0 to 1 over the spin), as an
 * offset in world units from the caster's centre on the ground plane: the
 * sparks start evenly round a circle of `radius`, the explosion's eight
 * directions, and sweep one full turn together at a steady rate, so at
 * `t = 1` each is back where it began. A spin is drawn on its caster as an
 * explosion anchored there is (`explosionPlacement`), at its ring's spread.
 */
export function spinSparkOffset(index: number, t: number, radius: number): { dx: number; dz: number } {
  const angle = (2 * Math.PI * index) / SPIN_SPARKS + 2 * Math.PI * Math.min(1, Math.max(0, t));
  return { dx: radius * Math.cos(angle), dz: radius * Math.sin(angle) };
}
