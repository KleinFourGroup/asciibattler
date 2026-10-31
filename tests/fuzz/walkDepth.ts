/**
 * 85h — the ONE home for run walk-depth comparisons (gotcha #127; the
 * gotcha-#120 class). A run's walk position is LEXICOGRAPHIC
 * (sectorsCleared, finalHop): finalHop RESETS per sector, so any
 * filter/sort/compare on bare finalHop is wrong on walk shapes — it
 * counts a late act-1 death (hop ≥ the act-2 terminal's number) as
 * at-or-past the act-2 terminal (the §68g false wall; the 85f reader
 * repeated the shape as the class's THIRD instance). Single-sector
 * shapes degrade cleanly (sector ≡ 0, the compare reduces to bare
 * hop). Readers — scratch probes included — import these instead of
 * hand-rolling the comparison; a bare `finalHop >=` in any depth read
 * is the tell.
 */

export interface WalkPos {
  /** `sectorsCleared` — the major key. */
  readonly sector: number;
  /** The hop WITHIN that sector (`finalHop` / `finalHopReached` / `b.hop`). */
  readonly hop: number;
}

/** Lexicographic compare: <0 = `a` shallower than `b`, 0 = equal, >0 = deeper. */
export function compareWalkPos(a: WalkPos, b: WalkPos): number {
  return a.sector - b.sector || a.hop - b.hop;
}

/** Did a run at `pos` reach at-or-past `target`? (The arrivals /
 *  runsReached filter — the shape #120's contamination corrupted.) */
export function atOrBeyondWalkPos(pos: WalkPos, target: WalkPos): boolean {
  return compareWalkPos(pos, target) >= 0;
}

/** 143a — a run's walk position at its end, in the frame its battles'
 *  `sector` uses: a run started at act N counts its sectors from N − 1, so
 *  its bare `sectorsCleared` (the transitions it made) is not comparable
 *  with a battle's label. Readers comparing a run against a (sector, hop)
 *  bucket take the position from here. */
export function runWalkPos(r: {
  readonly startAct: number;
  readonly sectorsCleared: number;
  readonly finalHopReached: number;
}): WalkPos {
  return { sector: r.startAct - 1 + r.sectorsCleared, hop: r.finalHopReached };
}
