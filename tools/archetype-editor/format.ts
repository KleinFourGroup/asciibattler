/**
 * Pure formatter for `config/archetypes.json` — the archetype editor's Save /
 * Copy / Download all emit through here so a saved file is byte-for-byte the
 * shape a hand-edit would produce (no noisy whitespace diffs). Extracted from
 * the editor UI and node-safe (types + a label map only) so it can be unit-
 * tested against the committed file (tests/tools/archetype-editor.test.ts).
 *
 * Mirrors the existing file exactly: 2-space indent, the `glyph / abilities /
 * targeting / baseStats / growthRates` key order, the `abilities` array inline
 * on one line, and the stats emitted in the canonical `STAT_LABELS` order
 * (CON·STR·RNG·MAG·LCK·DEF·PRC·EVA·SPD·MOB·POW). Driving the stat order off
 * `STAT_LABELS` — the same source the recruit/promotion cards iterate — means a
 * future stat addition flows through the formatter with no edit here.
 */

import type { ArchetypesConfig } from '../../src/config/archetypes';
import { STAT_LABELS } from '../../src/ui/statLabels';

const STAT_ORDER = Object.keys(STAT_LABELS) as (keyof typeof STAT_LABELS)[];

/** Emit the canonical-ordered `"stat": value,` lines for one stat block. */
function statLines(block: Readonly<Record<string, number>>): string[] {
  return STAT_ORDER.map((key, i) => {
    const sep = i === STAT_ORDER.length - 1 ? '' : ',';
    return `      ${JSON.stringify(key)}: ${JSON.stringify(block[key])}${sep}`;
  });
}

/**
 * Format a full archetypes config (the whole file, all archetypes) to a JSON
 * string matching `config/archetypes.json`'s layout. No trailing newline — the
 * save endpoint appends one (matching every other editor's emit convention).
 */
export function formatArchetypesJson(config: ArchetypesConfig): string {
  const keys = Object.keys(config) as (keyof ArchetypesConfig)[];
  const parts: string[] = ['{'];
  keys.forEach((name, i) => {
    const a = config[name];
    const tail = i === keys.length - 1 ? '' : ',';
    parts.push(`  ${JSON.stringify(name)}: {`);
    parts.push(`    "glyph": ${JSON.stringify(a.glyph)},`);
    parts.push(`    "abilities": ${JSON.stringify(a.abilities)},`);
    parts.push(`    "targeting": ${JSON.stringify(a.targeting)},`);
    parts.push(`    "baseStats": {`);
    parts.push(...statLines(a.baseStats));
    parts.push(`    },`);
    parts.push(`    "growthRates": {`);
    parts.push(...statLines(a.growthRates));
    parts.push(`    }`);
    parts.push(`  }${tail}`);
  });
  parts.push('}');
  return parts.join('\n');
}
