/**
 * H7c — turn a `balance-sweep.csv` into something human eyes can scan. The CSV
 * is the machine-readable artifact (40 columns, great for a spreadsheet, rough
 * on a terminal); this renders a per-grid-point breakdown: the difficulty
 * knobs, the win-rate trio + gradient, the per-turn pool chips, and a compact
 * per-archetype table (only the archetypes that actually did something, so the
 * perpetual rogue/mage/catapult zeros don't bury the signal).
 *
 * It parses by COLUMN NAME (not position) and tolerates missing columns, so it
 * renders an older CSV (e.g. one written before `dmgTaken` existed) just as
 * happily as a fresh one — a missing field shows as `—`.
 *
 * Wired two ways (cli.ts): every `--balance-sweep` writes `balance-sweep.report.txt`
 * beside the CSV, and `--report=<csv>` re-renders any existing CSV on demand.
 */

import { ALL_ARCHETYPES } from '../../src/sim/archetypes';
import type { Archetype } from '../../src/sim/archetypes';

/** The per-archetype fields the report knows how to pull, by CSV suffix. */
const ARCH_FIELDS = ['dmg', 'dmgTaken', 'deathsPerRun', 'heal', 'xp', 'final'] as const;
type ArchField = (typeof ARCH_FIELDS)[number];

const FIXED_METRICS = [
  'bestTrainWin',
  'bestTestWin',
  'pureRandomWin',
  'greedyWin',
  'gradient',
  'meanChipPlayer',
  'meanChipEnemy',
] as const;
type FixedMetric = (typeof FIXED_METRICS)[number];

export interface ParsedRow {
  knobs: Record<string, string>;
  metrics: Partial<Record<FixedMetric, number>>;
  archetypes: Record<Archetype, Partial<Record<ArchField, number>>>;
}

export interface ParsedSweep {
  knobPaths: string[];
  rows: ParsedRow[];
}

/**
 * Parse a balance-sweep CSV. Knob columns are everything left of `bestTrainWin`;
 * the rest are looked up by name. Throws only if the header is unrecognizable
 * (no `bestTrainWin` column) — otherwise missing cells are simply absent.
 */
export function parseSweepCsv(csvText: string): ParsedSweep {
  const lines = csvText.trim().split('\n').filter((l) => l.length > 0);
  if (lines.length < 1) throw new Error('sweep report: empty CSV');
  const header = lines[0]!.split(',');
  const splitAt = header.indexOf('bestTrainWin');
  if (splitAt < 0) throw new Error('sweep report: CSV header has no bestTrainWin column');
  const knobPaths = header.slice(0, splitAt);
  const colIndex = new Map(header.map((h, i) => [h, i]));

  const rows: ParsedRow[] = lines.slice(1).map((line) => {
    const cells = line.split(',');
    const num = (col: string): number | undefined => {
      const i = colIndex.get(col);
      if (i === undefined) return undefined;
      const v = Number(cells[i]);
      return Number.isFinite(v) ? v : undefined;
    };
    const knobs: Record<string, string> = {};
    for (const path of knobPaths) knobs[path] = cells[colIndex.get(path)!] ?? '';
    const metrics: Partial<Record<FixedMetric, number>> = {};
    for (const m of FIXED_METRICS) {
      const v = num(m);
      if (v !== undefined) metrics[m] = v;
    }
    const archetypes = Object.fromEntries(
      ALL_ARCHETYPES.map((a) => {
        const fields: Partial<Record<ArchField, number>> = {};
        for (const f of ARCH_FIELDS) {
          const v = num(`${a}_${f}`);
          if (v !== undefined) fields[f] = v;
        }
        return [a, fields];
      }),
    ) as Record<Archetype, Partial<Record<ArchField, number>>>;
    return { knobs, metrics, archetypes };
  });

  return { knobPaths, rows };
}

// ── number formatting ─────────────────────────────────────────────────────────

/** Compact magnitude: 60918 → "60.9k", 1_250_000 → "1.25M", 96 → "96". */
function humanK(n: number | undefined): string {
  if (n === undefined) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

const pct = (x: number | undefined): string => (x === undefined ? '—' : `${Math.round(x * 100)}%`);
const f1 = (x: number | undefined): string => (x === undefined ? '—' : x.toFixed(1));
const f2 = (x: number | undefined): string => (x === undefined ? '—' : x.toFixed(2));
const int = (x: number | undefined): string => (x === undefined ? '—' : String(Math.round(x)));

// ── rendering ─────────────────────────────────────────────────────────────────

function renderArchTable(row: ParsedRow): string[] {
  // Only archetypes that actually did something — skip perpetual zeros.
  const active = ALL_ARCHETYPES.filter((a) => {
    const t = row.archetypes[a];
    return (t.dmg ?? 0) > 0 || (t.final ?? 0) > 0 || (t.heal ?? 0) > 0;
  });
  const inactive = ALL_ARCHETYPES.filter((a) => !active.includes(a));

  const headers = ['archetype', 'dmgDealt', 'dmgTaken', 'deaths/run', 'heal', 'xp', 'final'];
  const cells = (a: Archetype): string[] => {
    const t = row.archetypes[a];
    return [a, humanK(t.dmg), humanK(t.dmgTaken), f1(t.deathsPerRun), humanK(t.heal), humanK(t.xp), int(t.final)];
  };
  const body = active.map(cells);
  const widths = headers.map((h, i) => Math.max(h.length, ...body.map((r) => r[i]!.length)));
  const fmt = (r: string[]): string =>
    '  ' + r.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');

  const lines = [fmt(headers), ...body.map(fmt)];
  if (inactive.length > 0) lines.push(`  (inactive: ${inactive.join(', ')})`);
  return lines;
}

/** Render a parsed sweep as a per-point human-readable report. */
export function renderSweepReport(parsed: ParsedSweep): string {
  const out: string[] = [];
  out.push(`Balance sweep — ${parsed.rows.length} grid point(s)`);
  out.push(`knobs: ${parsed.knobPaths.join(', ')}`);
  out.push('');

  for (const row of parsed.rows) {
    const knobStr = parsed.knobPaths.map((p) => `${p}=${row.knobs[p]}`).join('   ');
    out.push(`━━━ ${knobStr} ━━━`);
    const m = row.metrics;
    out.push(
      `  best-achievable ${pct(m.bestTrainWin).padStart(4)}` +
        `   (held-out test ${pct(m.bestTestWin)} · random ${pct(m.pureRandomWin)} · greedy ${pct(m.greedyWin)})`,
    );
    if (m.gradient !== undefined) {
      out.push(`  skill gradient  +${Math.round(m.gradient * 100)}pt   (best − best baseline)`);
    }
    out.push(`  pool chip/turn  player ${f2(m.meanChipPlayer)} · enemy ${f2(m.meanChipEnemy)}`);
    out.push('');
    out.push(...renderArchTable(row));
    out.push('');
  }
  return out.join('\n') + '\n';
}

/** Parse + render in one call (CSV text → report text). */
export function reportFromCsv(csvText: string): string {
  return renderSweepReport(parseSweepCsv(csvText));
}
