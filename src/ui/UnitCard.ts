/**
 * The unit card. One builder renders a unit (a roster `UnitTemplate`, a
 * battle `Unit`, or a `PromotionInfo`'s state before the level) for every
 * screen that shows one, so the screens can't drift on layout or the stat
 * block, and the ability readings can't disagree with the unit.
 *
 * The screens differ by skin: a CSS class, a header format and the
 * sections shown by default, never the DOM the builder emits. The
 * promotion's staggered reveal lives in PromotionScreen, which drives the
 * card through the `levelValue` and `statRows` handles this returns.
 *
 * Every card carries `unit-card--rarity-{rarity}` (`common` for an
 * archetype with none), which ui.css tints by tier; a full card's header
 * also gives the tier as stars (`rarityDisplay.ts`).
 */

import type { UnitTemplate, Archetype, UnitStats, Unit } from '../sim/Unit';
import type { PromotionInfo } from '../core/events';
import type { StatusReadout } from '../sim/statusReadout';
import {
  abilityIdsForArchetype,
  glyphForArchetype,
  nameForArchetype,
  rarityForArchetype,
} from '../sim/archetypes';
import { attackCooldownTicksFor } from '../sim/stats';
import { abilityDef } from '../config/abilities';
import { abilityDetailParts } from './abilityDetail';
import { ticksToSeconds } from '../config';
import { xpProgress, displayLevel } from '../sim/xp';
import { statusColor, statusSymbol, empowerColor, empowerLabel } from '../render/statusDisplay';
import { STAT_LABELS } from './statLabels';
import { powerTooltip } from './chipLabels';
import { attachTooltip } from './tooltip';
import { rarityStarParts, rarityLabel } from './rarityDisplay';
import { t } from '../i18n/ui';
import type { StatusEffect } from '../sim/statusEffects';
import type { EmpowerStackView } from '../run/empower';

/** A card's tier is the config's (`rarityForArchetype`). */
import type { UnitRarity } from '../config/units';
export type { UnitRarity };

/** The layout: `full` is the detailed card (the stats, the abilities, the
 *  XP bar); `compact` is the battle HUD's card. */
type UnitCardMode = 'compact' | 'full';

/** The context a card is drawn in: it picks the skin's CSS, the header
 *  format and the sections shown by default. `hud` is the battle HUD's
 *  panes, only ever `compact`. `roster` is the card-list modal's (the
 *  roster view, the draw and discard piles, the port's crew removal): full
 *  cards that show the XP bar. */
type UnitCardSkin = 'recruit' | 'promotion' | 'preturn' | 'hud' | 'roster';

/** Normalized card input. Adapters build this from a template / Unit /
 *  promotion so the builder never reaches into screen-specific shapes. */
interface UnitCardData {
  readonly archetype: Archetype;
  readonly glyph: string;
  readonly level: number;
  readonly stats: UnitStats;
  readonly rarity: UnitRarity;
  /** Banked XP toward the next level, for the full card's XP bar. */
  readonly xp: number;
  /** Live battle HP, for the compact card's bar. Only `unitCardFromUnit`
   *  sets it; the full cards show no HP. */
  readonly hp?: { readonly current: number; readonly max: number };
}

interface UnitCardOptions {
  readonly mode: UnitCardMode;
  readonly skin: UnitCardSkin;
  /** Override the skin's default for the abilities section (every skin
   *  shows it but promotion). */
  readonly showAbilities?: boolean;
  /** Override the skin's default click affordance (only recruit's is on).
   *  The click handler is the caller's. */
  readonly clickable?: boolean;
  /** Override the skin's default for the XP bar (pre-turn and roster show
   *  it, for owned units with banked XP; a recruit offer has none, and
   *  promotion is mid-level). */
  readonly showXpBar?: boolean;
  /** The compact card's side: `enemy` turns the glyph and the HP bar red;
   *  `player`, the default, keeps them green. The full cards ignore it. */
  readonly team?: 'player' | 'enemy';
}

/** Handles into one stat row's mutable parts, for the promotion reveal. */
interface StatRowHandle {
  readonly row: HTMLDivElement;
  readonly value: HTMLSpanElement;
  /** The right-hand group the `+N` delta chip is appended into. */
  readonly right: HTMLSpanElement;
}

