/**
 * Pure formatter for `config/units.json` — the archetype editor's Save /
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

import type { UnitDef } from '../../src/config/units';
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
 * string matching `config/units.json`'s layout. No trailing newline — the
 * save endpoint appends one (matching every other editor's emit convention).
 *
 * Typed as `Record<string, UnitDef>` (not the fixed-key `UnitDefsConfig`)
 * so §30d's editor can emit a working set that includes a NOT-YET-WIRED new
 * archetype key — the formatter only iterates keys + reads each entry's fields,
 * so it's agnostic to which keys exist.
 */
export function formatArchetypesJson(config: Record<string, UnitDef>): string {
  const keys = Object.keys(config);
  const parts: string[] = ['{'];
  keys.forEach((name, i) => {
    const a = config[name];
    const tail = i === keys.length - 1 ? '' : ',';
    parts.push(`  ${JSON.stringify(name)}: {`);
    // §38d — a NEUTRAL entry (wall / half-cover / rubble) is a glyph + optional
    // `hp`, no abilities/stat blocks. §40b: discriminate on `baseStats` (a
    // combatant-only key), NOT `hp` — `hp` became OPTIONAL (HP-presence =
    // destructibility), so an hp-less wall must still route here. Matches
    // `isNeutralUnitDef`; stays a types-only node-safe module. Fields in canonical
    // order; only a present `hp` (destructible rubble), the non-default
    // `blocksLineOfSight: false` (half-cover), a non-default `footprint`, and a
    // present `statusSusceptibility` are emitted, so the file diff stays minimal and
    // a re-parse fills the omitted defaults back.
    if (!('baseStats' in a)) {
      const fields = [`    "glyph": ${JSON.stringify(a.glyph)}`];
      // §40b — emit `hp` only when the neutral carries one (destructible rubble);
      // an hp-less wall / half-cover is indestructible and omits it.
      if (a.hp !== undefined) fields.push(`    "hp": ${JSON.stringify(a.hp)}`);
      if (a.blocksLineOfSight === false) fields.push(`    "blocksLineOfSight": false`);
      // §40a — a multi-tile rubble neutral declares its footprint (N∈2..4). The
      // default 1 (walls / half-cover / 1×1 rubble) stays omitted so their file
      // diff is untouched and a re-parse fills it back. Canonical order: after
      // blocksLineOfSight, before statusSusceptibility (the schema field order).
      if ((a.footprint ?? 1) !== 1) fields.push(`    "footprint": ${JSON.stringify(a.footprint)}`);
      if (a.statusSusceptibility !== undefined)
        fields.push(`    "statusSusceptibility": ${JSON.stringify(a.statusSusceptibility)}`);
      parts.push(fields.join(',\n'));
      parts.push(`  }${tail}`);
      return;
    }
    parts.push(`    "glyph": ${JSON.stringify(a.glyph)},`);
    parts.push(`    "abilities": ${JSON.stringify(a.abilities)},`);
    parts.push(`    "targeting": ${JSON.stringify(a.targeting)},`);
    // §29-close: `draftable` defaults to true and is emitted ONLY when false (the
    // enemy disruptors + the summon-only minion), so the player-draftable
    // archetypes keep their original lines and the file diff is exactly the
    // exclusions. A re-parse fills the absent default back to true.
    if (a.draftable === false) parts.push(`    "draftable": false,`);
    // §38c — the branch-killer capability fields, emitted only when present (a
    // striker's `damageStat`; absent ⇒ non-striker/0). Optional with no schema
    // default, so an absent field re-parses to absent — the file diff stays
    // exactly the archetypes that declare one.
    if (a.damageStat !== undefined) parts.push(`    "damageStat": ${JSON.stringify(a.damageStat)},`);
    if (a.movementBehavior !== undefined)
      parts.push(`    "movementBehavior": ${JSON.stringify(a.movementBehavior)},`);
    if (a.retargetOnLosLoss !== undefined)
      parts.push(`    "retargetOnLosLoss": ${JSON.stringify(a.retargetOnLosLoss)},`);
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
