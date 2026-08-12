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
  // --- the Run ladder (wired at 77d2) ---
  'sector', //     (sectorIndex)            — sector-DAG successor pick
  'nodemap', //    (sectorIndex)            — node-map generation for the sector
  'boss', //       (sectorIndex)            — the boss pre-roll (66a forewarning)
  'team', //       ()                       — the starting roster
  'levelup', //    (unitId, level)          — per-unit level-up rolls
  'deck', //       (shuffleIndex)           — draw-pile shuffles (serialized counter)
  'daemon', //     (sectorIndex, nodeId)    — daemon/instant-hook draws at a node
  'reward', //     (sectorIndex, nodeId)    — the reward-phase table rolls
  'rewardBits', // (sectorIndex, nodeId)    — the bits-payout roll
  'portStock', //  (sectorIndex, nodeId)    — port inventory (node-anchored: seed-fixed per node)
  'portPrice', //  (sectorIndex, nodeId)    — port price jitter
  'event', //      (sectorIndex, nodeId)    — event pool pick + page rolls at a node
  'map', //        (sectorIndex, nodeId)    — encounter selection + battlefield roll
  'battle', //     (turnIndex)              — per-turn battle stream (worldSeed, waves)
  'offer', //      (sectorIndex, nodeId)    — the post-battle recruit draft
  'rolloutRoot', //(rolloutSeed)            — a bot clone's REPLACEMENT streamRoot (CRN divergence)
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
