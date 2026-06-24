import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { COLORS } from './palette';
import { createBloomMixPass, createBloomPass, createSatClampedPass } from './PostProcess';
import { BLOOM_LAYER } from './SpriteRenderer';
import { pickInstanceAtNdc, type PickCandidate } from './pick';
import { GRID_SIZE } from '../config';
import type { GridCoord } from '../core/types';

export type { PickCandidate };

/** Camera pitch from horizontal. 45° down matches the diorama framing. */
const CAMERA_PITCH_RAD = Math.PI / 4;

/**
 * X/Z padding around the arena AABB and Y headroom for the sprite layer.
 * X/Z scales with `gridW` / `gridH` (set per battle via `fitToBoard`);
 * the constant terms here give the terrain edge a bit of breathing room
 * and cover ground (y=0) up through the sprite layer (y=~1).
 */
const XZ_PADDING = 0.5;
const Y_HALF_EXTENT = 1.0;

/** Distance multiplier on top of the analytic fit so nothing hugs the frame edge. */
const FIT_MARGIN = 1.05;

/** D4: which camera framing is active. */
export type CameraMode = 'fit' | 'scroll';

/**
 * D4 dev default. Scroll mode is implemented and toggleable via the dev
 * keystroke from day one, but the default stays `fit` until D5 (spawn
 * regions) gives scroll a richer initial focal point than "player rows".
 */
const DEV_DEFAULT_MODE: CameraMode = 'fit';

/**
 * D4 scroll-mode visible window — tiles per side. Matches the pre-D3
 * `GRID_SIZE` so scroll-mode framing feels like the original game zoom
 * on any board that's >= this size; smaller boards fall back to "show
 * everything" (camera clamps to the world origin in that dim).
 */
const SCROLL_WINDOW_TILES = 12;

/** D4 edge-scroll trigger zone: px from canvas edge that activates pan. */
const EDGE_SCROLL_THRESHOLD_PX = 40;

/** D4 pan speed (tiles/sec) for both WASD and edge-scroll. */
const PAN_SPEED_TILES_PER_SEC = 12;

/** D4 dev keystroke that toggles camera mode (Backquote = the `~` key). */
const CAMERA_TOGGLE_CODE = 'Backquote';

/** D4 pan keys: WASD and arrow keys (both active simultaneously). Tracked
 *  in `keysHeld` and summed into the XZ pan direction in
 *  `updateScrollFromInput`. `e.code` is layout-independent. */