export interface UnitCardHandles {
  readonly el: HTMLDivElement;
  /** The element holding the level text, the promotion's level-flip target.
   *  The other full skins point it at the header, the compact card at its
   *  level span. */
  readonly levelValue: HTMLElement;
  /** Per-stat handles in the card's row order, POW first and then the
   *  grid. Empty for `compact`, which has no stat block. */
  readonly statRows: Map<keyof UnitStats, StatRowHandle>;
  /** The compact card's HP fill, which the HUD drives on every
   *  `unit:attacked`, `status:ticked` and `unit:healed`. Undefined for the
   *  full cards. */
  readonly hpFill?: HTMLDivElement;
  /** The compact card's status row; `updateCardStatusRow` reconciles its
   *  chips (`Name ×N · P/s · Ns`, the live potency as a number). Undefined
   *  for the full cards. */
  readonly statusRow?: HTMLDivElement;
  /** The compact card's empower-marker row, under the status row;
   *  `updateCardEmpowerMarkers` reconciles its `▲` chips, one per buff key,
   *  the pre-turn hand's badges carried into battle. Undefined for the full
   *  cards. */
  readonly empowerRow?: HTMLDivElement;
}

/** Adapter: a roster or offer template → card data. */
export function unitCardFromTemplate(template: UnitTemplate): UnitCardData {
  return {
    archetype: template.archetype,
    glyph: glyphForArchetype(template.archetype),
    level: template.level,
    stats: template.stats,
    rarity: rarityForArchetype(template.archetype),
    xp: template.xp,
  };
}

/** Adapter: a live battle `Unit` → card data, for the compact card. It
 *  carries HP for the bar, and `displayLevel` rounds the combatant level to
 *  the value the rest of the UI shows. Power is read off the same `stats`
 *  as on every other surface, so the card can't disagree with the unit. */
export function unitCardFromUnit(unit: Unit): UnitCardData {
  return {
    // Only combatants are carded: the HUD skips every neutral (walls, cover,
    // and camp members, which get no card by a signed call), so
    // `unit.archetype` is a combatant catalog id here.
    archetype: unit.archetype,
    glyph: unit.glyph,
    level: displayLevel(unit.level),
    stats: unit.stats,
    rarity: rarityForArchetype(unit.archetype),
    xp: unit.xp,
    hp: { current: unit.currentHp, max: unit.derived.maxHp },
  };
}

/** Adapter: a `PromotionInfo`'s state before the level → card data. The
 *  screen's reveal flips it to the new level and stats through the returned
 *  handles. Promotion never shows the XP bar, so `xp` is unused. */
export function unitCardFromPromotion(p: PromotionInfo): UnitCardData {
  return {
    archetype: p.archetype,
    glyph: p.glyph,
    level: p.oldLevel,
    stats: p.oldStats,
    rarity: rarityForArchetype(p.archetype),
    xp: 0,
  };
}

/** Whether a skin shows the abilities section by default: every skin but
 *  promotion. */
function defaultShowAbilities(skin: UnitCardSkin): boolean {
  return skin !== 'promotion';
}

/** Whether a skin is clickable by default: recruit's, whose click is the
 *  pick. The pre-turn hand and the roster's picker add their click and its
 *  class after the build. */
function defaultClickable(skin: UnitCardSkin): boolean {
  return skin === 'recruit';
}

/** Whether a skin shows the XP-to-next bar by default: pre-turn and roster,
 *  whose units are owned and carry banked XP. A recruit offer has none, and
 *  promotion is mid-level. */
function defaultShowXpBar(skin: UnitCardSkin): boolean {
  return skin === 'preturn' || skin === 'roster';
}

