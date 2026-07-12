/**
 * 53b — the localStorage ring buffer for battle traces (the shape-locked D2
 * call: auto-record every battle, keep the last `TRACE_RING_CAP`, export in
 * bulk — no per-battle save friction mid-session).
 *
 * DOM-zone glue (browser-only, eyeball-verified per the TESTING policy) — the
 * testable assembly logic lives in `TraceRecorder.ts`. Wired in `main.ts`'s
 * DEV block; the shipped bundle never touches this. Bulk export: the
 * `Ctrl+Alt+D` dev key (devKeys.ts, 53f) downloads the whole ring as one
 * JSON file; `__game.dumpTraces()` returns it from the console.
 */

import type { BattleTrace } from './TraceRecorder';

const KEY = 'asciibattler:traces:v1';

/** 53f rider — 40→80: the 53g human session is ~30 battles plus retries and
 *  warm-ups in ONE sitting; a 40-deep ring could evict the session's own
 *  early traces before the end-of-session export. */
export const TRACE_RING_CAP = 80;

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
    // Quota or serialization trouble must never break a dev play session —
    // the recorder is passive by contract. Lose the trace, say so, move on.
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
