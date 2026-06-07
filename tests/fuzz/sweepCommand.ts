/**
 * H7d — the sweep GUI's command-builder.
 *
 * The balance sweep / weight search runs in Node (tsx), not the browser, so the
 * sweep GUI can't *run* it — instead it builds the `npm run fuzz -- …` command
 * line for the user to paste into a terminal (the way the run launcher emits a
 * launch URL). This module is the pure logic behind that page: form state → argv.
 *
 * Single source of truth: `SWEEP_KNOBS` is enumerated from the SAME live config
 * objects `--balance-sweep` tunes (DIFFICULTY / HEALTH / LEVELING — mirrors
 * `balanceSweep.ts`'s `KNOB_GROUPS`), so the GUI can never offer a knob the CLI
 * would reject, and a newly-added numeric config key auto-appears in the menu.
 *
 * Kept free of any `node:*` import so it loads in the browser (the GUI page) AND
 * under vitest (the smoke test). The arg shape mirrors `tests/fuzz/cli.ts`.
 */

import { DIFFICULTY } from '../../src/config/difficulty';
import { HEALTH } from '../../src/config/health';
import { LEVELING } from '../../src/config/leveling';

export const SWEEP_MODES = ['balance-sweep', 'search'] as const;
export type SweepMode = (typeof SWEEP_MODES)[number];

/**
 * quick | medium | heavy | overnight. Used as `--tier` in balance-sweep mode and
 * `--preset` in search mode (the CLI takes the same names for both). Mirrors
 * `search.ts`'s `PRESETS` keys — a smoke test pins this against
 * `Object.keys(PRESETS)` so the two can't drift. Declared here (not imported
 * from `search.ts`) to keep this module's import graph free of the harness, so
 * it stays browser-loadable.
 */
export const TIER_NAMES = ['quick', 'medium', 'heavy', 'overnight'] as const;
export type TierName = (typeof TIER_NAMES)[number];

export interface KnobInfo {
  /** `group.key`, e.g. `difficulty.budgetFactor` — the `--knob` value. */
  readonly path: string;
  readonly group: string;
  readonly key: string;
  /** The currently-configured value (shown in the menu + used to seed ranges). */
  readonly value: number;
}

// The live, mutable config objects a sweep may address — identical set to
// balanceSweep.ts's KNOB_GROUPS (difficulty / health / leveling).
const KNOB_GROUPS: Record<string, Record<string, unknown>> = {
  difficulty: DIFFICULTY as unknown as Record<string, unknown>,
  health: HEALTH as unknown as Record<string, unknown>,
  leveling: LEVELING as unknown as Record<string, unknown>,
};

/** Every numeric knob a sweep can tune, enumerated live from the config objects
 *  (so this never drifts from the production config or `balanceSweep.ts`). */
export const SWEEP_KNOBS: readonly KnobInfo[] = Object.entries(KNOB_GROUPS).flatMap(
  ([group, obj]) =>
    Object.entries(obj)
      .filter(([, v]) => typeof v === 'number')
      .map(([key, v]) => ({ path: `${group}.${key}`, group, key, value: v as number })),
);

export interface SweepFormState {
  readonly mode: SweepMode;
  // ── balance-sweep ──
  readonly knob?: string | undefined;
  /** `min:max:steps`. */
  readonly range?: string | undefined;
  readonly knob2?: string | undefined;
  readonly range2?: string | undefined;
  readonly tier?: string | undefined;
  /** Fan the per-point search across N child processes (only > 1 is emitted). */
  readonly jobs?: number | undefined;
  /** Time grid-point 1 + project the total, write nothing. */
  readonly dryRun?: boolean | undefined;
  // ── search ──
  readonly preset?: string | undefined;
  readonly vectors?: number | undefined;
  readonly seeds?: number | undefined;
  // ── shared ──
  readonly floors?: number | undefined;
  readonly roster?: string | undefined;
  readonly samplerSeed?: number | undefined;
}

const isNum = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: string | undefined): v is string =>
  typeof v === 'string' && v.trim() !== '';

/**
 * Build the argv that follows `npm run fuzz --`, mirroring `tests/fuzz/cli.ts`.
 * Emits a flag only when its value is meaningfully set; `--knob2`/`--range2` are
 * emitted only as a pair (the CLI rejects one without the other), and `--jobs` is
 * balance-sweep-only and only when > 1 (the single-process default needs no flag,
 * and `--search` ignores it). Whitespace-only string fields are dropped.
 */
export function buildFuzzArgs(state: SweepFormState): string[] {
  const args: string[] = [];
  if (state.mode === 'balance-sweep') {
    args.push('--balance-sweep');
    if (isStr(state.knob)) args.push(`--knob=${state.knob.trim()}`);
    if (isStr(state.range)) args.push(`--range=${state.range.trim()}`);
    if (isStr(state.knob2) && isStr(state.range2)) {
      args.push(`--knob2=${state.knob2.trim()}`);
      args.push(`--range2=${state.range2.trim()}`);
    }
    if (isStr(state.tier)) args.push(`--tier=${state.tier.trim()}`);
    if (isNum(state.floors)) args.push(`--floors=${state.floors}`);
    if (isStr(state.roster)) args.push(`--roster=${state.roster.trim()}`);
    if (isNum(state.jobs) && state.jobs > 1) args.push(`--jobs=${state.jobs}`);
    if (isNum(state.samplerSeed)) args.push(`--sampler-seed=${state.samplerSeed}`);
    if (state.dryRun) args.push('--dry-run');
  } else {
    args.push('--search');
    if (isStr(state.preset)) args.push(`--preset=${state.preset.trim()}`);
    if (isNum(state.vectors)) args.push(`--vectors=${state.vectors}`);
    if (isNum(state.seeds)) args.push(`--seeds=${state.seeds}`);
    if (isNum(state.floors)) args.push(`--floors=${state.floors}`);
    if (isStr(state.roster)) args.push(`--roster=${state.roster.trim()}`);
    if (isNum(state.samplerSeed)) args.push(`--sampler-seed=${state.samplerSeed}`);
  }
  return args;
}

/** Render args as the full pasteable command. No shell-quoting needed — every
 *  emitted value (group.key paths, `min:max:steps` ranges, roster tokens, ints)
 *  is space-free. */
export function formatFuzzCommand(args: readonly string[]): string {
  return ['npm', 'run', 'fuzz', '--', ...args].join(' ');
}
