/**
 * In-battle command channel. UI (and the headless harness in A3) enqueues
 * `WorldCommand`s on the active `World`; `World.tick()` drains the queue
 * at a deterministic point (top of tick, before per-unit step) and applies
 * each command. Pending commands are part of `WorldSnapshot` so a
 * mid-battle save/restore preserves intent that hasn't been processed yet.
 *
 * Currently a placeholder — C5 fills in the actual targetless and
 * single-target command kinds. Keeping the union open here lets later
 * additions land without touching the channel plumbing.
 */
export type WorldCommand = { readonly kind: 'noop' };

export const WORLD_COMMAND_KINDS: readonly WorldCommand['kind'][] = ['noop'] as const;
