/**
 * 102d — ONE side's fallen as a cell: its label, a glyph run (`nobody fell`
 * when none) and the loss the rows add up to. Lifted from the pre-turn
 * screen's "last turn" strip (96.5d) when the run-end stats became its second
 * consumer — the strip draws one turn, the GameOverScreen draws an encounter
 * and the whole run, all three off `Run.fallenLedger` rows.
 *
 * The idioms it carries for both: a glyph run with a tooltip is a text site
 * (focusable, tap toggles — §97d); the side is named in WORDS, the hue is the
 * second channel (§98); nothing here animates or changes after mount.
 */

import type { FallenRecord } from '../run/Run';
import type { ArchetypeFallen } from '../run/fallenStats';
import { ARCHETYPE_CONFIG, glyphForArchetype } from '../sim/archetypes';
import { t } from '../i18n/ui';
import { attachTooltip } from './tooltip';

export interface FallenSideOptions {
  readonly side: 'player' | 'enemy';
  readonly label: string;
  /** The glyph run as drawn; `null` = nobody fell. */
  readonly glyphs: string | null;
  /** The run's detail, one fallen (or one group) per line. */
  readonly glyphTooltip?: string;
  /** Σ power of the rows — what the fallen cost this side. */
  readonly loss: number;
  readonly lossTooltip?: string;
}

function archetypeName(archetype: string): string {
  return ARCHETYPE_CONFIG[archetype]?.name ?? archetype;
}

/** One glyph per fallen, in death order; `null` for an empty side. */
export function fallenGlyphRun(rows: readonly FallenRecord[]): string | null {
  return rows.length === 0 ? null : rows.map((r) => glyphForArchetype(r.archetype)).join(' ');
}

/** One line per fallen: `Archer Lv4 (−2)`. */
export function fallenLines(rows: readonly FallenRecord[]): string {
  return rows
    .map((r) => t('lastturn.fallen', { name: archetypeName(r.archetype), level: r.level, power: r.power }))
    .join('\n');
}

/** The run-wide form, where one glyph per fallen would not fit: `M×5 A×2`. */
export function archetypeGlyphRun(groups: readonly ArchetypeFallen[]): string | null {
  return groups.length === 0
    ? null
    : groups.map((g) => `${glyphForArchetype(g.archetype)}×${g.count}`).join(' ');
}

/** One line per archetype: `Mercenary ×5 (−12)`. */
export function archetypeLines(groups: readonly ArchetypeFallen[]): string {
  return groups
    .map((g) => t('gameover.stats.archetype', { name: archetypeName(g.archetype), count: g.count, power: g.power }))
    .join('\n');
}

export function fallenSide(opts: FallenSideOptions): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = `fallen-side fallen-side--${opts.side}`;

  const name = document.createElement('span');
  name.className = 'fallen-side-label';
  name.textContent = opts.label;

  const glyphs = document.createElement('span');
  glyphs.className = 'fallen-glyphs';
  if (opts.glyphs === null) {
    glyphs.classList.add('fallen-glyphs--none');
    glyphs.textContent = t('lastturn.nobody');
  } else {
    glyphs.textContent = opts.glyphs;
    if (opts.glyphTooltip !== undefined) {
      glyphs.tabIndex = 0;
      attachTooltip(glyphs, opts.glyphTooltip);
    }
  }

  const loss = document.createElement('span');
  loss.className = 'fallen-loss';
  loss.textContent = opts.loss > 0 ? `−${opts.loss}` : '0';
  if (opts.lossTooltip !== undefined) {
    loss.tabIndex = 0;
    attachTooltip(loss, opts.lossTooltip);
  }

  el.append(name, glyphs, loss);
  return el;
}
