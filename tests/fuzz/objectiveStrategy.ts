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
 * objective). The menu covers `none`, `random`, highest/lowest of a base stat,
 * highest/lowest current HP, and **target a given enemy archetype** ("focus the
 * mage") — parameterized per stat key / per archetype so they auto-extend off
 * `STAT_KEYS` / `ALL_ARCHETYPES` (like the `stat:<stat>` recruit menu). A
 * per-unit objective per archetype is NOT this (there's one shared objective);
 * that would be a later `scored`-strategy term.
 *
 * K3c3 adds the **`scored` kind** — the H7a linear model applied to target
 * selection: per-stat + current-HP + per-archetype weights, min–max normalized
 * over the living enemies, weighted-sum → argmax. It strictly generalizes the
 * single-axis menu (any `stat`/`hp` entry is a one-hot corner of the weight
 * space) and can express combos the menu can't ("the wounded mage" = hp:low ×
 * archetype:mage). Not a menu entry (it isn't enumerable) — the arena searches
 * it via random weight vectors (`runArenaVectorSearch`), and it reaches the
 * full-run fuzz the same way every proclivity does: `--objective=<file>.json`.
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
import { ALL_ARCHETYPES, type Archetype } from '../../src/sim/archetypes';
import { minMax, norm, numberRecordSchema } from './scoring';
import { STAT_KEYS } from './strategies/policies';

export type SelectDirection = 'highest' | 'lowest';

/**
 * The weight vector of the `scored` proclivity. Every feature the menu kinds
 * can see, as simultaneous linear terms: base stats + current HP are min–max
 * normalized over the living enemies per decision (so weights are scale-free),
 * the archetype term is a flat affinity. Keys track `STAT_KEYS` /
 * `ALL_ARCHETYPES` (archetypes that never spawn as enemies today simply never
 * score — same caveat as the `archetype` menu entries).
 */
export interface ScoredObjectiveWeights {
  readonly stats: Record<keyof UnitStats, number>;
  /** Weight on normalized CURRENT hp (negative = prefer the wounded). */
  readonly hp: number;
  readonly archetype: Record<Archetype, number>;
}

/**
 * A serializable objective-selection policy — the saved "objective strategy."
 *   - `none`   : never set an objective (the byte-identical-to-no-objective mode).
 *   - `random` : pick a uniform-random living enemy each time (after each kill).
 *   - `stat`   : the living enemy with the highest / lowest base stat.
 *   - `hp`     : the living enemy with the highest / lowest CURRENT health.
 *   - `archetype` : a living enemy of a given archetype ("focus the mage"); null
 *                   when none of that archetype is alive (→ default targeting).
 */
export type ObjectiveProclivity =
  | { readonly kind: 'none' }
  | { readonly kind: 'random' }
  | { readonly kind: 'stat'; readonly select: SelectDirection; readonly stat: keyof UnitStats }
  | { readonly kind: 'hp'; readonly select: SelectDirection }
  | { readonly kind: 'archetype'; readonly archetype: Archetype }
  | { readonly kind: 'scored'; readonly weights: ScoredObjectiveWeights };

const DIRECTION = z.enum(['highest', 'lowest']);
// Built from the live `STAT_KEYS` so a new base stat auto-extends the schema (a
// missing/unknown stat throws loudly) — the same vocabulary-tracking trick
// `scoredWeights.ts` uses for its per-stat weights.
const STAT_ENUM = z.enum(STAT_KEYS as [string, ...string[]]);
const ARCHETYPE_ENUM = z.enum(ALL_ARCHETYPES as unknown as [string, ...string[]]);

const ScoredObjectiveWeightsSchema = z.strictObject({
  stats: numberRecordSchema(STAT_KEYS),
  hp: z.number(),
  archetype: numberRecordSchema(ALL_ARCHETYPES),
});

const ProclivitySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({ kind: z.literal('random') }),
  z.strictObject({ kind: z.literal('stat'), select: DIRECTION, stat: STAT_ENUM }),
  z.strictObject({ kind: z.literal('hp'), select: DIRECTION }),
  z.strictObject({ kind: z.literal('archetype'), archetype: ARCHETYPE_ENUM }),
  z.strictObject({ kind: z.literal('scored'), weights: ScoredObjectiveWeightsSchema }),
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
    case 'archetype':
      return `archetype:${p.archetype}`;
    case 'scored':
      return 'scored'; // a weight vector has no compact inline form
  }
}