export function buildUnitCard(data: UnitCardData, opts: UnitCardOptions): UnitCardHandles {
  // The compact battle card is another shape (the glyph, level and power, an
  // HP bar, no stat block), so it branches off before the full layout.
  if (opts.mode === 'compact') return buildCompactCard(data, opts);

  const card = document.createElement('div');
  card.className = [
    'unit-card',
    `unit-card--${opts.skin}`,
    `unit-card--${opts.mode}`,
    `unit-card--rarity-${data.rarity}`,
  ].join(' ');
  const clickable = opts.clickable ?? defaultClickable(opts.skin);
  if (clickable) {
    card.classList.add('unit-card--clickable');
  }

  const glyph = document.createElement('div');
  glyph.className = 'unit-card__glyph';
  glyph.textContent = data.glyph;
  card.appendChild(glyph);

  // The star run's touch route follows `clickable` (`buildRarityStars`).
  const { headerEl, levelValue } = buildHeader(data, opts.skin, clickable ? 'press' : 'tap');
  card.appendChild(headerEl);

  const { statsEl, powerRow, statRows } = buildStats(data.stats);
  // POW, the pool stat, sits in its own accented row under the level, above
  // the combat grid.
  card.appendChild(powerRow);
  card.appendChild(statsEl);

  if (opts.mode === 'full' && (opts.showAbilities ?? defaultShowAbilities(opts.skin))) {
    card.appendChild(buildAbilities(data.archetype, data.stats));
  }

  if (opts.mode === 'full' && (opts.showXpBar ?? defaultShowXpBar(opts.skin))) {
    card.appendChild(buildXpBar(data));
  }

  return { el: card, levelValue, statRows };
}

/**
 * The compact battle card, in the HUD's player pane at the bottom center
 * and in its enemy pane. A large glyph with the level small at the top left
 * and power small at the top right (power in the POW blue, so the two
 * corners read apart without wide labels), and a glyph-width HP bar under
 * it. The returned `hpFill` lets the pane drive the bar live; the pane grays
 * a dead unit's card with `.is-dead`. No stat block, abilities or XP bar.
 */
function buildCompactCard(data: UnitCardData, opts: UnitCardOptions): UnitCardHandles {
  const card = document.createElement('div');
  card.className = [
    'unit-card',
    `unit-card--${opts.skin}`,
    'unit-card--compact',
    `unit-card--rarity-${data.rarity}`,
  ].join(' ');
  // An enemy card's glyph and HP bar are red; a player's, the default, green.
  if (opts.team === 'enemy') card.classList.add('unit-card--enemy');

  const top = document.createElement('div');
  top.className = 'unit-card__compact-top';
  // Each number carries a persistent hint, in a wrapper beside its span and
  // never inside it: `levelValue` points at the level span, and a write to
  // the handle's `textContent` would erase a nested hint. The level needs no
  // tooltip once it reads `Lv 5`; the power keeps its clarifier.
  const levelWrap = document.createElement('span');
  levelWrap.className = 'unit-card__compact-level-wrap';
  const levelHint = document.createElement('span');
  levelHint.className = 'unit-card__compact-hint';
  levelHint.textContent = t('card.hint.level');
  const level = document.createElement('span');
  level.className = 'unit-card__compact-level';
  level.textContent = String(data.level);
  levelWrap.append(levelHint, level);
  const powerWrap = document.createElement('span');
  powerWrap.className = 'unit-card__compact-power-wrap';
  const power = document.createElement('span');
  power.className = 'unit-card__compact-power';
  power.textContent = String(data.stats.power);
  const powerHint = document.createElement('span');
  powerHint.className = 'unit-card__compact-hint';
  powerHint.textContent = STAT_LABELS.power;
  powerWrap.append(power, powerHint);
  // The clarifier reads by the card's side. An enemy card is a control (its
  // click is the engage objective), so the nested text takes the
  // long-press; a player card is inert, so a tap.
  const team = opts.team ?? 'player';
  attachTooltip(
    powerWrap,
    () => `${STAT_LABELS.power} ${power.textContent} — ${powerTooltip(team)}`,
    { touch: team === 'enemy' ? 'press' : 'tap' },
  );
  top.append(levelWrap, powerWrap);

  const glyph = document.createElement('div');
  glyph.className = 'unit-card__glyph';
  glyph.textContent = data.glyph;

  const hp = document.createElement('div');
  hp.className = 'unit-card__compact-hp';
  const hpFill = document.createElement('div');
  hpFill.className = 'unit-card__compact-hp-fill';
  hpFill.style.width = `${hpPercent(data.hp) * 100}%`;
  hp.appendChild(hpFill);

  // The status row, under the HP bar: empty and hidden until the unit
  // carries a status. The HUD's once-a-tick pass drives
  // `updateCardStatusRow`.
  const statusRow = document.createElement('div');
  statusRow.className = 'unit-card__statuses';
  statusRow.hidden = true;

  // The empower-marker row, under the statuses, on the same lifecycle:
  // hidden until the unit carries a marked buff, and driven by the same pass
  // (`updateCardEmpowerMarkers`).
  const empowerRow = document.createElement('div');
  empowerRow.className = 'unit-card__empowers';
  empowerRow.hidden = true;

  card.append(top, glyph, hp, statusRow, empowerRow);
  // No reveal and no stat block: `levelValue` points at the level span so
  // the handle is non-null, and `statRows` is empty.
  return { el: card, levelValue: level, statRows: new Map(), hpFill, statusRow, empowerRow };
}

