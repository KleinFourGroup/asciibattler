/**
 * THE DIAGNOSTICS' MEASUREMENTS (116l), apart from the page so a headless test
 * can hold each one to a known answer (measure.test.ts): a storage with a
 * planted quota, a clock that steps by a planted amount.
 *
 *  - `censusOf`: what a `localStorage` holds, the game's keys apart from
 *    everyone else's. On itch every HTML game shares one origin, so the keys
 *    that aren't ours are other games', and they count against the same quota.
 *  - `findLimit`: the longest value one more key will take. It doubles a fill
 *    key until a write is refused and then bisects between the last length
 *    taken and the first refused, so its answer is a pair that brackets the
 *    limit, never a guess: `lastOk` was written and `firstFail` was refused.
 *    A storage that takes everything up to the ceiling is reported as that
 *    (`hitCeiling`), not as a limit.
 *  - `timeWrites`: what one `setItem` costs at each of a list of sizes.
 *  - `timerResolution`: the clock's own step. A browser may round
 *    `performance.now()` to a millisecond or more, and a single write timed
 *    with such a clock reads as 0 or as one step; the mean over many writes
 *    is the number to read, and this says how coarse the rest is.
 *  - `WriteTally`: every write the game itself made, by section.
 *
 * Nothing here is imported by the game. It is reached only from
 * src/dev/diag/index.ts, which only a build made with `VITE_DIAG=1` loads.
 */

/** What the measurements use of a `Storage`. */
export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function describeError(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}

// --- the census --------------------------------------------------------------

export interface Census {
  /** The keys under the game's namespace. `chars` is the key's length plus its
   *  value's, which is what a quota counts. */
  readonly ours: readonly { readonly key: string; readonly chars: number }[];
  readonly oursChars: number;
  /** How many keys are not ours, and what they hold together. */
  readonly others: number;
  readonly othersChars: number;
  /** The first few of their names, cut short. */
  readonly othersSample: readonly string[];
}

const SAMPLE_KEYS = 12;
const SAMPLE_KEY_CHARS = 48;

export function censusOf(storage: StorageLike, namespace: string): Census {
  const ours: { key: string; chars: number }[] = [];
  const othersSample: string[] = [];
  let oursChars = 0;
  let others = 0;
  let othersChars = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === null) continue;
    const chars = key.length + (storage.getItem(key)?.length ?? 0);
    if (key.startsWith(namespace)) {
      ours.push({ key, chars });
      oursChars += chars;
    } else {
      others++;
      othersChars += chars;
      if (othersSample.length < SAMPLE_KEYS) othersSample.push(key.slice(0, SAMPLE_KEY_CHARS));
    }
  }
  ours.sort((a, b) => a.key.localeCompare(b.key));
  return { ours, oursChars, others, othersChars, othersSample };
}

// --- the limit ---------------------------------------------------------------

export interface LimitResult {
  /** The longest value the fill key took, in characters. */
  readonly lastOk: number;
  /** The shortest value that was refused; null when none was. */
  readonly firstFail: number | null;
  /** The refusal, as `Name: message`. */
  readonly error: string | null;
  /** True when every length up to the ceiling was taken: no limit was found. */
  readonly hitCeiling: boolean;
  readonly ceiling: number;
  readonly attempts: number;
  /** Characters stored when the measurement began, keys and values, the fill
   *  key aside. `inUse + fillKey.length + lastOk` is what the storage held at
   *  the limit. */
  readonly inUse: number;
  /** Whether the fill key was gone afterwards. */
  readonly cleaned: boolean;
}

export interface LimitOptions {
  /** The longest value tried. */
  readonly ceiling: number;
  /** The first length tried, and how close the two answers end. */
  readonly step: number;
  /** The character the fill is made of (one UTF-16 unit). */
  readonly unit?: string;
}

function charsIn(storage: StorageLike): number {
  let total = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null) total += key.length + (storage.getItem(key)?.length ?? 0);
  }
  return total;
}

/**
 * The longest value `fillKey` can hold beside what the storage holds now.
 * The key is removed before and after, whatever happens in between. While it
 * runs the storage is nearly full, so nothing else can write to it: the page
 * calls this from a button that says so, and it is synchronous, so the game's
 * own writes can't fall inside it.
 */
