/**
 * §76g4 → 116b — how an aura shows its range, a setting (`aura`,
 * src/settings). It began as an A/B rig on a console switch; the settings
 * kept two of its three modes:
 *  - `track` (the default): besides the idle motes on the boundary, a square
 *    wave of motes expands from the carrier and re-anchors to its live sprite
 *    every frame, so the waves glide with it. The legibility pick: the
 *    aura's range is measured from wherever the carrier stands now.
 *  - `fill`: no waves; the idle motes sample the whole area instead of its
 *    boundary. The aesthetic pick.
 * The third, `fixed` (waves left behind by a moving carrier), lost the A/B
 * and was deleted with the switch.
 *
 * Module state, read by BattleRenderer each frame, so a change shows at
 * once. THREE-free, so it loads under Vitest.
 */

export type AuraFxMode = 'track' | 'fill';

let mode: AuraFxMode = 'track';

export function auraFxMode(): AuraFxMode {
  return mode;
}

export function setAuraFxMode(next: AuraFxMode): void {
  mode = next;
}
