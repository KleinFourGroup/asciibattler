/**
 * P1 — the shared unit-card component. One builder renders a unit (a roster
 * `UnitTemplate`, a battle `Unit`, or a `PromotionInfo`'s pre-level state) into
 * a card, so RecruitScreen / PromotionScreen / (P3) PreTurnScreen / (Q) the HUD
 * can't drift on layout, the stat block, or the "card can't disagree with the
 * unit" ability readings. Replaces RecruitScreen's `renderCard`/`abilityRow`/
 * `statLine` (+ its `ABILITY_UI` label map, since retired in Yb for the
 * config-owned `AbilityDef.name`) and PromotionScreen's card markup.
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

import type { UnitTemplate, Archetype, UnitStats, Unit } from '../sim/Unit';
import type { PromotionInfo } from '../core/events';
import { abilityIdsForArchetype, glyphForArchetype } from '../sim/archetypes';
import { attackCooldownTicksFor, damageStatFor } from '../sim/stats';
import { abilityDef, damageOpOf, healOpOf } from '../config/abilities';
import { ticksToSeconds } from '../config';
import { xpProgress, displayLevel } from '../sim/xp';
import { STAT_LABELS } from './statLabels';

/** Future per-unit accent dimension. Only `common` exists today (unstyled =
 *  current look); the union grows when the rarity system lands. */
export type UnitRarity = 'common';

/** Macro layout. `full` = recruit-style detail (stats + abilities); `compact`
 *  = the in-battle HUD card (consumed in Phase Q). */
export type UnitCardMode = 'compact' | 'full';

/** Render context — selects the theme/layout CSS, the header format, and the
 *  default section visibility. Each screen is one skin. `hud` is the Q4/Q5
 *  in-battle pane skin (only ever paired with `compact`). `roster` is the R1/R2
 *  card-list modal skin (roster view + draw/discard pile views; display-only
 *  full cards, shows the XP bar). */
export type UnitCardSkin = 'recruit' | 'promotion' | 'preturn' | 'hud' | 'roster';

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
  /** Live battle HP (Q4 — drives the `compact` variant's glyph-width HP bar).
   *  Only the `unitCardFromUnit` adapter populates it; the template/promotion
   *  adapters leave it undefined (those variants don't show an HP bar). */
  readonly hp?: { readonly current: number; readonly max: number };
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
  /** Q5 — team coloring for the `compact` variant: `enemy` → red glyph + HP
   *  bar; default `player` → the green default. Ignored by the full variants
   *  (always player-owned). */
  readonly team?: 'player' | 'enemy';
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
  /** Per-stat handles in canonical `STAT_LABELS` order. Empty for `compact`
   *  (it has no stat block to reveal). */
  readonly statRows: Map<keyof UnitStats, StatRowHandle>;
  /** Q4 — the `compact` HP-bar fill, for the in-battle pane to drive on every
   *  `unit:attacked`/`:burned`/`:healed`. Undefined for the full variants. */
  readonly hpFill?: HTMLDivElement;
}

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

/** Adapter: a live battle `Unit` → card data (Q4 — the in-battle `compact`
 *  card). Carries HP for the bar; `displayLevel` rounds the combatant level to
 *  the same value the rest of the UI shows. Power is read off the same `stats`
 *  block as every other surface, so the card can't disagree with the unit. */