export function findLimit(storage: StorageLike, fillKey: string, options: LimitOptions): LimitResult {
  const { ceiling, step } = options;
  const unit = options.unit ?? 'x';
  let attempts = 0;
  let error: string | null = null;
  let lastOk = 0;
  let firstFail: number | null = null;
  let inUse = 0;
  const fits = (chars: number): boolean => {
    attempts++;
    try {
      storage.setItem(fillKey, unit.repeat(chars));
      return true;
    } catch (err) {
      error = describeError(err);
      return false;
    }
  };
  try {
    storage.removeItem(fillKey);
    inUse = charsIn(storage);
    // Double until a length is refused or the next would pass the ceiling.
    for (let chars = step; chars <= ceiling; chars *= 2) {
      if (!fits(chars)) {
        firstFail = chars;
        break;
      }
      lastOk = chars;
    }
    // Bisect between the last taken and the first refused.
    while (firstFail !== null && firstFail - lastOk > step) {
      const middle = lastOk + Math.floor((firstFail - lastOk) / 2);
      if (fits(middle)) lastOk = middle;
      else firstFail = middle;
    }
  } finally {
    try {
      storage.removeItem(fillKey);
    } catch {
      // Reported through `cleaned`.
    }
  }
  let cleaned = false;
  try {
    cleaned = storage.getItem(fillKey) === null;
  } catch {
    cleaned = false;
  }
  return {
    lastOk,
    firstFail,
    error: firstFail === null ? null : error,
    hitCeiling: firstFail === null,
    ceiling,
    attempts,
    inUse,
    cleaned,
  };
}

// --- a write's cost ----------------------------------------------------------

export interface BenchRow {
  readonly chars: number;
  /** Writes asked for, and how many were made before one was refused. */
  readonly reps: number;
  readonly done: number;
  readonly totalMs: number;
  /** `totalMs / done`: the number to read where the clock is coarse. */
  readonly meanMs: number;
  /** The slowest single write, as the clock saw it. */
  readonly maxMs: number;
  readonly error: string | null;
}

/**
 * Time `reps` writes of `chars` characters at each row of `plan`, to one
 * scratch key that is removed afterwards. `textOf(chars, variant)` gives the
 * text; the two variants alternate, so no write repeats the value before it
 * (a storage may skip a write that changes nothing).
 */
export function timeWrites(
  storage: StorageLike,
  key: string,
  plan: readonly { readonly chars: number; readonly reps: number }[],
  textOf: (chars: number, variant: 0 | 1) => string,
  now: () => number,
): BenchRow[] {
  const rows: BenchRow[] = [];
  try {
    for (const { chars, reps } of plan) {
      const texts = [textOf(chars, 0), textOf(chars, 1)] as const;
      let done = 0;
      let maxMs = 0;
      let error: string | null = null;
      const began = now();
      try {
        for (let i = 0; i < reps; i++) {
          const t0 = now();
          storage.setItem(key, texts[i % 2 === 0 ? 0 : 1]);
          const ms = now() - t0;
          if (ms > maxMs) maxMs = ms;
          done++;
        }
      } catch (err) {
        error = describeError(err);
      }
      const totalMs = now() - began;
      rows.push({ chars, reps, done, totalMs, meanMs: done === 0 ? 0 : totalMs / done, maxMs, error });
    }
  } finally {
    try {
      storage.removeItem(key);
    } catch {
      // Nothing to add: the rows already say what was refused.
    }
  }
  return rows;
}

/** A text of exactly `chars` characters cut from `source` repeated, its first
 *  character set by the variant so the two differ. */
export function textFrom(source: string, chars: number, variant: 0 | 1): string {
  const base = source.length === 0 ? 'x' : source;
  const body = base.repeat(Math.ceil(chars / base.length)).slice(0, chars);
  return chars === 0 ? '' : `${variant}${body.slice(1)}`;
}

/** The smallest step the clock takes, in its own units; 0 when it never moved. */
export function timerResolution(now: () => number, samples = 20, spinLimit = 5_000_000): number {
  let best = Infinity;
  for (let i = 0; i < samples; i++) {
    const t0 = now();
    let t1 = now();
    for (let spins = 0; t1 === t0 && spins < spinLimit; spins++) t1 = now();
    if (t1 > t0 && t1 - t0 < best) best = t1 - t0;
  }
  return best === Infinity ? 0 : best;
}

