import * as THREE from 'three';
import { COLORS } from './palette';
import { BOTTOM_Y } from './TerrainRenderer';
import VERTEX_SHADER from './shaders/void.vert.glsl?raw';
import FRAGMENT_SHADER from './shaders/void.frag.glsl?raw';
import FOG_GLSL from './shaders/fogcolor.glsl?raw';

/**
 * M4 playtest — the mist floor. A large dark plane at the prisms' bottom Y
 * running the shared `fogColorAt` noise (fogcolor.glsl), so the void
 * around the board reads as a slow dark roil instead of flat terminal
 * gray. The apron's fog fades toward this exact function sampled along
 * the view ray, so a fully-fogged apron pixel is indistinguishable from
 * the mist behind it — the board dissolves INTO the mist, no seam.
 *
 * The noise amplitude calms to zero with distance from the origin
 * (MIST_CALM_FAR in fogcolor.glsl), converging on the flat scene
 * background — so the plane's literal edge is invisible, and even an
 * ultrawide-aspect ray that overshoots the plane's horizon lands on a
 * matching flat color.
 *
 * Page-lifetime scenery: encounter-independent (origin-centered, fixed
 * size), so Game adds it once and there's no setTiles/clear — non-battle
 * scenes fully mask the canvas with opaque DOM (the G2 rule), so it's
 * only ever seen behind a live battle. Layer 0 only — never in the bloom
 * pass; not a pick surface.
 */

/** Half-extent in world units. The worst-case fit framing (32×32 board,
 *  45° pitch, 50° FOV) sees ~125 units of plane; 300 covers it with
 *  margin while the noise has long since calmed to the flat background. */
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

  /** Same uTime accumulation as Terrain/ApronRenderer — drives the mist
   *  drift. BattleScene calls it alongside the other two. */
  advanceTime(dt: number): void {
    const u = this.material.uniforms['uTime']!;
    u.value = (u.value as number) + dt;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
