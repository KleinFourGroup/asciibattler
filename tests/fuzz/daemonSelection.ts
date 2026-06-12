/**
 * L1c3 — the fuzz daemon arm: which idol (or none) the harness's runs carry.
 *
 * Unlike the objective/redraw/empower bots this is not a per-turn POLICY —
 * the daemon is rolled once per run by `Run` itself (L1). The selection just
 * decides the `RunConfig.daemon` override:
 *
 * - `random` (the default, ≡ flag absent) — leave the override unset, so the
 *   Run rolls uniformly off its own daemon stream. This is the REAL GAME's
 *   behavior, hence the harness default; pinned byte-identical to an absent
 *   flag.
 * - `none` — force a daemon-less run (both pre-turn gates permanently
 *   disabled): the control arm a per-idol lift is measured against.
 * - a catalog id (`mars` / `minerva` / `mercury` / `janus`) — force that idol
 *   on every run, the per-daemon measurement arm.
 *
 * A plain JSON object so it round-trips the `--jobs` ShardJob temp file, like
 * the policies.
 */

import { DAEMONS, daemonById, type DaemonConfig } from '../../src/config/daemons';

export type DaemonSelection =
  | { kind: 'random' }
  | { kind: 'none' }
  | { kind: 'fixed'; id: string };

/** Parse the `--daemon=<random|none|id>` flag. Throws on an unknown value so a
 *  typo'd idol id fails loudly instead of silently measuring `random`. */
export function parseDaemonFlag(raw: string): DaemonSelection {
  const token = raw.trim().toLowerCase();
  if (token === 'random') return { kind: 'random' };
  if (token === 'none') return { kind: 'none' };
  if (daemonById(token) !== undefined) return { kind: 'fixed', id: token };
  throw new Error(
    `--daemon: unknown value '${raw}' (choices: random, none, ${DAEMONS.map((d) => d.id).join(', ')})`,
  );
}

export function daemonLabel(selection: DaemonSelection): string {
  return selection.kind === 'fixed' ? selection.id : selection.kind;
}

/**
 * Resolve a selection into the `RunConfig.daemon` override: `undefined` for
 * `random` (leave the Run's own roll alone — byte-identical to no flag),
 * `null` for the daemon-less control arm, the catalog entry for `fixed`.
 */
export function daemonConfigFor(selection: DaemonSelection): DaemonConfig | null | undefined {
  if (selection.kind === 'random') return undefined;
  if (selection.kind === 'none') return null;
  const daemon = daemonById(selection.id);
  if (daemon === undefined) {
    throw new Error(`daemonConfigFor: unknown daemon id '${selection.id}'`);
  }
  return daemon;
}