// --- the game's own writes -----------------------------------------------------

/** The upper edge of each bucket, in ms; one more bucket holds the rest. A
 *  frame at 60 Hz is 16.7 ms, so the last two say whether a write cost one. */
export const TALLY_EDGES_MS = [1, 2, 4, 8, 16, 33] as const;

export interface SectionTally {
  /** Writes made, the refused ones included. */
  n: number;
  refused: number;
  totalMs: number;
  maxMs: number;
  /** Characters of the data written, last and largest. */
  lastChars: number;
  maxChars: number;
  /** Writes by duration: under each edge of `TALLY_EDGES_MS`, then the rest. */
  buckets: number[];
}

export interface TallyJson {
  /** When the first page that counted into this tally loaded, ISO. */
  since: string;
  /** Page loads counted into it. */
  loads: number;
  sections: Record<string, SectionTally>;
}

function emptySection(): SectionTally {
  return {
    n: 0,
    refused: 0,
    totalMs: 0,
    maxMs: 0,
    lastChars: 0,
    maxChars: 0,
    buckets: new Array<number>(TALLY_EDGES_MS.length + 1).fill(0),
  };
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function sectionFrom(value: unknown): SectionTally | null {
  if (typeof value !== 'object' || value === null) return null;
  const s = value as Partial<SectionTally>;
  if (![s.n, s.refused, s.totalMs, s.maxMs, s.lastChars, s.maxChars].every(isCount)) return null;
  if (!Array.isArray(s.buckets) || s.buckets.length !== TALLY_EDGES_MS.length + 1 || !s.buckets.every(isCount)) {
    return null;
  }
  return {
    n: s.n!,
    refused: s.refused!,
    totalMs: s.totalMs!,
    maxMs: s.maxMs!,
    lastChars: s.lastChars!,
    maxChars: s.maxChars!,
    buckets: [...s.buckets],
  };
}

/** The tally of every write the game made through its store, by section, kept
 *  across page loads as text. */
export class WriteTally {
  private readonly sections = new Map<string, SectionTally>();

  private constructor(
    private since: string,
    private loads: number,
  ) {}

  /** The tally in `text`, or a new one begun at `now` when `text` isn't one. */
  static from(text: string | null, now: string): WriteTally {
    if (text !== null) {
      try {
        const parsed = JSON.parse(text) as Partial<TallyJson> | null;
        if (
          parsed !== null &&
          typeof parsed === 'object' &&
          typeof parsed.since === 'string' &&
          isCount(parsed.loads) &&
          typeof parsed.sections === 'object' &&
          parsed.sections !== null
        ) {
          const tally = new WriteTally(parsed.since, parsed.loads);
          for (const [name, value] of Object.entries(parsed.sections)) {
            const section = sectionFrom(value);
            if (section !== null) tally.sections.set(name, section);
          }
          return tally;
        }
      } catch {
        // Not a tally: begin a new one.
      }
    }
    return new WriteTally(now, 0);
  }

  countLoad(): void {
    this.loads++;
  }

  record(section: string, ms: number, ok: boolean, chars: number): void {
    let s = this.sections.get(section);
    if (s === undefined) {
      s = emptySection();
      this.sections.set(section, s);
    }
    s.n++;
    if (!ok) s.refused++;
    s.totalMs += ms;
    if (ms > s.maxMs) s.maxMs = ms;
    s.lastChars = chars;
    if (chars > s.maxChars) s.maxChars = chars;
    let bucket = TALLY_EDGES_MS.findIndex((edge) => ms < edge);
    if (bucket === -1) bucket = TALLY_EDGES_MS.length;
    s.buckets[bucket] = (s.buckets[bucket] ?? 0) + 1;
  }

  toJSON(): TallyJson {
    const sections: Record<string, SectionTally> = {};
    for (const [name, s] of [...this.sections].sort(([a], [b]) => a.localeCompare(b))) {
      sections[name] = { ...s, buckets: [...s.buckets] };
    }
    return { since: this.since, loads: this.loads, sections };
  }
}
