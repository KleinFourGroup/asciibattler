/**
 * Run-level map screen. Renders a NodeMap as positioned `<div>`s wired up
 * with an SVG edge layer behind them. The screen is a *pure view* — it
 * doesn't track which node is current or advance the run.
 *
 * Three node states:
 *   - **current** — the player's position. Amber, non-clickable.
 *   - **frontier** — one edge hop from current. Cyan, clickable; click
 *     dispatches an `enterNode` command on the run dispatcher.
 *   - **locked** — everything else. Dimmed, non-clickable.
 */

import type { NodeMap } from '../run/NodeMap';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { fadeIn, fadeOutAndRemove } from './fade';

/**
 * Vertical pixels allotted per floor on the scrollable board. The board height
 * is `floorCount * FLOOR_PX`; a tall board (10+ floors) overflows the viewport
 * and scrolls, with the current node centered on show. `.map-board`'s
 * `min-height: 100%` keeps a short board (e.g. a floorCount-2 forced run)
 * filling the viewport instead of collapsing to a sliver.
 */
const FLOOR_PX = 90;

export class MapScreen {
  private readonly mount: HTMLElement;
  private readonly dispatcher: RunDispatcher;
  private readonly audio: AudioPlayer;
  private container: HTMLDivElement | null = null;

  constructor(mount: HTMLElement, dispatcher: RunDispatcher, audio: AudioPlayer) {
    this.mount = mount;
    this.dispatcher = dispatcher;
    this.audio = audio;
  }

  show(map: NodeMap, currentNodeId: number, visited: ReadonlySet<number> = new Set()): void {
    this.hide();
    this.container = this.render(map, currentNodeId, visited);
    this.container.classList.add('screen-fade');
    this.mount.appendChild(this.container);
    // Center the current node in the viewport. Reading offsetTop forces the
    // layout that makes the scroll math valid; the browser clamps scrollTop to
    // range, so the root (near the board top) settles at the top and deeper
    // nodes pull the view down with them.
    const current = this.container.querySelector<HTMLElement>('.map-node.current');
    if (current) {
      this.container.scrollTop = current.offsetTop - this.container.clientHeight / 2;
    }
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

    // The board carries the floor-scaled height; the scroll container
    // (.map-screen) clips it. Edges + nodes lay out against the board, not the
    // viewport, so a tall board scrolls without distorting the layout.
    const board = document.createElement('div');
    board.className = 'map-board';
    board.style.height = `${floorCount * FLOOR_PX}px`;
    container.appendChild(board);

    // SVG edge layer. Sits behind the node divs by virtue of DOM order; CSS
    // pins it to inset:0 so its 100×100 viewBox stretches to the board.
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
    board.appendChild(svg);

    for (const node of map.nodes) {
      const pos = positions.get(node.id)!;
      const div = document.createElement('div');
      div.className = 'map-node';
      div.style.left = `${pos.x * 100}%`;
      div.style.top = `${pos.y * 100}%`;
      // Root reads as the run's origin marker (roguelike "@") rather than
      // a battle node you skipped past — the numbered-circle visual was
      // making node 0 feel like a never-chosen option. Battle nodes keep
      // their numeral. Style hook (.root) lets CSS lean into the
      // distinction further without touching this dispatch logic.
      const isRoot = node.id === map.rootId;
      div.textContent = isRoot ? '@' : String(node.id);
      div.dataset.nodeId = String(node.id);
      if (isRoot) div.classList.add('root');

      if (node.id === currentNodeId) {
        div.classList.add('current');
      } else if (frontier.has(node.id)) {
        div.classList.add('frontier');
        div.addEventListener('click', () => {
          this.audio.play('click');
          this.dispatcher.dispatch({ kind: 'enterNode', nodeId: node.id });
        });
      } else if (visited.has(node.id)) {
        div.classList.add('visited');
      } else {
        div.classList.add('locked');
      }

      board.appendChild(div);
    }

    return container;
  }
}
