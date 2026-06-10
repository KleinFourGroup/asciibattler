/**
 * J4 — the fuzz **objective strategy**: a serializable "objective proclivity"
 * the bot uses to drive the player team's single shared battle objective (J1's
 * low-intensity steering layer), plus the pure selector + per-tick decision that
 * exercise it without paralyzing the bot.
 *
 * The brief's testing scheme: fuzz objectives may ONLY target enemy units, and a
 * NEW objective is only chosen once the previous target is killed (no
 * thrashing). The no-thrash rule falls out of J1's auto-clear — an `enemy`
 * objective auto-clears the tick its target dies
 * (`World.clearObjectiveIfResolved`), so the bot simply refills when
 * `world.objective === null` (`decideObjectiveCommand` below).
 *
 * The proclivity is ONE team-wide policy per run (there is a single shared
 * objective); the brief's "per-archetype proclivities" become a later
 * `scored`-strategy term. The menu is parameterized per stat key (auto-extends
 * off `STAT_KEYS`, like the `stat:<stat>` recruit menu) + current-HP + the
 * `random` / `none` modes.
 *
 * Dev-only fuzz tooling — never imported by `src/`. Mirrors the A4 config
 * pattern (zod, validate-on-load, throw on malformed) the way `scoredWeights.ts`
 * does: the single-proclivity JSON is BOTH the `--objective=<file>.json` input
 * format AND what the arena search emits as its winner.
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { RNG } from '../../src/core/RNG';
import type { World } from '../../src/sim/World';
import type { WorldCommand } from '../../src/sim/Command';
import type { Unit, UnitStats } from '../../src/sim/Unit';
import { STAT_KEYS } from './strategies/policies';

export type SelectDirection = 'highest' | 'lowest';

/**
 * A serializable objective-selection policy — the saved "objective strategy."
 *   - `none`   : never set an objective (the byte-identical-to-no-objective mode).
 *   - `random` : pick a uniform-random living enemy each time (after each kill).
 *   - `stat`   : the living enemy with the highest / lowest base stat.
 *   - `hp`     : the living enemy with the highest / lowest CURRENT health.
 */
export type ObjectiveProclivity =
  | { readonly kind: 'none' }
  | { readonly kind: 'random' }
  | { readonly kind: 'stat'; readonly select: SelectDirection; readonly stat: keyof UnitStats }
  | { readonly kind: 'hp'; readonly select: SelectDirection };

const DIRECTION = z.enum(['highest', 'lowest']);
// Built from the live `STAT_KEYS` so a new base stat auto-extends the schema (a
// missing/unknown stat throws loudly) — the same vocabulary-tracking trick
// `scoredWeights.ts` uses for its per-stat weights.
const STAT_ENUM = z.enum(STAT_KEYS as [string, ...string[]]);

const ProclivitySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('random') }),
  z.strictObject({ kind: z.literal('stat'), select: DIRECTION, stat: STAT_ENUM }),
  z.strictObject({ kind: z.literal('hp'), select: DIRECTION }),
]);

/** Validate an arbitrary parsed-JSON value into an `ObjectiveProclivity`. Throws
 *  (zod) on any missing / extra / non-matching field. */
export function parseProclivity(input: unknown): ObjectiveProclivity {
  return ProclivitySchema.parse(input) as ObjectiveProclivity;
}

/** Read + validate a proclivity from a JSON file — the `--objective=<file>.json`
 *  input and the arena search's emitted winner. */
export function loadProclivityFile(path: string): ObjectiveProclivity {
  return parseProclivity(JSON.parse(readFileSync(path, 'utf8')));
}

/** Serialize a proclivity to the canonical single-object JSON (2-space indent,
 *  trailing newline) — the format `loadProclivityFile` reads back. */
export function serializeProclivity(p: ObjectiveProclivity): string {
  return JSON.stringify(p, null, 2) + '\n';
}

/** A short, stable label for a proclivity (the arena table + the saved-file
 *  note). The inverse of the inline forms `parseObjectiveFlag` accepts. */
export function proclivityLabel(p: ObjectiveProclivity): string {
  switch (p.kind) {
    case 'none':
      return 'none';
    case 'random':
      return 'random';
    case 'hp':
      return `hp:${p.select}`;
    case 'stat':
      return `stat:${String(p.stat)}:${p.select}`;
  }
}

export interface MenuEntry {
  readonly label: string;
  readonly proclivity: ObjectiveProclivity;
}

/**
 * The full proclivity menu the arena enumerates: `none`, `random`, highest /
 * lowest current-HP, and highest / lowest of every base stat. Config-derived —
 * the per-stat entries track `STAT_KEYS`, so a new stat auto-joins the menu (no
 * edit here), matching the `stat:<stat>` recruit-menu ethos.
 */
