/**
 * 105c — the POSED SET: 105b's posed row, generalized. Whatever pose the dial
 * names (fixtures.ts `placePose` — the row, 105a's three clumps, the edge
 * units, the fake flyer) is stood on the live board as RENDER-ONLY sprites:
 * dev sprites through the public `SpriteRenderer.addSprite`, and REAL overlay
 * stacks through `UnitOverlayLayer.add` — the production bar DOM and CSS, so
 * the bar-line read is honest. No sim unit exists for any of them: they cannot
 * be clicked, targeted or walked around (a live unit walks THROUGH them — read
 * a pose on a parked board). That is the charter's "render-only explorer", and
 * it is why a fixture can never disturb the seeded fight it stands in.
 *
 * WHERE things stand is fixtures.ts (pure, tested); this file only asks the
 * live board which tiles are clear and puts sprites on the answer.
 *
 * The FLYER is the one member that moves per frame: its sprite rides the
 * `lift` dial along CAMERA-up (`aboveAnchor` — so it stays "straight up the
 * screen" under whatever camera 105d dials in), its bar rides above that, and
 * its ground point keeps the shadow + the cue, which is the whole read: the
 * glyph lands over the unit behind it and only the ground says which tile.
 */

import * as THREE from 'three';
import { aboveAnchor } from '../../render/anchor';
import { gridToWorld } from '../../render/BattleRenderer';
import { spriteColorForUnit } from '../../render/spriteColor';
import type { SpriteHandle } from '../../render/SpriteRenderer';
import type { UnitOverlayHandle } from '../../render/UnitOverlayLayer';
import type { FontAtlas } from '../../render/FontAtlas';
import { footprintOf } from '../../sim/occupancy';
import { placePose, type PoseId, type PosedSpec } from './fixtures';
import type { GameInternals, LiveBattle } from './seams';
import { barLift, type DialState } from './state';

export interface PosedMember {
  readonly spec: PosedSpec;
  readonly cell: { readonly x: number; readonly y: number };
  readonly ground: THREE.Vector3;
  readonly flies: boolean;
  readonly sprite: SpriteHandle;
  readonly overlay: UnitOverlayHandle;
}

export class PosedSet {
  private members: PosedMember[] = [];
  /** 105e — the scale the members' quads were last sized to (a fresh build
   *  starts at 1, the atlas default). */
  private sizedAt = 1;
  private readonly scratch = new THREE.Vector3();
  private readonly lifted = new THREE.Vector3();
  /** Where the pose landed (one line per group), for the panel's readout. */
  where: string | null = null;

  constructor(
    private readonly internals: GameInternals,
    private readonly atlas: FontAtlas,
  ) {}

  get live(): readonly PosedMember[] {
    return this.members;
  }

  build(battle: LiveBattle, pose: PoseId): void {
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
    const notes: string[] = [];
    const { placements, notes: landed } = placePose(pose, {
      gridW: world.gridW,
      gridH: world.gridH,
      isClear: (x, y) => {
        const cell = { x, y };
        return (
          world.tileGrid.defAt(cell).passable &&
          !world.tileGrid.kindAt(cell).includes('water') &&
          !taken.has(`${x},${y}`)
        );
      },
    });
    notes.push(...landed);
    const { sprites, overlays, terrain } = this.internals;
    for (const { spec, cell, flies } of placements) {
      if (!this.inAtlas(spec.glyph)) {
        notes.push(`'${spec.glyph}' is not in the atlas - skipped`);
        continue;
      }
      const ground = gridToWorld(cell, world.gridW, world.gridH);
      ground.y = terrain.heightAt(cell.x, cell.y, world.tileGrid.kindAt(cell));
      const sprite = sprites.addSprite(spec.glyph, spriteColorForUnit(spec), ground, 'base');
      if (spec.team === 'neutral') sprites.updateSprite(sprite, { bloomIntensity: 0 });
      const overlay = spec.destructible
        ? overlays.addDestructible(1)
        : overlays.add(spec.team, 1, 1);
      overlays.updateHp(overlay, spec.hp);
      this.members.push({ spec, cell, ground, flies, sprite, overlay });
    }
    this.where = notes.join('\n');
  }

  /** `getGlyphUV` throws on a glyph outside the 48-cell atlas — a pose names
   *  glyphs by hand, so it asks first and says what it skipped. */
  private inAtlas(glyph: string): boolean {
    try {
      this.atlas.getGlyphUV(glyph);
      return true;
    } catch {
      return false;
    }
  }

  /** Per frame: the bars follow the SAME rule the live units' bars do, and the
   *  flyer follows the lift dial along the CURRENT camera's up. 105e: a posed
   *  body is a unit body, so it wears the glyph scale too — `inkTopLiftAtSize1`
   *  is the atlas's lift BEFORE seams.ts's scale patch (`barLift`'s contract). */
  sync(dials: DialState, inkTopLiftAtSize1: (glyph: string) => number): void {
    const { sprites, overlays, renderer } = this.internals;
    if (this.sizedAt !== dials.scale) {
      this.sizedAt = dials.scale;
      for (const m of this.members) sprites.updateSprite(m.sprite, { size: dials.scale });
    }
    for (const m of this.members) {
      const lift =
        barLift(dials, inkTopLiftAtSize1(m.spec.glyph), this.atlas.baseAnchorY(m.spec.glyph)) *
        dials.scale;
      const rise = m.flies ? dials.lift : 0;
      if (m.flies) {
        sprites.updateSprite(m.sprite, {
          position: aboveAnchor(m.ground, rise, renderer.camera, this.lifted),
        });
      }
      overlays.updatePosition(
        m.overlay,
        aboveAnchor(m.ground, rise + lift, renderer.camera, this.scratch),
      );
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
    this.sizedAt = 1;
    this.where = null;
  }
}
