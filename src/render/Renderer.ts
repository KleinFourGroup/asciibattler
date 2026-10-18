import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { COLORS } from './palette';
import { createBloomMixPass, createBloomPass, createSatClampedPass } from './PostProcess';
import { BLOOM_LAYER } from './SpriteRenderer';
import { pickInstanceAtNdc, type PickCandidate } from './pick';
import {
  DEFAULT_CAMERA_VIEW,
  applyCameraFit,
  fitCameraToBox,
  panToWorld,
  type CameraView,
  type FitCamera,
} from './cameraFit';
import { GRID_SIZE } from '../config';
import type { GridCoord } from '../core/types';

export type { PickCandidate, CameraView };

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

/** Which camera framing is active: the whole board (`fit`), or a fixed
 *  window panned by keys and the screen's edge (`scroll`). */
type CameraMode = 'fit' | 'scroll';

/**
 * The starting mode. Scroll mode is a dev seam, toggled by the dev chord
 * (Ctrl+Alt+C, src/dev/devKeys.ts → `toggleCameraMode`); fit is the only
 * production view.
 */
const DEV_DEFAULT_MODE: CameraMode = 'fit';

/** The scroll mode's input (the pan keys, the edge-scroll) is DEV-only:
 *  its listeners attach only under `import.meta.env.DEV`, so the shipped
 *  bundle never sees a camera keydown, and the mode itself is unreachable
 *  there (its toggle is a dev key, and the dev keys come in under the same
 *  flag, main.ts). The `typeof` guard is for an import outside Vite, where
 *  `import.meta.env` is undefined. */
const DEV = typeof import.meta.env !== 'undefined' && import.meta.env.DEV === true;

/**
 * The scroll mode's window, in tiles per side. A board smaller than it in
 * a dimension shows whole in that dimension (the camera centres at the
 * origin there, `clampCameraTarget`).
 */
const SCROLL_WINDOW_TILES = 12;

/** The edge-scroll zone: px from the canvas edge that pans. */
const EDGE_SCROLL_THRESHOLD_PX = 40;

/** The pan speed (tiles/sec), for the keys and the edge-scroll alike. */
const PAN_SPEED_TILES_PER_SEC = 12;

/** The pan keys: WASD and the arrows, both live at once. Tracked in
 *  `keysHeld` and summed into a screen pan direction in
 *  `updateScrollFromInput`. `e.code` is layout-independent. DEV-only (see
 *  `DEV`). */
const PAN_KEY_CODES = new Set<string>([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
]);

/**
 * Wraps `WebGLRenderer` + `EffectComposer` and owns the requestAnimationFrame
 * loop. The scene, camera, and clear color live here so gameplay code never
 * reaches into three.js directly.
 *
 * The camera's view (projection, FOV, pitch, yaw) is `DEFAULT_CAMERA_VIEW`
 * (cameraFit.ts) for every player. It is state so the dev-only board
 * explorer can dial it (`setCameraView`). The framed board's size is set
 * per encounter by `fitToBoard(gridW, gridH)`.
 */
export class Renderer {
  readonly scene: THREE.Scene;
  readonly webgl: THREE.WebGLRenderer;

  /** Both cameras live for the Renderer's whole life and the view picks one
   *  (`cameraFor`), so a projection swap is a re-point, never a rebuild.
   *  Read `renderer.camera` per use: a holder that captures it goes stale on
   *  a swap. The two RenderPasses below are the only captures, re-pointed in
   *  `setCameraView`; `UnitOverlayLayer` takes a getter. */
  private readonly perspectiveCamera: THREE.PerspectiveCamera;
  private readonly orthographicCamera: THREE.OrthographicCamera;
  private activeCamera: FitCamera;
  private view: CameraView = DEFAULT_CAMERA_VIEW;
  /** Canvas w / h, kept here because an orthographic camera has no `.aspect`. */
  private aspect = 1;
  private readonly renderPasses: RenderPass[] = [];

  // The selective bloom: two composers driven off the same scene and camera
  // by layer membership (gotcha #30). `bloomComposer` renders only BLOOM_LAYER (the
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

  /** The framed board's size, for `fitCamera`. `GRID_SIZE` square until
   *  the first battle, so a render before it has a sensible frame;
   *  BattleScene sets it by `fitToBoard` on mount. */
  private boardW: number = GRID_SIZE;
  private boardH: number = GRID_SIZE;

