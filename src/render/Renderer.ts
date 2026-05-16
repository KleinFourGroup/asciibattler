import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { COLORS } from './palette';

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

  private rafId: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.webgl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.webgl.setPixelRatio(window.devicePixelRatio);
    this.webgl.setClearColor(COLORS.TERMINAL_BLACK, 1);

    this.scene = new THREE.Scene();

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

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  start(): void {
    const loop = (): void => {
      this.rafId = requestAnimationFrame(loop);
      this.stats.begin();
      this.controls.update();
      this.webgl.render(this.scene, this.camera);
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
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
}
