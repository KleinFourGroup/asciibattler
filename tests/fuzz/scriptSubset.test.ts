/**
 * 57a — the `--scripts=<spec>` subset resolver. The load-bearing contracts:
 * both spec forms select against the STANDARD registry, order is always the
 * registry's own (arbitration priority is the registry's property — the §54
 * lock), and every malformed spec bails loudly (a typo must not silently
 * measure the wrong leave-one-out arm).
 */

import { describe, expect, it } from 'vitest';
import { AUDITION_SCRIPTS, TRAFFIC_SCRIPTS } from '../../src/bot/TrafficScriptDriver';
import { parseScriptsSpec } from './scriptSubset';

describe('parseScriptsSpec (57a — the leave-one-out CLI seam)', () => {
  it('a minus-arm subtracts from the full registry, order preserved', () => {
    const subset = parseScriptsSpec('-unjam');
    expect(subset.map((s) => s.id)).toEqual(
      TRAFFIC_SCRIPTS.filter((s) => s.id !== 'unjam').map((s) => s.id),
    );
  });

  it('an only-arm selects exactly the named scripts, in registry order', () => {
    const subset = parseScriptsSpec('cohesion-focus,unjam');
    // Spec order (cohesion first) must NOT reorder: unjam precedes
    // cohesion-focus in the registry's arbitration priority.
    expect(subset.map((s) => s.id)).toEqual(['unjam', 'cohesion-focus']);
  });

  it('naming every id reproduces the full registry (parity with --scripts)', () => {
    const all = parseScriptsSpec(TRAFFIC_SCRIPTS.map((s) => s.id).join(','));
    expect(all).toEqual(TRAFFIC_SCRIPTS);
  });

  it('throws on a mixed spec', () => {
    expect(() => parseScriptsSpec('unjam,-choke-hold')).toThrow(/mixed/);
  });

  it('throws on an unknown id, listing the choices', () => {
    expect(() => parseScriptsSpec('-unjammm')).toThrow(/unknown script id 'unjammm'.*unjam/);
  });

  it('throws on an empty spec', () => {
    expect(() => parseScriptsSpec('  ,  ')).toThrow(/empty spec/);
  });

  it('57g.4: resolves against a parameterized registry — the --audition composition', () => {
    const subset = parseScriptsSpec('-unjam', AUDITION_SCRIPTS);
    expect(subset.map((s) => s.id)).toEqual(
      AUDITION_SCRIPTS.filter((s) => s.id !== 'unjam').map((s) => s.id),
    );
    // The resolved objects are the AUDITION variants (nominate present) —
    // the spec grammar composes with the registry swap, not around it.
    for (const s of subset) expect(s.nominate).toBeDefined();
  });
});
