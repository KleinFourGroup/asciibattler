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

import { PRE_ROOT_NODE_ID, type NodeMap, type NodeKind } from '../run/NodeMap';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { UnitTemplate } from '../sim/Unit';
import { fadeIn, fadeOutAndRemove } from './fade';
import { CardListButton } from './CardListModal';

/**
 * G3 — node-kind glyphs. The icon IS the route-planning affordance, so it
 * replaces the old numeric label. DOM text only (no FontAtlas). Root is
 * rendered as `@` separately (the run's origin marker), so it's not keyed
 * here. `Record<NodeKind, …>` keeps this exhaustive if the union grows.
 */
const KIND_GLYPH: Record<NodeKind, string> = {
  battle: 'X',
  rest: 'Z',
  boss: '!',
  elite: '*',
  port: '$', // 50c — the shop dock (money lay-reading; shell-prompt tech-reading)
  event: '?', // 74b — the event node (the StS ?-node lineage); EventScene lands 74f
};

/**
 * Vertical pixels allotted per hop on the scrollable board. The board height
 * is `hopCount * HOP_PX`; a tall board (10+ hops) overflows the viewport
 * and scrolls, with the current node centered on show. `.map-board`'s
 * `min-height: 100%` keeps a short board (e.g. a hopCount-2 forced run)
 * filling the viewport instead of collapsing to a sliver.
 */
const HOP_PX = 90;

/**
 * 77e3 — horizontal pixels allotted per LANE. The board's width is capped at
 * `maxWidth * LANE_PX` (centered by the CSS `margin: 0 auto`) instead of
 * stretching to the viewport: the braid generator gives lanes a persistent
 * identity, and full-width stretching read as "too separate" on wide
 * screens (user call, worklog §77e3). Positions are computed on a FIXED
 * per-lane pitch against the map's widest hop — narrow hops cluster
 * centered (the nodemap-viz model) rather than spreading to fill.
 */
const LANE_PX = 110;

/**
 * 66b — the boss forewarning pair as the map displays it: the pre-rolled
 * boss's display name + its board's layout name (`null` = procedural, which
 * THIS layer renders as "Uncharted Ground" — the flavor label is view voice,
 * the run reports only identity). Shape matches `Run.bossForewarning`.
 */
export interface BossForewarning {
  readonly name: string;
  readonly layoutName: string | null;
}

/** 66b — the display label for a procedural boss board (user-named). */
const UNCHARTED_LABEL = 'Uncharted Ground';

export class MapScreen {
  private readonly mount: HTMLElement;
  private readonly dispatcher: RunDispatcher;
  private readonly audio: AudioPlayer;
  private container: HTMLDivElement | null = null;
  // R1 — the shared "view roster" affordance (top-right), disposed on hide.
  private rosterButton: CardListButton | null = null;

  constructor(mount: HTMLElement, dispatcher: RunDispatcher, audio: AudioPlayer) {
    this.mount = mount;
    this.dispatcher = dispatcher;
    this.audio = audio;
  }

  show(
    map: NodeMap,
    currentNodeId: number,
    visited: ReadonlySet<number> = new Set(),
    roster: readonly UnitTemplate[] = [],
    sectorTitle = '',
    forewarning: BossForewarning | null = null,
  ): void {
    this.hide();
    this.container = this.render(map, currentNodeId, visited, roster, sectorTitle, forewarning);
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
    this.rosterButton?.dispose();
    this.rosterButton = null;
    if (this.container) {
      fadeOutAndRemove(this.container);
      this.container = null;
    }
  }

