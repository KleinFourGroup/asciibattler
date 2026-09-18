import { describe, it, expect } from 'vitest';
import {
  assertFxKeysResolve,
  assertStatusFxKeysResolve,
  fxDescriptor,
  FX_REGISTRY,
  HITSPLAT_PREFIX,
  hitsplatText,
  isDotHitsplatKind,
  type HitsplatKind,
  type FxDescriptor,
  REDUCED_MOTION_STRIPS,
  stripMotion,
} from './fxRegistry';
import { ABILITY_DEFS } from '../config/abilities';
import { STATUS_DEFS } from '../config/statuses';

/**
 * Phase Z — the FX registry is pure data (no three.js), so its resolution + the
 * boot assert are headless-testable; only the on-screen pixels are eyeballed.
 */

describe('fxRegistry — resolution', () => {
  it('resolves a known key to its channel set; unknown keys are undefined', () => {
    expect(fxDescriptor('magic_bolt_launch')).toEqual({ projectile: { style: 'straight' } });
    expect(fxDescriptor('magic_bolt_burst')).toMatchObject({ burst: { style: 'explosion' }, sound: 'magicboom' });
    expect(fxDescriptor('catapult_launch')).toEqual({ projectile: { style: 'arc' } });
    expect(fxDescriptor('catapult_burst')).toMatchObject({ burst: { style: 'dud' }, sound: 'thud' });
    expect(fxDescriptor('no_such_key')).toBeUndefined();
  });
});

describe('fxRegistry — Z3 strike cues', () => {
  it('the melee swing key carries a shove + the melee whoosh', () => {
    expect(fxDescriptor('melee_swing')).toMatchObject({ shove: {}, sound: 'melee' });
  });

  it('the ranged shot key carries a tracer + the shoot whoosh', () => {
    expect(fxDescriptor('ranged_shot')).toMatchObject({ tracer: {}, sound: 'shoot' });
  });
});

describe('fxRegistry — §29c chain arc', () => {
  // The chain arc is EVENT-driven (`unit:chained`, per hop), not def-driven — so
  // `chain_lightning` carries no `fx` block and the ability boot-assert never sees
  // this key. Pin it directly: a tracer + the `chain` zap + a subtle per-hop jolt.
  it('chain_arc carries a tracer, the chain zap, and a gentle shake', () => {
    const arc = fxDescriptor('chain_arc');
    expect(arc).toMatchObject({ tracer: {}, sound: 'chain' });
    expect(arc?.shake?.intensity).toBeGreaterThan(0);
    // Gentler than the bolt's own impact shake — it fires once PER HOP.
    expect(arc!.shake!.intensity).toBeLessThan(fxDescriptor('magic_bolt_burst')!.shake!.intensity);
  });

  it('chain_lightning drives its arcs off the event, not a def fx block', () => {
    expect(ABILITY_DEFS.chain_lightning!.fx).toBeUndefined();
  });
});

describe('fxRegistry — Z2 camera shake', () => {
  it('the impact burst keys carry an authored shake, catapult heavier than the bolt', () => {
    const mage = fxDescriptor('magic_bolt_burst');
    const cat = fxDescriptor('catapult_burst');
    expect(mage?.shake?.intensity).toBeGreaterThan(0);
    expect(cat?.shake?.intensity).toBeGreaterThan(0);
    expect(cat!.shake!.intensity).toBeGreaterThan(mage!.shake!.intensity);
    expect(cat!.shake!.durationSeconds).toBeGreaterThan(0);
  });
});

