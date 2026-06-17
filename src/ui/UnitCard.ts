/**
 * P1 — the shared unit-card component. One builder renders a unit (a roster
 * `UnitTemplate`, a battle `Unit`, or a `PromotionInfo`'s pre-level state) into
 * a card, so RecruitScreen / PromotionScreen / (P3) PreTurnScreen / (Q) the HUD
 * can't drift on layout, the stat block, or the "card can't disagree with the
 * unit" ability readings. Replaces RecruitScreen's `renderCard`/`abilityRow`/
 * `statLine` + `ABILITY_UI` and PromotionScreen's card markup.
 *
 * The visual differences between the screens are PRESERVED (P1 is a parity
 * extraction, not a redesign): they're expressed as `skin` CSS classes + per-
 * skin header formats + section defaults, NOT baked into the DOM the component
 * emits. The M2 staggered reveal stays in PromotionScreen, which drives the
 * card via the `levelValue` + `statRows` handles this builder returns.
 *
 * Rarity seam: every card stamps `unit-card--rarity-{rarity}` (default
 * `common`). No rarity CSS ships yet — default rarity renders exactly as today
 * — so the future rarity-accent system is a data field + a CSS block, with no
 * structural change here or in the screens.
 */

import type { UnitTemplate, Archetype, UnitStats } from '../sim/Unit';
import type { PromotionInfo } from '../core/events';
import { abilityIdsForArchetype, glyphForArchetype } from '../sim/archetypes';
import { attackCooldownTicksFor, damageStatFor } from '../sim/stats';
import { abilityConfig } from '../config/abilities';
import { ticksToSeconds } from '../config';
import { xpProgress } from '../sim/xp';
import { STAT_LABELS } from './statLabels';

/** Future per-unit accent dimension. Only `common` exists today (unstyled =
 *  current look); the union grows when the rarity system lands. */
export type UnitRarity = 'common';

/** Macro layout. `full` = recruit-style detail (stats + abilities); `compact`
 *  = the in-battle HUD card (consumed in Phase Q). */
export type UnitCardMode = 'compact' | 'full';

/** Render context — selects the theme/layout CSS, the header format, and the
 *  default section visibility. Each screen is one skin. */
export type UnitCardSkin = 'recruit' | 'promotion' | 'preturn';

/** Normalized card input. Adapters build this from a template / Unit /
 *  promotion so the builder never reaches into screen-specific shapes. */
export interface UnitCardData {
  readonly archetype: Archetype;
  readonly glyph: string;
  readonly level: number;
  readonly stats: UnitStats;
  readonly rarity: UnitRarity;
  /** Banked XP toward the next level (P2 — drives the full variant's XP bar). */
  readonly xp: number;
}

export interface UnitCardOptions {
  readonly mode: UnitCardMode;
  readonly skin: UnitCardSkin;
  /** Override the skin's default abilities-section visibility (recruit/preturn
   *  show; promotion hides). */
  readonly showAbilities?: boolean;
  /** Override the skin's default click affordance (recruit clicks; promotion
   *  doesn't). The click handler itself is wired by the caller. */
  readonly clickable?: boolean;
  /** Override the skin's default XP-bar visibility (P2 — pre-turn shows it for
   *  owned roster units; recruit hides it, since fresh offers carry no banked
   *  progress; promotion is mid-level-up). */
  readonly showXpBar?: boolean;
}

/** Handles into one stat row's mutable bits, for the M2 reveal. */
export interface StatRowHandle {
  readonly row: HTMLDivElement;
  readonly value: HTMLSpanElement;
  /** The right-hand group the `+N` delta chip is appended into. */
  readonly right: HTMLSpanElement;
}

export interface UnitCardHandles {
  readonly el: HTMLDivElement;
  /** The element holding the level text (the M2 level-reveal target). For
   *  skins without a reveal it's just the header element. */
  readonly levelValue: HTMLElement;
  /** Per-stat handles in canonical `STAT_LABELS` order. */
  readonly statRows: Map<keyof UnitStats, StatRowHandle>;
}

/**
 * Render-only ability descriptor map (was RecruitScreen's `ABILITY_UI`).
 * Display labels + whether the ability heals or damages live HERE (UI), NOT in
 * `config/abilities.json` (mechanics-only). An unmapped ability falls back to
 * its raw id + a damage reading, so the card never throws.
 */
