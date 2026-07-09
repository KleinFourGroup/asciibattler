/**
 * Pure formatter for `config/rewards.json` — the reward-table editor's Save /
 * Copy / Download all emit through here so a written file is byte-for-byte the
 * shape a hand-edit would produce (no noisy whitespace diffs). Extracted from
 * the editor UI and node-safe (types only) so it can be unit-tested against the
 * committed file (tests/tools/reward-editor.test.ts) — the
 * archetype/sector/encounter formatter pattern.
 *
 * Mirrors `config/rewards.json` exactly: a `{ "tables": [...] }` root object,
 * 2-space indent, each table expanded (`id` then `entries`), and each entry
 * inline on one line in its schema key order — `kind`, `weight`, then the
 * kind-specific fields (`min`/`max` for bits, `packet`, `daemon`). No trailing
 * newline — the save endpoint appends one (every editor's emit convention).
 */

import type { RewardTable, RewardEntry } from '../../src/config/rewards';

/** One weighted entry on a single line, in schema key order per kind. */
function inlineEntry(entry: RewardEntry): string {
  const parts = [
    `"kind": ${JSON.stringify(entry.kind)}`,
    `"weight": ${JSON.stringify(entry.weight)}`,
  ];
  switch (entry.kind) {
    case 'bits':
      parts.push(`"min": ${JSON.stringify(entry.min)}`, `"max": ${JSON.stringify(entry.max)}`);
      break;
    case 'packet':
      parts.push(`"packet": ${JSON.stringify(entry.packet)}`);
      break;
    case 'daemon':
      parts.push(`"daemon": ${JSON.stringify(entry.daemon)}`);
      break;
  }
  return `{ ${parts.join(', ')} }`;
}

/**
 * Format a full reward-table registry (the whole file) to a JSON string
 * matching `config/rewards.json`'s layout. No trailing newline.
 */
export function formatRewardsJson(tables: readonly RewardTable[]): string {
  const lines: string[] = ['{', '  "tables": ['];
  tables.forEach((t, ti) => {
    const tail = ti === tables.length - 1 ? '' : ',';
    lines.push('    {');
    lines.push(`      "id": ${JSON.stringify(t.id)},`);
    if (t.entries.length === 0) {
      // Schema-invalid (min 1 entry) so Save is disabled — but emit valid JSON
      // for the export box rather than a malformed block.
      lines.push('      "entries": []');
    } else {
      lines.push('      "entries": [');
      t.entries.forEach((e, ei) => {
        const etail = ei === t.entries.length - 1 ? '' : ',';
        lines.push(`        ${inlineEntry(e)}${etail}`);
      });
      lines.push('      ]');
    }
    lines.push(`    }${tail}`);
  });
  lines.push('  ]', '}');
  return lines.join('\n');
}
