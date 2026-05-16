import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { COLORS } from './palette';
import { createPaletteQuantPass } from './PostProcess';

/**
 * Wraps `WebGLRenderer` + (eventually) `EffectComposer` and owns the
 * requestAnimationFrame loop. The scene, camera, and clear color live here so
 * gameplay code never reaches into three.js directly.
 *
 * EffectComposer is wired in at Step 2.5.
 */
export class Renderer {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly webgl: THREE.WebGLRenderer;

  // TODO(roadmap-5.3): remove OrbitControls and lock the camera before MVP ships.
  private readonly controls: OrbitControls;
  // TODO(roadmap-5.3): remove the Stats panel before MVP ships.
  private readonly stats: Stats;

  private readonly composer: EffectComposer;
  private readonly paletteQuantPass: ShaderPass;
  private postProcessEnabled = true;

  private readonly onFrame: (dtSeconds: number) => void;

  private rafId: number | null = null;
  private lastFrameMs = 0;

  constructor(canvas: HTMLCanvasElement, onFrame: (dtSeconds: number) => void) {
    this.onFrame = onFrame;
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.webgl.setPixelRatio(window.devicePixelRatio);
    this.webgl.setClearColor(COLORS.TERMINAL_BLACK, 1);

    this.scene = new THREE.Scene();
    // Set the background as scene state (rendered as a full-screen quad with
    // proper color management) rather than relying on the gl clear color
    // reaching the EffectComposer's HalfFloat render targets correctly.
    // Without this, the cleared RT lands at a value bright enough that the
    // palette-quant pass snaps the background to DARK_TERMINAL_AMBER instead
    // of TERMINAL_BLACK.
    this.scene.background = new THREE.Color(COLORS.TERMINAL_BLACK);

    // Tilted ~45° down per DESIGN.md "fixed perspective". The exact position
    // is provisional — when the 12×12 grid lands (Step 3.1) the camera will
    // need to frame it; for now we just need to see the placeholder cube.
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    this.camera.position.set(0, 8, 8);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.webgl.domElement);
    this.controls.enableDamping = true;

    this.stats = new Stats();
    // Position top-right; stats.js defaults to top-left.
    this.stats.dom.style.cssText = 'position:fixed;top:0;right:0;left:auto;cursor:pointer;z-index:10000;';
    document.body.appendChild(this.stats.dom);

    this.composer = new EffectComposer(this.webgl);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.paletteQuantPass = createPaletteQuantPass();
    this.composer.addPass(this.paletteQuantPass);
    // OutputPass converts the composer's internal linear-sRGB framebuffer to
    // the canvas's sRGB output space. Without this last step, every linear
    // RGB value gets written to the screen as if it were sRGB, which makes
    // brights look dim and shifts hues unpredictably (TERMINAL_GREEN #33FF00
    // rendered as #08FF00, background snapped to amber, etc.).
    this.composer.addPass(new OutputPass());

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Toggle the entire post-process pipeline. Used for A/B comparison during
   * Step 2.5 verify; left in as a useful debug affordance through MVP.
   * TODO(roadmap-5.3): remove (or gate behind a debug flag) before ship.
   */
  setPostProcessEnabled(enabled: boolean): void {
    this.postProcessEnabled = enabled;
  }

  togglePostProcess(): boolean {
    this.postProcessEnabled = !this.postProcessEnabled;
    return this.postProcessEnabled;
  }

  start(): void {
    this.lastFrameMs = performance.now();
    const loop = (): void => {
      this.rafId = requestAnimationFrame(loop);
      this.stats.begin();

      const now = performance.now();
      const dt = (now - this.lastFrameMs) / 1000;
      this.lastFrameMs = now;

      this.controls.update();
      this.onFrame(dt);

      if (this.postProcessEnabled) {
        this.composer.render();
      } else {
        this.webgl.render(this.scene, this.camera);
      }

      this.stats.end();
    };
    loop();
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.stats.dom.remove();
    this.webgl.dispose();
  }

  private handleResize = (): void => {
    const canvas = this.webgl.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.webgl.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
