/**
 * Pure formatter for `config/abilities.json` — the attack editor's Save / Copy /
 * Download all emit through here so a saved file is byte-for-byte the shape a
 * canonical hand-edit would produce (a Save with no edits is a no-op diff).
 * Extracted from the editor UI and node-safe (types only) so it can be unit-
 * tested against the committed file (tests/tools/attack-editor.test.ts).
 *
 * THE CANONICAL CONVENTION (§30a). `ABILITY_DEFS` is the PARSED value (zod
 * defaults already applied), so the formatter — not the source text — DEFINES
 * the on-disk shape; `config/abilities.json` was normalized to match it once in
 * §30a (a semantically-null pass — the deep-equal round-trip test guards it).
 * The rules:
 *  - 2-space indent; the file is a `Record<id, AbilityDef>` (key === def.id).
 *  - DEFAULTED fields are OMITTED at their default value: `speedScaled` (true),
 *    `minRangeCells` (0), aoe `ringMultiplier` (1), timeline `scalesWithSpeed`
 *    (false), chain `hopDelaySeconds` (0.1), summon `level`/`count` (1) /
 *    `radiusCells` (2), summon `at` ({kind:'self'}). TRUE-OPTIONAL fields
 *    (`ignoresLineOfSight`, `fx`, applyStatus `magnitude`/`durationSeconds`) are
 *    emitted only when present.
 *  - Small objects are inline (the target selector, each timeline phase, `fx`,
 *    and the `heal`/`move`/`applyStatus`/`summon` ops); the multi-field `damage`
 *    op and the `chain` op expand one field per line (matching the source).
 */

import type {
  AbilityDef,
  EffectEntry,
  EffectOp,
  ChainOp,
  DamageOp,
  SummonSpec,
  TargetSelector,
  TimelinePhase,
} from '../../src/sim/effects/schema';

/** A finite number as JSON text (`2.0` → `2`, `0.5` → `0.5`). */
const n = (x: number): string => String(x);
const s = (x: string): string => JSON.stringify(x);

/** Order `fx` keys by the timeline phase order (the file's convention). */
const FX_KEYS = ['windup', 'release', 'travel', 'impact', 'recovery'] as const;

function fmtTarget(t: TargetSelector): string {
  switch (t.kind) {
    case 'self':
      return '{ "kind": "self" }';
    case 'enemyInRange':
      return '{ "kind": "enemyInRange" }';
    case 'lowestHpAlly':
      return `{ "kind": "lowestHpAlly", "rangeCells": ${n(t.rangeCells)} }`;
    case 'aoe': {
      const pairs = [
        `"kind": "aoe"`,
        `"shape": ${s(t.shape)}`,
        `"radius": ${n(t.radius)}`,
        `"anchor": ${s(t.anchor)}`,
        `"affects": ${s(t.affects)}`,
      ];
      if (t.ringMultiplier !== 1) pairs.push(`"ringMultiplier": ${n(t.ringMultiplier)}`);
      return `{ ${pairs.join(', ')} }`;
    }
  }
}

function fmtPhase(p: TimelinePhase): string {
  const pairs = [`"phase": ${s(p.phase)}`, `"seconds": ${p.seconds === 'fill' ? '"fill"' : n(p.seconds)}`];
  if (p.scalesWithSpeed) pairs.push(`"scalesWithSpeed": true`);
  return `{ ${pairs.join(', ')} }`;
}

function fmtFx(fx: NonNullable<AbilityDef['fx']>): string {
  const pairs = FX_KEYS.filter((k) => fx[k] !== undefined).map((k) => `${s(k)}: ${s(fx[k]!)}`);
  return `{ ${pairs.join(', ')} }`;
}

function fmtSummonSpec(spec: SummonSpec): string {
  const pairs = [`"archetype": ${s(spec.archetype)}`];
  if (spec.level !== 1) pairs.push(`"level": ${n(spec.level)}`);
  if (spec.count !== 1) pairs.push(`"count": ${n(spec.count)}`);
  pairs.push(`"maxLive": ${n(spec.maxLive)}`);
  if (spec.radiusCells !== 2) pairs.push(`"radiusCells": ${n(spec.radiusCells)}`);
  return `{ ${pairs.join(', ')} }`;
}

/** The eight `damage` fields expanded, one per line. `indent` is the column of
 *  the opening `{` line's caller (so continuation lines sit at `indent + 2`). */
