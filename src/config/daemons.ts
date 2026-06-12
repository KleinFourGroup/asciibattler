/**
 * L1 — the daemon catalog. Source of truth at `config/daemons.json`. Mirrors
 * the `config/empower.json` pattern (parse at module load, throw on malformed
 * JSON).
 *
 * A daemon is a run-scoped relic that GATES the pre-turn mechanics (the
 * user-locked "daemon-only gates" model — without a daemon granting it,
 * redraw/empower simply isn't available). Each daemon may carry a `redraw`
 * gate and/or an `empower` gate; a gate it doesn't carry is never granted.
 *
 * Every gate has a `chance` — the generalized "X% per turn" condition (the
 * user's call: many daemons will be chance-triggered). `1` = granted every
 * turn (no RNG draw), `0 < chance < 1` = a per-turn flip off the run's
 * dedicated daemon stream (`Run.daemonRng`), `0` = never (no draw). The
 * resolution lives in `src/run/daemon.ts` (`resolveTurnGates`).
 *
 * The first catalog (the Phase-L design round, 2026-06-12) is four idols —
 * Roman-statue flavor in the terminal frame, the synthwave blend:
 * - Mars    — empower, the K4 universal-offense +4 STR/RNG/MAG, 1/turn.
 * - Minerva — empower, +4 DEF, 1/turn (flat mitigation — the tank identity).
 * - Mercury — 50%/turn coin flip for the FULL standard redraw.
 * - Janus   — guaranteed redraw every turn, capped at 2 cards (the
 *             reliable-but-small face opposite Mercury's all-or-nothing).
 */

import { z } from 'zod';
import daemonsJson from '../../config/daemons.json';
import { BuffSchema, normalizeBuff, type EmpowerConfig } from './empower';

const ChanceSchema = z.number().min(0).max(1);

const DaemonRedrawGateSchema = z.object({
  chance: ChanceSchema,
  redrawsPerTurn: z.number().int().nonnegative(),
  maxCardsPerTurn: z.number().int().nonnegative(),
});

const DaemonEmpowerGateSchema = z.object({
  chance: ChanceSchema,
  empowersPerTurn: z.number().int().nonnegative(),
  buff: BuffSchema,
});

const DaemonSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  redraw: DaemonRedrawGateSchema.optional(),
  empower: DaemonEmpowerGateSchema.optional(),
});

const DaemonsSchema = z
  .object({ daemons: z.array(DaemonSchema).min(1) })
  .refine(
    (cfg) => new Set(cfg.daemons.map((d) => d.id)).size === cfg.daemons.length,
    { message: 'daemon ids must be unique' },
  );

/** A redraw grant: when the per-turn `chance` lands, redraw is available with
 *  these knobs (the `RedrawConfig` shape minus `enabled`, which the grant IS). */
export interface DaemonRedrawGate {
  chance: number;
  redrawsPerTurn: number;
  maxCardsPerTurn: number;
}

/** An empower grant: when the per-turn `chance` lands, empower is available
 *  with these knobs + this buff (each daemon carries its OWN buff — Mars and
 *  Minerva differ only here). */
export interface DaemonEmpowerGate {
  chance: number;
  empowersPerTurn: number;
  buff: EmpowerConfig['buff'];
}

export interface DaemonConfig {
  id: string;
  name: string;
  description: string;
  redraw?: DaemonRedrawGate;
  empower?: DaemonEmpowerGate;
}

const parsed = DaemonsSchema.parse(daemonsJson);

/** Build exact-optional objects (no explicit-`undefined` keys) from the parse. */
function normalizeDaemon(raw: (typeof parsed.daemons)[number]): DaemonConfig {
  const daemon: DaemonConfig = {
    id: raw.id,
    name: raw.name,
    description: raw.description,
  };
  if (raw.redraw !== undefined) {
    daemon.redraw = {
      chance: raw.redraw.chance,
      redrawsPerTurn: raw.redraw.redrawsPerTurn,
      maxCardsPerTurn: raw.redraw.maxCardsPerTurn,
    };
  }
  if (raw.empower !== undefined) {
    daemon.empower = {
      chance: raw.empower.chance,
      empowersPerTurn: raw.empower.empowersPerTurn,
      buff: normalizeBuff(raw.empower.buff),
    };
  }
  return daemon;
}

export const DAEMONS: readonly DaemonConfig[] = parsed.daemons.map(normalizeDaemon);

/** Catalog lookup by id (`undefined` on a miss — callers decide throw vs skip). */
export function daemonById(id: string): DaemonConfig | undefined {
  return DAEMONS.find((d) => d.id === id);
}
