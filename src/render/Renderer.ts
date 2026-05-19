import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { COLORS } from './palette';
import {
  createBloomMixPass,
  createBloomPass,
  createSatClampedPass,
  createScanlinePass,
} from './PostProcess';
import { BLOOM_LAYER } from './SpriteRenderer';
import { GRID_SIZE } from '../config';

/** Camera pitch from horizontal. 45° down matches the diorama framing. */
const CAMERA_PITCH_RAD = Math.PI / 4;

/**
 * Half-extents of the volume the camera must always keep fully visible.
 * X/Z cover the grid plus a small padding so the terrain edge has breathing
 * room; Y covers ground (y=0) up through the sprite layer (y=~1) with a
 * little headroom.
 */
const FIT_HALF_EXTENTS = { x: GRID_SIZE / 2 + 0.5, y: 1.0, z: GRID_SIZE / 2 + 0.5 };

/** Distance multiplier on top of the analytic fit so nothing hugs the frame edge. */
const FIT_MARGIN = 1.05;

/**
 * Wraps `WebGLRenderer` + `EffectComposer` and owns the requestAnimationFrame
 * loop. The scene, camera, and clear color live here so gameplay code never
 * reaches into three.js directly.
 *
 * Camera is locked to a fixed pitch (CAMERA_PITCH_RAD) and fits the arena
 * AABB to the viewport on every resize — distance adapts to aspect so the
 * grid never clips off frame.
 */
