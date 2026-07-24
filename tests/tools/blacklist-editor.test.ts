/**
 * 63g — Global Blacklist Editor edit-surface fidelity. The editor is a UI
 * over the `draftable` flags in `config/units.json`, saving through the
 * ARCHETYPE editor's `formatArchetypesJson` (whose verbatim + round-trip
 * pins live in archetype-editor.test.ts). What's pinned here is the
 * blacklist-specific contract:
 *
 *  1. Toggling one archetype off adds EXACTLY one `"draftable": false,`
 *     line to the committed file (and toggling it back restores the file
 *     verbatim) — a blacklist edit's diff is exactly the exclusion change.
 *  2. The toggle survives the format → real-schema reparse round-trip
 *     (deep-equal, and the derived draftable set matches).
 *  3. `poolsByTier` over the untouched catalog reproduces the live
 *     `DRAFTABLE_BY_TIER` — the preview's grouping can't drift from the
 *     sampler's.
 *
 * Everything derives from the live catalog (never hardcoded archetype ids).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ALL_UNIT_DEFS, UnitDefsSchema, type UnitDefsConfig } from '../../src/config/units';
import { DRAFTABLE_BY_TIER } from '../../src/sim/archetypes';
import { formatArchetypesJson } from '../../tools/archetype-editor/format';
import {
  combatantIds,
  draftableIds,
  poolsByTier,
  setDraftable,
} from '../../tools/blacklist-editor/draftable';

/** Normalize line endings + trailing blank space so the assertions aren't
 *  hostage to how git checked the file out. */
function norm(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/, '');
}

/** If `next` is `orig` plus exactly one inserted line, return that line;
 *  otherwise null. */
function singleInsertion(orig: string[], next: string[]): string | null {
  if (next.length !== orig.length + 1) return null;
  let i = 0;
  while (i < orig.length && orig[i] === next[i]) i++;
  for (let j = i; j < orig.length; j++) {
    if (orig[j] !== next[j + 1]) return null;
  }
  return next[i]!;
}

const onDisk = norm(
  readFileSync(fileURLToPath(new URL('../../config/units.json', import.meta.url)), 'utf8'),
);

function working(): UnitDefsConfig {
  return structuredClone(ALL_UNIT_DEFS);
}

describe('the blacklist edit surface', () => {
  it('blacklisting one archetype adds exactly one draftable:false line', () => {
    const config = working();
    const target = draftableIds(config)[0]!;
    setDraftable(config, target, false);
    const inserted = singleInsertion(
      onDisk.split('\n'),
      norm(formatArchetypesJson(config)).split('\n'),
    );
    expect(inserted).toBe('    "draftable": false,');
    expect(draftableIds(config)).not.toContain(target);
  });

  it('un-blacklisting a global exclusion removes exactly its line; re-toggling restores the file verbatim', () => {
    const config = working();
    const excluded = combatantIds(config).filter((id) => !draftableIds(config).includes(id));
    expect(excluded.length).toBeGreaterThan(0); // the §29-close exclusions exist
    const target = excluded[0]!;
    setDraftable(config, target, true);
    const removed = singleInsertion(
      norm(formatArchetypesJson(config)).split('\n'),
      onDisk.split('\n'),
    );
    expect(removed).toBe('    "draftable": false,');
    expect(draftableIds(config)).toContain(target);

    setDraftable(config, target, false);
    expect(norm(formatArchetypesJson(config))).toBe(onDisk);
  });

  it('a toggle round-trips through the real game schema deep-equal', () => {
    const config = working();
    const target = draftableIds(config)[0]!;
    setDraftable(config, target, false);
    const reparsed = UnitDefsSchema.parse(JSON.parse(formatArchetypesJson(config)));
    expect(reparsed).toEqual(config);
    expect(draftableIds(reparsed)).toEqual(draftableIds(config));
  });

  it('poolsByTier over the untouched catalog reproduces the live DRAFTABLE_BY_TIER', () => {
    expect(poolsByTier(ALL_UNIT_DEFS)).toEqual(DRAFTABLE_BY_TIER);
  });

  it('rejects a toggle on a neutral or unknown id (loud, not a no-op)', () => {
    const config = working();
    const neutral = Object.keys(config).find((id) => !combatantIds(config).includes(id));
    expect(neutral).toBeDefined(); // the neutral fold (wall / half-cover) exists
    expect(() => setDraftable(config, neutral!, false)).toThrow(/not a combatant/);
    expect(() => setDraftable(config, 'no-such-archetype', false)).toThrow(/not a combatant/);
  });
});
