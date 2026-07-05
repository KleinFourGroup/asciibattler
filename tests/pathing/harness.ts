/**
 * §42b — the movement-metrics runner: attach a collector, hot-loop the world
 * (the fuzz-harness idiom — no renderer, no clock), return the metrics.
 * Deterministic: same prepared scenario (seed + specs) → identical metrics;
 * the fixture battles are ability-less and never resolve, so `maxTicks` is
 * the normal exit, not a failure.
 */

import type { EventBus } from '../../src/core/EventBus';
import type { GameEvents } from '../../src/core/events';
import type { World } from '../../src/sim/World';
import { MovementMetricsCollector, type MetricsConfig, type MovementMetrics } from './metrics';

export function runMovementMetrics(
  scenario: { world: World; bus: EventBus<GameEvents>; config?: MetricsConfig },
  maxTicks: number,
): MovementMetrics {
  const collector = new MovementMetricsCollector(scenario.world, scenario.bus, scenario.config);
  for (let i = 0; i < maxTicks && !scenario.world.ended; i++) {
    scenario.world.tick();
  }
  return collector.finish();
}