export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly webgl: THREE.WebGLRenderer;

  // B1.1 selective bloom: two composers driven off the same scene+camera
  // via layer membership. `bloomComposer` renders only BLOOM_LAYER (the
  // SpriteRenderer's bloomMesh) and blurs the result; `mainComposer`
  // renders the visible scene (layer 0) and additively mixes the bloom
  // output back in. Decoupling means sprite-level bloomIntensity controls
  // halo strength without ever darkening the visible sprite.
  private readonly bloomComposer: EffectComposer;
  private readonly mainComposer: EffectComposer;
  private readonly bloomMixPass: ShaderPass;
  private readonly sceneBackground: THREE.Color;

  private readonly onFrame: (dtSeconds: number) => void;

  private rafId: number | null = null;
  private lastFrameMs = 0;

  constructor(canvas: HTMLCanvasElement, onFrame: (dtSeconds: number) => void) {
    this.onFrame = onFrame;
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.webgl.setPixelRatio(window.devicePixelRatio);
    this.webgl.setClearColor(COLORS.TERMINAL_BLACK, 1);

    this.scene = new THREE.Scene();
    // Background as scene state, not just the gl clear color — keeps the
    // bg color consistent through the EffectComposer's HalfFloat render
    // targets regardless of how downstream passes treat alpha/clear.
    this.sceneBackground = new THREE.Color(COLORS.TERMINAL_BLACK);
    this.scene.background = this.sceneBackground;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    // Position + lookAt are set by fitCamera() in handleResize once aspect is
    // known; no placeholder needed because handleResize runs before start().

    // ---- bloomComposer: layer-1 only, output captured in renderTarget2 ----
    //
    // The render loop swaps scene.background to null and camera.layers to
    // BLOOM_LAYER before .render(); RenderPass picks up both. The explicit
    // (0,0,0)/alpha-0 clear color is critical: the renderer's default
    // clear color is TERMINAL_BLACK sRGB (`#282828`), which lands as raw
    // 0.157 in the HalfFloat linear target — well below the bloom
    // threshold, but UnrealBloomPass *additively* composites its bloom
    // output onto the un-cleared input, so any non-zero ground floor
    // leaks across the whole bloom buffer and brightens the final mix.
    // Pure-black ground floor means the bloom buffer ends up containing
    // only the sprite bloomMesh contribution + its blurred halo.
    this.bloomComposer = new EffectComposer(this.webgl);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(
      new RenderPass(this.scene, this.camera, null, new THREE.Color(0x000000), 0),
    );
    this.bloomComposer.addPass(createBloomPass(new THREE.Vector2(1, 1)));

    // ---- mainComposer: layer-0 only, mixes bloom in, scanlines, output ----
    //
    // Saturation-clamp first so any color the bloom mix adds doesn't get
    // re-saturated (bloom is meant to be additive HDR-ish glow on top of
    // the clamped main render). MixPass reads bloomComposer's output via
    // its uBloom uniform — wired up after construction since renderTarget2
    // is only valid after EffectComposer's first .render() initializes it.
    this.bloomMixPass = createBloomMixPass();
    this.mainComposer = new EffectComposer(this.webgl);
    this.mainComposer.addPass(new RenderPass(this.scene, this.camera));
    this.mainComposer.addPass(createSatClampedPass());
    this.mainComposer.addPass(this.bloomMixPass);
    this.mainComposer.addPass(createScanlinePass());
    // OutputPass converts the composer's internal linear-sRGB framebuffer to
    // the canvas's sRGB output space. Without this last step, every linear
    // RGB value gets written to the screen as if it were sRGB, which makes
    // brights look dim and shifts hues unpredictably (TERMINAL_GREEN #33FF00
    // rendered as #08FF00, background snapped to amber, etc.).
    this.mainComposer.addPass(new OutputPass());

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  start(): void {
    this.lastFrameMs = performance.now();
    const loop = (): void => {
      this.rafId = requestAnimationFrame(loop);

      const now = performance.now();
      const dt = (now - this.lastFrameMs) / 1000;
      this.lastFrameMs = now;

      this.onFrame(dt);
      this.renderTwoPass();
    };
    loop();
  }

  /**
   * Two-pass render for B1.1 selective bloom:
   *
   * 1. Bloom layer: camera.layers → BLOOM_LAYER and scene.background → null
   *    so the bloom RenderPass sees ONLY the sprite bloomMesh against a
   *    transparent black background. UnrealBloomPass then high-passes +
   *    blurs the result into bloomComposer.renderTarget2.
   * 2. Main layer: camera.layers → 0 and scene.background restored, so the
   *    main RenderPass sees the visible scene. MixPass adds the blurred
   *    bloom buffer in, then scanlines + OutputPass finish the chain.
   *
   * scene.background must be cleared during the bloom pass: otherwise the
   * full-screen background quad fills every pixel and the bloom buffer
   * never has the pure black it needs for the high-pass to subtract.
   */
  private renderTwoPass(): void {
    this.scene.background = null;
    this.camera.layers.set(BLOOM_LAYER);
    this.bloomComposer.render();

    this.scene.background = this.sceneBackground;
    this.camera.layers.set(0);
    this.bloomMixPass.uniforms['uBloom']!.value = this.bloomComposer.renderTarget2.texture;
    this.mainComposer.render();
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener('resize', this.handleResize);
    this.webgl.dispose();
  }

  private handleResize = (): void => {
    const canvas = this.webgl.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.webgl.setSize(w, h, false);
    this.bloomComposer.setSize(w, h);
    this.mainComposer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
  };

  /**
   * Position the camera so the arena AABB fits the viewport with margin at
   * the current pitch and aspect. For each of the 8 corners of the box,
   * compute the minimum camera distance D such that the corner sits inside
   * both the vertical and horizontal FOV cones; take the max. Pitch is
   * fixed, so position is `(0, D·sinθ, D·cosθ)` and we always look at the
   * world origin.
   *
   * Derivation: camera basis vectors at pitch θ are
   *   forward = (0, -sinθ, -cosθ),  up = (0, cosθ, -sinθ),  right = (1, 0, 0)
   * For a corner P relative to camera C = (0, D·sinθ, D·cosθ):
   *   depth     = (D - py·sinθ - pz·cosθ)
   *   up_coord  = py·cosθ - pz·sinθ           (D cancels)
   *   rightC    = px                          (D cancels)
   * Fit constraints: |up_coord| ≤ depth·tan(fovV/2) and same for horizontal.
   * Solving for D yields  D ≥ py·sinθ + pz·cosθ + |coord|/tan(fov/2).
   */
  private fitCamera(): void {
    const fovV = (this.camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    const sinP = Math.sin(CAMERA_PITCH_RAD);
    const cosP = Math.cos(CAMERA_PITCH_RAD);
    const tanV = Math.tan(fovV / 2);
    const tanH = Math.tan(fovH / 2);
    const { x: hx, y: hy, z: hz } = FIT_HALF_EXTENTS;

    let maxD = 0;
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          const px = sx * hx;
          const py = sy * hy;
          const pz = sz * hz;
          const lateral = py * sinP + pz * cosP;
          const upC = py * cosP - pz * sinP;
          const fromHeight = lateral + Math.abs(upC) / tanV;
          const fromWidth = lateral + Math.abs(px) / tanH;
          if (fromHeight > maxD) maxD = fromHeight;
          if (fromWidth > maxD) maxD = fromWidth;
        }
      }
    }
    const D = maxD * FIT_MARGIN;
    this.camera.position.set(0, D * sinP, D * cosP);
    this.camera.lookAt(0, 0, 0);
  }
}
