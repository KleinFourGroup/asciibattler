/**
 * Phase Y — the data-driven attack/effect model (`src/sim/effects/`).
 *
 * Y1 lands the vocabulary (`schema.ts`) + the seconds→ticks timeline conversion
 * (`timeline.ts`). Y2 adds the generic `EffectAction` interpreter here; Y3/Y4
 * strangler-migrate every combat verb onto it, proven byte-identical.
 */

export * from './schema';
export * from './timeline';