  private render(
    map: NodeMap,
    currentNodeId: number,
    visited: ReadonlySet<number>,
    roster: readonly UnitTemplate[],
    sectorTitle: string,
    forewarning: BossForewarning | null,
  ): HTMLDivElement {
    const frontier = new Set<number>();
    if (currentNodeId === PRE_ROOT_NODE_ID) {
      // S2 — pre-root start: the root is the sole selectable frontier (no node
      // is "current" yet, so nothing gets the current-highlight either).
      frontier.add(map.rootId);
    } else {
      for (const e of map.edges) {
        if (e.from === currentNodeId) frontier.add(e.to);
      }
    }

    // Fractional [0, 1] positions within the BOARD. The CSS does the actual
    // pixel sizing — keeping coordinates dimensionless means the same layout
    // logic feeds both the absolute-positioned divs and the SVG viewBox.
    // 77e3 — x rides a fixed per-lane pitch against the widest hop (see
    // LANE_PX): a width-2 hop on a width-6 map occupies the two center
    // lanes, not the whole panel.
    const positions = new Map<number, { x: number; y: number }>();
    const hopCount = map.hops.length;
    const maxLanes = Math.max(...map.hops.map((h) => h.length));
    for (let f = 0; f < hopCount; f++) {
      const ids = map.hops[f]!;
      const y = (f + 0.5) / hopCount;
      for (let i = 0; i < ids.length; i++) {
        const x = ((maxLanes - ids.length) / 2 + i + 0.5) / maxLanes;
        positions.set(ids[i]!, { x, y });
      }
    }

    const container = document.createElement('div');
    container.className = 'map-screen';

    // R1 — the roster view (top-right, position: fixed so it ignores the
    // board's vertical scroll). Inside the faded container so it cleans up with
    // the screen; dispose() also closes the overlay if it's still open.
    this.rosterButton = new CardListButton(this.mount, this.audio, {
      text: 'Roster',
      title: 'Your Roster',
      position: 'roster',
      getUnits: () => roster,
      // 51e — the count badge ("Roster · 10"); the screen re-renders on
      // every show, so no refresh wiring is needed here.
      getCount: () => roster.length,
      emptyText: 'No units in your roster.',
    });
    container.appendChild(this.rosterButton.el);

    // T2 — the sector-name banner (top-center, position: fixed so it ignores the
    // board's vertical scroll, like the roster button). Names the sector the run
    // is currently traversing; mirrors the in-battle .battle-banner chrome. An
    // empty title (a bare show()) renders no banner.
    if (sectorTitle) {
      const banner = document.createElement('div');
      banner.className = 'map-banner';
      const title = document.createElement('div');
      title.className = 'map-banner-title';
      title.textContent = sectorTitle;
      banner.appendChild(title);
      // 66b — the boss forewarning sub-line: the sector-start pre-roll,
      // surfaced from the moment the map first shows (the StS-style plan-ahead
      // read). Rides inside the banner so the two lines share one chrome.
      if (forewarning) {
        const boss = document.createElement('div');
        boss.className = 'map-banner-boss';
        boss.textContent = `Boss: ${forewarning.name} — ${forewarning.layoutName ?? UNCHARTED_LABEL}`;
        banner.appendChild(boss);
      }
      container.appendChild(banner);
    }

    // The board carries the hop-scaled height; the scroll container
    // (.map-screen) clips it. Edges + nodes lay out against the board, not the
    // viewport, so a tall board scrolls without distorting the layout.
    const board = document.createElement('div');
    board.className = 'map-board';
    board.style.height = `${hopCount * HOP_PX}px`;
    // 77e3 — the width cap (see LANE_PX): the board stops stretching to the
    // viewport; `.map-board`'s `margin: 0 auto` centers the capped column.
    board.style.maxWidth = `${maxLanes * LANE_PX}px`;
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
      // Every node shows its kind glyph (G3): X battle, Z rest, ! boss — the
      // route-planning affordance. (S2: the root lost its `@` origin marker —
      // it's a normal selectable node now, so it reads like any other.) A
      // `.{kind}` class rides alongside the state classes (.current/.frontier/…)
      // so CSS can color rest/boss distinctly without touching this dispatch.
      div.textContent = KIND_GLYPH[node.kind];
      div.dataset.nodeId = String(node.id);
      div.classList.add(node.kind);
      // 66b — the boss node names its forewarned fight on hover (the banner
      // sub-line carries the always-visible copy; this is the spatial anchor).
      if (node.kind === 'boss' && forewarning) {
        div.title = `${forewarning.name} — ${forewarning.layoutName ?? UNCHARTED_LABEL}`;
      }

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
