import { describe, expect, it } from 'vitest';
import encountersJson from '../../../config/encounters.json';
import { getEncounter } from '../../config/encounters';
import { EventBus } from '../../core/EventBus';
import { RNG } from '../../core/RNG';
import type { GameEvents } from '../../core/events';
import { World } from '../../sim/World';
import { scaledUnit } from '../../sim/archetypes';
import { resolveWave, type WaveSpec } from './wave';

/**
 * The boss flag: an encounter's boss is the wave entry marked `boss: true`,
 * carried to each template it resolves to and so to the unit. The expected
 * entries are read from the raw config, apart from the code under test: in a
 * boss encounter, the entry with a `power` override is its boss.
 */

interface RawSpec {
  archetype: string;
  power?: number;
  boss?: boolean;
}
interface RawEncounter {
  id: string;
  kind: string;
  waves: unknown;
}

/** Every wave entry an encounter's raw grammar holds, at any depth. */
function rawSpecs(o: unknown, out: RawSpec[] = []): RawSpec[] {
  if (Array.isArray(o)) for (const v of o) rawSpecs(v, out);
  else if (o !== null && typeof o === 'object') {
    const r = o as Record<string, unknown>;
    if (typeof r.archetype === 'string') out.push(r as unknown as RawSpec);
    for (const v of Object.values(r)) rawSpecs(v, out);
  }
  return out;
}

/** Every wave spec in a parsed encounter, at any depth, the shape Run resolves. */
function waveSpecs(o: unknown, out: WaveSpec[] = []): WaveSpec[] {
  if (Array.isArray(o)) for (const v of o) waveSpecs(v, out);
  else if (o !== null && typeof o === 'object') {
    const r = o as Record<string, unknown>;
    if (r.kind === 'wave' && r.spec !== undefined) out.push(r.spec as WaveSpec);
    for (const v of Object.values(r)) waveSpecs(v, out);
  }
  return out;
}

const raw = encountersJson as unknown as RawEncounter[];

describe('the boss flag', () => {
  it("marks each boss encounter's powered entry, and nothing else", () => {
    const bosses = new Set<string>();
    for (const e of raw) {
      for (const s of rawSpecs(e.waves)) {
        const isBoss = e.kind === 'boss' && s.power !== undefined;
        expect(s.boss === true, `${e.id}: ${s.archetype}`).toBe(isBoss);
        if (isBoss) bosses.add(`${e.id}:${s.archetype}`);
      }
    }
    // One boss archetype for each boss encounter.
    const bossEncounters = raw.filter((e) => e.kind === 'boss').map((e) => e.id);
    expect([...bosses].map((b) => b.split(':')[0]).sort()).toEqual([...bossEncounters].sort());
  });

  it('spawns a boss entry as a boss unit, and every other entry as none', () => {
    for (const e of raw.filter((x) => x.kind === 'boss')) {
      const encounter = getEncounter(e.id)!;
      for (const spec of waveSpecs(encounter.waves)) {
        const roster = [scaledUnit('mercenary', 3), scaledUnit('archer', 3)];
        const templates = resolveWave(spec, { roster, handSize: 6 }, new RNG(1));
        const world = new World(new EventBus<GameEvents>(), new RNG(1), 24, 24);
        const units = templates.map((t, i) => world.spawnUnit(t, 'enemy', { x: i % 24, y: Math.floor(i / 24) }));
        const flagged = new Set(spec.units.filter((u) => u.boss === true).map((u) => u.archetype));
        for (const u of units) {
          expect(u.boss, `${e.id}: ${u.archetype}`).toBe(flagged.has(u.archetype));
        }
      }
    }
  });

  it('keeps the flag on a unit and on a queued template through a snapshot', () => {
    const world = new World(new EventBus<GameEvents>(), new RNG(1), 16, 16);
    const boss = world.spawnUnit({ ...scaledUnit('bear', 2), boss: true }, 'enemy', { x: 3, y: 3 });
    const plain = world.spawnUnit(scaledUnit('bear', 2), 'enemy', { x: 5, y: 3 });
    world.queueUnit('enemy', { ...scaledUnit('banshee', 2), boss: true });
    const wire = JSON.parse(JSON.stringify(world.toJSON())) as ReturnType<World['toJSON']>;
    const restored = World.fromJSON(wire, new EventBus<GameEvents>());
    expect(restored.units.find((u) => u.id === boss.id)!.boss).toBe(true);
    expect(restored.units.find((u) => u.id === plain.id)!.boss).toBe(false);
    expect(wire.spawnQueues.find((q) => q.team === 'enemy')!.templates[0]!.boss).toBe(true);
    expect(JSON.stringify(restored.toJSON())).toBe(JSON.stringify(world.toJSON()));
  });
});
