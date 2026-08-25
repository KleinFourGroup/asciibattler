import { describe, expect, it } from 'vitest';
import { atOrBeyondWalkPos, compareWalkPos } from './walkDepth';
import { DECISION_SITES, isDecisionSite } from './rollout/sites';

describe('walkDepth (gotcha #127 — the lexicographic depth key)', () => {
  it('orders by sector first, hop second', () => {
    expect(compareWalkPos({ sector: 0, hop: 11 }, { sector: 1, hop: 1 })).toBeLessThan(0);
    expect(compareWalkPos({ sector: 1, hop: 3 }, { sector: 1, hop: 7 })).toBeLessThan(0);
    expect(compareWalkPos({ sector: 1, hop: 7 }, { sector: 1, hop: 7 })).toBe(0);
    expect(compareWalkPos({ sector: 2, hop: 0 }, { sector: 1, hop: 99 })).toBeGreaterThan(0);
  });

  it('the #120 contamination case: a late act-1 death is NOT at-or-past an act-2 terminal', () => {
    // The pre-72b bare-hop filter counted a death at act-1 hop 10 (of an
    // 11-hop act 1) as an arrival at the act-2 hop-10 terminal — the §68g
    // false wall. The lexicographic key must reject it.
    const act1LateDeath = { sector: 0, hop: 10 };
    const act2Terminal = { sector: 1, hop: 10 };
    expect(act1LateDeath.hop >= act2Terminal.hop).toBe(true); // the bare-hop lie
    expect(atOrBeyondWalkPos(act1LateDeath, act2Terminal)).toBe(false); // the truth
    // And the true arrivals still pass:
    expect(atOrBeyondWalkPos({ sector: 1, hop: 10 }, act2Terminal)).toBe(true);
    expect(atOrBeyondWalkPos({ sector: 2, hop: 0 }, act2Terminal)).toBe(true);
  });

  it('single-sector shapes reduce to bare hop (sector ≡ 0)', () => {
    expect(atOrBeyondWalkPos({ sector: 0, hop: 9 }, { sector: 0, hop: 9 })).toBe(true);
    expect(atOrBeyondWalkPos({ sector: 0, hop: 8 }, { sector: 0, hop: 9 })).toBe(false);
  });
});

describe('decision-site registry (gotcha #128)', () => {
  it('guards csv-parsed strings — the 85f reader mistake stays caught', () => {
    expect(isDecisionSite('rewardDaemon')).toBe(true);
    expect(isDecisionSite('reward')).toBe(false); // the remembered-string bug
    expect(isDecisionSite('campRaid')).toBe(true);
  });

  it('is a closed, duplicate-free list', () => {
    expect(new Set(DECISION_SITES).size).toBe(DECISION_SITES.length);
  });
});