/** Clamp a UnitCardData HP reading to a 0..1 fill fraction (0 when absent). */
function hpPercent(hp: UnitCardData['hp']): number {
  if (!hp || hp.max <= 0) return 0;
  return Math.max(0, Math.min(1, hp.current / hp.max));
}

/**
 * Reconcile a compact card's status row against a unit's status readouts,
 * the numbers beside the board's pips. One chip per status, in the
 * catalog's order: its symbol in its colour (the board pip's), the name,
 * and the live `×stacks · N/s · Ns` (`statusChipMeta`). Hidden when the
 * unit carries no status, so the compact card holds no empty row.
 *
 * Cheap by construction: the HUD calls it at most once a sim tick, and each
 * chip's writes are cached in its dataset, so an unchanged field skips its
 * DOM write. A no-op without a status row (the full cards).
 */
export function updateCardStatusRow(
  handles: UnitCardHandles,
  readouts: readonly StatusReadout[],
): void {
  const row = handles.statusRow;
  if (!row) return;
  if (readouts.length === 0) {
    if (!row.hidden) {
      row.hidden = true;
      row.replaceChildren();
    }
    return;
  }
  if (row.hidden) row.hidden = false;
  while (row.childElementCount < readouts.length) row.appendChild(makeStatusChip());
  while (row.childElementCount > readouts.length) row.lastElementChild!.remove();
  for (let i = 0; i < readouts.length; i++) {
    applyStatusChip(row.children[i] as HTMLDivElement, readouts[i]!);
  }
}

/** Build one empty status chip: `[symbol] name  meta`. The first span
 *  (class `swatch`) holds the status's symbol in its colour, the board
 *  pip's. */
function makeStatusChip(): HTMLDivElement {
  const chip = document.createElement('div');
  chip.className = 'unit-card__status';
  const swatch = document.createElement('span');
  swatch.className = 'unit-card__status-swatch';
  const name = document.createElement('span');
  name.className = 'unit-card__status-name';
  const meta = document.createElement('span');
  meta.className = 'unit-card__status-meta';
  chip.append(swatch, name, meta);
  return chip;
}

/** Paint a chip from a readout, skipping unchanged DOM writes via a cache. */
function applyStatusChip(chip: HTMLDivElement, r: StatusReadout): void {
  const [swatch, name, meta] = chip.children as unknown as HTMLSpanElement[];
  if (chip.dataset.sid !== r.statusId) {
    chip.dataset.sid = r.statusId;
    swatch!.textContent = statusSymbol(r.statusId);
    swatch!.style.color = statusColor(r.statusId);
    name!.textContent = r.name;
  }
  const metaText = statusChipMeta(r);
  if (meta!.dataset.t !== metaText) {
    meta!.dataset.t = metaText;
    meta!.textContent = metaText;
  }
}

/**
 * Reconcile the compact card's empower-marker row: one `▲` chip per buff
 * the HUD passes from the live unit (those `EMPOWER_DISPLAY` marks), the
 * pre-turn hand's badges carried into battle. `readUnitStatuses` skips
 * these stat effects, so they never reach the status row. Each key's
 * colour and label come from `EMPOWER_DISPLAY`. As cheap as the status row:
 * the HUD calls it at most once a sim tick, and a signature cache skips the
 * rebuild when nothing changed. A no-op for the full cards.
 */
