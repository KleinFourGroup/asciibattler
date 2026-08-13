/**
 * 77d1 — the RNG stream-key registry: every named randomness stream in the
 * game, as a closed union. `deriveSeed` (RNG.ts) accepts ONLY these keys,
 * so an unregistered stream name is a compile error — the "single
 * sanctioned door" half of the §77 keyed-derivation architecture (worklog
 * §77 shape-lock; the audit's positional-fork hazards are the why).
 *
 * ⚠️ KEY STRINGS ARE PERMANENT — the gotcha-number rule applied to RNG.
 * A stream's derived seed is `hash(root, key, ...indices)`: RENAMING a key
 * (or changing the hash in RNG.ts) remaps every seed in that stream — a
 * global stream break that re-baselines fuzz pins and the balance board.
 * Add new keys freely (that's the whole point — additions never move
 * existing streams); never rename or reuse one. Retired keys stay listed
 * as tombstones with a `(RETIRED)` note, exactly like gotchas.
 *
 * Keys are registered here as they are DESIGNED, which may be a step
 * ahead of their wiring (the 77d2/77d3 conversions consume the run/world
 * blocks below). The doc comment on each key states its index signature —
 * the stable ids that follow the key in the `deriveSeed` call.
 */

export const RNG_STREAM_KEYS = [
  // --- the Run ladder (wired at 77d2; an "occurrence" is one atomic
  //     synchronous resolution — a snapshot can never land inside one) ---
  'sector', //     (sectorIndex)                    — sector-DAG successor pick
  'nodemap', //    (sectorIndex)                    — node-map generation for the sector
  'boss', //       (sectorIndex)                    — the boss pre-roll (66a forewarning)
  'team', //       ()                               — the starting roster + construction grants
  'levelup', //    (sectorIndex, nodeId, turnIndex) — one XP-banking call's level rolls
  'deck', //       (shuffleIndex)                   — one pile shuffle (serialized counter)
  'daemon', //     (sectorIndex, nodeId, site, turnIndex) — one hook resolution (site 0=start 1=turn 2=end)
  'reward', //     (sectorIndex, nodeId, turnIndex) — one turn boundary's table rolls
  'rewardBits', // (sectorIndex, nodeId, turnIndex) — one turn boundary's bits rolls
  'portStock', //  (sectorIndex, nodeId)            — port inventory (node-anchored: seed-fixed per node)
  'portPrice', //  (sectorIndex, nodeId)            — port price jitter
  'event', //      (eventStep)                      — one event occurrence: node entry OR one choice resolution (serialized counter)
  'map', //        (sectorIndex, nodeId)            — encounter selection + battlefield roll
  'battle', //     (sectorIndex, nodeId, turnIndex) — one turn's battle stream (worldSeed, waves)
  'offer', //      (sectorIndex, nodeId)            — the post-battle recruit draft
  'rolloutRoot', //()  root = rolloutSeed           — a bot clone's REPLACEMENT streamRoot (CRN divergence)
  // --- the node-map braid generator's sub-passes (77e1; root = ONE u32
  //     drawn off the 'nodemap' stream at generate() entry, so each pass
  //     can change its draw count without remapping the others) ---
  'nodemapWidths', // ()  — the per-hop width sequence
  'nodemapOps', //    ()  — split/merge op placement (the braid pass)
  'nodemapKinds', //  ()  — node-kind placement (e1 BRIDGE: the old scatter
  //                  passes verbatim; e2 replaces them with quota+machine
  //                  and adds the rejection-attempt index here)
  // --- the battle/world side (wired at 77d3; root = terrainSeed) ---
  'terrain', //    ()                       — battlefield terrain generation
  'spawnSetup', // ()                       — spawn-region pick + per-team shuffles
  'campSetup', //  ()                       — camp selection + install (NO turn index — per-encounter identity is the 75j signed verdict)
  'enemyPull', //  (worldSeed)              — the per-turn camp enemy-pull roll (75j2)
  'combat', //     ()                       — the World combat stream (crits/dodges)
  // --- dev/test ---
  'test', //       (any)                    — test-fixture streams; never shipped in src/
] as const;

export type RngStreamKey = (typeof RNG_STREAM_KEYS)[number];