const PAN_KEY_CODES = new Set<string>([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

/**
 * Wraps `WebGLRenderer` + `EffectComposer` and owns the requestAnimationFrame
 * loop. The scene, camera, and clear color live here so gameplay code never
 * reaches into three.js directly.
 *
 * Camera is locked to a fixed pitch (CAMERA_PITCH_RAD). The visible-arena
 * size is set per-encounter via `fitToBoard(gridW, gridH)` (D3); pre-D3
 * the size was a fixed `GRID_SIZE × GRID_SIZE` constant.
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

  /** Current arena dimensions used by `fitCamera`. Defaults to the
   *  square `GRID_SIZE × GRID_SIZE` so the boot map-screen render before
   *  any battle has a sensible frame. BattleScene overrides via
   *  `fitToBoard` on mount. */
  private boardW: number = GRID_SIZE;
  private boardH: number = GRID_SIZE;

  /**
   * D4 camera state. `cameraMode` swaps between fit (whole arena framed)
   * and scroll (fixed window pannable with WASD + edge-scroll). Target
   * is the world XZ point the scroll camera is centered on; ignored in
   * fit mode but preserved across toggles so flipping back to scroll
   * resumes where the player left it.
   */
  private cameraMode: CameraMode = DEV_DEFAULT_MODE;
  private cameraTargetX = 0;
  private cameraTargetZ = 0;

  /** D4 input state. Held WASD keys + last-known mouse XY relative to
   *  the canvas (null when mouse is outside the canvas — edge-scroll
   *  shouldn't fire from a mouse parked over the HUD or browser chrome). */
  private readonly keysHeld = new Set<string>();
  private mouseX: number | null = null;
  private mouseY: number | null = null;

  /** J3 — reusable raycast scratch for `pickCell` (screen → grid cell), kept as
   *  fields so a per-click pick allocates nothing. */
  private readonly pickRaycaster = new THREE.Raycaster();
  private readonly pickNdc = new THREE.Vector2();

  /**
   * §Z camera shake — a transient screen-aligned jitter applied to the camera
   * around the render pass (never persisted into the base position), triggered
   * by an FX cue via `shakeCamera`. Decays linearly to zero over its duration.
   * Runs on the loop's WALL-CLOCK dt: it's a viewport effect, not a world event,
   * so it deliberately doesn't scale with playback speed (a sub-second wobble).
   */
  private shakeIntensity = 0;
  private shakeDurationSec = 0;
  private shakeElapsedSec = 0;
  private readonly shakeOffset = new THREE.Vector3();
  private readonly shakeRight = new THREE.Vector3();
  private readonly shakeUp = new THREE.Vector3();

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

    // ---- mainComposer: layer-0 only, mixes bloom in, output ----
    //
    // Saturation-clamp first so any color the bloom mix adds doesn't get
    // re-saturated (bloom is meant to be additive HDR-ish glow on top of
    // the clamped main render). MixPass reads bloomComposer's output via
    // its uBloom uniform — wired up after construction since renderTarget2
    // is only valid after EffectComposer's first .render() initializes it.
    //
    // CRT scanlines live as a CSS overlay on `#scanlines` (B5), not a
    // post-process pass.
    this.bloomMixPass = createBloomMixPass();
    this.mainComposer = new EffectComposer(this.webgl);
    this.mainComposer.addPass(new RenderPass(this.scene, this.camera));
    this.mainComposer.addPass(createSatClampedPass());
    this.mainComposer.addPass(this.bloomMixPass);
    // OutputPass converts the composer's internal linear-sRGB framebuffer to
    // the canvas's sRGB output space. Without this last step, every linear
    // RGB value gets written to the screen as if it were sRGB, which makes
    // brights look dim and shifts hues unpredictably (TERMINAL_GREEN #33FF00
    // rendered as #08FF00, background snapped to amber, etc.).
    this.mainComposer.addPass(new OutputPass());

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    // D4 input listeners: keys on window so the user doesn't need to focus
    // the canvas; mouse position on the canvas so edge-scroll only triggers
    // when the cursor is over the play area (HUD hover doesn't pan).
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.webgl.domElement.addEventListener('mousemove', this.handleMouseMove);
    this.webgl.domElement.addEventListener('mouseleave', this.handleMouseLeave);
  }

  start(): void {
    this.lastFrameMs = performance.now();
    const loop = (): void => {
      this.rafId = requestAnimationFrame(loop);

      const now = performance.now();
      const dt = (now - this.lastFrameMs) / 1000;
      this.lastFrameMs = now;

      if (this.cameraMode === 'scroll') this.updateScrollFromInput(dt);
      this.onFrame(dt);
      // §Z — add the shake offset just before render and strip it right after,
      // so the jitter is visible this frame but never corrupts the base position
      // the camera modes manage.
      this.applyCameraShake(dt);
      this.renderTwoPass();
      this.clearCameraShake();
    };
    loop();
  }

  /**
   * D3: BattleScene calls this on mount with the current encounter's
   * dimensions so the camera frames the arena. Idempotent; safe to call
   * mid-battle if size ever changes. Map/Recruit/GameOver scenes don't
   * call this and inherit whatever the last battle left (or the
   * `GRID_SIZE × GRID_SIZE` default at boot) — they don't render
   * arena content so the camera state is irrelevant for them.
   *
   * D4: in scroll mode the board size also drives the clamp range for
   * `cameraTargetX/Z`, so calling this re-clamps the saved target.
   */
  fitToBoard(gridW: number, gridH: number): void {
    this.boardW = gridW;
    this.boardH = gridH;
    this.fitCamera();
  }

  /**
   * D4: BattleScene calls this after team spawn to anchor the scroll
   * camera on the player area. World XZ; gets clamped to the board on
   * apply. No-op for fit mode visually, but the target is preserved so
   * a toggle to scroll picks up at this anchor.
   */
  setCameraTarget(worldX: number, worldZ: number): void {
    this.cameraTargetX = worldX;
    this.cameraTargetZ = worldZ;
    this.fitCamera();
  }

  /**
   * J3 — screen → grid cell. Raycasts a viewport pixel (a click's
   * `clientX/clientY`) through the camera against the `surface` mesh (the
   * TERRAIN mesh — every cell has a top face at its real height), then inverts
   * `gridToWorld` to the integer cell. Hitting the actual surface (not a flat
   * plane) is what makes the pick exact on raised/lowered tiles — a flat-plane
   * pick drifts by a tile where the terrain height differs from the plane (the
   * playtest "off by a tile"). Returns null when the ray misses the surface
   * (clicked into the void off the board) or the hit lands off-board. The
   * inversion mirrors `gridToWorld`: worldX = x + 0.5 − boardW/2,
   * worldZ = boardH/2 − y − 0.5 ⇒ x = ⌊worldX + boardW/2⌋, y = ⌊boardH/2 − worldZ⌋.
   */
  pickCell(clientX: number, clientY: number, surface: THREE.Object3D): GridCoord | null {
    const rect = this.webgl.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.pickNdc.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.pickRaycaster.setFromCamera(this.pickNdc, this.camera);
    const hit = this.pickRaycaster.intersectObject(surface, false)[0];
    if (!hit) return null;

    const x = Math.floor(hit.point.x + this.boardW / 2);
    const y = Math.floor(this.boardH / 2 - hit.point.z);
    if (x < 0 || x >= this.boardW || y < 0 || y >= this.boardH) return null;
    return { x, y };
  }

  /**
   * J3 — screen → sprite. The billboard-aware counterpart to `pickCell`: tests
   * the cursor against each candidate's camera-facing quad (NOT the terrain), so
   * clicking a unit's GLYPH selects that unit. A glyph floats ~0.5 above its
   * tile, so a terrain raycast through it lands on the cell behind — hence the
   * objective controller tries this first, then falls back to `pickCell`.
   * Returns the frontmost candidate id under the cursor, or null.
   */
  pickInstance(clientX: number, clientY: number, candidates: readonly PickCandidate[]): number | null {
    const rect = this.webgl.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    return pickInstanceAtNdc(candidates, ndcX, ndcY, this.camera);
  }

  /**
   * D4: dev/debug camera-mode swap. Re-fits the camera so the change is
   * visible immediately. Logs to console so it's obvious which mode is
   * active during browser-verify.
   */
  setCameraMode(mode: CameraMode): void {
    if (this.cameraMode === mode) return;
    this.cameraMode = mode;
    this.fitCamera();
    if (typeof window !== 'undefined') {
      console.log(`[camera] mode: ${mode}`);
    }
  }

  getCameraMode(): CameraMode {
    return this.cameraMode;
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
   *    bloom buffer in, then OutputPass finishes the chain.
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
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.webgl.domElement.removeEventListener('mousemove', this.handleMouseMove);
    this.webgl.domElement.removeEventListener('mouseleave', this.handleMouseLeave);
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
   * Position the camera so the active frame (whole arena in fit mode;
   * fixed window in scroll mode) sits inside the viewport at the current
   * pitch and aspect.
   *
   * Shared math lives in `computeCameraDistance`. The two modes differ
   * only in (a) the half-extents that drive the AABB, and (b) the look-at
   * point — fit always points at world origin; scroll points at
   * `(cameraTargetX, 0, cameraTargetZ)` so panning translates the frame.
   */
  private fitCamera(): void {
    if (this.cameraMode === 'fit') {
      this.fitCameraFit();
    } else {
      this.fitCameraScroll();
    }
  }

  private fitCameraFit(): void {
    const sinP = Math.sin(CAMERA_PITCH_RAD);
    const cosP = Math.cos(CAMERA_PITCH_RAD);
    const hx = this.boardW / 2 + XZ_PADDING;
    const hz = this.boardH / 2 + XZ_PADDING;
    const D = this.computeCameraDistance(hx, Y_HALF_EXTENT, hz);
    this.camera.position.set(0, D * sinP, D * cosP);
    this.camera.lookAt(0, 0, 0);
  }

  private fitCameraScroll(): void {
    this.clampCameraTarget();
    const sinP = Math.sin(CAMERA_PITCH_RAD);
    const cosP = Math.cos(CAMERA_PITCH_RAD);
    const half = SCROLL_WINDOW_TILES / 2;
    const D = this.computeCameraDistance(half, Y_HALF_EXTENT, half);
    this.camera.position.set(
      this.cameraTargetX,
      D * sinP,
      this.cameraTargetZ + D * cosP,
    );
    this.camera.lookAt(this.cameraTargetX, 0, this.cameraTargetZ);
  }

  /**
   * Min camera distance D such that the box of half-extents (hx, hy, hz)
   * centered at the camera's look-at point fits inside both FOV cones.
   *
   * For each of the 8 corners, compute the minimum D such that the
   * corner sits inside both the vertical and horizontal FOV cones; take
   * the max across corners and both axes, then apply FIT_MARGIN.
   *
   * Derivation: camera basis at pitch θ is
   *   forward = (0, -sinθ, -cosθ),  up = (0, cosθ, -sinθ),  right = (1, 0, 0)
   * For a corner P relative to camera at (0, D·sinθ, D·cosθ):
   *   depth     = D - py·sinθ - pz·cosθ
   *   up_coord  = py·cosθ - pz·sinθ           (D cancels)
   *   right_coord = px                        (D cancels)
   * Fit: |up_coord| ≤ depth·tan(fovV/2) and same for horizontal. Solving
   * yields D ≥ py·sinθ + pz·cosθ + |coord|/tan(fov/2). Translation of
   * the look-at point doesn't change this — both camera and box shift
   * by the same amount.
   */
  private computeCameraDistance(hx: number, hy: number, hz: number): number {
    const fovV = (this.camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * this.camera.aspect);
    const sinP = Math.sin(CAMERA_PITCH_RAD);
    const cosP = Math.cos(CAMERA_PITCH_RAD);
    const tanV = Math.tan(fovV / 2);
    const tanH = Math.tan(fovH / 2);

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
    return maxD * FIT_MARGIN;
  }

  /**
   * Clamp the scroll camera target so the visible window stays inside
   * the board's XZ AABB. When the board is smaller than the window in a
   * dim, the camera centers at 0 in that dim (no pan possible).
   */
  private clampCameraTarget(): void {
    const half = SCROLL_WINDOW_TILES / 2;
    const maxX = Math.max(0, this.boardW / 2 - half);
    const maxZ = Math.max(0, this.boardH / 2 - half);
    if (this.cameraTargetX > maxX) this.cameraTargetX = maxX;
    else if (this.cameraTargetX < -maxX) this.cameraTargetX = -maxX;
    if (this.cameraTargetZ > maxZ) this.cameraTargetZ = maxZ;
    else if (this.cameraTargetZ < -maxZ) this.cameraTargetZ = -maxZ;
  }

  /**
   * D4 per-frame scroll-camera driver. Sums WASD and edge-scroll input
   * into an XZ direction, then translates the camera target at
   * PAN_SPEED_TILES_PER_SEC scaled by dt. Cheap to call every frame;
   * skips the matrix update + clamp when no input is active.
   *
   * Screen-up at the locked pitch maps to world -Z (the far edge of the
   * arena), so W / mouse-near-top → -Z, S / mouse-near-bottom → +Z.
   */
  private updateScrollFromInput(dt: number): void {
    let dx = 0;
    let dz = 0;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) dx -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) dx += 1;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) dz -= 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) dz += 1;

    if (this.mouseX !== null && this.mouseY !== null) {
      const w = this.webgl.domElement.clientWidth;
      const h = this.webgl.domElement.clientHeight;
      if (this.mouseX < EDGE_SCROLL_THRESHOLD_PX) dx -= 1;
      else if (this.mouseX > w - EDGE_SCROLL_THRESHOLD_PX) dx += 1;
      if (this.mouseY < EDGE_SCROLL_THRESHOLD_PX) dz -= 1;
      else if (this.mouseY > h - EDGE_SCROLL_THRESHOLD_PX) dz += 1;
    }

    if (dx === 0 && dz === 0) return;
    const step = PAN_SPEED_TILES_PER_SEC * dt;
    this.cameraTargetX += dx * step;
    this.cameraTargetZ += dz * step;
    this.fitCamera();
  }

  /**
   * §Z — kick a camera shake: a screen-aligned jitter that decays linearly to
   * zero over `durationSeconds`. Authored per FX key (the registry's `shake`
   * channel), so a heavy lob shakes harder than a bolt. `intensity` is the
   * offset amplitude in world units. A fresh trigger restarts the decay (a new
   * impact wins rather than stacking), keeping the wobble bounded.
   */
  shakeCamera(intensity: number, durationSeconds: number): void {
    if (intensity <= 0 || durationSeconds <= 0) return;
    this.shakeIntensity = intensity;
    this.shakeDurationSec = durationSeconds;
    this.shakeElapsedSec = 0;
  }

  /**
   * §Z — add this frame's decaying shake offset to the camera, just before the
   * render pass. Jitters along the camera's right (matrix col 0) + up (col 1)
   * axes so the wobble reads as on-screen shake regardless of pitch / mode.
   * `clearCameraShake` strips it after render, so the base position the camera
   * modes own is never touched.
   */
  private applyCameraShake(dt: number): void {
    this.shakeOffset.set(0, 0, 0);
    if (this.shakeElapsedSec >= this.shakeDurationSec || this.shakeIntensity <= 0) return;
    this.shakeElapsedSec += dt;
    const mag = this.shakeIntensity * Math.max(0, 1 - this.shakeElapsedSec / this.shakeDurationSec);
    if (mag <= 0) return;
    this.camera.updateMatrixWorld();
    const right = this.shakeRight.setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = this.shakeUp.setFromMatrixColumn(this.camera.matrixWorld, 1);
    const jx = (Math.random() * 2 - 1) * mag;
    const jy = (Math.random() * 2 - 1) * mag;
    this.shakeOffset.copy(right).multiplyScalar(jx).addScaledVector(up, jy);
    this.camera.position.add(this.shakeOffset);
  }

  /** §Z — restore the base camera position after render (shake never persists). */
  private clearCameraShake(): void {
    this.camera.position.sub(this.shakeOffset);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === CAMERA_TOGGLE_CODE) {
      if (e.repeat) return;
      this.setCameraMode(this.cameraMode === 'fit' ? 'scroll' : 'fit');
      return;
    }
    if (PAN_KEY_CODES.has(e.code)) {
      this.keysHeld.add(e.code);
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysHeld.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent): void => {
    const rect = this.webgl.domElement.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  };

  private handleMouseLeave = (): void => {
    this.mouseX = null;
    this.mouseY = null;
  };
}
