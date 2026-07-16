/**
 * 57a — the `--scripts=<spec>` subset resolver for the re-ask gate's
 * leave-one-out arms (the 55b per-script A/B, promoted from a scratch drive
 * to a CLI affordance; §57g reuses it for cell-scale work).
 *
 * Spec grammar: a comma list of script ids from the standard registry.
 * Plain ids select EXACTLY those (an only-arm: `--scripts=unjam`);
 * `-`-prefixed ids subtract from the full registry (a minus-arm:
 * `--scripts=-unjam`). Mixing the two forms in one spec is ambiguous and
 * throws; unknown ids throw with the choices listed (the `layoutFromArgs`
 * loud-bail convention — a typo must not silently measure the wrong arm).
 *
 * Order is ALWAYS the registry's own: arbitration priority is a property of
 * the registry (the §54 lock), not of the flag — a spec can select scripts,
 * never reorder them.
 */

import { TRAFFIC_SCRIPTS, type TrafficScript } from '../../src/bot/TrafficScriptDriver';

export function parseScriptsSpec(spec: string): readonly TrafficScript[] {
  const tokens = spec
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    throw new Error('--scripts=<spec>: empty spec (omit the value for the full registry)');
  }
  const isMinus = tokens.every((t) => t.startsWith('-'));
  const isOnly = tokens.every((t) => !t.startsWith('-'));
  if (!isMinus && !isOnly) {
    throw new Error(
      '--scripts=<spec>: mixed only-ids and -minus-ids in one spec (pick one form)',
    );
  }
  const knownIds = TRAFFIC_SCRIPTS.map((s) => s.id);
  const ids = tokens.map((t) => (isMinus ? t.slice(1) : t));
  for (const id of ids) {
    if (!knownIds.includes(id)) {
      throw new Error(`--scripts: unknown script id '${id}' (choices: ${knownIds.join(', ')})`);
    }
  }
  const wanted = new Set(ids);
  return isMinus
    ? TRAFFIC_SCRIPTS.filter((s) => !wanted.has(s.id))
    : TRAFFIC_SCRIPTS.filter((s) => wanted.has(s.id));
}