export function updateCardEmpowerMarkers(
  handles: UnitCardHandles,
  stacks: readonly EmpowerStackView[],
): void {
  const row = handles.empowerRow;
  if (!row) return;
  const signature = stacks.map((s) => `${s.key}:${s.magnitude}`).join('|');
  if (row.dataset.sig === signature) return;
  row.dataset.sig = signature;
  row.replaceChildren();
  row.hidden = stacks.length === 0;
  // A chip in an enemy card is nested in a control (the card's click is the
  // engage objective), so the long-press; in a player card, a tap.
  const touch = handles.el.classList.contains('unit-card--enemy') ? 'press' : 'tap';
  for (const s of stacks) {
    const chip = document.createElement('span');
    chip.className = 'unit-card__empower-chip';
    chip.style.color = empowerColor(s.key);
    chip.textContent = s.magnitude <= 3 ? '▲'.repeat(s.magnitude) : `▲×${s.magnitude}`;
    // The key's name, always shown beside the triangles, so the hue is never
    // the only channel. The tooltip carries the mods.
    const label = document.createElement('span');
    label.className = 'unit-card__empower-chip-label';
    label.textContent = buffKeyLabel(s.key);
    chip.appendChild(label);
    attachTooltip(chip, buffChipTooltip(s.key, s.magnitude, s.mods), { touch });
    row.appendChild(chip);
  }
}

/** A buff key's label, from the UI string table through `EMPOWER_DISPLAY`
 *  (`buff.<key>`), whose coverage pin (statusDisplay.test.ts) keeps every
 *  shipped key labelled. */
function buffKeyLabel(key: string): string {
  return empowerLabel(key);
}

/** The `▲` chip's tooltip, one shape for the pre-turn hand card and the
 *  battle marker: `Name ×N` on the first line, the mods on the second. */
export function buffChipTooltip(key: string, magnitude: number, mods: StatusEffect['mods']): string {
  return `${buffKeyLabel(key)} ×${magnitude}\n${buffModsSummary(mods)}`;
}

/** A buff's mods as text (`+4 STR · +4 RNG`), in `STAT_LABELS` order, so a
 *  tooltip can't drift from the buff it describes. */
export function buffModsSummary(mods: StatusEffect['mods']): string {
  const parts: string[] = [];
  for (const stat of Object.keys(STAT_LABELS) as (keyof UnitStats)[]) {
    const mod = mods[stat];
    if (!mod) continue;
    if (mod.add !== undefined) {
      parts.push(`${mod.add >= 0 ? '+' : ''}${mod.add} ${STAT_LABELS[stat]}`);
    }
    if (mod.mul !== undefined) parts.push(`×${mod.mul} ${STAT_LABELS[stat]}`);
  }
  return parts.join(' · ');
}

/** The chip's numeric tail: `×stacks · potency/s · Ns`, omitting the parts
 *  that don't apply (no ×N unless an `add` status has stacked; no potency
 *  for a behavior status). Heal potency reads `+N/s`, damage `N/s`. */
function statusChipMeta(r: StatusReadout): string {
  const parts: string[] = [];
  if (r.merge === 'add' && r.stacks > 1) parts.push(`×${r.stacks}`);
  if (r.potencyPerSec !== null) {
    const v = Math.abs(r.potencyPerSec);
    const num = Number.isInteger(v) ? String(v) : v.toFixed(1);
    parts.push(r.kind === 'heal' ? `+${num}/s` : `${num}/s`);
  }
  if (r.remainingSeconds !== null) parts.push(`${r.remainingSeconds.toFixed(1)}s`);
  return parts.join(' · ');
}

/**
 * The header by skin. Promotion reads `NAME • Lv N`, with the level in its
 * own span so the reveal can flip it; every other skin reads `Level N name`
 * on one line. Both end with the rarity stars.
 */
