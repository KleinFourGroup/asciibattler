/**
 * 84e — the prior-table builder's contracts: long-horizon rows only, the
 * per-site polarity, level stripping + cross-site n-weighted merge, the
 * signable floor, eventChoice / unknown sites excluded, provenance passed
 * through, the summary render.
 */

import { describe, it, expect } from 'vitest';
import type { DecisionRow } from '../reporters';
import { buildPriorTable, priorItemOf, renderPriorTable } from './priorTable';

const PROV = { head: 'abc1234', builtAt: '2026-08-22T00:00:00Z', sources: ['x/decisions.csv'] };

/** One decision = a null row + challenger rows at the given horizon. */
function decision(
  id: number,
  site: string,
  horizon: string,
  hopsRemaining: number | null,
  nullScore: number,
  challengers: readonly [string, number][],
): DecisionRow[] {
  const base = {
    seed: 1,
    strategy: 'arb',
    decision: id,
    site,
    sector: 'the-start',
    hop: 2,
    marginVsNull: 0,
    epsilon: 0,
    horizon,
    hopsRemaining,
    stuckFrac: null,
    lambda: null,
  };
  return [
    { ...base, candidate: 0, label: 'null', chosen: true, score: nullScore },
    ...challengers.map(([label, score], i) => ({
      ...base,
      candidate: i + 1,
      label,
      chosen: false,
      score,
    })),
  ];
}

describe('priorItemOf — the site polarity + item-key rule', () => {
  it('maps the acquisition sites, strips unit levels, excludes the rest', () => {
    expect(priorItemOf('rewardDaemon', 'daemon:mars')).toEqual({ key: 'daemon:mars', sign: -1 });
    expect(priorItemOf('portBuy', 'daemon:mars')).toEqual({ key: 'daemon:mars', sign: 1 });
    expect(priorItemOf('portBuy', 'packet:patch')).toEqual({ key: 'packet:patch', sign: 1 });
    expect(priorItemOf('portBuy', 'unit:archer:L7')).toEqual({ key: 'unit:archer', sign: 1 });
    expect(priorItemOf('recruit', 'unit:archer')).toEqual({ key: 'unit:archer', sign: 1 });
    expect(priorItemOf('eventChoice', 'choice:1 "A daemon"')).toBeNull();
    expect(priorItemOf('grant:empower', 'empower')).toBeNull();
  });
});

describe('buildPriorTable', () => {
  it('uses long-horizon rows only, applies polarity, normalizes per hop, flags the floor', () => {
    const rows = [
      // live row — must be ignored even though it carries the same item
      ...decision(0, 'rewardDaemon', '', 10, 0, [['decline daemon:mars', 99]]),
      // run horizon: declining mars costs 4 → holding mars is worth +4, +0.4/hop
      ...decision(1, 'rewardDaemon', 'run', 10, 0, [['decline daemon:mars', -4]]),
      // recruit: taking an archer is worth +2 over pass, at 20 hops → 0.1/hop
      ...decision(2, 'recruit', 'run', 20, 1, [['recruit unit:archer:L5', 3], ['recruit unit:rogue:L5', 0]]),
      // eventChoice rows never become items
      ...decision(3, 'eventChoice', 'run', 10, 0, [['choice:1 "A daemon"', 5]]),
    ];
    const t = buildPriorTable(rows, PROV, 80);
    expect(t.provenance).toEqual(PROV);
    expect(t.floor).toBe(80);
    expect(t.decisions).toBe(3); // the three long-horizon decisions
    expect(Object.keys(t.items)).toEqual(['daemon:mars', 'unit:archer', 'unit:rogue']);
    const mars = t.items['daemon:mars']!;
    expect(mars.n).toBe(1);
    expect(mars.meanDelta).toBeCloseTo(4, 10);
    expect(mars.valuePerHop).toBeCloseTo(0.4, 10);
    expect(mars.signable).toBe(false);
    expect(mars.sites['rewardDaemon']).toEqual({ n: 1, valuePerHop: 0.4, meanDelta: 4 });
    const archer = t.items['unit:archer']!;
    expect(archer.meanDelta).toBeCloseTo(2, 10);
    expect(archer.valuePerHop).toBeCloseTo(0.1, 10);
    expect(t.items['unit:rogue']!.meanDelta).toBeCloseTo(-1, 10);
  });

  it('merges one item across sites and levels, n-weighted; the floor flips signable', () => {
    const rows: DecisionRow[] = [];
    // 60 port buys of archer at two levels: +6 each at 10 hops (0.6/hop)
    for (let i = 0; i < 60; i++) {
      rows.push(
        ...decision(i, 'portBuy', 'run', 10, 0, [[`buy unit:archer:L${i % 2 === 0 ? 6 : 8} @3`, 6]]),
      );
    }
    // 20 recruit offers of archer: +2 each at 20 hops (0.1/hop)
    for (let i = 100; i < 120; i++) {
      rows.push(...decision(i, 'recruit', 'run', 20, 0, [['recruit unit:archer:L5', 2]]));
    }
    const t = buildPriorTable(rows, PROV, 80);
    const archer = t.items['unit:archer']!;
    expect(archer.n).toBe(80);
    expect(archer.signable).toBe(true);
    expect(archer.meanDelta).toBeCloseTo((60 * 6 + 20 * 2) / 80, 10);
    expect(archer.valuePerHop).toBeCloseTo((60 * 0.6 + 20 * 0.1) / 80, 10);
    expect(archer.sites['portBuy']!.n).toBe(60);
    expect(archer.sites['recruit']!.n).toBe(20);
    // One short: directional.
    expect(buildPriorTable(rows.slice(0, -2), PROV, 80).items['unit:archer']!.signable).toBe(false);
  });

  it('an instance without hops contributes to meanΔ but not to value/hop', () => {
    const rows = [
      ...decision(0, 'recruit', 'run', null, 0, [['recruit unit:mage:L5', 4]]),
      ...decision(1, 'recruit', 'run', 8, 0, [['recruit unit:mage:L5', 2]]),
    ];
    const mage = buildPriorTable(rows, PROV, 80).items['unit:mage']!;
    expect(mage.n).toBe(2);
    expect(mage.meanDelta).toBeCloseTo(3, 10);
    expect(mage.valuePerHop).toBeCloseTo(0.25, 10); // 2/8 over the one hop-bearing instance
  });

  it('renders signable rows first and the directional tail', () => {
    const rows = decision(0, 'rewardDaemon', 'run', 10, 0, [['decline daemon:mars', -4]]);
    const out = renderPriorTable(buildPriorTable(rows, PROV, 1));
    expect(out).toContain('HEAD abc1234');
    expect(out).toContain('Signable (1)');
    expect(out).toContain('daemon:mars');
    expect(out).toContain('value/hop=   0.400');
    expect(renderPriorTable(buildPriorTable(rows, PROV, 80))).toContain('Directional — under the floor (1');
  });
});
