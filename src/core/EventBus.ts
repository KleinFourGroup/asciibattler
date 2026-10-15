/**
 * A typed pub/sub. The sim, the run, the UI and the effects report what
 * happened through one of these, so no module reaches into another's
 * internals; player intent goes through the command channels instead
 * (ARCHITECTURE.md, guiding principle 5).
 *
 * `Events` maps each event name to its payload type, so a subscriber's
 * event name and payload are type-checked.
 */

type Handler<P> = (payload: P) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private readonly handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  /** Subscribes to `event` and returns the function that unsubscribes. */
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
   * Calls every handler subscribed to `event` when the call starts; a
   * handler added or removed during the dispatch takes effect at the next
   * emit.
   *
   * A handler's exception propagates to the caller of `emit` and skips the
   * handlers after it. Treat it as a bug to fix, not to swallow.
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers[event];
    if (!set || set.size === 0) return;
    for (const handler of [...set]) handler(payload);
  }
}
