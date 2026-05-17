/**
 * Run-level map screen. Renders a NodeMap as positioned `<div>`s wired up
 * with an SVG edge layer behind them. The screen is a *pure view* — it
 * doesn't track which node is current or advance the run. Whoever owns the
 * run state (Game for now, Run.ts at Step 4.3) passes `currentNodeId` into
 * `show()` and listens for `run:nodeEntered` to update it.
 *
 * Three node states:
 *   - **current** — the player's position. Amber, non-clickable.
 *   - **frontier** — one edge hop from current. Cyan, clickable; click
 *     emits `run:nodeEntered`.
 *   - **locked** — everything else. Dimmed, non-clickable.
 */

import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/events';
import type { NodeMap } from '../run/NodeMap';
import { fadeIn, fadeOutAndRemove } from './fade';

export class MapScreen {
  private readonly mount: HTMLElement;
  private readonly bus: EventBus<GameEvents>;
  private container: HTMLDivElement | null = null;

  constructor(mount: HTMLElement, bus: EventBus<GameEvents>) {
    this.mount = mount;
    this.bus = bus;
  }

  show(map: NodeMap, currentNodeId: number, visited: ReadonlySet<number> = new Set()): void {
    this.hide();
    this.container = this.render(map, currentNodeId, visited);
    this.container.classList.add('screen-fade');
    this.mount.appendChild(this.container);
    fadeIn(this.container);
  }

  hide(): void {
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
  }

  private render(
    map: NodeMap,
    currentNodeId: number,
    visited: ReadonlySet<number>,
  ): HTMLDivElement {
    const frontier = new Set<number>();
    for (const e of map.edges) {
      if (e.from === currentNodeId) frontier.add(e.to);
    }

    // Fractional [0, 1] positions within the panel. The CSS does the actual
    // pixel sizing — keeping coordinates dimensionless means the same layout
    // logic feeds both the absolute-positioned divs and the SVG viewBox.
    const positions = new Map<number, { x: number; y: number }>();
    const floorCount = map.floors.length;
    for (let f = 0; f < floorCount; f++) {
      const ids = map.floors[f]!;
      const y = (f + 0.5) / floorCount;
      for (let i = 0; i < ids.length; i++) {
        const x = (i + 0.5) / ids.length;
        positions.set(ids[i]!, { x, y });
      }
    }

    const container = document.createElement('div');
    container.className = 'map-screen';

    // SVG edge layer. Sits behind the node divs by virtue of DOM order; CSS
    // pins it to inset:0 so its 100×100 viewBox stretches to the panel.
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.classList.add('map-edges');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    for (const e of map.edges) {
      const from = positions.get(e.from)!;
      const to = positions.get(e.to)!;
      const line = document.createElementNS(svgNs, 'line');
      line.setAttribute('x1', String(from.x * 100));
      line.setAttribute('y1', String(from.y * 100));
      line.setAttribute('x2', String(to.x * 100));
      line.setAttribute('y2', String(to.y * 100));
      line.classList.add('map-edge');
      if (e.from === currentNodeId) line.classList.add('frontier');
      svg.appendChild(line);
    }
    container.appendChild(svg);

    for (const node of map.nodes) {
      const pos = positions.get(node.id)!;
      const div = document.createElement('div');
      div.className = 'map-node';
      div.style.left = `${pos.x * 100}%`;
      div.style.top = `${pos.y * 100}%`;
      div.textContent = String(node.id);
      div.dataset.nodeId = String(node.id);

      if (node.id === currentNodeId) {
        div.classList.add('current');
      } else if (frontier.has(node.id)) {
        div.classList.add('frontier');
        div.addEventListener('click', () => {
          this.bus.emit('run:nodeEntered', { nodeId: node.id });
        });
      } else if (visited.has(node.id)) {
        div.classList.add('visited');
      } else {
        div.classList.add('locked');
      }

      container.appendChild(div);
    }

    return container;
  }
}