function fmtDamage(op: DamageOp, indent: string): string {
  const inner = indent + '  ';
  const lines = [
    `"kind": "damage"`,
    `"scaling": ${s(op.scaling)}`,
    `"might": ${n(op.might)}`,
    `"accuracy": ${n(op.accuracy)}`,
    `"critBase": ${n(op.critBase)}`,
    `"critable": ${String(op.critable)}`,
    `"evadable": ${String(op.evadable)}`,
    `"bypassDefense": ${String(op.bypassDefense)}`,
  ];
  return `{\n${lines.map((l) => inner + l).join(',\n')}\n${indent}}`;
}

function fmtChain(op: ChainOp, indent: string): string {
  const inner = indent + '  ';
  const lines = [
    `"kind": "chain"`,
    `"maxJumps": ${n(op.maxJumps)}`,
    `"rangeCells": ${n(op.rangeCells)}`,
    `"falloff": ${n(op.falloff)}`,
  ];
  if (op.hopDelaySeconds !== 0.1) lines.push(`"hopDelaySeconds": ${n(op.hopDelaySeconds)}`);
  const opIndent = inner + '  ';
  const opsLines = op.ops.map((io) => opIndent + fmtOp(io, opIndent));
  lines.push(`"ops": [\n${opsLines.join(',\n')}\n${inner}]`);
  return `{\n${lines.map((l) => inner + l).join(',\n')}\n${indent}}`;
}

/** Format one op. `indent` is the column the op's opening line starts at (its
 *  first line is returned un-indented for the caller to place after `"op": `). */
function fmtOp(op: EffectOp, indent: string): string {
  switch (op.kind) {
    case 'heal':
      return `{ "kind": "heal", "scaling": ${s(op.scaling)}, "might": ${n(op.might)} }`;
    case 'move':
      return `{ "kind": "move", "mode": ${s(op.mode)}, "cells": ${n(op.cells)} }`;
    case 'applyStatus': {
      const pairs = [`"kind": "applyStatus"`, `"statusId": ${s(op.statusId)}`];
      if (op.magnitude !== undefined) pairs.push(`"magnitude": ${n(op.magnitude)}`);
      if (op.durationSeconds !== undefined) pairs.push(`"durationSeconds": ${n(op.durationSeconds)}`);
      return `{ ${pairs.join(', ')} }`;
    }
    case 'summon': {
      const pairs = [`"kind": "summon"`, `"summon": ${fmtSummonSpec(op.summon)}`];
      if (op.at.kind !== 'self') pairs.push(`"at": ${fmtTarget(op.at)}`);
      return `{ ${pairs.join(', ')} }`;
    }
    case 'damage':
      return fmtDamage(op, indent);
    case 'chain':
      return fmtChain(op, indent);
  }
}

function fmtEffectEntry(e: EffectEntry, indent: string): string {
  const f = indent + '  ';
  return `${indent}{\n${f}"phase": ${s(e.phase)},\n${f}"op": ${fmtOp(e.op, f)}\n${indent}}`;
}

/** Format the full abilities catalog. No trailing newline — the save endpoint
 *  appends one (matching every other editor's emit convention). */
export function formatAbilitiesJson(config: Record<string, AbilityDef>): string {
  const blocks = Object.entries(config).map(([key, def]) => {
    const F = '    ';
    const lines: string[] = [
      `${F}"id": ${s(def.id)}`,
      `${F}"name": ${s(def.name)}`,
      `${F}"cooldownSeconds": ${n(def.cooldownSeconds)}`,
    ];
    if (def.speedScaled === false) lines.push(`${F}"speedScaled": false`);
    lines.push(`${F}"rangeCells": ${n(def.rangeCells)}`);
    if (def.minRangeCells !== 0) lines.push(`${F}"minRangeCells": ${n(def.minRangeCells)}`);
    if (def.ignoresLineOfSight !== undefined) {
      lines.push(`${F}"ignoresLineOfSight": ${String(def.ignoresLineOfSight)}`);
    }
    lines.push(`${F}"target": ${fmtTarget(def.target)}`);
    lines.push(`${F}"timeline": [\n${def.timeline.map((p) => `      ${fmtPhase(p)}`).join(',\n')}\n${F}]`);
    lines.push(`${F}"orphanPolicy": ${s(def.orphanPolicy)}`);
    lines.push(`${F}"priority": ${n(def.priority)}`);
    lines.push(`${F}"effects": [\n${def.effects.map((e) => fmtEffectEntry(e, '      ')).join(',\n')}\n${F}]`);
    if (def.fx !== undefined) lines.push(`${F}"fx": ${fmtFx(def.fx)}`);
    return `  ${s(key)}: {\n${lines.join(',\n')}\n  }`;
  });
  return `{\n${blocks.join(',\n')}\n}`;
}
