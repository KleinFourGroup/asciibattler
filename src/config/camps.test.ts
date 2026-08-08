/**
 * §75a — the camp catalog loader. Balance-proof discipline: expectations
 * derive from the config modules (the raw JSON import, the live catalogs),
 * never hardcoded counts or balance arithmetic.
 */

import { describe, it, expect } from 'vitest';
import campsJson from '../../config/camps.json';
import {
  CAMPS,
  CAMP_IDS,
  CampsSchema,
  getCamp,
  assertCampRewardRefs,
  assertLayoutCampRefs,
  CAMP_UNIT_MAX_COUNT,
  CAMP_MAX_LEASH_RADIUS,
  type CampDef,
} from './camps';
import { REWARD_TABLE_IDS } from './rewards';
import { UNIT_DEFS } from './units';
import { LAYOUTS, type LayoutDef } from './layouts';

const validCamp = (patch: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'test-camp',
  name: 'Test Camp',
  leashRadius: 2,
  units: [{ archetype: 'mercenary' }],
  ...patch,
});

describe('§75a — the camp catalog', () => {
  it('parses the shipped catalog 1:1 with the raw file', () => {
    expect(CAMPS.length).toBe(campsJson.length);
    expect(CAMP_IDS).toEqual(campsJson.map((c) => c.id));
  });

  it('getCamp resolves every shipped id and misses unknowns', () => {
    for (const id of CAMP_IDS) expect(getCamp(id)?.id).toBe(id);
    expect(getCamp('no-such-camp')).toBeUndefined();
  });

  it('every shipped camp unit is a COMBATANT archetype (never a neutral def)', () => {
    // UNIT_DEFS is the combatant-only view; a wall/rubble id must not appear.
    for (const camp of CAMPS) {
      for (const u of camp.units) {
        expect(Object.keys(UNIT_DEFS)).toContain(u.archetype);
      }
    }
  });

  it('rejects a neutral-def archetype (the combatant-only gate)', () => {
    expect(
      CampsSchema.safeParse([validCamp({ units: [{ archetype: 'wall' }] })]).success,
    ).toBe(false);
  });

  it('rejects an unknown archetype, an empty roster, and a non-positive leash', () => {
    expect(
      CampsSchema.safeParse([validCamp({ units: [{ archetype: 'gremlin' }] })]).success,
    ).toBe(false);
    expect(CampsSchema.safeParse([validCamp({ units: [] })]).success).toBe(false);
    expect(CampsSchema.safeParse([validCamp({ leashRadius: 0 })]).success).toBe(false);
  });

  it('the typo guards bind: count and leash caps from the module constants', () => {
    expect(
      CampsSchema.safeParse([
        validCamp({ units: [{ archetype: 'mercenary', count: CAMP_UNIT_MAX_COUNT }] }),
      ]).success,
    ).toBe(true);
    expect(
      CampsSchema.safeParse([
        validCamp({ units: [{ archetype: 'mercenary', count: CAMP_UNIT_MAX_COUNT + 1 }] }),
      ]).success,
    ).toBe(false);
    expect(
      CampsSchema.safeParse([validCamp({ leashRadius: CAMP_MAX_LEASH_RADIUS + 1 })]).success,
    ).toBe(false);
  });

  it('an empty catalog is legal (camp-free game)', () => {
    expect(CampsSchema.safeParse([]).success).toBe(true);
  });
});

describe('§75a — referential boot asserts (args-injected)', () => {
  const campWithReward = (table: string): CampDef =>
    CampsSchema.parse([
      validCamp({ rewards: [{ table, trigger: { chance: 1 } }] }),
    ])[0]!;

  it('assertCampRewardRefs passes on the live catalogs and throws on an unknown table', () => {
    expect(() => assertCampRewardRefs(CAMPS, REWARD_TABLE_IDS)).not.toThrow();
    expect(() =>
      assertCampRewardRefs([campWithReward('no-such-table')], REWARD_TABLE_IDS),
    ).toThrow(/unknown reward table/);
  });

  it('assertLayoutCampRefs passes on the live catalogs and throws on an unknown campId', () => {
    expect(() => assertLayoutCampRefs(LAYOUTS, CAMP_IDS)).not.toThrow();
    const layout = {
      ...LAYOUTS[0]!,
      camps: [{ campId: 'no-such-camp' }],
    } as LayoutDef;
    expect(() => assertLayoutCampRefs([layout], CAMP_IDS)).toThrow(/unknown camp/);
  });
});
