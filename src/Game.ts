import * as THREE from 'three';
import { Renderer } from './render/Renderer';
import { COLORS } from './render/palette';

/**
 * Top-level orchestrator. Eventually owns the EventBus, Clock, current screen,
 * and the run state machine. For Step 0.2 it just owns the Renderer and adds a
 * single placeholder mesh so we can verify rendering works end-to-end.
 */
export class Game {
  private readonly renderer: Renderer;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);

    // Step 0.2 placeholder — confirms the render loop, the camera position,
    // and the palette wiring are all hooked up. Removed once the SpriteRenderer
    // takes over (Steps 2.2 / 3.2).
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: COLORS.TERMINAL_AMBER,
        wireframe: true,
      }),
    );
    this.renderer.scene.add(cube);
  }

  start(): void {
    this.renderer.start();
  }
}
