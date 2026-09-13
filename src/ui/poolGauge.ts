/**
 * H4b — a labeled health-pool gauge (player or enemy): a name + `current / max`
 * readout above a proportional fill bar. Shared by the pre-turn screen, the
 * post-turn outcome screen, and (compactly) the in-battle HUD so the two pools
 * read identically everywhere. Pure DOM, no state — re-render to update.
 *
 * 96.5b1 — THE GHOST. The battle HUD's gauges are live now (the loss-event
 * model, src/run/chipRule.ts): a loss the rule has made a FACT of but Run has
 * not yet booked (the charge books at `resolveTurn`) shows as a ghost
 * segment at the fill's leading edge — the solid fill stays the booked pool,
 * the readout reads `33 (−7) / 40`, and `commit()` folds the ghost into the
 * fill at the outro's end so the bar leaves the screen at the number the
 * next screen's gauge shows. The pending loss is clamped at the pool (the
 * applied charge is), so the ghost never crosses zero. `createPoolGauge`
 * returns the live handle; `renderPoolGauge` is the one-shot form the turn
 * screens keep (a ghost of 0 renders exactly the H4b gauge).
 */

import { chipPulse } from './chip';

export type PoolSide = 'player' | 'enemy';

export interface PoolGaugeHandle {
  readonly el: HTMLDivElement;
  /** Repaint the BOOKED pool (keeps the pending loss). */
  set(current: number, max: number): void;
  /** The un-booked loss to ghost (uncapped; clamped at the pool here). */
  setPending(loss: number): void;
  /** Fold the ghost into the fill: the pool becomes `current − pending`. */
  commit(): void;
  /** 96.5b2 — the live numbers (the shake scales by `max`). */
  reading(): { current: number; max: number; pending: number };
  /** 96.5b2 — the orb's landing point (viewport): the fill's leading edge
   *  as the ghost currently leaves it — where the next loss grows from. */
  anchor(): { x: number; y: number };
  /** 96.5b2 — the landing flash (`.is-pulsing`, the chip's pulse). */
  pulse(): void;
  /** 96.5c/c2 — the NOTCH: a 2px slice out of the fill at `current − loss`
   *  (the pre-turn "at risk: up to N" bound, or its enemy mirror), the most
   *  the ghost can reach on an ordinary turn; 0 hides it, as does a bound
   *  covering the whole pool. Anchored to the BOOKED pool, so it holds still
   *  while the ghost grows toward it; `commit()` clears it (the turn's over). */
  setCeiling(loss: number): void;
}

/** The readout: `current / max`, or `remaining (−pending) / max` while a loss
 *  is pending. Pure — `remaining` and the shown loss are both clamped. */
export function poolValueParts(
  current: number,
  max: number,
  pending: number,
): { remaining: number; pending: number; max: number } {
  const booked = Math.max(0, current);
  const loss = Math.max(0, Math.min(booked, pending));
  return { remaining: booked - loss, pending: loss, max };
}

export function createPoolGauge(
  side: PoolSide,
  label: string,
  current: number,
  max: number,
): PoolGaugeHandle {
  const gauge = document.createElement('div');
  gauge.className = `pool-gauge pool-gauge--${side}`;

  const head = document.createElement('div');
  head.className = 'pool-gauge-head';
  const name = document.createElement('span');
  name.className = 'pool-gauge-label';
  name.textContent = label;
  const value = document.createElement('span');
  value.className = 'pool-gauge-value';
  const remainingText = document.createTextNode('');
  const pendingEl = document.createElement('span');
  pendingEl.className = 'pool-gauge-pending';
  const maxText = document.createTextNode('');
  value.append(remainingText, pendingEl, maxText);
  head.append(name, value);

  const bar = document.createElement('div');
  bar.className = 'pool-gauge-bar';
  const fill = document.createElement('div');
  fill.className = 'pool-gauge-fill';
  const ghost = document.createElement('div');
  ghost.className = 'pool-gauge-ghost';
  const risk = document.createElement('div');
  risk.className = 'pool-gauge-risk';
  risk.hidden = true;
  bar.append(fill, ghost, risk);

  gauge.append(head, bar);
  const pulse = chipPulse(gauge);

  let cur = current;
  let mx = max;
  let pend = 0;
  let ceil = 0;

  const paint = (): void => {
    const parts = poolValueParts(cur, mx, pend);
    remainingText.data = `${parts.remaining}`;
    pendingEl.textContent = parts.pending > 0 ? ` (−${parts.pending})` : '';
    pendingEl.hidden = parts.pending === 0;
    maxText.data = ` / ${parts.max}`;
    const pct = (n: number): number => (mx > 0 ? Math.max(0, Math.min(1, n / mx)) : 0);
    fill.style.width = `${pct(Math.max(0, cur)) * 100}%`;
    // The ghost sits over the fill's leading segment: from the projected
    // remainder to the booked pool.
    ghost.style.left = `${pct(parts.remaining) * 100}%`;
    ghost.style.width = `${(pct(parts.remaining + parts.pending) - pct(parts.remaining)) * 100}%`;
    gauge.classList.toggle('is-pending', parts.pending > 0);
    // 96.5c2 — the NOTCH sits at the booked pool minus the bound: the
    // ghost's leading edge can reach it and, on an ordinary turn, not pass
    // it. Hidden when there is no bound, and when the bound covers the whole
    // pool (a notch at zero morale is the bar's own end).
    const floor = Math.max(0, cur) - ceil;
    risk.hidden = ceil <= 0 || mx <= 0 || floor <= 0;
    risk.style.left = `${pct(Math.max(0, floor)) * 100}%`;
  };
  paint();

  return {
    el: gauge,
    set(next: number, nextMax: number): void {
      cur = next;
      mx = nextMax;
      paint();
    },
    setPending(loss: number): void {
      pend = loss;
      paint();
    },
    commit(): void {
      const parts = poolValueParts(cur, mx, pend);
      cur = parts.remaining;
      pend = 0;
      // 96.5c2 — the notch is THIS turn's bound; the commit ends the turn,
      // so it leaves with the ghost (the user's playtest: it used to
      // re-derive against the dropped pool and jump during the outro).
      ceil = 0;
      paint();
    },
    reading(): { current: number; max: number; pending: number } {
      return { current: cur, max: mx, pending: pend };
    },
    anchor(): { x: number; y: number } {
      const r = bar.getBoundingClientRect();
      const parts = poolValueParts(cur, mx, pend);
      const frac = mx > 0 ? Math.max(0, Math.min(1, parts.remaining / mx)) : 0;
      return { x: r.left + r.width * frac, y: r.top + r.height / 2 };
    },
    pulse,
    setCeiling(loss: number): void {
      ceil = Math.max(0, loss);
      paint();
    },
  };
}

export function renderPoolGauge(
  side: PoolSide,
  label: string,
  current: number,
  max: number,
): HTMLDivElement {
  return createPoolGauge(side, label, current, max).el;
}
