/**
 * T2 (Post-R "Encounter System" round): the **sector-selection meta-DAG** — the
 * graph a run walks to choose its *sequence of sectors*. Source of truth at
 * `config/sector-map.json` (hand-edited JSON; no editor this round, per the
 * brief). Each DAG node holds a LIST of candidate sectors (the run picks one on
 * arrival); edges connect nodes; `sources` are the possible run starts and
 * `sinks` are the run-complete terminals.
 *
 * A run: pick a random `source` node → a random sector from its list → walk the
 * sector's node-map → on clearing the sector's terminal, pick a random successor
 * node → its sector → a fresh node-map → … → **complete** at a `sink`. (The
 * RNG-driven walk itself lives in `src/run/sectorWalk.ts`; this module is the
 * validated data + the structural guards that keep the walk total.)
 *
 * Initial content ships a **one-node DAG** (`source == sink == "start"`, holding
 * the single sector "The Start"), so a run is exactly one sector — today's
 * structure, now expressed through the general system. Multi-node DAGs are
 * *built + validated + headless-tested* but not populated (only "The Start"
 * ships).
 *
 * Validation runs at module load (the A4 loud-failure mode). Beyond zod's
 * structural checks, four custom guards keep the walk well-formed + terminating:
 *   1. node ids are unique;
 *   2. every `node.sectors` entry is a real `SECTOR_ID`;
 *   3. every edge endpoint + every source/sink is a real node id;
 *   4. every NON-sink node has ≥1 outgoing edge, and the graph is ACYCLIC — so
 *      the random walk can never dead-end at a non-sink nor loop forever; every
 *      maximal path terminates at a sink.
 */

import { z } from 'zod';
import sectorMapJson from '../../config/sector-map.json';
import { SECTOR_IDS } from './sectors';

const SectorMapNodeSchema = z.object({
  id: z.string().min(1),
  /** Candidate sectors at this DAG node; the run picks one on arrival. */
  sectors: z.array(z.string().min(1)).min(1),
});

const SectorMapEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

const SectorMapSchema = z
  .object({
    nodes: z.array(SectorMapNodeSchema).min(1),
    edges: z.array(SectorMapEdgeSchema),
    sources: z.array(z.string().min(1)).min(1),
    sinks: z.array(z.string().min(1)).min(1),
  })
  .superRefine((map, ctx) => {
    // Guard 1 — unique node ids.
    const nodeIds = new Set<string>();
    map.nodes.forEach((node, idx) => {
      if (nodeIds.has(node.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', idx, 'id'],
          message: `duplicate sector-map node id "${node.id}"`,
        });
      }
      nodeIds.add(node.id);
    });

    // Guard 2 — every candidate sector exists.
    const sectorIds = new Set<string>(SECTOR_IDS);
    map.nodes.forEach((node, idx) => {
      node.sectors.forEach((sectorId, sIdx) => {
        if (!sectorIds.has(sectorId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['nodes', idx, 'sectors', sIdx],
            message: `node "${node.id}": unknown sector id "${sectorId}"`,
          });
        }
      });
    });

    // Guard 3 — edges + sources + sinks reference real nodes.
    map.edges.forEach((edge, idx) => {
      if (!nodeIds.has(edge.from)) {
        ctx.addIssue({ code: 'custom', path: ['edges', idx, 'from'], message: `edge from unknown node "${edge.from}"` });
      }
      if (!nodeIds.has(edge.to)) {
        ctx.addIssue({ code: 'custom', path: ['edges', idx, 'to'], message: `edge to unknown node "${edge.to}"` });
      }
    });
    map.sources.forEach((id, idx) => {
      if (!nodeIds.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['sources', idx], message: `source references unknown node "${id}"` });
      }
    });
    map.sinks.forEach((id, idx) => {
      if (!nodeIds.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['sinks', idx], message: `sink references unknown node "${id}"` });
      }
    });

    // Guard 4 — the walk stays total: every non-sink has an outgoing edge, and
    // the graph is acyclic (so a path can neither dead-end at a non-sink nor
    // loop). Together these guarantee every maximal path ends at a sink.
    const sinkSet = new Set<string>(map.sinks);
    const out = new Map<string, string[]>();
    for (const node of map.nodes) out.set(node.id, []);
    for (const edge of map.edges) out.get(edge.from)?.push(edge.to);
    for (const node of map.nodes) {
      if (!sinkSet.has(node.id) && (out.get(node.id)?.length ?? 0) === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['nodes'],
          message: `node "${node.id}" is a non-sink dead-end (no outgoing edge)`,
        });
      }
    }
    // Acyclicity via DFS coloring (white/gray/black). A back-edge to a gray node
    // is a cycle. Only runs over nodes that exist (unknown-edge guard above).
    const color = new Map<string, 0 | 1 | 2>(); // 0 white, 1 gray, 2 black
    let cyclic = false;
    const visit = (id: string): void => {
      color.set(id, 1);
      for (const to of out.get(id) ?? []) {
        const c = color.get(to) ?? 0;
        if (c === 1) cyclic = true;
        else if (c === 0) visit(to);
      }
      color.set(id, 2);
    };
    for (const node of map.nodes) {
      if ((color.get(node.id) ?? 0) === 0) visit(node.id);
    }
    if (cyclic) {
      ctx.addIssue({ code: 'custom', path: ['edges'], message: 'sector-map has a cycle (the walk would never terminate)' });
    }
  });

export type SectorMap = z.infer<typeof SectorMapSchema>;
export type SectorMapNode = z.infer<typeof SectorMapNodeSchema>;

/** Exported so `src/run/RunConfig.ts` can type a fixture/override + the test can
 *  round-trip hand-built DAGs through the real loader schema. */
export { SectorMapSchema };

export const SECTOR_MAP: SectorMap = SectorMapSchema.parse(sectorMapJson);
