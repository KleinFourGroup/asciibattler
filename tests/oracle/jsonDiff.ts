/**
 * Two JSON values compared path by path, for the proofs a hash cannot give.
 *
 * A hash says two values differ and nothing more. When a change is meant to
 * move the stored words and not the behaviour (a field dropped from the
 * save, a config key moved to another file), the proof is that the values
 * differ ONLY where the change says they should, and that needs every
 * difference named. Two uses, both through `npm run oracle`:
 *  - two end snapshots of one run (`npm run corpus -- --snapshots=<dir>` on
 *    each tree), for a change that slims the save;
 *  - two dumps of every config loader's exports (configDump.ts), for a
 *    change that moves config between files.
 *
 * Key order is compared too. Code that walks an object's keys behaves by
 * their order, so two objects with the same keys in another order are
 * reported as `reordered`, not passed.
 */

export interface JsonDifference {
  readonly kind: 'removed' | 'added' | 'changed' | 'reordered';
  /** Where: `team[3].stats.hp`. The root is the empty string. */
  readonly path: string;
  /** The values as short JSON text, where the kind has them. */
  readonly before?: string;
  readonly after?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const short = (value: unknown): string => {
  const text = JSON.stringify(value) ?? 'undefined';
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
};

const under = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

export function jsonDiff(before: unknown, after: unknown, path = ''): JsonDifference[] {
  if (Array.isArray(before) && Array.isArray(after)) {
    const out: JsonDifference[] = [];
    const shared = Math.min(before.length, after.length);
    for (let i = 0; i < shared; i++) out.push(...jsonDiff(before[i], after[i], `${path}[${i}]`));
    for (let i = shared; i < before.length; i++) out.push({ kind: 'removed', path: `${path}[${i}]`, before: short(before[i]) });
    for (let i = shared; i < after.length; i++) out.push({ kind: 'added', path: `${path}[${i}]`, after: short(after[i]) });
    return out;
  }
  if (isObject(before) && isObject(after)) {
    const out: JsonDifference[] = [];
    const keysBefore = Object.keys(before);
    const keysAfter = Object.keys(after);
    for (const key of keysBefore) {
      if (key in after) out.push(...jsonDiff(before[key], after[key], under(path, key)));
      else out.push({ kind: 'removed', path: under(path, key), before: short(before[key]) });
    }
    for (const key of keysAfter) {
      if (!(key in before)) out.push({ kind: 'added', path: under(path, key), after: short(after[key]) });
    }
    const kept = keysBefore.filter((key) => key in after);
    const keptAfter = keysAfter.filter((key) => key in before);
    if (kept.join('\n') !== keptAfter.join('\n')) {
      out.push({ kind: 'reordered', path, before: short(kept), after: short(keptAfter) });
    }
    return out;
  }
  if (before === after) return [];
  return [{ kind: 'changed', path, before: short(before), after: short(after) }];
}

/** A path with every array index dropped: `team[3].stats.hp` → `team[].stats.hp`. */
export const pathShape = (path: string): string => path.replace(/\[\d+\]/g, '[]');

/**
 * The differences counted by kind and path shape, most frequent first, so
 * thirty snapshots of many units read as a few lines: `removed
 * team[].fatigue ×212`.
 */
export function summarize(differences: readonly JsonDifference[]): string[] {
  const counts = new Map<string, number>();
  for (const d of differences) {
    const key = `${d.kind} ${pathShape(d.path) || '(the root)'}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([key, n]) => `${key} ×${n}`);
}

/** One difference as a line of text. */
export function describeDifference(d: JsonDifference): string {
  const where = d.path || '(the root)';
  if (d.kind === 'removed') return `removed ${where}: ${d.before}`;
  if (d.kind === 'added') return `added ${where}: ${d.after}`;
  return `${d.kind} ${where}: ${d.before} → ${d.after}`;
}
