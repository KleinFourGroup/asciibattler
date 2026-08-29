/**
 * 86e1 — the per-batch machine manifest pins: round-trip, git capture in a
 * real repo, and the loud-on-corrupt read contract (a broken provenance
 * record must never quietly read as "no provenance").
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MANIFEST_FILE,
  MANIFEST_VERSION,
  armSignatureOf,
  captureGitProvenance,
  readBatchManifest,
  stripPartitionFlags,
  writeBatchManifest,
} from './manifest';

describe('86e1 — the batch manifest', () => {
  it('round-trips write → read', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fuzz-manifest-'));
    try {
      const written = writeBatchManifest(dir, {
        kind: 'run',
        argv: ['--count=40', '--searcher', '--out=x'],
        seedWindow: { firstSeed: 1, count: 40 },
        provenance: { head: 'a'.repeat(40), dirty: false },
      });
      const read = readBatchManifest(dir);
      expect(read).toEqual(written);
      expect(read?.manifestVersion).toBe(MANIFEST_VERSION);
      expect(read?.head).toBe('a'.repeat(40));
      expect(read?.seedWindow).toEqual({ firstSeed: 1, count: 40 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('captures real git provenance in this repo (a 40-hex head + a boolean dirty)', () => {
    const p = captureGitProvenance();
    expect(p.head).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof p.dirty).toBe('boolean');
  });

  it('reads null on a missing manifest, THROWS on a corrupt or shape-broken one', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fuzz-manifest-'));
    try {
      expect(readBatchManifest(dir)).toBeNull();
      writeFileSync(join(dir, MANIFEST_FILE), 'not json{');
      expect(() => readBatchManifest(dir)).toThrow(/unparseable/);
      writeFileSync(join(dir, MANIFEST_FILE), JSON.stringify({ kind: 'run' }));
      expect(() => readBatchManifest(dir)).toThrow(/shape-broken/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('strips exactly the partition flags for the arm signature (order-blind)', () => {
    expect(
      stripPartitionFlags(['--count=40', '--searcher', '--seed-offset=40', '--out=d', '--jobs=8', '--emit-results', '--prior-lambda=0.5']),
    ).toEqual(['--searcher', '--prior-lambda=0.5']);
    // The same arm, differently partitioned and differently ordered.
    expect(armSignatureOf(['--count=40', '--searcher', '--arbitrate'])).toBe(
      armSignatureOf(['--arbitrate', '--count=80', '--seed-offset=40', '--searcher', '--jobs=8']),
    );
    // A real arm difference survives the strip.
    expect(armSignatureOf(['--searcher'])).not.toBe(armSignatureOf(['--searcher', '--arbitrate']));
    // `--counters` must NOT be swallowed by the `--count` prefix (flag-boundary check).
    expect(stripPartitionFlags(['--counters=3'])).toEqual(['--counters=3']);
  });
});