describe('fxRegistry — 28 behavior-status overlays', () => {
  it('each behavior status authors a persistent overlay tint that resolves', () => {
    for (const id of ['frozen', 'panic', 'blind', 'confusion']) {
      const key = STATUS_DEFS[id]!.fx?.active;
      expect(key, `${id} must author an fx.active key`).toBeDefined();
      const fx = fxDescriptor(key!);
      expect(fx?.overlay?.tint, `${id}'s active key carries an overlay tint`).toMatch(/^#/);
    }
  });

  it('the four overlay tints are distinct (each status reads differently)', () => {
    const tints = ['frozen', 'panic', 'blind', 'confusion'].map(
      (id) => fxDescriptor(STATUS_DEFS[id]!.fx!.active!)!.overlay!.tint,
    );
    expect(new Set(tints).size).toBe(4);
  });

  it('the shipped status catalog passes the status fx boot assert', () => {
    expect(() => assertStatusFxKeysResolve(STATUS_DEFS)).not.toThrow();
  });
});

describe('fxRegistry — boot assert', () => {
  it('passes for the shipped ability catalog (every fx key resolves)', () => {
    expect(() => assertFxKeysResolve(ABILITY_DEFS)).not.toThrow();
  });

  it('throws naming the def, phase, and key when a def references an unknown FxKey', () => {
    const bad = {
      catapult_shot: { ...ABILITY_DEFS.catapult_shot!, fx: { impact: 'no_such_key' } },
    };
    expect(() => assertFxKeysResolve(bad)).toThrow(
      /ability 'catapult_shot' phase 'impact' references unknown FxKey 'no_such_key'/,
    );
  });

  it('tolerates a def with no fx block', () => {
    const noFx = { sword: { ...ABILITY_DEFS.sword!, fx: undefined } };
    expect(() => assertFxKeysResolve(noFx)).not.toThrow();
  });
});

describe('fxRegistry — the Z1 re-home (config-derived)', () => {
  it('the mage + catapult defs carry release+impact fx keys that resolve', () => {
    expect(ABILITY_DEFS.magic_bolt!.fx).toEqual({
      release: 'magic_bolt_launch',
      impact: 'magic_bolt_burst',
    });
    expect(ABILITY_DEFS.catapult_shot!.fx).toEqual({
      release: 'catapult_launch',
      impact: 'catapult_burst',
    });
    for (const key of Object.values(ABILITY_DEFS.magic_bolt!.fx ?? {})) {
      expect(key !== undefined && key in FX_REGISTRY).toBe(true);
    }
  });
});

describe('fxRegistry — 102b a launched projectile has a flight (config-derived)', () => {
  /** Every ability whose `release` key launches a projectile but whose
   *  timeline gives it no `travel` time. The renderer times the flight off the
   *  caster's live `travel` ticks and falls back to a fixed 0.18 s when there
   *  are none — so a 0-length travel lands the glyph AFTER the burst it
   *  announces (the §102 kickoff finding). Walks the catalog, never an id list:
   *  a new projectile ability joins the pin the moment it ships. */
  function projectilesWithoutFlight(defs: typeof ABILITY_DEFS): string[] {
    const out: string[] = [];
    for (const def of Object.values(defs)) {
      const key = def.fx?.release;
      if (key === undefined || fxDescriptor(key)?.projectile === undefined) continue;
      const travel = def.timeline.find((p) => p.phase === 'travel');
      if (travel === undefined || typeof travel.seconds !== 'number' || travel.seconds <= 0) {
        out.push(def.id);
      }
    }
    return out;
  }

  it('the pin can fail: a doctored 0-length travel is flagged', () => {
    const vial = ABILITY_DEFS.vial!;
    const doctored = {
      vial: {
        ...vial,
        timeline: vial.timeline.map((p) => (p.phase === 'travel' ? { ...p, seconds: 0 } : p)),
      },
    };
    expect(projectilesWithoutFlight(doctored)).toEqual(['vial']);
  });

  it('every ability that launches a projectile on release has travel time', () => {
    expect(projectilesWithoutFlight(ABILITY_DEFS)).toEqual([]);
  });

  it('the two pure afflicters launch one (they were impact-only before 102)', () => {
    for (const id of ['hex', 'wail']) {
      const key = ABILITY_DEFS[id]!.fx?.release;
      expect(key, `${id} authors a release key`).toBeDefined();
      expect(fxDescriptor(key!)?.projectile, `${id}'s release key flies`).toBeDefined();
    }
  });
});

describe('fxRegistry — the Z3 re-home (config-derived)', () => {
  // The four melee weapons + the rogue gambit all swing; the gambit authors it
  // on `windup` (where it deals damage) instead of `impact`. Deriving the
  // expectations from the def keeps the test honest if a weapon is retuned.
  it('every melee weapon strikes with the shared melee_swing key on impact', () => {
    for (const id of ['sword', 'club', 'katana', 'whip']) {
      expect(ABILITY_DEFS[id]!.fx).toEqual({ impact: 'melee_swing' });
    }
  });

  it('the gambit swings on windup (where it deals its damage)', () => {
    expect(ABILITY_DEFS.gambit_strike!.fx).toEqual({ windup: 'melee_swing' });
  });

  it('the bow flies the ranged_shot tracer on impact', () => {
    expect(ABILITY_DEFS.bow!.fx).toEqual({ impact: 'ranged_shot' });
  });

  it('every strike-cue key the defs reference resolves in the registry', () => {
    for (const id of ['sword', 'club', 'katana', 'whip', 'gambit_strike', 'bow']) {
      for (const key of Object.values(ABILITY_DEFS[id]!.fx ?? {})) {
        expect(key !== undefined && key in FX_REGISTRY).toBe(true);
      }
    }
  });
});

describe('fxRegistry — 98d the hitsplat kinds (config-derived)', () => {
  /** Every periodic status's `ticked` descriptor, keyed by status id, with the
   *  op kind the sim will apply — derived from the status catalog, so a new
   *  DoT/HoT joins the pin the moment it ships. */
  function periodicTicks(): Map<string, { op: 'damage' | 'heal'; kind: HitsplatKind }> {
    const out = new Map<string, { op: 'damage' | 'heal'; kind: HitsplatKind }>();
    for (const def of Object.values(STATUS_DEFS)) {
      if (!def.periodic) continue;
      const key = def.fx?.ticked;
      expect(key, `${def.id} — a periodic status authors a ticked fx key`).toBeDefined();
      const fx = fxDescriptor(key!);
      expect(fx?.hitsplat, `${def.id} — its tick carries a hitsplat`).toBeDefined();
      out.set(def.id, { op: def.periodic.op.kind, kind: fx!.hitsplat!.kind });
    }
    return out;
  }

  it('every periodic DAMAGE status draws its own hitsplat kind, and never the heal kind', () => {
    const ticks = periodicTicks();
    const dots = [...ticks.entries()].filter(([, t]) => t.op === 'damage');
    expect(dots.length).toBeGreaterThanOrEqual(3); // burn / bleed / poison ship
    const kinds = dots.map(([, t]) => t.kind);
    expect(new Set(kinds).size, `distinct kinds across ${dots.map(([id]) => id).join(' / ')}`).toBe(kinds.length);
    for (const [id, t] of dots) {
      expect(t.kind, id).not.toBe('heal');
      expect(isDotHitsplatKind(t.kind), `${id} draws a DoT kind`).toBe(true);
      // The kind IS the status id — one table (STATUS_DISPLAY) colors pip,
      // card swatch and number.
      expect(t.kind, `${id}'s kind names its own status`).toBe(id);
    }
  });

  it('every periodic HEAL status draws the heal kind', () => {
    for (const [id, t] of periodicTicks()) {
      if (t.op === 'heal') expect(t.kind, id).toBe('heal');
    }
  });

  it('every DoT kind carries a non-empty prefix glyph, distinct from the others and from heal', () => {
    const dotKinds = (Object.keys(HITSPLAT_PREFIX) as HitsplatKind[]).filter(isDotHitsplatKind);
    const prefixes = dotKinds.map((k) => HITSPLAT_PREFIX[k]);
    for (const [i, p] of prefixes.entries()) expect(p.length, dotKinds[i]).toBeGreaterThan(0);
    expect(new Set([...prefixes, HITSPLAT_PREFIX.heal]).size).toBe(prefixes.length + 1);
    // The strike kinds stay bare — their size / italic already carry crit and miss.
    expect(HITSPLAT_PREFIX.normal).toBe('');
    expect(HITSPLAT_PREFIX.crit).toBe('');
    expect(HITSPLAT_PREFIX.miss).toBe('');
  });

  it('hitsplatText is the prefix + the amount', () => {
    expect(hitsplatText('heal', 4)).toBe('+4');
    expect(hitsplatText('normal', 12)).toBe('12');
    for (const kind of (Object.keys(HITSPLAT_PREFIX) as HitsplatKind[]).filter(isDotHitsplatKind)) {
      expect(hitsplatText(kind, 7)).toBe(`${HITSPLAT_PREFIX[kind]}7`);
    }
  });
});

/**
 * 99c — the reduced-motion filter, walked over EVERY registry key under both
 * readings. The strip set is pinned by value (the §99 exit criterion: no
 * shake, burst or sparkle) and the kept channels byte-equal, so a channel
 * added to the descriptor later is kept until someone decides otherwise here.
 */
describe('99c — fxDescriptor under reduced motion', () => {
  const keys = Object.keys(FX_REGISTRY);
  const stripped = new Set<keyof FxDescriptor>(REDUCED_MOTION_STRIPS);

  it('strips exactly shake, burst and sparkle', () => {
    expect([...REDUCED_MOTION_STRIPS].sort()).toEqual(['burst', 'shake', 'sparkle']);
  });

  it('the registry exercises every stripped channel (the pin is not vacuous)', () => {
    for (const channel of REDUCED_MOTION_STRIPS) {
      const carriers = keys.filter((k) => fxDescriptor(k)![channel] !== undefined);
      expect(carriers.length, `no key carries \`${channel}\``).toBeGreaterThan(0);
    }
  });

  it('every key: the reduced reading has none of the stripped channels and all of the others, byte-equal', () => {
    for (const k of keys) {
      const full = fxDescriptor(k)!;
      const reduced = fxDescriptor(k, true)!;
      for (const channel of REDUCED_MOTION_STRIPS) {
        expect(reduced[channel], `${k}.${channel} under reduced motion`).toBeUndefined();
      }
      for (const channel of Object.keys(full) as (keyof FxDescriptor)[]) {
        if (stripped.has(channel)) continue;
        expect(reduced[channel], `${k}.${channel} must survive reduced motion`).toEqual(full[channel]);
      }
      // The full reading is the registry entry itself; the reduced one never mutates it.
      expect(fxDescriptor(k, false)).toBe(full);
      expect(full).toEqual(FX_REGISTRY[k as keyof typeof FX_REGISTRY]);
    }
  });

  it('the informational channels ride through: a bolt still launches, a DoT still splats, a tint still holds', () => {
    expect(fxDescriptor('magic_bolt_launch', true)).toEqual({ projectile: { style: 'straight' } });
    expect(fxDescriptor('magic_bolt_burst', true)).toEqual({ sound: 'magicboom' });
    expect(fxDescriptor('poison_tick', true)?.hitsplat).toEqual(fxDescriptor('poison_tick')?.hitsplat);
    expect(fxDescriptor('poison_tick', true)?.sparkle).toBeUndefined();
    expect(fxDescriptor('chain_arc', true)).toEqual({ tracer: {}, sound: 'chain' });
    expect(fxDescriptor('no_such_key', true)).toBeUndefined();
  });

  it('stripMotion is a copy, not a mutation', () => {
    const fx: FxDescriptor = { sound: 'thud', shake: { intensity: 1, durationSeconds: 1 }, burst: { style: 'dud' } };
    const out = stripMotion(fx);
    expect(out).toEqual({ sound: 'thud' });
    expect(fx.shake).toBeDefined();
    expect(fx.burst).toBeDefined();
  });
});
