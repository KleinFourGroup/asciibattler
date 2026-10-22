import { describe, it, expect } from 'vitest';
import { createMovementBehavior } from './registry';
import { MovementBehavior } from './MovementBehavior';
import { SupportMovementBehavior } from './SupportMovementBehavior';
import { ALL_ARCHETYPES, ARCHETYPE_CONFIG } from '../archetypes';

/**
 * The movement-behavior selector is the `UnitDef.movementBehavior` catalog
 * field, not a special case in `createMovementBehavior`.
 * Balance-proof: derive the expected behavior from the SAME catalog the factory
 * reads, so this pins the wiring (factory ⇄ config), not a hand-listed archetype.
 */
describe('createMovementBehavior (catalog-driven)', () => {
  it('selects each archetype\'s behavior from UnitDef.movementBehavior', () => {
    for (const a of ALL_ARCHETYPES) {
      const behavior = createMovementBehavior(a);
      if (ARCHETYPE_CONFIG[a].movementBehavior === 'support') {
        expect(behavior, a).toBeInstanceOf(SupportMovementBehavior);
      } else {
        // absent / 'standard' ⇒ the default charger (byte-identical to the old
        // `else` branch).
        expect(behavior, a).toBeInstanceOf(MovementBehavior);
      }
    }
  });

  it('the healer is the lone support unit; a striker charges (the anchor cases)', () => {
    expect(ARCHETYPE_CONFIG.healer.movementBehavior).toBe('support');
    expect(createMovementBehavior('healer')).toBeInstanceOf(SupportMovementBehavior);
    expect(ARCHETYPE_CONFIG.mercenary.movementBehavior).toBeUndefined();
    expect(createMovementBehavior('mercenary')).toBeInstanceOf(MovementBehavior);
  });
});
