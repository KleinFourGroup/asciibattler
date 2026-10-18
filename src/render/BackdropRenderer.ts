import * as THREE from 'three';
import { COLORS } from './palette';
import { BOTTOM_Y } from './TerrainRenderer';
import VERTEX_SHADER from './shaders/void.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/void.frag.glsl?raw';
import FOG_GLSL from './shaders/fogcolor.glsl?raw';

/**
 * The mist floor: a large dark plane at the prisms' bottom running the shared
 * `fogColorAt` noise (fogcolor.glsl), so the void around the board reads as a
 * slow dark roil rather than a flat colour. The apron's fog fades toward the
 * same function sampled along the view ray, so a fully fogged apron pixel
 * matches the mist behind it, and the board dissolves into the mist with no
 * seam.
 *
 * The noise calms to nothing with distance from the origin (MIST_CALM_FAR
 * in fogcolor.glsl), converging on the flat scene background, so the plane's
 * edge doesn't show, and an ultrawide ray that overshoots its horizon lands
 * on a matching flat colour.
 *
 * Page-lifetime scenery: independent of the battle (centred on the origin,
 * of fixed size), so Game adds it once and it has no `setTiles` or `clear`.
 * Every other scene's screen covers the canvas in opaque black once it has
 * faded in (src/ui/ui.css), so the floor shows only behind a battle. On
 * layer 0 only, never in the bloom pass; not a pick surface.
 */

/** Half-extent in world units: well past MIST_CALM_FAR (90), where the mist
 *  has calmed to the flat background. */
const BACKDROP_HALF = 300;

export class BackdropRenderer {
  readonly mesh: THREE.Mesh;

  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.ShaderMaterial;

  constructor() {
    this.geometry = new THREE.PlaneGeometry(BACKDROP_HALF * 2, BACKDROP_HALF * 2);
    this.geometry.rotateX(-Math.PI / 2); // face +Y
    this.geometry.translate(0, BOTTOM_Y, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FOG_GLSL + FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color(COLORS.TERMINAL_BLACK) },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  /** As the terrain's and the apron's `advanceTime`, for the mist's drift;
   *  BattleScene calls the three together. */
  advanceTime(dt: number): void {
    const u = this.material.uniforms['uTime']!;
    u.value = (u.value as number) + dt;
  }
}