function buildHeader(
  data: UnitCardData,
  skin: UnitCardSkin,
  touch: 'tap' | 'press',
): { headerEl: HTMLDivElement; levelValue: HTMLElement } {
  const header = document.createElement('div');
  header.className = 'unit-card__header';

  if (skin === 'promotion') {
    const label = document.createElement('span');
    // The config's display name (`nameForArchetype`), not the raw id.
    label.textContent = `${nameForArchetype(data.archetype).toUpperCase()} • `;
    const value = document.createElement('span');
    value.className = 'unit-card__level-value';
    value.textContent = t('common.lv', { level: data.level });
    header.append(label, value, buildRarityStars(data.rarity, touch));
    return { headerEl: header, levelValue: value };
  }

  header.textContent = t('unit.levelName', {
    level: data.level,
    name: nameForArchetype(data.archetype),
  });
  header.appendChild(buildRarityStars(data.rarity, touch));
  // No reveal for these skins: the handle points at the header so callers
  // have a non-null target. Only the promotion skin's level flip writes the
  // handle, and that skin has its own span, so the star run appended here
  // is never erased.
  return { headerEl: header, levelValue: header };
}

/**
 * The rarity stars at the header's tail (`rarityDisplay.ts`), the tier's
 * channel that is not colour: a fixed-width count of filled and hollow
 * stars, which survives grayscale where the card's tint cannot. Two spans
 * so the hollow half sits dimmer (CSS). The tier's name is a tooltip on the
 * run, and its touch route is the caller's: the long-press when the card
 * was built clickable (nested text in a control), a tap otherwise. Full
 * cards only: the compact battle card has no room, and the battle never
 * acts on rarity.
 */
function buildRarityStars(rarity: UnitRarity, touch: 'tap' | 'press'): HTMLSpanElement {
  const run = document.createElement('span');
  run.className = 'unit-card__rarity';
  const { filled, hollow } = rarityStarParts(rarity);
  const filledEl = document.createElement('span');
  filledEl.textContent = filled;
  const hollowEl = document.createElement('span');
  hollowEl.className = 'unit-card__rarity-hollow';
  hollowEl.textContent = hollow;
  run.append(filledEl, hollowEl);
  attachTooltip(run, rarityLabel(rarity), { touch });
  return run;
}

/**
 * The raw stat block. The 10 combat stats render in the grid. POW, the pool
 * stat (what the chip rule charges a side's pool, `chipRule.ts`) and not a
 * combat stat, is its own accented row above the grid, returned apart so
 * `buildUnitCard` can seat it under the level. POW goes into `statRows`
 * first, so the promotion reveal, which iterates the map in order, animates
 * it first, as it sits on the card. One DOM shape per row (the label and a
 * right-hand value group the promotion's `+N` chip goes into); the grid or
 * column layout and the reveal's styling are CSS keyed on the skin.
 */
function buildStats(stats: UnitStats): {
  statsEl: HTMLDivElement;
  powerRow: HTMLDivElement;
  statRows: Map<keyof UnitStats, StatRowHandle>;
} {
  const statsEl = document.createElement('div');
  statsEl.className = 'unit-card__stats';
  const statRows = new Map<keyof UnitStats, StatRowHandle>();

  const power = buildStatRow('power', stats.power, true);
  statRows.set('power', power.handle);

  for (const key of Object.keys(STAT_LABELS) as (keyof UnitStats)[]) {
    if (key === 'power') continue;
    const { row, handle } = buildStatRow(key, stats[key], false);
    statsEl.appendChild(row);
    statRows.set(key, handle);
  }

  return { statsEl, powerRow: power.row, statRows };
}

/** One stat row: `LABEL ········ value`; the right-hand group is where the
 *  promotion's `+N` chip lands. `isPower` adds the pool stat's accent, its
 *  `morale` hint and its tooltip. */