export interface MenuEntry {
  readonly label: string;
  readonly proclivity: ObjectiveProclivity;
}

/**
 * The full proclivity menu the arena enumerates: `none`, `random`, highest /
 * lowest current-HP, highest / lowest of every base stat, and one entry per
 * enemy archetype. Config-derived — the per-stat entries track `STAT_KEYS` and
 * the per-archetype entries track `ALL_ARCHETYPES`, so a new stat or archetype
 * auto-joins the menu (no edit here), matching the `stat:<stat>` recruit-menu
 * ethos. (Archetypes that never spawn as enemies today — only `bandit`/`ranged`
 * do — select nothing → behave like `none` until enemy diversity lands.)
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
  for (const archetype of ALL_ARCHETYPES) {
    out.push({ label: `archetype:${archetype}`, proclivity: { kind: 'archetype', archetype } });
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
 * JSON). A `scored` proclivity is FILE-ONLY — a weight vector has no inline
 * form; the arena vector search emits it as best-objective.json. An absent
 * flag defaults to `none` — handled by the caller.
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
  if (parts[0] === 'archetype' && parts.length === 2) {
    return parseProclivity({ kind: 'archetype', archetype: parts[1] });
  }
  throw new Error(
    `Unrecognized --objective value: "${value}" (expected ` +
      `none | random | <file>.json | stat:<stat>:<dir> | hp:<dir> | archetype:<name>)`,
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
  if (proclivity.kind === 'scored') return scoredObjectiveTarget(enemies, proclivity.weights);
  if (proclivity.kind === 'archetype') {
    const matches = enemies.filter((u) => u.archetype === proclivity.archetype);
    if (matches.length === 0) return null; // none of that archetype alive → default targeting
    // Lowest-id deterministic pick (no RNG). A "focus down the wounded one"
    // refinement — lowest-HP among the archetype — is an easy later change.
    return matches.reduce((best, u) => (u.id < best.id ? u : best)).id;
  }

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
 * The `scored` selector: min–max normalize base stats + current HP over the
 * living enemies (the H7a offer∪roster trick, candidates-only here), score each
 * enemy as Σ wᵢ·norm(featureᵢ) + archetypeAffinity, argmax with the ascending-id
 * tie-break. Deterministic — no RNG draw. Reads BASE stats like the `stat` menu
 * kinds (the bot targets what the player can see on a card, not buffed values).
 */
function scoredObjectiveTarget(
  enemies: readonly Unit[],
  weights: ScoredObjectiveWeights,
): number {
  const statRanges = STAT_KEYS.map((k) => minMax(enemies.map((u) => u.stats[k])));
  const hpRange = minMax(enemies.map((u) => u.currentHp));
  const scoreOf = (u: Unit): number => {
    let s = weights.hp * norm(u.currentHp, hpRange) + weights.archetype[u.archetype];
    for (let i = 0; i < STAT_KEYS.length; i++) {
      s += weights.stats[STAT_KEYS[i]!] * norm(u.stats[STAT_KEYS[i]!], statRanges[i]!);
    }
    return s;
  };
  let best = enemies[0]!;
  let bestScore = scoreOf(best);
  for (const u of enemies) {
    const s = scoreOf(u);
    if (s > bestScore || (s === bestScore && u.id < best.id)) {
      best = u;
      bestScore = s;
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
