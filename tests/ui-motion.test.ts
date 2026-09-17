/**
 * 99b — THE REDUCED-MOTION PINS (Round 7 §99; the ui-tokens.test.ts shape
 * applied to the sheet's animations). `ui.css` keys its reduced forms off
 * `:root[data-motion='reduced']`, the attribute src/render/motion.ts stamps
 * (the selector is DERIVED from that module's constants, so a rename on
 * either side fails here). A new `animation:` anywhere in the sheet fails
 * until it picks a reduced form — the guard rides `npm test`, the
 * forgetful path, not the author's attention.
 *
 * Contract:
 *   1. every selector that carries an `animation:` outside the gate has the
 *      SAME selector under the gate, also carrying an `animation:`;
 *   2. every keyframe a reduced rule names is defined and MOTION-FREE (no
 *      `transform` in any frame) and never `infinite`;
 *   3. a reduced form that is not `none` keeps the original DURATION (the
 *      hitsplat and the pre-turn exit ghost self-remove on `animationend` —
 *      an animation that never ends leaks them);
 *   4. every `@keyframes` in the sheet is referenced by some `animation:`
 *      (no dead keyframes);
 *   5. zero `@media (prefers-reduced-motion …)` blocks — the attribute is the
 *      ONE gate (a media block can't be flipped by the Round 8 setting).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOTION_ATTR, MOTION_REDUCED } from '../src/render/motion';
import { blocksOf, stripCssComments } from './cssBlocks';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHEET = 'src/ui/ui.css';
const GATE = `[${MOTION_ATTR}='${MOTION_REDUCED}']`;

const raw = readFileSync(join(ROOT, SHEET), 'utf8');
const css = stripCssComments(raw);

interface AnimRule {
  readonly selector: string;
  readonly value: string; // the raw `animation:` value
}

const keyframes = new Map<string, string>(); // name → body
const rules: AnimRule[] = [];
const mediaPreludes: string[] = [];

function collect(src: string): void {
  for (const b of blocksOf(src)) {
    const kf = /^@keyframes\s+(\S+)/.exec(b.prelude);
    if (kf) {
      keyframes.set(kf[1]!, b.body);
      continue;
    }
    if (b.prelude.startsWith('@media')) {
      mediaPreludes.push(b.prelude);
      collect(b.body);
      continue;
    }
    if (b.prelude.startsWith('@')) continue;
    const anim = /(?:^|[\s;])animation\s*:\s*([^;]+);/.exec(b.body);
    if (!anim) continue;
    for (const sel of b.prelude.split(',')) {
      rules.push({ selector: sel.trim().replace(/\s+/g, ' '), value: anim[1]!.trim() });
    }
  }
}
collect(css);

const gated = (sel: string): boolean => sel.includes(GATE);
const ungate = (sel: string): string =>
  sel.replace(new RegExp(`^:root\\${GATE.slice(0, -1)}\\]\\s+`), '');
const nameOf = (value: string): string => value.split(/\s+/)[0]!;
const durationOf = (value: string): string | undefined =>
  value.split(/\s+/).find((t) => /^[\d.]+m?s$/.test(t));

const plain = rules.filter((r) => !gated(r.selector));
const reduced = new Map(
  rules.filter((r) => gated(r.selector)).map((r) => [ungate(r.selector), r] as const),
);

describe('99b — the reduced-motion forms', () => {
  it('parsed the sheet (the format or the walker drifted otherwise)', () => {
    expect(keyframes.size).toBeGreaterThan(5);
    expect(plain.length).toBeGreaterThan(5);
    expect(reduced.size).toBeGreaterThan(5);
  });

  it('every animated selector has its reduced form under the gate', () => {
    const missing = plain.map((r) => r.selector).filter((s) => !reduced.has(s));
    expect(
      missing,
      `no \`:root${GATE} <selector> { animation: … }\` for:\n${missing.join('\n')}`,
    ).toEqual([]);
  });

  it('every reduced rule is gated on EVERY selector of its list (no leak)', () => {
    // A rule whose selector list mixes gated and ungated entries would apply
    // its reduced form to motion-on players; `rules` splits lists, so check
    // by re-walking the preludes that name a reduced keyframe.
    for (const b of blocksOf(css)) {
      if (b.prelude.startsWith('@')) continue;
      const sels = b.prelude.split(',').map((s) => s.trim());
      const anyGated = sels.some(gated);
      if (anyGated) expect(sels.every(gated), `mixed gating in "${b.prelude}"`).toBe(true);
    }
  });

  it('reduced keyframes are defined, motion-free and never infinite', () => {
    const bad: string[] = [];
    for (const [sel, r] of reduced) {
      const name = nameOf(r.value);
      if (/\binfinite\b/.test(r.value)) bad.push(`${sel}: infinite`);
      if (name === 'none') continue;
      const body = keyframes.get(name);
      if (body === undefined) bad.push(`${sel}: keyframe "${name}" undefined`);
      else if (/\btransform\s*:/.test(body))
        bad.push(`${sel}: keyframe "${name}" carries a transform`);
    }
    expect(bad).toEqual([]);
  });

  it('a reduced form that is not `none` keeps the original duration', () => {
    const bad: string[] = [];
    for (const r of plain) {
      const red = reduced.get(r.selector);
      if (!red || nameOf(red.value) === 'none') continue;
      const want = durationOf(r.value);
      const got = durationOf(red.value);
      if (want !== got) bad.push(`${r.selector}: ${want} → ${got}`);
    }
    expect(bad).toEqual([]);
  });

  it('every @keyframes is referenced by some animation', () => {
    const used = new Set(rules.map((r) => nameOf(r.value)));
    const dead = [...keyframes.keys()].filter((k) => !used.has(k));
    expect(dead).toEqual([]);
  });

  it('has zero @media prefers-reduced-motion blocks — the attribute is the one gate', () => {
    const media = mediaPreludes.filter((p) => /prefers-reduced-motion/.test(p));
    expect(media).toEqual([]);
  });
});
