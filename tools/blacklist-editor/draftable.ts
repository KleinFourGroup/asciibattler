/**
 * 63g — the Global Blacklist Editor's pure edit surface. The editor is a UI
 * over the `draftable` flags in `config/units.json` (the kickoff lock: NO new
 * config file — `draftable: false` IS the global blacklist; the 63a-post
 * verdict keeps the flag because it also marks the STRUCTURAL exclusions,
 * summon-only/enemy-only units that sit outside the whole draft system).
 *
 * Node-safe (types + the units config module only) so the toggle → format
 * round-trip is unit-testable (tests/tools/blacklist-editor.test.ts) against
 * the archetype-editor formatter it shares. The parsed catalog always carries
 * `draftable` / `rarity` (schema defaults true / 'common'), so toggles are
 * plain boolean writes and a format→reparse round-trips deep-equal — the
 * formatter emits `draftable` only when false, keeping the file diff exactly
 * the exclusion set.
 */

import {
  isNeutralUnitDef,
  type CombatantUnitDef,
  type UnitDefsConfig,
  type UnitRarity,
} from '../../src/config/units';

/** Combatant entry ids in catalog (file) order — the neutral fold (walls /
 *  half-cover / rubble) has no draft concept and never appears here. */
export function combatantIds(config: UnitDefsConfig): string[] {
  return Object.keys(config).filter((id) => !isNeutralUnitDef(config[id]!));
}

/** The global draft pool under this working config: every combatant whose
 *  `draftable` flag is not false, in catalog order. */
export function draftableIds(config: UnitDefsConfig): string[] {
  return combatantIds(config).filter(
    (id) => (config[id] as CombatantUnitDef).draftable !== false,
  );
}

/** Flip one combatant's `draftable` flag in place. A neutral or unknown id
 *  is a caller bug — loud, not a silent no-op. */
export function setDraftable(config: UnitDefsConfig, id: string, draftable: boolean): void {
  const def = config[id];
  if (def === undefined || isNeutralUnitDef(def)) {
    throw new Error(`setDraftable: '${id}' is not a combatant archetype`);
  }
  def.draftable = draftable;
}

/** The draftable pool split by rarity tier (rarity defaults common), catalog
 *  order within each tier — the same grouping `DRAFTABLE_BY_TIER` derives
 *  from the LIVE catalog, computed here over the WORKING one so the preview
 *  tracks unsaved toggles. */
export function poolsByTier(config: UnitDefsConfig): Record<UnitRarity, string[]> {
  const pools: Record<UnitRarity, string[]> = {
    common: [],
    uncommon: [],
    rare: [],
    legendary: [],
  };
  for (const id of draftableIds(config)) {
    pools[(config[id] as CombatantUnitDef).rarity ?? 'common'].push(id);
  }
  return pools;
}