const ABILITY_UI: Record<string, { label: string; effect: 'damage' | 'heal' }> = {
  // I6 — the per-subclass melee weapons (split from the old `melee_strike`).
  sword: { label: 'Sword', effect: 'damage' },
  club: { label: 'Club', effect: 'damage' },
  katana: { label: 'Katana', effect: 'damage' },
  whip: { label: 'Whip', effect: 'damage' },
  bow: { label: 'Bow', effect: 'damage' },
  gambit_strike: { label: 'Gambit', effect: 'damage' },
  heal_ally: { label: 'Heal', effect: 'heal' },
  magic_bolt: { label: 'Bolt', effect: 'damage' },
  catapult_shot: { label: 'Lob', effect: 'damage' },
};

/** Adapter: a roster/offer template → card data (recruit + P3 pre-turn). */
export function unitCardFromTemplate(template: UnitTemplate): UnitCardData {
  return {
    archetype: template.archetype,
    glyph: glyphForArchetype(template.archetype),
    level: template.level,
    stats: template.stats,
    rarity: 'common',
    xp: template.xp,
  };
}

/** Adapter: a `PromotionInfo`'s PRE-level state → card data. The reveal flips
 *  it to the new level/stats via the returned handles (driven by the screen).
 *  Promotion never shows the XP bar (mid-level-up), so `xp` is irrelevant. */
export function unitCardFromPromotion(p: PromotionInfo): UnitCardData {
  return {
    archetype: p.archetype,
    glyph: p.glyph,
    level: p.oldLevel,
    stats: p.oldStats,
    rarity: 'common',
    xp: 0,
  };
}

/** Whether a skin shows the abilities section by default (P1: recruit/preturn
 *  yes, promotion no — preserving each screen's current look). */
function defaultShowAbilities(skin: UnitCardSkin): boolean {
  return skin !== 'promotion';
}

/** Whether a skin is clickable by default (recruit picks a unit; promotion is
 *  display-only). */
function defaultClickable(skin: UnitCardSkin): boolean {
  return skin === 'recruit';
}

/** Whether a skin shows the XP-to-next bar by default. Only pre-turn (owned
 *  roster units with real banked XP) does; recruit offers are fresh (0) and
 *  promotion is mid-level-up. */
function defaultShowXpBar(skin: UnitCardSkin): boolean {
  return skin === 'preturn';
}

