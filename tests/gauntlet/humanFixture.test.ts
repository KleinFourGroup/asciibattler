import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { replayTrace } from '../../src/dev/replayTrace';
import { configHash } from '../../src/dev/configHash';
import type { BattleTrace } from '../../src/dev/TraceRecorder';

/**
 * 53g — the recorded HUMAN baseline replays byte-identically (the phase exit
 * criterion, closed on real session data rather than synthetic traces). The
 * fixture is the canonical union of the 2026-07-13 session dumps (104 turns,
 * ring order, deduped by worldSeed — worklog §53g); the full-corpus sweep ran
 * at ingest (104/104 byte-identical), this test keeps three representative
 * turns under regression: the command-densest turn, a player loss, and a
 * commanded win.
 *
 * ⚠ Era-bound BY DESIGN: replay strictly refuses a configHash mismatch, so
 * the first balance-JSON change (§57 will make several) retires this fixture
 * rather than blocking the tuning — hence the guarded skip, not a failure.
 * The traces stay valid history for their era; the replay MECHANISM stays
 * continuously covered by the 53c fidelity keystone (current-config,
 * synthetic).
 */

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', '53g-human-traces.json');
const traces = JSON.parse(readFileSync(FIXTURE, 'utf8')) as BattleTrace[];
const eraMatches = traces.length > 0 && traces[0]!.configHash === configHash();

describe('53g human-baseline fixture', () => {
  it('holds one config era and outcomes on every trace', () => {
    expect(traces.length).toBeGreaterThan(0);
    expect(new Set(traces.map((t) => t.configHash)).size).toBe(1);
    expect(traces.every((t) => t.outcome !== null)).toBe(true);
  });

  it.skipIf(!eraMatches)('replays representative human turns byte-identically', () => {
    const byCommands = [...traces].sort((a, b) => b.commands.length - a.commands.length);
    const picks = [
      byCommands[0]!, // the command-densest turn (traffic management at its thickest)
      traces.find((t) => t.outcome!.winner === 'enemy')!, // a human loss
      traces.find((t) => t.outcome!.winner === 'player' && t.commands.length > 0)!, // a commanded win
    ];
    for (const trace of picks) {
      const r = replayTrace(trace);
      expect(r.winner).toBe(trace.outcome!.winner);
      expect(r.ticks).toBe(trace.outcome!.ticks);
    }
  });
});
