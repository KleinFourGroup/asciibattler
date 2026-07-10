/**
 * Pure formatter for `config/packets.json` — the packet editor's Save / Copy /
 * Download all emit through here so a written file is byte-for-byte the shape
 * a hand-edit would produce (the archetype/sector/encounter/reward formatter
 * pattern; node-safe, unit-tested against the committed file in
 * tests/tools/packet-editor.test.ts).
 *
 * Mirrors `config/packets.json` exactly: a `{ "packets": [...] }` root,
 * 2-space indent, each packet expanded in schema key order (`id`, `name`,
 * `description`, `usableIn` inline, `target`, `effect`). The effect's layout
 * is PER-OP, matching the committed convention:
 *  - `healPool` / `grantRedraws` — flat ops, INLINE on one line;
 *  - `applyBuff` — expanded, its `buff` expanded, `mods` one stat per line
 *    (each `{add?, mul?}` mod inline);
 *  - `injectRule` — expanded, its `rule` expanded (`on`, `chance?`,
 *    `filter?` inline, `effect` inline), then `duration`.
 * No trailing newline — the save endpoint appends one (the emit convention).
 */

import type { PacketConfig, PacketEffect } from '../../src/config/packets';

type Mods = Extract<PacketEffect, { op: 'applyBuff' }>['buff']['mods'];
type InjectedRule = Extract<PacketEffect, { op: 'injectRule' }>['rule'];

/** One `{add?, mul?}` stat mod, inline, in schema key order. */
function inlineMod(mod: NonNullable<Mods[keyof Mods]>): string {
  const parts: string[] = [];
  if (mod.add !== undefined) parts.push(`"add": ${JSON.stringify(mod.add)}`);
  if (mod.mul !== undefined) parts.push(`"mul": ${JSON.stringify(mod.mul)}`);
  return `{ ${parts.join(', ')} }`;
}

/** An injected rule's effect (`gainBits` | `applyStatus`), inline. */
function inlineRuleEffect(effect: InjectedRule['effect']): string {
  const parts = [`"op": ${JSON.stringify(effect.op)}`];
  if (effect.op === 'gainBits') {
    parts.push(`"amount": ${JSON.stringify(effect.amount)}`);
  } else {
    parts.push(`"statusId": ${JSON.stringify(effect.statusId)}`);
    if (effect.magnitude !== undefined) {
      parts.push(`"magnitude": ${JSON.stringify(effect.magnitude)}`);
    }
    if (effect.durationSeconds !== undefined) {
      parts.push(`"durationSeconds": ${JSON.stringify(effect.durationSeconds)}`);
    }
    if (effect.applyTo !== undefined) {
      parts.push(`"applyTo": ${JSON.stringify(effect.applyTo)}`);
    }
  }
  return `{ ${parts.join(', ')} }`;
}

/** The `effect` block's lines, indented for the packet body (6 spaces at the
 *  `"effect"` key). Flat ops inline; the nested ops expand. */
function effectLines(effect: PacketEffect): string[] {
  switch (effect.op) {
    case 'healPool':
      return [
        `      "effect": { "op": "healPool", "amount": ${JSON.stringify(effect.amount)} }`,
      ];
    case 'grantRedraws':
      return [
        `      "effect": { "op": "grantRedraws", "redrawsPerTurn": ${JSON.stringify(
          effect.redrawsPerTurn,
        )}, "maxCardsPerTurn": ${JSON.stringify(effect.maxCardsPerTurn)} }`,
      ];
    case 'applyBuff': {
      const lines = [
        '      "effect": {',
        '        "op": "applyBuff",',
        '        "buff": {',
        `          "key": ${JSON.stringify(effect.buff.key)},`,
      ];
      const statKeys = Object.keys(effect.buff.mods) as (keyof Mods)[];
      if (statKeys.length === 0) {
        lines.push('          "mods": {},');
      } else {
        lines.push('          "mods": {');
        statKeys.forEach((stat, i) => {
          const tail = i === statKeys.length - 1 ? '' : ',';
          lines.push(
            `            ${JSON.stringify(stat)}: ${inlineMod(effect.buff.mods[stat]!)}${tail}`,
          );
        });
        lines.push('          },');
      }
      lines.push(
        `          "merge": ${JSON.stringify(effect.buff.merge)}`,
        '        },',
        `        "duration": ${JSON.stringify(effect.duration)}`,
        '      }',
      );
      return lines;
    }
    case 'injectRule': {
      const rule = effect.rule;
      const lines = [
        '      "effect": {',
        '        "op": "injectRule",',
        '        "rule": {',
        `          "on": ${JSON.stringify(rule.on)},`,
      ];
      if (rule.chance !== undefined) {
        lines.push(`          "chance": ${JSON.stringify(rule.chance)},`);
      }
      if (rule.filter !== undefined) {
        const parts: string[] = [];
        if (rule.filter.archetype !== undefined) {
          parts.push(`"archetype": ${JSON.stringify(rule.filter.archetype)}`);
        }
        if (rule.filter.crit !== undefined) {
          parts.push(`"crit": ${JSON.stringify(rule.filter.crit)}`);
        }
        lines.push(`          "filter": { ${parts.join(', ')} },`);
      }
      lines.push(
        `          "effect": ${inlineRuleEffect(rule.effect)}`,
        '        },',
        `        "duration": ${JSON.stringify(effect.duration)}`,
        '      }',
      );
      return lines;
    }
  }
}

/**
 * Format a full packet catalog (the whole file) to a JSON string matching
 * `config/packets.json`'s layout. No trailing newline.
 */
export function formatPacketsJson(packets: readonly PacketConfig[]): string {
  const lines: string[] = ['{', '  "packets": ['];
  packets.forEach((p, pi) => {
    const tail = pi === packets.length - 1 ? '' : ',';
    lines.push('    {');
    lines.push(`      "id": ${JSON.stringify(p.id)},`);
    lines.push(`      "name": ${JSON.stringify(p.name)},`);
    lines.push(`      "description": ${JSON.stringify(p.description)},`);
    lines.push(`      "usableIn": [${p.usableIn.map((c) => JSON.stringify(c)).join(', ')}],`);
    lines.push(`      "target": ${JSON.stringify(p.target)},`);
    lines.push(...effectLines(p.effect));
    lines.push(`    }${tail}`);
  });
  lines.push('  ]', '}');
  return lines.join('\n');
}
