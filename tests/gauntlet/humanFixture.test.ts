import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import type { BattleTrace } from '../../src/dev/TraceRecorder';

/**
 * 53g — the recorded HUMAN baseline fixture (the canonical union of the
 * 2026-07-13 session dumps: 104 turns, ring order, deduped by worldSeed —
 * worklog §53g). This test guards the fixture's SHAPE only.
 *
 * The byte-identical replay test was retired at 68h (2026-07-29,
 * user-signed): 56b ended the fixture's engine era (a sim-code change
 * re-deals every replay trajectory), it had been `skipIf`-skipped since,
 * and the rollout-arbitration interstitial moves the bot ceiling anyway —
 * a future human gauntlet re-records on the then-current engine and
 * re-opens replay regression then. Full history: git + BALANCE §"The
 * instrument registry". The replay MECHANISM stays continuously covered
 * by the 53c fidelity keystone (current-config, synthetic).
 *
 * Do NOT delete the fixture — BALANCE §53g/§54 cite it (the ~80% human
 * ceiling), and the traces are the pre-swap historical record.
 */
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', '53g-human-traces.json');
const traces = JSON.parse(readFileSync(FIXTURE, 'utf8')) as BattleTrace[];

describe('53g human-baseline fixture', () => {
  it('holds one config era and outcomes on every trace', () => {
    expect(traces.length).toBeGreaterThan(0);
    expect(new Set(traces.map((t) => t.configHash)).size).toBe(1);
    expect(traces.every((t) => t.outcome !== null)).toBe(true);
  });
});
