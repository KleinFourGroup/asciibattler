import type * as THREE from 'three';
import type { TileGrid } from '../../sim/TileGrid';
import type { TerrainVariant } from './TerrainVariant';

/**
 * C1c decision-point demo controller. Holds all three terrain variants,
 * keeps exactly one mounted in the scene, and reseats the active variant
 * when the user presses 1 / 2 / 3.
 *
 * Hotkey cycle (instead of true side-by-side rendering) was the user's
 * call: terrain detail reads best at native resolution, and the
 * Preview-MCP-screenshot caveat in HANDOFF tip #1 specifically warns
 * that thirded viewports smear sub-pixel detail.
 *
 * Lifetime mirrors WaterRenderer / SpriteRenderer — Game owns one
 * instance, BattleScene populates tiles on mount and clears on dispose.
 *
 * After the winner is picked the losers get deleted; this controller
 * shrinks to a thin wrapper around the chosen variant (or folds back
 * into a single TerrainRenderer entirely).
 */
export class TerrainController {
  private readonly scene: THREE.Scene;
  private readonly label: HTMLElement;
  private activeIndex = 0;
  private currentTiles: { grid: TileGrid; gridSize: number } | null = null;
  private readonly onKey: (e: KeyboardEvent) => void;

  constructor(
    scene: THREE.Scene,
    readonly variants: readonly TerrainVariant[],
  ) {
    if (variants.length === 0) throw new Error('TerrainController: at least one variant required');
    this.scene = scene;

    // Mount the initial variant.
    this.scene.add(variants[0]!.mesh);

    // Tiny floating label so the user can see which variant is showing
    // during the cycle. Pure dev affordance — gets ripped out when the
    // demo lands its winner.
    this.label = document.createElement('div');
    this.label.id = 'terrain-variant-label';
    Object.assign(this.label.style, {
      position: 'fixed',
      top: '8px',
      right: '12px',
      zIndex: '1001',
      font: '12px / 1 "JetBrains Mono", monospace',
      color: '#9aa',
      background: 'rgba(0,0,0,0.45)',
      padding: '4px 8px',
      borderRadius: '3px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
    });
    document.body.appendChild(this.label);
    this.refreshLabel();

    this.onKey = (e) => {
      // Number row 1..N selects variant N-1. Ignore modifier+number combos
      // so we don't fight browser shortcuts.
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const idx = '123456789'.indexOf(e.key);
      if (idx < 0 || idx >= this.variants.length) return;
      e.preventDefault();
      this.setVariant(idx);
    };
    window.addEventListener('keydown', this.onKey);
  }

  /** Active variant for the current battle. BattleScene threads through this on mount. */
  setTiles(tileGrid: TileGrid, gridSize: number): void {
    this.currentTiles = { grid: tileGrid, gridSize };
    this.variants[this.activeIndex]!.setTiles(tileGrid, gridSize);
  }

  /** Drop tile-specific visuals on the active variant + drop the cache. */
  clear(): void {
    this.currentTiles = null;
    this.variants[this.activeIndex]!.clear();
  }

  setVariant(index: number): void {
    if (index === this.activeIndex || index < 0 || index >= this.variants.length) return;
    const prev = this.variants[this.activeIndex]!;
    const next = this.variants[index]!;
    this.scene.remove(prev.mesh);
    prev.clear();
    this.scene.add(next.mesh);
    this.activeIndex = index;
    if (this.currentTiles) {
      next.setTiles(this.currentTiles.grid, this.currentTiles.gridSize);
    }
    this.refreshLabel();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.label.remove();
    for (const v of this.variants) v.dispose();
  }

  private refreshLabel(): void {
    const lines = this.variants.map((v, i) => {
      const marker = i === this.activeIndex ? '▶' : ' ';
      return `${marker} ${i + 1}. ${v.label}`;
    });
    this.label.textContent = `C1c terrain demo\n${lines.join('\n')}`;
  }
}