  /**
   * The camera's mode and the scroll mode's target, the world XZ point
   * its window is centred on. Fit mode ignores the target but keeps it, so
   * a toggle back to scroll resumes where it was left.
   */
  private cameraMode: CameraMode = DEV_DEFAULT_MODE;
  private cameraTargetX = 0;
  private cameraTargetZ = 0;

  /** The scroll mode's input: the pan keys held, and the mouse's last XY
   *  on the canvas (null off it, so a mouse parked over the HUD or the
   *  browser's chrome doesn't edge-scroll). */
  private readonly keysHeld = new Set<string>();
  private mouseX: number | null = null;
  private mouseY: number | null = null;

  /** The raycast scratch for `pickCell` (screen → grid cell), kept as
   *  fields so a pick allocates nothing. */
  private readonly pickRaycaster = new THREE.Raycaster();
  private readonly pickNdc = new THREE.Vector2();

  /**
   * The camera shake: a transient screen-aligned jitter applied to the camera
   * around the render pass (never persisted into the base position), triggered
   * by an FX cue via `shakeCamera`. Decays linearly to zero over its duration.
   * Runs on the loop's wall-clock dt: a viewport effect, not a world event,
   * so it doesn't scale with the playback speed (a sub-second wobble).
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

    this.perspectiveCamera = new THREE.PerspectiveCamera(DEFAULT_CAMERA_VIEW.fovDeg, 1, 0.1, 1000);
    this.orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    // From the view, never a fixed pick: `fitCamera` builds the fit for
    // `this.view`, and an ortho fit on the perspective camera would frame the
    // board from the ortho stand-off at a 50° lens (too far back).
    this.activeCamera = this.cameraFor(this.view);
    // Position + lookAt are set by fitCamera() in handleResize once aspect is
    // known; no placeholder needed because handleResize runs before start().

    // ---- bloomComposer: layer-1 only, output captured in renderTarget2 ----
    //
    // The render loop swaps scene.background to null and camera.layers to
    // BLOOM_LAYER before .render(); RenderPass picks up both. The explicit
    // black, alpha-0 clear matters: the bloom's threshold is 0
    // (PostProcess.ts), so any non-zero floor, the renderer's TERMINAL_BLACK
    // clear among them, would pass the high-pass and glow across the whole
    // buffer. With a black floor the buffer holds only the sprites'
    // bloomMesh and its blurred halo.
    this.bloomComposer = new EffectComposer(this.webgl);
    this.bloomComposer.renderToScreen = false;
    const bloomRenderPass = new RenderPass(
      this.scene,
      this.activeCamera,
      null,
      new THREE.Color(0x000000),
      0,
    );
    this.bloomComposer.addPass(bloomRenderPass);
    this.bloomComposer.addPass(createBloomPass(new THREE.Vector2(1, 1)));

    // ---- mainComposer: layer-0 only, mixes bloom in, output ----
    //
    // Saturation-clamp first so any color the bloom mix adds doesn't get
    // re-saturated (bloom is meant to be additive HDR-ish glow on top of
    // the clamped main render). MixPass reads bloomComposer's output
    // through its uBloom uniform, set each frame in `renderTwoPass`.
    this.bloomMixPass = createBloomMixPass();
    this.mainComposer = new EffectComposer(this.webgl);
    const mainRenderPass = new RenderPass(this.scene, this.activeCamera);
    this.mainComposer.addPass(mainRenderPass);
    this.renderPasses.push(bloomRenderPass, mainRenderPass);
    this.mainComposer.addPass(createSatClampedPass());
    this.mainComposer.addPass(this.bloomMixPass);
    // OutputPass converts the composer's internal linear-sRGB framebuffer to
    // the canvas's sRGB output space. Without this last step, every linear
    // RGB value gets written to the screen as if it were sRGB, which makes
    // brights look dim and shifts hues unpredictably.
    this.mainComposer.addPass(new OutputPass());

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
    // The scroll mode's listeners: keys on window so the canvas needn't be
    // focused; the mouse on the canvas so edge-scroll only triggers over the
    // play area (a HUD hover doesn't pan). DEV-only (see `DEV`), so the
    // shipped bundle attaches none of them.
    if (DEV) {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      this.webgl.domElement.addEventListener('mousemove', this.handleMouseMove);
      this.webgl.domElement.addEventListener('mouseleave', this.handleMouseLeave);
    }
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
      // Add the shake offset just before render and strip it right after,
      // so the jitter is visible this frame but never corrupts the base position
      // the camera modes manage.
      this.applyCameraShake(dt);
      this.renderTwoPass();
      this.clearCameraShake();
    };
    loop();
  }

  /** The camera the frame is drawn with. Read it per use — see the ⚠ on the
   *  two camera fields. */
  get camera(): FitCamera {
    return this.activeCamera;
  }

