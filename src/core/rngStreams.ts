/**
 * The registry of RNG stream keys: every named randomness stream in the
 * game, as a closed union. `deriveSeed` (RNG.ts) accepts only these keys,
 * so an unregistered stream name does not compile.
 *
 * A key string is permanent (gotcha #125). A stream's seed is
 * `hash(root, key, ...ids)`, so renaming a key, or changing the hash in
 * RNG.ts, moves every seed in that stream and re-baselines the fuzz pins
 * and the balance board. Adding a key moves no other stream. Never rename
 * or reuse one; a retired key stays listed, marked retired, as a retired
 * gotcha does.
 *
 * Each key's comment gives the ids that follow it in the `deriveSeed` call.
 * They name the occurrence, never a count of draws.
 */

export const RNG_STREAM_KEYS = [
  // --- the run (root = the run's `streamRoot`). An occurrence is one
  //     synchronous resolution, so a snapshot never lands inside one ---
  'sector', // (sectorIndex) — the next sector's pick on the sector graph
  'nodemap', // (sectorIndex) — the sector's node map
  'boss', // (sectorIndex) — the boss, rolled ahead so it can be forewarned
  'team', // () — the starting roster and the construction grants
  'levelup', // (sectorIndex, nodeId, turnIndex) — one XP-banking call's level rolls
  'deck', // (shuffleIndex) — one pile shuffle; the index is a serialized counter
  'daemon', // (sectorIndex, nodeId, site, turnIndex) — one hook's resolution; site 0 is
  //           the battle's start, 1 a turn, 2 its end
  'reward', // (sectorIndex, nodeId, turnIndex) — one turn boundary's table rolls
  'rewardBits', // (sectorIndex, nodeId, turnIndex) — one turn boundary's bits rolls
  'portStock', // (sectorIndex, nodeId) — a port's inventory: the same draws at a node and
  //              seed whatever the route, while the stock follows the team and its daemons
  'portPrice', // (sectorIndex, nodeId) — a port's price jitter
  'event', // (eventStep) — one event occurrence: a node's entry or one choice's
  //          resolution; eventStep is a serialized counter
  'map', // (sectorIndex, nodeId) — the encounter's selection and its battlefield roll
  'battle', // (sectorIndex, nodeId, turnIndex) — one turn's battle stream (worldSeed, waves)
  'offer', // (sectorIndex, nodeId) — the post-battle recruit draft
  'rolloutRoot', // () root = the rollout seed — a bot clone's replacement stream root,
  //                a run's `streamRoot` or a battle's world stream
  // --- the node-map generator's passes (root = one u32 drawn off the
  //     'nodemap' stream as generation starts, so each pass can change its
  //     draw count without moving the others) ---
  'nodemapWidths', // () — the width of each hop
  'nodemapOps', // (attempt) — one braid roll, rolled again (bounded) while the map is
  //               over its budget of closed sibling pairs (NodeMap.ts); the least bad wins
  'nodemapKinds', // (attempt) — one kind placement, rolled again (bounded) on rejection
  // --- the battle (root = the encounter's terrainSeed) ---
  'terrain', // () — the battlefield's terrain
  'spawnSetup', // () — the spawn-region pick and each team's shuffle
  'campSetup', // () — the camps' selection and install. No turn index: an encounter
  //              places the same camps on every turn. A battle clone re-seeds its camp
  //              stream on this key from the rollout seed
  'enemyPull', // (worldSeed) — the roll for an enemy camp pull; the world seed makes it
  //              one per turn
  'combat', // () root = the rollout seed — a battle clone's replacement combat stream
  //           (crits). A battle forks its own off the world seed (`World`)
  // --- the bot and fuzz harness's arbitration (root = the run seed); harness
  //     streams, never serialized ---
  'arbDriver', // () — the run-layer arbitration driver's paired stream
  'arbShadowSites', // () — the shadow-only sites' paired stream
  'rosterSample', // () — the sampled-roster draw: one whole recorded row per run
  // --- tests ---
  'test', // (any) — test fixtures; no shipped code derives it
] as const;

export type RngStreamKey = (typeof RNG_STREAM_KEYS)[number];
