/**
 * The render side's status display: each `StatusDef.id` to its color and
 * symbol. The counterpart to the `readUnitStatuses` selector
 * (`src/sim/statusReadout.ts`): the selector carries the sim's truth (stacks,
 * duration, potency), this carries the look, so the sim's schema stays free
 * of presentation, as the FX registry keeps it free of cues.
 *
 * The colors are tuned by eye:
 * - the four behavior statuses wear their held body tints' exact hues
 *   (fxRegistry's `_active` keys), so a unit's pip and its tint read as one
 *   status;
 * - the four DoT and HoT statuses get hues of their own.
 * The two closest pairs, burn and panic on the warm side and poison and
 * rejuvenate on the green, are the ones to retune if they read ambiguously in
 * the native browser.
 *
 * Every hue is a palette name (src/render/palette.ts), so a second palette
 * re-picks them with the rest. The tables are built when this module loads,
 * from the palette the boot chose.
 *
 * A status also has a symbol, one character, the shape beside its hue ("never
 * color alone", DESIGN.md's UI idioms): on the board pip, in the card's
 * status row, and before a DoT's number (`HITSPLAT_PREFIX` in fxRegistry.ts
 * reads the three DoT symbols from this table). A camp unit has no card, so
 * on its pip the symbol is the status's only read besides the hue. The
 * symbols were picked to stay apart at small sizes, and the pip draws them at
 * 12px. statusDisplay.test.ts holds every shipped status to one symbol of its
 * own.
 */

import { COLORS } from './palette';
import { t } from '../i18n/ui';

interface StatusDisplay {
  /** CSS color for the board pip, the card row's symbol, a DoT's number and
   *  an aura's motes. */
  color: string;
  /** One character: the status's shape, drawn in `color`. DOM text, never
   *  the glyph atlas. */
  symbol: string;
}

/** An empower buff's hue and its player-facing label. A buff has no `name`
 *  in config, since its key is an identifier; the label lives in the UI
 *  string table under `buff.<key>`. No symbol: every buff wears the one `▲`
 *  marker, and its label is its second channel. */
interface EmpowerDisplay {
  color: string;
  label: string;
}

export const STATUS_DISPLAY: Record<string, StatusDisplay> = {
  // The DoTs and the HoT.
  burn: { color: COLORS.EMBER_ORANGE, symbol: '~' },
  bleed: { color: COLORS.BLOOD_CRIMSON, symbol: '‡' },
  poison: { color: COLORS.TOXIC_GREEN, symbol: '☠' },
  rejuvenate: { color: COLORS.REGEN_GREEN, symbol: '+' },
  // The behavior statuses, in their held tints' hues.
  frozen: { color: COLORS.FLOURESCENT_BLUE, symbol: '*' },
  panic: { color: COLORS.TERMINAL_AMBER, symbol: '!' },
  blind: { color: COLORS.TERMINAL_STONE, symbol: '⊘' },
  confusion: { color: COLORS.NEON_PURPLE, symbol: '?' },
  // The stat buffs. Gold beside panic's amber is a buff beside a behavior, as
  // burn beside panic is; retune by eye if it reads ambiguously.
  emboldened: { color: COLORS.BUFF_GOLD, symbol: '↑' },
  // The Officer's Inspire aura (+mobility): a pale green, brighter and lighter
  // than poison's.
  inspired: { color: COLORS.MARCH_GREEN, symbol: '»' },
};

/** Fallback color for a status with no display entry. No shipped status
 *  wears it (statusDisplay.test.ts); a loud magenta makes a missing entry
 *  visible. No palette name: it is a defect's colour, the same in every
 *  palette. */
export const STATUS_DISPLAY_FALLBACK = '#FF00FF';

/** Resolve a status id to its display color, or the fallback. */
export function statusColor(statusId: string): string {
  return STATUS_DISPLAY[statusId]?.color ?? STATUS_DISPLAY_FALLBACK;
}

/** The symbol of a status with no display entry: no shipped status wears it,
 *  so with the magenta it marks a missing mapping. */
export const STATUS_SYMBOL_FALLBACK = '¤';

/** Resolve a status id to its symbol, or the fallback. */
export function statusSymbol(statusId: string): string {
  return STATUS_DISPLAY[statusId]?.symbol ?? STATUS_SYMBOL_FALLBACK;
}

/**
 * The empower buffs' display map, STATUS_DISPLAY's sibling for the stat buffs
 * (the daemons' empower hooks and the packets' `applyBuff`), the keys
 * `readUnitStatuses` skips, so they never meet the status table. It is also
 * the marker set: the HUD draws a `▲` marker in battle for exactly the effect
 * keys in this table, and the pre-turn chips take their color from it, so one
 * table drives both. statusDisplay.test.ts pins its coverage from the daemon
 * and packet catalogs, so a new buff key fails until it has a color and a
 * label.
 *
 * The colors, tuned by eye: `honed` is FLOURESCENT_BLUE, and the rest are
 * clear of the status table's hues: `warded` a pale lavender for a calm
 * defense, `hyped` pink, `shielded` steel blue, `overclocked` a volt yellow,
 * brighter and greener than `emboldened`'s gold, which never shares a surface
 * with it (gold is in the status row, volt in the `▲` markers).
 *
 * Each label is read from the UI string table (`buff.<key>`), always with a
 * literal key so the key-scan pin sees it.
 */
export const EMPOWER_DISPLAY: Record<string, EmpowerDisplay> = {
  honed: { color: COLORS.FLOURESCENT_BLUE, label: t('buff.honed') }, // Mars
  warded: { color: COLORS.AEGIS_LAVENDER, label: t('buff.warded') }, // Minerva
  hyped: { color: COLORS.PARTY_PINK, label: t('buff.hyped') }, // a packet
  shielded: { color: COLORS.SHIELD_STEEL, label: t('buff.shielded') }, // a packet
  overclocked: { color: COLORS.VOLT_YELLOW, label: t('buff.overclocked') }, // a packet
};

/** An empower buff's color, or the shared magenta fallback, as
 *  `statusColor` has it. */
export function empowerColor(buffKey: string): string {
  return EMPOWER_DISPLAY[buffKey]?.color ?? STATUS_DISPLAY_FALLBACK;
}

/** A buff key's player-facing label: the table's, or the key capitalized for
 *  a key outside it (the coverage pin keeps every shipped key in the table).
 *  Shared by the pre-turn chips and the in-battle markers
 *  (`UnitCard.buffKeyLabel`). */
export function empowerLabel(buffKey: string): string {
  return EMPOWER_DISPLAY[buffKey]?.label ?? buffKey.charAt(0).toUpperCase() + buffKey.slice(1);
}
