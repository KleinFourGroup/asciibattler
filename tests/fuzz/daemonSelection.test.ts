import { describe, it, expect } from 'vitest';
import { parseDaemonFlag, daemonConfigFor, daemonLabel } from './daemonSelection';
import { DAEMONS, daemonById } from '../../src/config/daemons';

describe('parseDaemonFlag (L1c3)', () => {
  it('parses the keywords and every catalog id (case/space tolerant)', () => {
    expect(parseDaemonFlag('random')).toEqual({ kind: 'random' });
    expect(parseDaemonFlag('none')).toEqual({ kind: 'none' });
    for (const d of DAEMONS) {
      expect(parseDaemonFlag(d.id)).toEqual({ kind: 'fixed', id: d.id });
      expect(parseDaemonFlag(` ${d.id.toUpperCase()} `)).toEqual({ kind: 'fixed', id: d.id });
    }
  });

  it('throws on an unknown idol id (a typo must not silently measure random)', () => {
    expect(() => parseDaemonFlag('cthulhu')).toThrow(/unknown value/);
  });
});

describe('daemonConfigFor', () => {
  it('random → undefined (leave the Run to its own roll)', () => {
    expect(daemonConfigFor({ kind: 'random' })).toBeUndefined();
  });

  it('none → null (the daemon-less control arm)', () => {
    expect(daemonConfigFor({ kind: 'none' })).toBeNull();
  });

  it('fixed → the catalog entry, by reference', () => {
    for (const d of DAEMONS) {
      expect(daemonConfigFor({ kind: 'fixed', id: d.id })).toBe(daemonById(d.id));
    }
  });

  it('fixed with an unknown id throws', () => {
    expect(() => daemonConfigFor({ kind: 'fixed', id: 'cthulhu' })).toThrow(/unknown daemon id/);
  });
});

describe('daemonLabel', () => {
  it('labels each kind', () => {
    expect(daemonLabel({ kind: 'random' })).toBe('random');
    expect(daemonLabel({ kind: 'none' })).toBe('none');
    expect(daemonLabel({ kind: 'fixed', id: 'mars' })).toBe('mars');
  });
});