function buildStatRow(
  key: keyof UnitStats,
  value: number,
  isPower: boolean,
): { row: HTMLDivElement; handle: StatRowHandle } {
  const row = document.createElement('div');
  row.className = isPower ? 'unit-card__stat unit-card__stat--power' : 'unit-card__stat';

  const label = document.createElement('span');
  label.className = 'unit-card__stat-label';
  label.textContent = STAT_LABELS[key];
  if (isPower) {
    // Side-agnostic here, on every full card. The row sits in cards that may
    // be controls (a recruit pick), so the touch route is the long-press.
    attachTooltip(row, () => `${STAT_LABELS.power} — ${powerTooltip()}`, { touch: 'press' });
    const hint = document.createElement('span');
    hint.className = 'unit-card__power-hint';
    hint.textContent = t('card.hint.morale');
    label.append(' ', hint);
  }

  const right = document.createElement('span');
  right.className = 'unit-card__stat-right';
  const valueEl = document.createElement('span');
  valueEl.className = 'unit-card__stat-value';
  valueEl.textContent = String(value);
  right.appendChild(valueEl);

  row.append(label, right);
  return { row, handle: { row, value: valueEl, right } };
}

/** The abilities list: one row per ability id, in the archetype's order, so
 *  the card says what the unit does. */
function buildAbilities(archetype: Archetype, stats: UnitStats): HTMLDivElement {
  const abilities = document.createElement('div');
  abilities.className = 'unit-card__abilities';

  const heading = document.createElement('div');
  heading.className = 'unit-card__abilities-heading';
  heading.textContent = t('unit.abilities');
  abilities.appendChild(heading);

  for (const id of abilityIdsForArchetype(archetype)) {
    abilities.appendChild(abilityRow(id, stats));
  }
  return abilities;
}

/**
 * The XP-to-next-level bar, on the full cards that show it (pre-turn and
 * roster by default). A thin track whose green fill is the progress to the
 * next level, labelled `XP n / need`, or `MAX` at the cap. The math (the
 * clamp, MAX at the cap) is `xpProgress` in xp.ts, pure and tested; this
 * paints it.
 */
function buildXpBar(data: UnitCardData): HTMLDivElement {
  const prog = xpProgress(data.xp, data.level);

  const wrap = document.createElement('div');
  wrap.className = 'unit-card__xp';

  const track = document.createElement('div');
  track.className = 'unit-card__xp-track';
  const fill = document.createElement('div');
  fill.className = 'unit-card__xp-fill';
  fill.style.width = `${Math.round(prog.fraction * 100)}%`;
  track.appendChild(fill);

  const label = document.createElement('div');
  label.className = 'unit-card__xp-label';
  label.textContent = prog.atCap ? 'MAX' : `XP ${data.xp} / ${prog.need}`;

  wrap.append(track, label);
  return wrap;
}

/**
 * One ability row: the name, the detail line of what the ability does
 * (`abilityDetailParts`) with an AoE tag, then the cadence in seconds. All
 * of it is read from the `AbilityDef` (`config/abilities.json`) through the
 * sim's own helpers, so the card can't disagree with battle.
 */
function abilityRow(id: string, stats: UnitStats): HTMLDivElement {
  const def = abilityDef(id);

  const row = document.createElement('div');
  row.className = 'unit-card__ability';

  const name = document.createElement('div');
  name.className = 'unit-card__ability-name';
  name.textContent = def.name;
  row.appendChild(name);

  const detail = document.createElement('div');
  detail.className = 'unit-card__ability-detail';
  // The wording is `abilityDetailParts`, pure and tested headless; this row
  // owns the DOM (the styled AoE tag and the cadence column).
  detail.textContent = abilityDetailParts(id, stats).join(' · ');
  if (def.target.kind === 'aoe') {
    const side = def.target.radius * 2 + 1;
    const tag = document.createElement('span');
    tag.className = 'unit-card__ability-aoe';
    tag.textContent = `AoE ${side}×${side}`;
    detail.append(' · ', tag);
  }
  row.appendChild(detail);

  const cadence = document.createElement('div');
  cadence.className = 'unit-card__ability-cadence';
  // A non-speed-scaled ability's cooldown is flat (the dash); an attack's or
  // a heal's cadence scales with the unit's speed.
  const seconds = def.speedScaled
    ? ticksToSeconds(attackCooldownTicksFor(def.cooldownSeconds, stats.speed))
    : def.cooldownSeconds;
  cadence.textContent = `${seconds.toFixed(2)}s`;
  row.appendChild(cadence);

  return row;
}