export function unitCardFromUnit(unit: Unit): UnitCardData {
  return {
    // `unit.archetype` is `UnitArchetype` (Archetype | 'environment'); only
    // real combatants are carded (neutral walls are filtered out before this),
    // so the `environment` arm is unreachable — the narrow just keeps the
    // shared `Archetype` field (read by the full variant) honest.
    archetype: unit.archetype === 'environment' ? 'mercenary' : unit.archetype,
    glyph: unit.glyph,
    level: displayLevel(unit.level),
    stats: unit.stats,
    rarity: 'common',
    xp: unit.xp,
    hp: { current: unit.currentHp, max: unit.derived.maxHp },
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

/** Whether a skin shows the XP-to-next bar by default. Pre-turn and the R1
 *  roster view show it (both render OWNED roster units with real banked XP);
 *  recruit offers are fresh (0) and promotion is mid-level-up. */
function defaultShowXpBar(skin: UnitCardSkin): boolean {
  return skin === 'preturn' || skin === 'roster';
}

export function buildUnitCard(data: UnitCardData, opts: UnitCardOptions): UnitCardHandles {
  // Q4 — the in-battle pane card is a different shape (glyph + level/power +
  // HP bar, no stat block), so it branches off before the full layout below.
  if (opts.mode === 'compact') return buildCompactCard(data, opts);

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
 * Q4 — the `compact` in-battle card (bottom-center player pane; Q5 mirrors it
 * for enemies). The brief's shape: a large glyph with the level small at the
 * top-left and power small at the top-right (power tinted with the established
 * POW meta-blue so the two corners read apart without wide labels), and a
 * glyph-width HP bar below. The returned `hpFill` lets the pane drive the bar
 * live; death gray-out is a `.is-dead` class the pane toggles. No stat block,
 * abilities, or XP bar — those stay on the full variants.
 */
function buildCompactCard(data: UnitCardData, opts: UnitCardOptions): UnitCardHandles {
  const card = document.createElement('div');
  card.className = [
    'unit-card',
    `unit-card--${opts.skin}`,
    'unit-card--compact',
    `unit-card--rarity-${data.rarity}`,
  ].join(' ');
  // Q5 — enemy cards recolor glyph + HP to red; player (default) stays green.
  if (opts.team === 'enemy') card.classList.add('unit-card--enemy');

  const top = document.createElement('div');
  top.className = 'unit-card__compact-top';
  const level = document.createElement('span');
  level.className = 'unit-card__compact-level';
  level.textContent = String(data.level);
  level.title = `Level ${data.level}`;
  const power = document.createElement('span');
  power.className = 'unit-card__compact-power';
  power.textContent = String(data.stats.power);
  power.title = `${STAT_LABELS.power} ${data.stats.power} — chips the opposing health pool each turn`;
  top.append(level, power);

  const glyph = document.createElement('div');
  glyph.className = 'unit-card__glyph';
  glyph.textContent = data.glyph;

  const hp = document.createElement('div');
  hp.className = 'unit-card__compact-hp';
  const hpFill = document.createElement('div');
  hpFill.className = 'unit-card__compact-hp-fill';
  hpFill.style.width = `${hpPercent(data.hp) * 100}%`;
  hp.appendChild(hpFill);

  card.append(top, glyph, hp);
  // No reveal/stat block for compact — point `levelValue` at the level span so
  // the handle is non-null, and hand back an empty `statRows`.
  return { el: card, levelValue: level, statRows: new Map(), hpFill };
}

/** Clamp a UnitCardData HP reading to a 0..1 fill fraction (0 when absent). */
function hpPercent(hp: UnitCardData['hp']): number {
  if (!hp || hp.max <= 0) return 0;
  return Math.max(0, Math.min(1, hp.current / hp.max));
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
 * The damage/heal amount reuses the sim's single-source-of-truth helpers (the
 * op's `might` + the scaling stat) so the card can't disagree with battle.
 * Range / cadence / AoE / the I6 profile come from `config/abilities.json`
 * (the `AbilityDef`: `rangeCells`, the damage/heal op, the `aoe` selector).
 */
function abilityRow(id: string, archetype: Archetype, stats: UnitStats): HTMLDivElement {
  const def = abilityDef(id);

  const row = document.createElement('div');
  row.className = 'unit-card__ability';

  const name = document.createElement('div');
  name.className = 'unit-card__ability-name';
  // Yb QoL: the display name is config now (`AbilityDef.name`), not a hardcoded
  // UI label map. Damage-vs-heal is read straight from the op below.
  name.textContent = def.name;
  row.appendChild(name);

  const detail = document.createElement('div');
  detail.className = 'unit-card__ability-detail';
  const parts: string[] = [];
  if (def.target.kind === 'self') {
    // N1 — a pure-reposition leap (the dash): no damage/heal profile, just the
    // leap distance (its recharge shows in the cadence column below).
    parts.push(`dash ${def.rangeCells}`);
  } else {
    const healOp = healOpOf(id);
    const damageOp = damageOpOf(id);
    if (healOp) {
      parts.push(`${healOp.might + stats.magic} heal`, `rng ${def.rangeCells}`);
    } else if (damageOp) {
      parts.push(`${damageOp.might + damageStatFor(archetype, stats)} dmg`, `rng ${def.rangeCells}`);
      // I6 — surface the per-weapon profile: base hit chance for an evadable
      // strike, base crit for a critable one (terse percentages, e.g. "60% hit").
      if (damageOp.evadable) parts.push(`${Math.round(damageOp.accuracy * 100)}% hit`);
      if (damageOp.critable) parts.push(`${Math.round(damageOp.critBase * 100)}% crit`);
    }
  }
  detail.textContent = parts.join(' · ');
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
  // N1 — a non-speed-scaled ability's cooldown is flat (the dash); attack/heal
  // cadence scales with the unit's speed.
  const seconds = def.speedScaled
    ? ticksToSeconds(attackCooldownTicksFor(def.cooldownSeconds, stats.speed))
    : def.cooldownSeconds;
  cadence.textContent = `${seconds.toFixed(2)}s`;
  row.appendChild(cadence);

  return row;
}