export function buildUnitCard(data: UnitCardData, opts: UnitCardOptions): UnitCardHandles {
  const card = document.createElement('div');
  card.className = [
    'unit-card',
    `unit-card--${opts.skin}`,
    `unit-card--${opts.mode}`,
    `unit-card--rarity-${data.rarity}`,
  ].join(' ');
  if (opts.clickable ?? defaultClickable(opts.skin)) {
    card.classList.add('unit-card--clickable');
  }

  const glyph = document.createElement('div');
  glyph.className = 'unit-card__glyph';
  glyph.textContent = data.glyph;
  card.appendChild(glyph);

  const { headerEl, levelValue } = buildHeader(data, opts.skin);
  card.appendChild(headerEl);

  const { statsEl, powerRow, statRows } = buildStats(data.stats);
  // POW (the meta pool-chip stat) sits in its own accented row right under the
  // level, above the per-battle combat grid.
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
 * Per-skin header. Recruit reads `Level N archetype` (one line); promotion
 * reads `ARCHETYPE • Lv N` with the level in its own span so the M2 beat can
 * flip it. Pre-turn reuses the recruit format for P1 (P3 refines it).
 */
function buildHeader(
  data: UnitCardData,
  skin: UnitCardSkin,
): { headerEl: HTMLDivElement; levelValue: HTMLElement } {
  const header = document.createElement('div');
  header.className = 'unit-card__header';

  if (skin === 'promotion') {
    const label = document.createElement('span');
    label.textContent = `${data.archetype.toUpperCase()} • `;
    const value = document.createElement('span');
    value.className = 'unit-card__level-value';
    value.textContent = `Lv ${data.level}`;
    header.append(label, value);
    return { headerEl: header, levelValue: value };
  }

  header.textContent = `Level ${data.level} ${data.archetype}`;
  // No reveal for this skin — point the handle at the header itself so callers
  // have a non-null target.
  return { headerEl: header, levelValue: header };
}

/**
 * The raw stat block. The 10 per-battle combat stats render in the grid; POW —
 * the Phase-H meta-currency that chips the encounter health pools each turn, not
 * a combat dial — is pulled out as its own accented row ABOVE the grid (returned
 * separately so `buildUnitCard` can seat it right under the level). POW is
 * inserted FIRST into `statRows`, so the promotion reveal (which iterates the
 * map in order) animates it first, matching its card position. One DOM shape per
 * row (label + a right-hand value group the promotion `+N` chip appends into);
 * the grid-vs-column layout + reveal styling are pure CSS keyed on the skin.
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
 *  promotion `+N` chip lands. `isPower` adds the meta-stat accent + a `pool`
 *  clarifier (POW chips the encounter health pools, not a per-battle stat). */
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
    row.title = 'Power — chips the opposing health pool each turn';
    const hint = document.createElement('span');
    hint.className = 'unit-card__power-hint';
    hint.textContent = 'pool';
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

/**
 * The abilities list — one row per ability id (in stored order), self-
 * documenting what the unit does. Moved verbatim from RecruitScreen so the
 * "card can't disagree with the unit" guarantee is the single source of truth.
 */
function buildAbilities(archetype: Archetype, stats: UnitStats): HTMLDivElement {
  const abilities = document.createElement('div');
  abilities.className = 'unit-card__abilities';

  const heading = document.createElement('div');
  heading.className = 'unit-card__abilities-heading';
  heading.textContent = 'Abilities';
  abilities.appendChild(heading);

  for (const id of abilityIdsForArchetype(archetype)) {
    abilities.appendChild(abilityRow(id, archetype, stats));
  }
  return abilities;
}

/**
 * P2 — the XP-to-next-level bar (full variant; pre-turn skin). A thin track
 * with a green fill = progress to the next level, labelled `XP n / need` (or
 * `MAX` at the cap). The math (clamp, MAX-at-cap) is the pure, unit-tested
 * `xpProgress` in xp.ts; this just paints it.
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
 * One ability row: name, then the weapon profile (`N dmg · rng R · H% hit · C%
 * crit`, or `N heal · rng R`) with an AoE tag, then the cadence in seconds.
 * The damage/heal amount reuses the sim's single-source-of-truth helpers (I6:
 * `cfg.might` + the scaling stat) so the card can't disagree with battle.
 * Range / cadence / AoE / the I6 profile come from `config/abilities.json`.
 */
function abilityRow(id: string, archetype: Archetype, stats: UnitStats): HTMLDivElement {
  const ui = ABILITY_UI[id] ?? { label: id, effect: 'damage' as const };
  const cfg = abilityConfig(id);

  const row = document.createElement('div');
  row.className = 'unit-card__ability';

  const name = document.createElement('div');
  name.className = 'unit-card__ability-name';
  name.textContent = ui.label;
  row.appendChild(name);

  const detail = document.createElement('div');
  detail.className = 'unit-card__ability-detail';
  const parts: string[] = [];
  if (cfg.kind === 'movement') {
    // N1 — a utility leap: no damage/heal profile, just the leap distance (its
    // recharge shows in the cadence column below).
    parts.push(`dash ${cfg.range}`);
  } else {
    const scaling = cfg.kind === 'heal' ? stats.magic : damageStatFor(archetype, stats);
    const amount = cfg.might + scaling;
    parts.push(`${amount} ${cfg.kind === 'heal' ? 'heal' : 'dmg'}`, `rng ${cfg.range}`);
    // I6 — surface the per-weapon profile: base hit chance for an evadable
    // strike, base crit for a critable one (terse percentages, e.g. "60% hit").
    if (cfg.kind === 'attack') {
      if (cfg.evadable) parts.push(`${Math.round(cfg.accuracy * 100)}% hit`);
      if (cfg.critable) parts.push(`${Math.round(cfg.critBase * 100)}% crit`);
    }
  }
  detail.textContent = parts.join(' · ');
  if (cfg.kind === 'attack' && cfg.aoe) {
    const side = cfg.aoe.radius * 2 + 1;
    const tag = document.createElement('span');
    tag.className = 'unit-card__ability-aoe';
    tag.textContent = `AoE ${side}×${side}`;
    detail.append(' · ', tag);
  }
  row.appendChild(detail);

  const cadence = document.createElement('div');
  cadence.className = 'unit-card__ability-cadence';
  // N1 — a movement ability's cooldown is flat (not speed-scaled); attack/heal
  // cadence scales with the unit's speed.
  const seconds =
    cfg.kind === 'movement'
      ? cfg.cooldownSeconds
      : ticksToSeconds(attackCooldownTicksFor(cfg.cooldownSeconds, stats.speed));
  cadence.textContent = `${seconds.toFixed(2)}s`;
  row.appendChild(cadence);

  return row;
}
