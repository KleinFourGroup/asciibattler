/**
 * §32c — the render-side status DISPLAY map (presentation only).
 *
 * Keyed by `StatusDef.id` → the cue's display color. This is the deliberate
 * counterpart to the pure `readUnitStatuses` selector (`src/sim/statusReadout.ts`):
 * the selector carries sim truth (stacks / duration / potency), this carries
 * palette. Kept render-side (a sibling to the `fxRegistry` colors) so the sim
 * schema stays free of presentation — the same data/render split the EffectOp
 * interpreter and the FX registry hold.
 *
 * Color choices (eyeball-tunable — the 32a design round flagged these as feel):
 *   - The four BEHAVIOR statuses reuse their EXACT 28c body-tint hues (frozen
 *     ice-cyan, panic fear-amber, blind stone-grey, confusion chaos-purple), so a
 *     unit's pip and its held tint read as the same status.
 *   - The four DoT/HoT statuses get distinct hues — burn ember-orange, bleed
 *     blood-crimson, poison toxic yellow-green, rejuvenate regen-green.
 * The two closest pairs (burn/panic on the warm axis, poison/rejuvenate on the
 * green axis) are a DoT-vs-behavior and a DoT-vs-HoT split that rarely co-occur
 * on one unit; retune here freely if they read ambiguously in the native browser.
 */

import { COLORS } from './palette';

export interface StatusDisplay {
  /** CSS color for the board pip + the card row swatch. */
  color: string;
}

export const STATUS_DISPLAY: Record<string, StatusDisplay> = {
  // DoT / HoT — distinct hues.
  burn: { color: '#FF6A00' }, // ember-orange (hotter than amber)
  bleed: { color: '#D41E3A' }, // blood-crimson (deeper than NEON_RED)
  poison: { color: '#8FC31F' }, // toxic yellow-green
  rejuvenate: { color: '#2BE57A' }, // regen / life-green
  // Behavior — reuse the 28c held-tint palette for pip↔tint consistency.
  frozen: { color: COLORS.FLOURESCENT_BLUE }, // ice-cyan
  panic: { color: COLORS.TERMINAL_AMBER }, // fear-amber
  blind: { color: COLORS.TERMINAL_STONE }, // blinded-grey
  confusion: { color: COLORS.NEON_PURPLE }, // chaos-purple
};

/** Fallback color for a status with no display entry (shouldn't happen for a
 *  shipped status — a loud-ish magenta makes a missing mapping visible). */
export const STATUS_DISPLAY_FALLBACK = '#FF00FF';

/** Resolve a status id to its display color, or the fallback. */
export function statusColor(statusId: string): string {
  return STATUS_DISPLAY[statusId]?.color ?? STATUS_DISPLAY_FALLBACK;
}
