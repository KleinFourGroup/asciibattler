/**
 * 105b — the POSED ROW `g ▄ ╥ M a r`: the six glyphs the H1 read is judged
 * on, side by side on one row of tiles — a descender (`g`), the two
 * floor-family blocks (`▄` `╥`), a cap-height letter (`M`) and two x-height
 * ones (`a` `r`). That is the whole range of both rules under test: the
 * stand line (two anchor classes, 4/64 of a cell apart) and the bar line (ink
 * tops 0.58 → 0.89 of a cell).
 *
 * RENDER-ONLY: dev sprites through the public `SpriteRenderer.addSprite`, and
 * REAL overlay stacks through `UnitOverlayLayer.add` — the production bar DOM
 * and CSS, so the bar-line read is honest. No sim unit exists for any of
 * them; they cannot be clicked, targeted or walked around (a live unit will
 * walk THROUGH the row — pose it during the countdown or a pause). 105c's
 * fixture loader supersedes this with real parked units.
 *
 * The row lands on the first run of six clear, DRY, passable tiles, scanning
 * from the board's middle row toward the camera first (a near row is the
 * biggest on screen — the anchor read is a 4-atlas-pixel question), then away.
 */

import * as THREE from 'three';
import { aboveAnchor } from '../../render/anchor';
import { gridToWorld } from '../../render/BattleRenderer';
import { spriteColorForUnit } from '../../render/spriteColor';
import type { SpriteHandle } from '../../render/SpriteRenderer';
import type { UnitOverlayHandle } from '../../render/UnitOverlayLayer';
import { footprintOf } from '../../sim/occupancy';
import type { Team } from '../../sim/Unit';
import type { CueSubject } from './groundCue';
import type { GameInternals, LiveBattle } from './seams';
import type { FontAtlas } from '../../render/FontAtlas';
import { barLift, type DialState } from './state';

interface PosedSpec extends CueSubject {
  readonly glyph: string;
  readonly team: Team;
  /** HP shown on the bar — below 1 so a destructible's bar un-hides. */
  readonly hp: number;
  readonly destructible: boolean;
}

/** Sides alternate so the cue's shapes sit next to each other in the row. */
export const POSED_ROW: readonly PosedSpec[] = [
  { glyph: 'g', team: 'enemy', archetype: 'ghoul', campId: null, hp: 0.7, destructible: false },
  { glyph: '▄', team: 'neutral', archetype: 'rubble_1x1', campId: null, hp: 0.6, destructible: true },
  {
    glyph: '╥',
    team: 'neutral',
    archetype: 'half_cover_destructible',
    campId: null,
    hp: 0.6,
    destructible: true,
  },
  { glyph: 'M', team: 'player', archetype: 'mercenary', campId: null, hp: 0.7, destructible: false },
  { glyph: 'a', team: 'player', archetype: 'archer', campId: null, hp: 0.7, destructible: false },
  { glyph: 'r', team: 'enemy', archetype: 'rogue', campId: null, hp: 0.7, destructible: false },
];

export interface PosedMember {
  readonly spec: PosedSpec;
  readonly ground: THREE.Vector3;
  readonly sprite: SpriteHandle;
  readonly overlay: UnitOverlayHandle;
}

/** The first x of a run of `length` clear dry tiles on row `y`, or -1. */
function clearRunOnRow(battle: LiveBattle, y: number, length: number, taken: Set<string>): number {
  const { world } = battle;
  const start = Math.max(0, Math.floor((world.gridW - length) / 2));
  // Try the centred window first, then slide outward from it.
  for (let offset = 0; offset <= world.gridW; offset++) {
    for (const x0 of offset === 0 ? [start] : [start - offset, start + offset]) {
      if (x0 < 0 || x0 + length > world.gridW) continue;
      let clear = true;
      for (let i = 0; i < length && clear; i++) {
        const cell = { x: x0 + i, y };
        const kind = world.tileGrid.kindAt(cell);
        clear =
          world.tileGrid.defAt(cell).passable &&
          !kind.includes('water') &&
          !taken.has(`${cell.x},${cell.y}`);
      }
      if (clear) return x0;
    }
  }
  return -1;
}

export class PosedRow {
  private members: PosedMember[] = [];
  private readonly scratch = new THREE.Vector3();
  /** Where the row landed, for the panel's readout. */
  where: string | null = null;

  constructor(
    private readonly internals: GameInternals,
    private readonly atlas: FontAtlas,
  ) {}

  get live(): readonly PosedMember[] {
    return this.members;
  }

  build(battle: LiveBattle): void {
    this.clear();
    const { world } = battle;
    const taken = new Set<string>();
    for (const unit of world.units) {
      if (unit.currentHp <= 0) continue;
      const n = footprintOf(unit);
      for (let dx = 0; dx < n; dx++) {
        for (let dy = 0; dy < n; dy++) taken.add(`${unit.position.x + dx},${unit.position.y + dy}`);
      }
    }
    // Grid y = 0 is the camera-NEAR row (gridToWorld): mid → 0, then mid+1 → far.
    const mid = Math.floor(world.gridH / 2);
    const rows: number[] = [];
    for (let y = mid; y >= 0; y--) rows.push(y);
    for (let y = mid + 1; y < world.gridH; y++) rows.push(y);
    for (const y of rows) {
      const x0 = clearRunOnRow(battle, y, POSED_ROW.length, taken);
      if (x0 < 0) continue;
      this.spawn(battle, x0, y);
      this.where = `row y=${y}, x=${x0}..${x0 + POSED_ROW.length - 1}`;
      return;
    }
    this.where = 'no clear run of six dry tiles on this board';
  }

  private spawn(battle: LiveBattle, x0: number, y: number): void {
    const { sprites, overlays, terrain } = this.internals;
    const { world } = battle;
    POSED_ROW.forEach((spec, i) => {
      const cell = { x: x0 + i, y };
      const ground = gridToWorld(cell, world.gridW, world.gridH);
      ground.y = terrain.heightAt(cell.x, cell.y, world.tileGrid.kindAt(cell));
      const sprite = sprites.addSprite(spec.glyph, spriteColorForUnit(spec), ground, 'base');
      if (spec.team === 'neutral') sprites.updateSprite(sprite, { bloomIntensity: 0 });
      const overlay = spec.destructible ? overlays.addDestructible(1) : overlays.add(spec.team, 1, 1);
      overlays.updateHp(overlay, spec.hp);
      this.members.push({ spec, ground, sprite, overlay });
    });
  }

  /** Per frame: the bars follow the SAME rule the live units' bars do. */
  sync(dials: DialState): void {
    const { overlays, renderer } = this.internals;
    for (const m of this.members) {
      const lift = barLift(
        dials,
        this.atlas.inkTopLift(m.spec.glyph),
        this.atlas.baseAnchorY(m.spec.glyph),
      );
      overlays.updatePosition(m.overlay, aboveAnchor(m.ground, lift, renderer.camera, this.scratch));
    }
  }

  /** Idempotent — safe after the battle's own `overlays.clear()`. */
  clear(): void {
    const { sprites, overlays } = this.internals;
    for (const m of this.members) {
      sprites.removeSprite(m.sprite);
      overlays.remove(m.overlay);
    }
    this.members = [];
    this.where = null;
  }
}
