/**
 * 84e — the measured-terminal-prior TABLE (round-6-spec §"The measurement
 * design" / §"The fold"): per acquirable item, the paired LONG-HORIZON
 * margin of holding it, built from the §84 shadow instrument's
 * decisions.csv rows and committed with provenance. §85's `priorBonus`
 * reads `meanDelta` UNSCALED over the holdings delta (the 2026-08-24
 * shape-lock, WORKLOG §85: the spec's linear × hopsRemaining is
 * superseded — hops-linearity NO, twice-measured, and the linear shape
 * breaches the death ordinal at h≈20); `valuePerHop` stays a READER
 * column (the hops-shape diagnostic), never a fold input. §88's rarity
 * read consumes the `unit:*` rows.
 *
 * What goes in: ONLY long-horizon rows (`horizon !== ''` — the within-
 * horizon margin is a different quantity, never pooled) from the
 * acquisition sites, each with its POLARITY made explicit so every table
 * value reads "holding this is worth +X pool HP per hop ahead":
 *
 *   rewardDaemon  challenger = DECLINE the daemon  → value = −Δ
 *   portBuy       challenger = BUY the slot        → value = +Δ  (λ_bits is
 *                 0 in the score, so the price paid is NOT netted — the
 *                 table is a holding value; pricing is §88's read)
 *   recruit       challenger = TAKE the slot       → value = +Δ
 *   eventChoice   per-CHOICE rows, not items       → excluded (the ε read's
 *                 data, not the prior's)
 *
 * Item keys merge across sites (a daemon offered at a port and as a
 * reward is ONE item): `daemon:<id>` · `packet:<id>` · `unit:<archetype>`
 * (level = instance noise, stripped). Cross-site merges are n-weighted.
 * `signable` = n ≥ the per-item floor (BALANCE doctrine); rows under it
 * ride the table as DIRECTIONAL and name §88's targeted-grant list.
 */

import {
  PER_ITEM_N_FLOOR,
  perItemDecisionStats,
  type DecisionRow,
  type ItemDecisionStats,
} from '../reporters';

export interface PriorSiteContribution {
  readonly n: number;
  /** 85a — the hops-bearing subset the site's valuePerHop was computed
   *  over (≤ n); per-hop merges weight by this, never by n. */
  readonly nPerHop: number;
  /** Signed holding value per remaining hop from this site alone. */
  readonly valuePerHop: number;
  readonly meanDelta: number;
}

export interface PriorRow {
  /** Signed holding value, pool HP per remaining hop — a READER column
   *  (the hops-shape diagnostic); the fold reads `meanDelta` (85a). */
  readonly valuePerHop: number;
  /** The raw signed long-horizon margin of HOLDING the item (pool HP) —
   *  the §85 fold input (unscaled; the 2026-08-24 shape-lock). */
  readonly meanDelta: number;
  readonly n: number;
  readonly signable: boolean;
  readonly sites: Readonly<Record<string, PriorSiteContribution>>;
}

export interface PriorProvenance {
  /** `git rev-parse --short HEAD` at build time — the ONE HEAD the rows
   *  were measured at (the instrument batch + the sidecars it read). */
  readonly head: string;
  readonly builtAt: string;
  /** The batch dirs swept (one line each, as given). */
  readonly sources: readonly string[];
  readonly note?: string;
}

export interface PriorTable {
  readonly provenance: PriorProvenance;
  readonly floor: number;
  /** Long-horizon DECISIONS the rows were pooled from (not instances). */
  readonly decisions: number;
  readonly items: Readonly<Record<string, PriorRow>>;
}

/** The site → (sign, item-key) rule. null = the site feeds no item. */
export function priorItemOf(site: string, item: string): { key: string; sign: 1 | -1 } | null {
  let m: RegExpExecArray | null;
  if (site === 'rewardDaemon') return { key: item, sign: -1 };
  if (site === 'portBuy') {
    if ((m = /^(unit:[^:]+):L\d+$/.exec(item))) return { key: m[1]!, sign: 1 };
    return { key: item, sign: 1 };
  }
  if (site === 'recruit') return { key: item, sign: 1 };
  return null;
}

/** Build the table from parsed sidecar rows (any mix of horizons/sites —
 *  the filter is here). Pure; the CLI supplies provenance. */
