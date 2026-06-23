/**
 * Phase Y — the data-driven attack/effect model (`src/sim/effects/`).
 *
 * Y1 landed the vocabulary (`schema.ts`) + the seconds→ticks timeline conversion
 * (`timeline.ts`). Y2 adds the generic `EffectAction` + the op interpreter +
 * the target/reposition resolution. Y3 adds the propose bridge (`propose.ts`) +
 * the generic `EffectAbility`, then strangler-migrates every combat verb onto
 * it, proven byte-identical.
 */

export * from './schema';
export * from './timeline';
export * from './targeting';
export * from './reposition';
export * from './interpreter';
export * from './EffectAction';
export * from './propose';
export * from './EffectAbility';