  /**
   * Re-point the board's projection: any subset of projection, FOV, pitch
   * and yaw, re-fitted at once. Its one caller is the dev-only board
   * explorer (src/dev/boardPanel); nothing a player can reach calls it, so
   * the shipped camera is `DEFAULT_CAMERA_VIEW`. The caller owns the dial
   * ranges: pitch must stay clear of 0° and 90° (the fit divides by tan θ
   * under ortho, and `lookAt` degenerates overhead).
   */
  setCameraView(change: Partial<CameraView>): void {
    this.view = { ...this.view, ...change };
    const next = this.cameraFor(this.view);
    if (next !== this.activeCamera) {
      this.activeCamera = next;
      for (const pass of this.renderPasses) pass.camera = next;
    }
    this.fitCamera();
  }

  /** The live camera for a view's projection — the constructor's pick and
   *  `setCameraView`'s swap read the same line. */
  private cameraFor(view: CameraView): FitCamera {
    return view.projection === 'orthographic' ? this.orthographicCamera : this.perspectiveCamera;
  }

  /**
   * BattleScene calls this on mount with the encounter's dimensions, so the
   * camera frames the board. Idempotent. The other scenes don't call it and
   * keep whatever the last battle left (or the `GRID_SIZE` default at
   * boot); they draw no board, so the camera's state doesn't matter to
   * them.
   *
   * In scroll mode the board's size also sets the clamp on
   * `cameraTargetX/Z`, so a call re-clamps the saved target.
   */
  fitToBoard(gridW: number, gridH: number): void {
    this.boardW = gridW;
    this.boardH = gridH;
    this.fitCamera();
  }

  /**
   * BattleScene calls this on mount with the centre of the player's spawn
   * region, to anchor the scroll camera there. World XZ, clamped to the
   * board in scroll mode. Fit mode draws no change, but keeps the target,
   * so a toggle to scroll starts at this anchor.
   */
  setCameraTarget(worldX: number, worldZ: number): void {
    this.cameraTargetX = worldX;
    this.cameraTargetZ = worldZ;
    this.fitCamera();
  }

  /**
   * Screen → grid cell. Raycasts a viewport pixel (a click's
   * `clientX/clientY`) through the camera against the `surface` mesh (the
   * terrain mesh, where every cell has a top face at its real height), then
   * inverts `gridToWorld` to the integer cell. Hitting the surface and not a
   * flat plane is what makes the pick exact on raised and lowered tiles: a
   * flat-plane pick drifts by a tile where the terrain's height differs from
   * the plane's. Returns null when the ray misses the surface
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
   * Screen → sprite. The billboard-aware counterpart to `pickCell`: tests the
   * cursor against each candidate's camera-facing quad (not the terrain), so
   * clicking a unit's glyph selects that unit. A glyph stands above its tile,
   * so a terrain raycast through it lands on the cell behind; the objective
   * controller (src/ui/ObjectiveController.ts) tries this first, then falls
   * back to `pickCell`. Returns the frontmost candidate id under the cursor,
   * or null.
   */
  pickInstance(clientX: number, clientY: number, candidates: readonly PickCandidate[]): number | null {
    const rect = this.webgl.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    return pickInstanceAtNdc(candidates, ndcX, ndcY, this.camera);
  }

  /**
   * The dev camera-mode swap. Re-fits the camera so the change is visible
   * at once.
   */
  setCameraMode(mode: CameraMode): void {
    if (this.cameraMode === mode) return;
    this.cameraMode = mode;
    this.fitCamera();
  }

  /** The dev chord's entry (Ctrl+Alt+C, devKeys.ts): flip fit ↔ scroll
   *  and report the new mode. */
  toggleCameraMode(): CameraMode {
    this.setCameraMode(this.cameraMode === 'fit' ? 'scroll' : 'fit');
    return this.cameraMode;
  }