export function objectiveMenu(): MenuEntry[] {
  const out: MenuEntry[] = [
    { label: 'none', proclivity: { kind: 'none' } },
    { label: 'random', proclivity: { kind: 'random' } },
    { label: 'hp:highest', proclivity: { kind: 'hp', select: 'highest' } },
    { label: 'hp:lowest', proclivity: { kind: 'hp', select: 'lowest' } },
  ];
  for (const stat of STAT_KEYS) {
    out.push({
      label: `stat:${String(stat)}:highest`,
      proclivity: { kind: 'stat', select: 'highest', stat },
    });
    out.push({
      label: `stat:${String(stat)}:lowest`,
      proclivity: { kind: 'stat', select: 'lowest', stat },
    });
  }
  return out;
}

/**
 * Resolve the `--objective=<value>` flag into a proclivity:
 *   none | random            → the two built-in modes
 *   <path>.json              → a saved proclivity (validated on load)
 *   stat:<stat>:<dir>        → inline, e.g. `stat:strength:highest`
 *   hp:<dir>                 → inline, e.g. `hp:lowest`
 * The inline forms are a dev convenience (the arena search emits / consumes
 * JSON). An absent flag defaults to `none` — handled by the caller.
 */
export function parseObjectiveFlag(value: string): ObjectiveProclivity {
  if (value === 'none') return { kind: 'none' };
  if (value === 'random') return { kind: 'random' };
  if (value.endsWith('.json')) return loadProclivityFile(value);
  const parts = value.split(':');
  if (parts[0] === 'hp' && parts.length === 2) {
    return parseProclivity({ kind: 'hp', select: parts[1] });
  }
  if (parts[0] === 'stat' && parts.length === 3) {
    return parseProclivity({ kind: 'stat', stat: parts[1], select: parts[2] });
  }
  throw new Error(
    `Unrecognized --objective value: "${value}" ` +
      `(expected none | random | <file>.json | stat:<stat>:<dir> | hp:<dir>)`,
  );
}

/** All living enemy units — the objective candidates. Mirrors the live
 *  `ObjectiveController`'s `team === 'enemy' && currentHp > 0` filter. */
function livingEnemies(world: World): readonly Unit[] {
  return world.units.filter((u) => u.team === 'enemy' && u.currentHp > 0);
}

/**
 * Pick the enemy unit id this proclivity targets, or `null` when there's no
 * living enemy or the proclivity is `none`. Deterministic: `stat` / `hp`
 * tie-break by ascending unit id (no RNG draw); only `random` consumes `rng`
 * (one `pick`), so the objective stream advances predictably per decision.
 */
export function selectObjectiveTarget(
  world: World,
  proclivity: ObjectiveProclivity,
  rng: RNG,
): number | null {
  if (proclivity.kind === 'none') return null;
  const enemies = livingEnemies(world);
  if (enemies.length === 0) return null;
  if (proclivity.kind === 'random') return rng.pick(enemies).id;

  const valueOf = (u: Unit): number =>
    proclivity.kind === 'hp' ? u.currentHp : u.stats[proclivity.stat];
  const wantHighest = proclivity.select === 'highest';
  let best = enemies[0]!;
  let bestValue = valueOf(best);
  for (const u of enemies) {
    const v = valueOf(u);
    if (wantHighest ? v > bestValue : v < bestValue) {
      best = u;
      bestValue = v;
    } else if (v === bestValue && u.id < best.id) {
      best = u; // deterministic id tie-break (no RNG)
    }
  }
  return best.id;
}

/**
 * The per-tick objective decision — the no-thrash gate. Returns a `setObjective`
 * command ONLY when there is no active objective and the proclivity selects a
 * living enemy; otherwise `null` (an active objective is left untouched — no
 * thrashing). J1 auto-clears an `enemy` objective the tick its target dies, so
 * the next tick the objective is `null` again and this refills it — that IS the
 * brief's "only after the previous target is killed."
 *
 * `none` always returns `null`, so a `none` run enqueues nothing and is
 * byte-identical to running with no objectives at all (the default that keeps
 * the existing fuzz baselines intact).
 */
export function decideObjectiveCommand(
  world: World,
  proclivity: ObjectiveProclivity,
  rng: RNG,
): WorldCommand | null {
  if (proclivity.kind === 'none') return null;
  if (world.objective !== null) return null; // engaged — leave it (no thrash)
  const targetId = selectObjectiveTarget(world, proclivity, rng);
  if (targetId === null) return null;
  return { kind: 'setObjective', objective: { kind: 'enemy', unitId: targetId } };
}
