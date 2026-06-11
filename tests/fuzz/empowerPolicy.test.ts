/**
 * K4 commit 3 — the empower policy: flag grammar, JSON round-trip, and the
 * pure position selector (budget respect, determinism, the level/scored
 * heuristics' tie-breaks).
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RNG } from '../../src/core/RNG';
import { rollUnit } from '../../src/sim/archetypes';
import type { UnitTemplate } from '../../src/sim/Unit';
import type { Archetype } from '../../src/sim/archetypes';
import {
  parseEmpowerPolicy,
  parseEmpowerFlag,
  loadEmpowerPolicyFile,
  serializeEmpowerPolicy,
  empowerPolicyLabel,
  selectEmpowerPosition,
  type EmpowerPolicy,
} from './empowerPolicy';
import type { ScoredCardWeights } from './redrawPolicy';
import { STAT_KEYS } from './strategies/policies';
import { ALL_ARCHETYPES } from '../../src/sim/archetypes';

const rng = () => new RNG(7);

function card(archetype: Archetype, level: number): UnitTemplate {
  return rollUnit(archetype, new RNG(level * 31 + archetype.length), level);
}

/** All-zero weight vector to build scored policies from. */
function zeroWeights(): ScoredCardWeights {
  return {
    level: 0,
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as ScoredCardWeights['stats'],
    archetype: Object.fromEntries(
      ALL_ARCHETYPES.map((a) => [a, 0]),
    ) as ScoredCardWeights['archetype'],
  };
}

const AVAIL = { empowersRemaining: 1 };
const SPENT = { empowersRemaining: 0 };

describe('empower policy parsing', () => {
  it('parses the inline flag forms', () => {
    expect(parseEmpowerFlag('none')).toEqual({ kind: 'none' });
    expect(parseEmpowerFlag('random')).toEqual({ kind: 'random' });
    expect(parseEmpowerFlag('level:hi')).toEqual({ kind: 'level', dir: 'hi' });
    expect(parseEmpowerFlag('level:lo')).toEqual({ kind: 'level', dir: 'lo' });
  });

  it('rejects unknown flag forms loudly', () => {
    expect(() => parseEmpowerFlag('level')).toThrow(/Unrecognized/);
    expect(() => parseEmpowerFlag('level:2')).toThrow(/Unrecognized/);
    expect(() => parseEmpowerFlag('scored')).toThrow(/Unrecognized/);
  });

  it('round-trips a scored policy through serialize → file → load', () => {
    const dir = mkdtempSync(join(tmpdir(), 'empower-policy-'));
    try {
      const policy: EmpowerPolicy = {
        kind: 'scored',
        weights: { ...zeroWeights(), level: 1 },
      };
      const path = join(dir, 'policy.json');
      writeFileSync(path, serializeEmpowerPolicy(policy));
      expect(loadEmpowerPolicyFile(path)).toEqual(policy);
      // The flag form accepts the same file.
      expect(parseEmpowerFlag(path)).toEqual(policy);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('zod rejects malformed policies (missing weights, stray fields)', () => {
    expect(() => parseEmpowerPolicy({ kind: 'scored' })).toThrow();
    expect(() => parseEmpowerPolicy({ kind: 'level', dir: 'up' })).toThrow();
    expect(() => parseEmpowerPolicy({ kind: 'random', cards: 1 })).toThrow();
  });

  it('labels every kind compactly', () => {
    expect(empowerPolicyLabel({ kind: 'none' })).toBe('none');
    expect(empowerPolicyLabel({ kind: 'random' })).toBe('random');
    expect(empowerPolicyLabel({ kind: 'level', dir: 'hi' })).toBe('level:hi');
    expect(empowerPolicyLabel({ kind: 'scored', weights: zeroWeights() })).toBe('scored');
  });
});

describe('selectEmpowerPosition', () => {
  const HAND = [card('mercenary', 3), card('ranged', 7), card('mercenary', 5)];

  it('none and an exhausted budget both return null', () => {
    expect(selectEmpowerPosition(HAND, AVAIL, { kind: 'none' }, rng())).toBeNull();
    expect(selectEmpowerPosition(HAND, SPENT, { kind: 'level', dir: 'hi' }, rng())).toBeNull();
    expect(selectEmpowerPosition([], AVAIL, { kind: 'level', dir: 'hi' }, rng())).toBeNull();
  });

  it('level:hi picks the highest-level card, level:lo the lowest', () => {
    expect(selectEmpowerPosition(HAND, AVAIL, { kind: 'level', dir: 'hi' }, rng())).toBe(1);
    expect(selectEmpowerPosition(HAND, AVAIL, { kind: 'level', dir: 'lo' }, rng())).toBe(0);
  });

  it('level ties break by ascending hand position', () => {
    const tied = [card('mercenary', 5), card('ranged', 5), card('mercenary', 5)];
    expect(selectEmpowerPosition(tied, AVAIL, { kind: 'level', dir: 'hi' }, rng())).toBe(0);
    expect(selectEmpowerPosition(tied, AVAIL, { kind: 'level', dir: 'lo' }, rng())).toBe(0);
  });

  it('random is deterministic for a given rng stream and stays in range', () => {
    const a = selectEmpowerPosition(HAND, AVAIL, { kind: 'random' }, new RNG(11));
    const b = selectEmpowerPosition(HAND, AVAIL, { kind: 'random' }, new RNG(11));
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(HAND.length);
  });

  it('scored argmaxes the weighted card score (level weight ≡ level:hi)', () => {
    const policy: EmpowerPolicy = { kind: 'scored', weights: { ...zeroWeights(), level: 1 } };
    expect(selectEmpowerPosition(HAND, AVAIL, policy, rng())).toBe(
      selectEmpowerPosition(HAND, AVAIL, { kind: 'level', dir: 'hi' }, rng()),
    );
  });

  it('scored archetype affinity steers the pick', () => {
    const weights = zeroWeights();
    weights.archetype = { ...weights.archetype, ranged: 1 };
    const policy: EmpowerPolicy = { kind: 'scored', weights };
    expect(selectEmpowerPosition(HAND, AVAIL, policy, rng())).toBe(1); // the lone archer
  });

  it('scored ties break by ascending hand position', () => {
    const policy: EmpowerPolicy = { kind: 'scored', weights: zeroWeights() };
    expect(selectEmpowerPosition(HAND, AVAIL, policy, rng())).toBe(0);
  });
});