  /**
   * The two-pass render of the selective bloom:
   *
   * 1. Bloom layer: camera.layers → BLOOM_LAYER and scene.background → null
   *    so the bloom RenderPass sees only the sprite bloomMesh against a
   *    transparent black background. UnrealBloomPass then high-passes +
   *    blurs the result into bloomComposer.renderTarget2.
   * 2. Main layer: camera.layers → 0 and scene.background restored, so the
   *    main RenderPass sees the visible scene. After the saturation clamp,
   *    MixPass adds the blurred bloom buffer in, and OutputPass finishes the
   *    chain.
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

  /**
   * Draw no more frames, and leave everything else as it stands: the last
   * frame stays on the canvas. The halt of a page that has failed
   * (`Game.halt`). The loop books its next frame before it runs this one's
   * body, so a call made after a frame threw cancels the frame that would
   * have thrown again.
   */
  halt(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private handleResize = (): void => {
    const canvas = this.webgl.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.webgl.setSize(w, h, false);
    this.bloomComposer.setSize(w, h);
    this.mainComposer.setSize(w, h);
    this.aspect = w / h;
    this.fitCamera();
  };

  /**
   * Position the camera so the active frame (whole arena in fit mode;
   * fixed window in scroll mode) sits inside the viewport at the current
   * view and aspect.
   *
   * The math is `fitCameraToBox` (cameraFit.ts, one fit for both modes and
   * both projections, gotcha #52) and `applyCameraFit` is where it becomes a
   * camera. The two modes differ only in (a) the half-extents of the box, and
   * (b) the look-at point — fit always points at world origin; scroll points
   * at `(cameraTargetX, 0, cameraTargetZ)` so panning translates the frame.
   */
  private fitCamera(): void {
    let hx = SCROLL_WINDOW_TILES / 2;
    let hz = SCROLL_WINDOW_TILES / 2;
    let targetX = 0;
    let targetZ = 0;
    if (this.cameraMode === 'fit') {
      hx = this.boardW / 2 + XZ_PADDING;
      hz = this.boardH / 2 + XZ_PADDING;
    } else {
      this.clampCameraTarget();
      targetX = this.cameraTargetX;
      targetZ = this.cameraTargetZ;
    }
    const fit = fitCameraToBox(this.view, this.aspect, hx, Y_HALF_EXTENT, hz, FIT_MARGIN);
    applyCameraFit(this.activeCamera, this.view, fit, this.aspect, targetX, targetZ);
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
   * The scroll camera's per-frame driver. Sums the keys' and the
   * edge-scroll's input into a screen direction, turns it by the view's yaw
   * into world XZ (`panToWorld`), then translates the camera target at
   * PAN_SPEED_TILES_PER_SEC scaled by dt. Cheap to call every frame;
   * skips the matrix update + clamp when no input is active.
   *
   * W or a mouse near the top pans screen-up at any yaw (world −Z at yaw 0,
   * the board's far edge). The clamp stays on the world axes (gotcha #53),
   * so under a yaw a pan along a diagonal slides along the board's edge.
   */
  private updateScrollFromInput(dt: number): void {
    let right = 0;
    let up = 0;
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) right -= 1;
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) right += 1;
    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) up += 1;
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) up -= 1;

    if (this.mouseX !== null && this.mouseY !== null) {
      const w = this.webgl.domElement.clientWidth;
      const h = this.webgl.domElement.clientHeight;
      if (this.mouseX < EDGE_SCROLL_THRESHOLD_PX) right -= 1;
      else if (this.mouseX > w - EDGE_SCROLL_THRESHOLD_PX) right += 1;
      if (this.mouseY < EDGE_SCROLL_THRESHOLD_PX) up += 1;
      else if (this.mouseY > h - EDGE_SCROLL_THRESHOLD_PX) up -= 1;
    }

    if (right === 0 && up === 0) return;
    const step = PAN_SPEED_TILES_PER_SEC * dt;
    const { dx, dz } = panToWorld(this.view, right, up);
    this.cameraTargetX += dx * step;
    this.cameraTargetZ += dz * step;
    this.fitCamera();
  }

  /**
   * Kick a camera shake: a screen-aligned jitter that decays linearly to
   * zero over `durationSeconds`, authored per FX key (the registry's `shake`
   * channel). `intensity` is the offset amplitude in world units. A fresh
   * trigger restarts the decay (a new impact wins rather than stacking),
   * keeping the wobble bounded.
   */
  shakeCamera(intensity: number, durationSeconds: number): void {
    if (intensity <= 0 || durationSeconds <= 0) return;
    this.shakeIntensity = intensity;
    this.shakeDurationSec = durationSeconds;
    this.shakeElapsedSec = 0;
  }

  /**
   * Add this frame's decaying shake offset to the camera, just before the
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

  /** Restore the base camera position after render (shake never persists). */
  private clearCameraShake(): void {
    this.camera.position.sub(this.shakeOffset);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
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
