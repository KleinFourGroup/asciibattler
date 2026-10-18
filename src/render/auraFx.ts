/**
 * How an aura shows its range, a setting (`aura`, src/settings):
 * - `track` — the default. Besides the idle motes on the boundary, a square
 *   wave of motes expands from the carrier and re-anchors to its live sprite
 *   every frame, so the waves glide with it and the range reads from where
 *   the carrier stands now.
 * - `fill` — no waves; the idle motes sample the whole area instead of its
 *   boundary.
 *
 * Module state, read by BattleRenderer each frame, so a change shows at
 * once. THREE-free, so it loads under Vitest.
 */

type AuraFxMode = 'track' | 'fill';

let mode: AuraFxMode = 'track';

export function auraFxMode(): AuraFxMode {
  return mode;
}

export function setAuraFxMode(next: AuraFxMode): void {
  mode = next;
}
