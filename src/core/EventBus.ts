/**
 * Tiny typed pub/sub. Combat, UI, FX, and the run state machine talk through
 * one of these so no module reaches into another's internals. See
 * ARCHITECTURE.md principle 5.
 *
 * Generic over an `Events` record so callers get autocomplete on event names
 * and structural checking on payloads.
 */

type Handler<P> = (payload: P) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private readonly handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  /**
   * Subscribe to `event`. Returns an unsubscribe function — call it to
   * detach, no need to keep a reference to the handler itself.
   */
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers[event];
    if (!set) {
      set = new Set();
      this.handlers[event] = set;
    }
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /**
   * Dispatch `payload` to every handler subscribed to `event` at the moment
   * of the call. Handlers added or removed during dispatch take effect on
   * the *next* emit — snapshot semantics keep iteration predictable.
   *
   * Exceptions from a handler propagate to the caller of `emit`; one bad
   * handler will skip the rest. Treat that as a bug to fix, not to swallow.
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers[event];
    if (!set || set.size === 0) return;
    for (const handler of [...set]) handler(payload);
  }
}
