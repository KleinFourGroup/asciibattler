/**
 * Pure formatter for `config/prices.json` — the price editor's Save / Copy /
 * Download all emit through here so a written file is byte-for-byte the shape
 * a hand-edit would produce (the archetype/sector/encounter/reward/packet
 * formatter pattern; node-safe, unit-tested against the committed file in
 * tests/tools/price-editor.test.ts).
 *
 * Mirrors `config/prices.json` exactly: 2-space indent, schema key order
 * (`units` → `packets` → `daemons` → `sellFraction` → `unitRemovalPrice` →
 * `portStock`), one archetype / one override per line, an EMPTY override
 * book inline as `{}` (the committed daemons.byId convention). No trailing
 * newline — the save endpoint appends one (the emit convention).
 */

import type { PricesConfig } from '../../src/config/prices';

/** A `{ default, byId }` price book (`packets` / `daemons`), expanded. */
function bookLines(key: 'packets' | 'daemons', book: PricesConfig['packets']): string[] {
  const lines = [`  ${JSON.stringify(key)}: {`, `    "default": ${JSON.stringify(book.default)},`];
  const ids = Object.keys(book.byId);
  if (ids.length === 0) {
    lines.push('    "byId": {}');
  } else {
    lines.push('    "byId": {');
    ids.forEach((id, i) => {
      const tail = i === ids.length - 1 ? '' : ',';
      lines.push(`      ${JSON.stringify(id)}: ${JSON.stringify(book.byId[id])}${tail}`);
    });
    lines.push('    }');
  }
  lines.push('  },');
  return lines;
}

/**
 * Format a full price book (the whole file) to a JSON string matching
 * `config/prices.json`'s layout. No trailing newline.
 */
export function formatPricesJson(prices: PricesConfig): string {
  const lines: string[] = ['{'];

  lines.push('  "units": {', '    "baseByArchetype": {');
  const archetypes = Object.keys(prices.units.baseByArchetype);
  archetypes.forEach((archetype, i) => {
    const tail = i === archetypes.length - 1 ? '' : ',';
    lines.push(
      `      ${JSON.stringify(archetype)}: ${JSON.stringify(
        prices.units.baseByArchetype[archetype],
      )}${tail}`,
    );
  });
  lines.push(
    '    },',
    `    "levelGrowth": ${JSON.stringify(prices.units.levelGrowth)},`,
    `    "jitter": ${JSON.stringify(prices.units.jitter)},`,
    // §61f — the per-tier rarity multiplier, always present (a required seam
    // field, not a per-entry override), emitted in tier order.
    '    "rarityMultiplier": {',
    `      "common": ${JSON.stringify(prices.units.rarityMultiplier.common)},`,
    `      "uncommon": ${JSON.stringify(prices.units.rarityMultiplier.uncommon)},`,
    `      "rare": ${JSON.stringify(prices.units.rarityMultiplier.rare)},`,
    `      "legendary": ${JSON.stringify(prices.units.rarityMultiplier.legendary)}`,
    '    }',
    '  },',
  );

  lines.push(...bookLines('packets', prices.packets));
  lines.push(...bookLines('daemons', prices.daemons));

  lines.push(
    `  "sellFraction": ${JSON.stringify(prices.sellFraction)},`,
    `  "unitRemovalPrice": ${JSON.stringify(prices.unitRemovalPrice)},`,
    '  "portStock": {',
    `    "units": ${JSON.stringify(prices.portStock.units)},`,
    `    "packets": ${JSON.stringify(prices.portStock.packets)},`,
    `    "daemons": ${JSON.stringify(prices.portStock.daemons)}`,
    '  }',
    '}',
  );
  return lines.join('\n');
}
