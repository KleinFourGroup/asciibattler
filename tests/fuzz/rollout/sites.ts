/**
 * 85h — the canonical decision-site registry (gotcha #128; the 82c
 * sweep-by-key family). Every arbitration decision site the run layer
 * hands the driver, as ONE closed list: site filters and per-site
 * enumerations in readers, probes, and verify scripts derive from
 * THIS, never from a remembered literal — the 85f reader's
 * `site === 'reward'` (for 'rewardDaemon') silently dropped ~144
 * rows/arm, and verifyArbitratedRuns carried its own stale local list.
 * Adding a site = add it here in the same commit as its `decide()`
 * call; site lists elsewhere are `satisfies readonly DecisionSite[]`
 * so an unregistered literal fails to compile.
 */

export const DECISION_SITES = [
  'portBuy',
  'packetFire:preTurn',
  'packetFire:outOfBattle',
  'rewardDaemon',
  'grant:redraw',
  'grant:empower',
  'nodeChoice',
  'eventChoice',
  'recruit',
  'campRaid',
] as const;

export type DecisionSite = (typeof DECISION_SITES)[number];

/** Runtime guard for csv-parsed / free-string site values. */
export function isDecisionSite(site: string): site is DecisionSite {
  return (DECISION_SITES as readonly string[]).includes(site);
}
