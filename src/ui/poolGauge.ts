/**
 * H4b — a labeled health-pool gauge (player or enemy): a name + `current / max`
 * readout above a proportional fill bar. Shared by the pre-turn screen, the
 * post-turn outcome screen, and (compactly) the in-battle HUD so the two pools
 * read identically everywhere. Pure DOM, no state — re-render to update.
 */

export type PoolSide = 'player' | 'enemy';

export function renderPoolGauge(
  side: PoolSide,
  label: string,
  current: number,
  max: number,
): HTMLDivElement {
  const gauge = document.createElement('div');
  gauge.className = `pool-gauge pool-gauge--${side}`;

  const head = document.createElement('div');
  head.className = 'pool-gauge-head';
  const name = document.createElement('span');
  name.className = 'pool-gauge-label';
  name.textContent = label;
  const value = document.createElement('span');
  value.className = 'pool-gauge-value';
  value.textContent = `${Math.max(0, current)} / ${max}`;
  head.append(name, value);

  const bar = document.createElement('div');
  bar.className = 'pool-gauge-bar';
  const fill = document.createElement('div');
  fill.className = 'pool-gauge-fill';
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0;
  fill.style.width = `${pct * 100}%`;
  bar.appendChild(fill);

  gauge.append(head, bar);
  return gauge;
}
