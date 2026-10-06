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
 *
 * 116f — every hue here is a palette name (src/render/palette.ts), so a second
 * palette re-picks them with the rest. The tables are built when this module
 * loads, from the palette the boot chose.
 */

import { COLORS } from './palette';
import { t } from '../i18n/ui';

export interface StatusDisplay {
  /** CSS color for the board pip + the card row swatch. */
  color: string;
}

/** 95f — an empower-buff row also carries the player-facing LABEL (a buff has
 *  no `name` in config; its key is an identifier, and the label lives in the
 *  UI string table under `buff.<key>`). */
export interface EmpowerDisplay extends StatusDisplay {
  label: string;
}

export const STATUS_DISPLAY: Record<string, StatusDisplay> = {
  // DoT / HoT — distinct hues.
  burn: { color: COLORS.EMBER_ORANGE }, // ember-orange (hotter than amber)
  bleed: { color: COLORS.BLOOD_CRIMSON }, // blood-crimson (deeper than NEON_RED)
  poison: { color: COLORS.TOXIC_GREEN }, // toxic yellow-green
  rejuvenate: { color: COLORS.REGEN_GREEN }, // regen / life-green
  // Behavior — reuse the 28c held-tint palette for pip↔tint consistency.
  frozen: { color: COLORS.FLOURESCENT_BLUE }, // ice-cyan
  panic: { color: COLORS.TERMINAL_AMBER }, // fear-amber
  blind: { color: COLORS.TERMINAL_STONE }, // blinded-grey
  confusion: { color: COLORS.NEON_PURPLE }, // chaos-purple
  // Stat buffs — §76b (the 47f `emboldened` shipped WITHOUT an entry and fell
  // to the magenta fallback; statusDisplay.test.ts now pins coverage). Buff-gold
  // vs panic's fear-amber is a buff-vs-behavior split (the burn/panic
  // precedent) — retune on eyeball if it reads ambiguously.
  emboldened: { color: COLORS.BUFF_GOLD }, // buff-gold
  // §76f — the Officer's Inspire aura (+mobility): a pale spring-green, brighter
  // and lighter than poison's toxic olive (a buff-vs-DoT split; eyeball-tunable).
  inspired: { color: COLORS.MARCH_GREEN }, // march-green
};

/** Fallback color for a status with no display entry (shouldn't happen for a
 *  shipped status — a loud-ish magenta makes a missing mapping visible). No
 *  palette name: it is a defect's colour, the same in every palette. */
export const STATUS_DISPLAY_FALLBACK = '#FF00FF';

/** Resolve a status id to its display color, or the fallback. */
export function statusColor(statusId: string): string {
  return STATUS_DISPLAY[statusId]?.color ?? STATUS_DISPLAY_FALLBACK;
}

/**
 * 78d — the EMPOWER-buff display map, the STATUS_DISPLAY sibling for the
 * K1-stat-buff vocabulary (daemon empower hooks + packet `applyBuff` — the
 * keys `readUnitStatuses` deliberately SKIPS, so they never collide with the
 * status table and its orphan guard). Doubles as the marker-eligibility set:
 * the HUD renders an in-battle `▲` marker for exactly the effect keys in
 * this table, and the pre-turn chips color from it, so one table drives
 * both surfaces. Coverage is pinned like STATUS_DISPLAY's (derived from the
 * daemon + packet catalogs — a new buff key fails the pin until it picks a
 * color).
 *
 * Color choices (eyeball-tunable): `honed` (Mars — the key was `empowered`
 * until 95f renamed it out of the EMPOWER mechanic's way) keeps
 * FLOURESCENT_BLUE — the K4 badge accent the player already knows. The rest
 * pick hues clear of the status table's (burn-orange / poison-olive /
 * buff-gold / chaos-purple …): warded = a pale aegis-lavender (calm defense),
 * hyped = party-pink, shielded = steel-blue, overclocked = volt-yellow
 * (brighter + greener than emboldened's gold; they never share a surface —
 * gold lives in the status row, volt in the ▲ markers).
 *
 * 95f — each row also carries its LABEL from the UI string table (`buff.<key>`,
 * always a literal key so the key-scan pin sees it); the coverage pin below
 * therefore proves every shipped buff key has a translatable label, not just
 * a color. The pre-95f label was the key capitalized — untranslatable.
 */
export const EMPOWER_DISPLAY: Record<string, EmpowerDisplay> = {
  honed: { color: COLORS.FLOURESCENT_BLUE, label: t('buff.honed') }, // Mars — the established K4 accent
  warded: { color: COLORS.AEGIS_LAVENDER, label: t('buff.warded') }, // Minerva — aegis-lavender
  hyped: { color: COLORS.PARTY_PINK, label: t('buff.hyped') }, // packet — party-pink
  shielded: { color: COLORS.SHIELD_STEEL, label: t('buff.shielded') }, // packet — shield-steel
  overclocked: { color: COLORS.VOLT_YELLOW, label: t('buff.overclocked') }, // packet — volt-yellow
};

/** Resolve an empower-buff key to its display color, or the shared magenta
 *  fallback (same make-it-visible discipline as `statusColor`). */
export function empowerColor(buffKey: string): string {
  return EMPOWER_DISPLAY[buffKey]?.color ?? STATUS_DISPLAY_FALLBACK;
}

/** 95f — the player-facing label for a buff key: the table's entry, or the key
 *  capitalized for one outside the table (the make-it-visible fallback — the
 *  coverage pin keeps every shipped key in the table). Shared by the pre-turn
 *  chips and the in-battle markers (UnitCard.buffKeyLabel). */
export function empowerLabel(buffKey: string): string {
  return EMPOWER_DISPLAY[buffKey]?.label ?? buffKey.charAt(0).toUpperCase() + buffKey.slice(1);
}
