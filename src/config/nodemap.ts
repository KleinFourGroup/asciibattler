/**
 * NodeMap generation parameters. Hop count, per-hop width bands,
 * total-node target, and out-degree cap drive the DAG shape produced by
 * `src/run/NodeMap.ts`. Source of truth at `config/nodemap.json`.
 *
 * G3 — node-kind scatter: `restChance` is the per-eligible-hop probability
 * of hosting a rest node; `restMinSpacing` is the minimum hop gap between
 * two rests (>= 2 = never on adjacent hops). Eligible hops are the middle
 * band only (never the first battle hop or the boss). The terminal is always
 * the boss; these knobs only govern rest placement.
 *
 * W2 — elite scatter: `eliteChance` / `eliteMinSpacing` mirror the rest knobs
 * for the (optional, harder) elite node. Elites scatter over the same middle
 * band, in a pass AFTER the rest scatter (so rest placement is unchanged), and
 * never overwrite a rest. Middle hops are always >= 2 wide, so an elite always
 * leaves a non-elite sibling — taking the elite is a route choice.
 *
 * 50c — port scatter: `portChance` / `portMinSpacing` mirror the elite knobs
 * for the port (shop) node. A third pass AFTER elites (rest + elite placement
 * unchanged); never overwrites either; and unlike elites, ≥1 port per map is
 * GUARANTEED via a fallback placement when the scatter rolls none (maps with
 * no eligible middle hop — dev hopCount overrides ≤ 3 — are exempt).
 *
 * 74e — event scatter: `eventChance` / `eventMinSpacing` mirror the pattern
 * for the event node, a FOURTH pass after ports. Deliberately dense
 * (chance 0.5, spacing 1 = back-to-back hops legal): events are a major
 * run component, ~half as frequent as battles on a path (user feel call,
 * §74e) — not an elite-style rare detour. LAUNCH-ROUGH: §81 re-reads the
 * density with the rest of the event-era balance; §77's constructive
 * generator replaces this scatter with a real events-to-combat ratio pass
 * (the one-node-per-hop ceiling is this interim pass's known limit).
 */

import { z } from 'zod';
import nodeMapJson from '../../config/nodemap.json';

const NodeMapSchema = z
  .object({
    hopCount: z.number().int().positive(),
    middleWidthMin: z.number().int().positive(),
    middleWidthMax: z.number().int().positive(),
    targetTotalMax: z.number().int().positive(),
    maxOutDegree: z.number().int().positive(),
    restChance: z.number().min(0).max(1),
    restMinSpacing: z.number().int().positive(),
    eliteChance: z.number().min(0).max(1),
    eliteMinSpacing: z.number().int().positive(),
    portChance: z.number().min(0).max(1),
    portMinSpacing: z.number().int().positive(),
    /** 74e — event-node placement (see header: dense by design). */
    eventChance: z.number().min(0).max(1),
    eventMinSpacing: z.number().int().positive(),
    /** 74b — the chance an entered event node resolves straight into a
     *  combat encounter (spec §Events; base of the `eventCombatChance` run
     *  stat — folded, not read raw, so daemons can bend it). NOT a scatter
     *  knob — placement is `eventChance`/`eventMinSpacing` above. */
    eventCombatChance: z.number().min(0).max(1),
  })
  .refine((c) => c.middleWidthMin <= c.middleWidthMax, {
    message: 'middleWidthMin must be <= middleWidthMax',
  });

export type NodeMapConfig = z.infer<typeof NodeMapSchema>;

export const NODE_MAP: NodeMapConfig = NodeMapSchema.parse(nodeMapJson);
