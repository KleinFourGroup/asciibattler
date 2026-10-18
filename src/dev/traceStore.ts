/**
 * The localStorage ring of battle traces: every battle recorded, the last
 * `TRACE_RING_CAP` kept, exported in bulk, so a play session pays no save
 * step per battle.
 *
 * Browser-only glue, checked by eye; the testable assembly is
 * `TraceRecorder.ts`. The dev entry wires it (./devEntry.ts), so the
 * shipped bundle never touches this. Bulk export: the `Ctrl+Alt+D` dev key
 * (./devKeys.ts) downloads the whole ring as one JSON file;
 * `__game.dumpTraces()` returns it from the console.
 */

import type { BattleTrace } from './TraceRecorder';

const KEY = 'asciibattler:traces:v1';

/** A human gauntlet session is about 30 battles, with retries and warm-ups,
 *  in one sitting; the ring holds that with room, so the session's early
 *  traces survive to the export at its end. */
const TRACE_RING_CAP = 80;

export function loadTraces(): BattleTrace[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Trust-but-version: keep only entries the replay path can consume.
    return parsed.filter((t): t is BattleTrace => (t as BattleTrace)?.version === 1);
  } catch {
    return [];
  }
}

export function pushTrace(trace: BattleTrace): void {
  try {
    const ring = loadTraces();
    ring.push(trace);
    while (ring.length > TRACE_RING_CAP) ring.shift();
    localStorage.setItem(KEY, JSON.stringify(ring));
  } catch (err) {
    // Quota or serialization trouble must never break a dev play session,
    // since the recorder is passive by contract: lose the trace, say so,
    // move on.
    console.warn('[traces] failed to persist battle trace:', err);
  }
}

export function clearTraces(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