export function buildPriorTable(
  rows: readonly DecisionRow[],
  provenance: PriorProvenance,
  floor: number = PER_ITEM_N_FLOOR,
): PriorTable {
  const long = rows.filter((r) => r.horizon !== '');
  const decisions = new Set(
    long.filter((r) => r.candidate === 0).map((r) => `${r.seed}|${r.strategy}|${r.decision}`),
  ).size;
  const stats: ItemDecisionStats[] = perItemDecisionStats(long);
  const acc = new Map<
    string,
    { n: number; deltaSum: number; perHopSum: number; perHopN: number; sites: Record<string, PriorSiteContribution> }
  >();
  for (const s of stats) {
    const mapped = priorItemOf(s.site, s.item);
    if (mapped === null || s.n === 0) continue;
    const { key, sign } = mapped;
    let a = acc.get(key);
    if (!a) {
      a = { n: 0, deltaSum: 0, perHopSum: 0, perHopN: 0, sites: {} };
      acc.set(key, a);
    }
    const meanDelta = sign * s.meanDelta;
    const valuePerHop = s.meanDeltaPerHop === null ? null : sign * s.meanDeltaPerHop;
    a.n += s.n;
    a.deltaSum += meanDelta * s.n;
    // 85a (finding 9): per-hop means merge weighted by the hops-bearing
    // subset they were computed over — weighting by the full row n skews
    // toward buckets with thin hop coverage.
    if (valuePerHop !== null) {
      a.perHopSum += valuePerHop * s.nPerHop;
      a.perHopN += s.nPerHop;
    }
    // One site may carry the same key under two labels (portBuy unit levels)
    // — merge those too.
    const prev = a.sites[s.site];
    const siteN = (prev?.n ?? 0) + s.n;
    const sitePerHopN = (prev?.nPerHop ?? 0) + (valuePerHop === null ? 0 : s.nPerHop);
    a.sites[s.site] = {
      n: siteN,
      nPerHop: sitePerHopN,
      valuePerHop:
        valuePerHop === null || sitePerHopN === 0
          ? (prev?.valuePerHop ?? 0)
          : ((prev?.valuePerHop ?? 0) * (prev?.nPerHop ?? 0) + valuePerHop * s.nPerHop) /
            sitePerHopN,
      meanDelta: ((prev?.meanDelta ?? 0) * (prev?.n ?? 0) + meanDelta * s.n) / siteN,
    };
  }
  const items: Record<string, PriorRow> = {};
  for (const [key, a] of [...acc.entries()].sort(([x], [y]) => x.localeCompare(y))) {
    items[key] = {
      valuePerHop: a.perHopN === 0 ? 0 : a.perHopSum / a.perHopN,
      meanDelta: a.deltaSum / a.n,
      n: a.n,
      signable: a.n >= floor,
      sites: a.sites,
    };
  }
  return { provenance, floor, decisions, items };
}

/** The stdout summary: signable rows first, then the directional tail
 *  (the §88 targeted-grant list). */
export function renderPriorTable(table: PriorTable): string {
  const lines: string[] = [];
  const entries = Object.entries(table.items);
  const signable = entries.filter(([, r]) => r.signable);
  const thin = entries.filter(([, r]) => !r.signable);
  lines.push(
    `### Prior table — ${entries.length} items from ${table.decisions} long-horizon decisions ` +
      `(HEAD ${table.provenance.head}, floor n=${table.floor})`,
  );
  lines.push(
    'meanΔ = signed long-horizon holding margin, pool HP — the §85 fold input (unscaled); ' +
      'value/hop = the hops-shape diagnostic (reader column)',
  );
  lines.push('');
  const row = ([key, r]: [string, PriorRow]): string =>
    `${key.padEnd(28)} n=${String(r.n).padStart(5)}${r.signable ? ' ' : '·'}  value/hop=${r.valuePerHop.toFixed(3).padStart(8)}  meanΔ=${r.meanDelta.toFixed(2).padStart(7)}  sites=${Object.keys(r.sites).join('+')}`;
  lines.push(`Signable (${signable.length}):`);
  for (const e of signable) lines.push('  ' + row(e));
  lines.push(`Directional — under the floor (${thin.length}; the §88 targeted-grant list):`);
  for (const e of thin) lines.push('  ' + row(e));
  return lines.join('\n') + '\n';
}
