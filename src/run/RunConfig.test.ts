import { describe, it, expect } from 'vitest';
import {
  parseRunConfig,
  parseRunConfigFromURL,
  runConfigToQueryString,
  FORCE_PROCEDURAL,
  type RunConfig,
} from './RunConfig';
import { ALL_ARCHETYPES } from '../sim/archetypes';
import { LAYOUT_IDS } from '../sim/layouts';
import { LEVELING } from '../config/leveling';

// Mechanic-level tests: the parser logic is config-free, so explicit inputs
// are fine. The only "data" we lean on is the live archetype + layout sets
// (so a new archetype/layout doesn't silently invalidate the fixtures).
const cfg = (query: string): RunConfig => parseRunConfig(new URLSearchParams(query));
const A0 = ALL_ARCHETYPES[0]!;
const A1 = ALL_ARCHETYPES[1]!;
const LAYOUT = LAYOUT_IDS[0]!;

describe('RunConfig parsing', () => {
  it('returns an empty config for no params', () => {
    expect(cfg('')).toEqual({});
  });

  it('parses every field', () => {
    const c = cfg(`seed=42&floors=2&roster=${A0},${A1}&layout=${LAYOUT}&width=4`);
    expect(c).toEqual({
      seed: 42,
      floorCount: 2,
      startingRoster: [
        { archetype: A0, level: 1 },
        { archetype: A1, level: 1 },
      ],
      forcedLayoutId: LAYOUT,
      mapMaxWidth: 4,
    });
  });

  it('allows seed 0 and negative seeds (RNG normalizes via >>> 0)', () => {
    expect(cfg('seed=0').seed).toBe(0);
    expect(cfg('seed=-5').seed).toBe(-5);
  });

  it('drops non-positive / non-integer floors and width', () => {
    expect(cfg('floors=0').floorCount).toBeUndefined();
    expect(cfg('floors=-1').floorCount).toBeUndefined();
    expect(cfg('floors=2.5').floorCount).toBeUndefined();
    expect(cfg('width=abc').mapMaxWidth).toBeUndefined();
  });

  it('drops invalid roster tokens, keeping the valid ones (default level 1)', () => {
    expect(cfg(`roster=${A0},notreal,___`).startingRoster).toEqual([{ archetype: A0, level: 1 }]);
  });

  it('omits startingRoster when no token is valid', () => {
    expect(cfg('roster=notreal,___').startingRoster).toBeUndefined();
  });

  it('trims + lowercases roster tokens', () => {
    expect(cfg(`roster= ${A0.toUpperCase()} `).startingRoster).toEqual([
      { archetype: A0, level: 1 },
    ]);
  });

  it('parses per-unit levels via archetype:level', () => {
    expect(cfg(`roster=${A0}:3,${A1}:2,${A0}`).startingRoster).toEqual([
      { archetype: A0, level: 3 },
      { archetype: A1, level: 2 },
      { archetype: A0, level: 1 },
    ]);
  });

  it('falls back to level 1 on a missing / non-positive / non-integer level', () => {
    expect(cfg(`roster=${A0}:`).startingRoster).toEqual([{ archetype: A0, level: 1 }]);
    expect(cfg(`roster=${A0}:0`).startingRoster).toEqual([{ archetype: A0, level: 1 }]);
    expect(cfg(`roster=${A0}:abc`).startingRoster).toEqual([{ archetype: A0, level: 1 }]);
  });

  it('clamps a roster level to the level cap', () => {
    expect(cfg(`roster=${A0}:9999`).startingRoster).toEqual([
      { archetype: A0, level: LEVELING.levelCap },
    ]);
  });

  it('drops an unknown layout id', () => {
    expect(cfg('layout=not_a_layout').forcedLayoutId).toBeUndefined();
  });

  it('parses the `procedural` sentinel (forces procedural maps), case-insensitively', () => {
    expect(cfg('layout=procedural').forcedLayoutId).toBe(FORCE_PROCEDURAL);
    expect(cfg('layout=Procedural').forcedLayoutId).toBe(FORCE_PROCEDURAL);
  });

  it('round-trips the procedural sentinel through the query string', () => {
    const original = cfg('layout=procedural');
    expect(parseRunConfig(new URLSearchParams(runConfigToQueryString(original)))).toEqual(original);
  });

  it('round-trips through runConfigToQueryString (incl. per-unit levels)', () => {
    const original = cfg(`seed=7&floors=3&roster=${A0}:4,${A1}&layout=${LAYOUT}&width=5`);
    const query = runConfigToQueryString(original);
    expect(parseRunConfig(new URLSearchParams(query))).toEqual(original);
  });

  it('parseRunConfigFromURL strips a leading "?" (location.search shape)', () => {
    expect(parseRunConfigFromURL('?floors=2&seed=9')).toEqual({ seed: 9, floorCount: 2 });
  });
});
