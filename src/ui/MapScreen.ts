/**
 * The run's map screen. Renders a NodeMap as positioned node buttons over an
 * SVG edge layer. The screen is a pure view: it doesn't track which node is
 * current or advance the run.
 *
 * Four node states:
 *   - current — the player's position. A filled amber disc, not clickable.
 *   - frontier — one edge hop from current. Cyan, clickable; a click
 *     dispatches an `enterNode` command on the run dispatcher.
 *   - visited — a node the run has entered. Not clickable.
 *   - locked — everything else. Dimmed, not clickable.
 *
 * `{readOnly: true}` renders the same view with no dispatch and no roster
 * button: the sector-map overlay's glance mode (SectorMapOverlay).
 */

import { PRE_ROOT_NODE_ID, type NodeMap, type NodeKind } from '../run/NodeMap';
import { t } from '../i18n/ui';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { UnitTemplate } from '../sim/Unit';
import { Screen } from './Screen';
import { CardListButton } from './CardListModal';
import { mountControl } from './chip';
import { attachTooltip } from './tooltip';

/**
 * The node kinds' glyphs: the glyph is the route-planning read. DOM text
 * only (no FontAtlas). The root is a node of its own kind and shows that
 * kind's glyph. `Record<NodeKind, …>` keeps this exhaustive if the union
 * grows. Exported with KIND_LABEL for the rest page's heading
 * (RestScreen.ts), which names its node as the map does.
 */
export const KIND_GLYPH: Record<NodeKind, string> = {
  battle: 'X',
  rest: 'Z',
  boss: '!',
  elite: '*',
  port: '$', // the shop dock (money to a lay reader, a shell prompt to a technical one)
  event: '?', // the event node, after Slay the Spire's ? node
};

/**
 * The legend's kind names, one literal key per kind (the key-scan pin
 * cannot see a computed key). `Record<NodeKind, …>` keeps it exhaustive with
 * KIND_GLYPH: a new kind fails tsc here until it is named. KIND_ORDER is the
 * legend's order, the route-planning read: the common node first, the
 * destination last.
 */
export const KIND_LABEL: Record<NodeKind, string> = {
  battle: t('map.legend.kind.battle'),
  rest: t('map.legend.kind.rest'),
  boss: t('map.legend.kind.boss'),
  elite: t('map.legend.kind.elite'),
  port: t('map.legend.kind.port'),
  event: t('map.legend.kind.event'),
};
const KIND_ORDER: readonly NodeKind[] = ['battle', 'rest', 'elite', 'port', 'event', 'boss'];

/** The four node states the board stamps (`.current`, `.frontier`,
 *  `.visited`, `.locked`, the classes the loop below adds) and their legend
 *  names: which nodes can be clicked, said in words beside the shape. */
type NodeState = 'current' | 'frontier' | 'visited' | 'locked';
const STATE_LABEL: Record<NodeState, string> = {
  current: t('map.legend.state.current'),
  frontier: t('map.legend.state.frontier'),
  visited: t('map.legend.state.visited'),
  locked: t('map.legend.state.locked'),
};
const STATE_ORDER: readonly NodeState[] = ['current', 'frontier', 'visited', 'locked'];

/**
 * The map legend, fixed at the bottom left. Two columns: the six kinds (the
 * glyph in its kind hue; the `.map-legend__swatch.<kind>` selectors share the
 * board's `.map-node.<kind>` color rules) and the four states (a ring swatch
 * in the state's shape, through the shared `.<state>` selectors, so the key
 * and the board can't drift apart). The names are a channel beside color, so
 * the key reads without it. A read only: pointer-events none, no tooltip
 * (the words are already here).
 */
function buildMapLegend(): HTMLDivElement {
  const legend = document.createElement('div');
  legend.className = 'map-legend';

  const kinds = document.createElement('div');
  kinds.className = 'map-legend__col';
  const title = document.createElement('div');
  title.className = 'map-legend__title';
  title.textContent = t('map.legend.title');
  kinds.appendChild(title);
  for (const kind of KIND_ORDER) {
    const row = document.createElement('div');
    row.className = 'map-legend__row';
    const swatch = document.createElement('span');
    swatch.className = `map-legend__swatch map-legend__swatch--kind ${kind}`;
    swatch.textContent = KIND_GLYPH[kind];
    const name = document.createElement('span');
    name.textContent = KIND_LABEL[kind];
    row.append(swatch, name);
    kinds.appendChild(row);
  }

  const states = document.createElement('div');
  states.className = 'map-legend__col';
  // A spacer row keeps the two columns' first swatches level under the title.
  const spacer = document.createElement('div');
  spacer.className = 'map-legend__title';
  spacer.textContent = ' ';
  states.appendChild(spacer);
  for (const state of STATE_ORDER) {
    const row = document.createElement('div');
    row.className = 'map-legend__row';
    const swatch = document.createElement('span');
    swatch.className = `map-legend__swatch ${state}`;
    const name = document.createElement('span');
    name.textContent = STATE_LABEL[state];
    row.append(swatch, name);
    states.appendChild(row);
  }

  legend.append(kinds, states);
  return legend;
}

/**
 * Vertical pixels allotted per hop on the scrollable board. The board height
 * is `hopCount * HOP_PX`; a tall board (10+ hops) overflows the viewport
 * and scrolls, with the current node centered on show. `.map-board`'s
 * `min-height: 100%` keeps a short board (e.g. a hopCount-2 forced run)
 * filling the viewport instead of collapsing to a sliver.
 */
const HOP_PX = 90;

/**
 * Horizontal pixels allotted per lane. The board's width is capped at
 * `maxLanes * LANE_PX` (centered by the CSS `margin: 0 auto`) instead of
 * stretching to the viewport: the braid gives lanes a persistent identity,
 * and stretched to full width on a wide screen they read as too separate.
 * Positions sit on a fixed per-lane pitch against the map's widest hop, so
 * narrow hops cluster centered (as nodemap-viz draws them) rather than
 * spreading to fill.
 */
const LANE_PX = 110;

/**
 * The boss forewarning as the map shows it: the pre-rolled boss's display
 * name and its board's layout name (`null` for a procedural board, which this
 * layer shows as `map.uncharted`: the label is the view's voice, and the run
 * reports only identity). Its shape matches `Run.bossForewarning`.
 */
export interface BossForewarning {
  readonly name: string;
  readonly layoutName: string | null;
}

/** The label for a procedural board: one key for every procedural map's
 *  label (this screen's, the pre-turn map line's, the battle banner's). */
const UNCHARTED_LABEL = t('map.uncharted');

export class MapScreen extends Screen {
  private readonly dispatcher: RunDispatcher;
  private readonly audio: AudioPlayer;
  /** A read-only view never dispatches (frontier nodes render but don't
   *  click) and skips the roster button (the overlay is a glance surface,
   *  and a second modal nested under it would fight the overlay's own
   *  chrome). The sector-map overlay's mode; MapScene uses the default. */
  private readonly readOnly: boolean;
  // The shared view-roster control: the control column's second row
  // (src/ui/chip.ts), disposed on hide.
  private rosterButton: CardListButton | null = null;
  /** Where the roster button mounts; the read-only view has neither. */
  private readonly controlSlot: HTMLElement | null;

  constructor(
    mount: HTMLElement,
    dispatcher: RunDispatcher,
    audio: AudioPlayer,
    opts: { readOnly?: boolean; controlSlot?: HTMLElement } = {},
  ) {
    super(mount);
    this.dispatcher = dispatcher;
    this.audio = audio;
    this.readOnly = opts.readOnly ?? false;
    this.controlSlot = opts.controlSlot ?? null;
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
    const el = this.render(map, currentNodeId, visited, roster, sectorTitle, forewarning);
    this.present(el);
    // Center the current node in the viewport. Reading offsetTop forces the
    // layout that makes the scroll math valid (present() has mounted `el`;
    // its fade-in is a next-frame class flip, so the read lands on a laid-out
    // tree either way); the browser clamps scrollTop to range, so the root
    // (near the board top) settles at the top and deeper nodes pull the view
    // down with them.
    const current = el.querySelector<HTMLElement>('.map-node.current');
    if (current) {
      el.scrollTop = current.offsetTop - el.clientHeight / 2;
    }
  }

  override hide(): void {
    this.rosterButton?.dispose();
    this.rosterButton = null;
    super.hide();
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
      // The pre-root start: the root is the one selectable frontier (no node
      // is current yet, so none takes the current highlight either).
      frontier.add(map.rootId);
    } else {
      for (const e of map.edges) {
        if (e.from === currentNodeId) frontier.add(e.to);
      }
    }

    // Fractional [0, 1] positions within the BOARD. The CSS does the actual
    // pixel sizing — keeping coordinates dimensionless means the same layout
    // logic feeds both the absolutely positioned nodes and the SVG viewBox.
    // x rides a fixed per-lane pitch against the widest hop (see LANE_PX): a
    // width-2 hop on a width-6 map takes the two center lanes, not the whole
    // panel.
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
    if (this.readOnly) container.classList.add('map-screen--readonly');

    // The roster view, in the control column (so it ignores the board's
    // vertical scroll), and skipped by a read-only view (see the field's
    // note); hide() disposes it, which also closes the modal if it's open.
    if (!this.readOnly && this.controlSlot !== null) {
      this.rosterButton = new CardListButton(this.mount, this.audio, {
        text: t('roster.button'),
        title: t('roster.title'),
        position: 'roster',
        getUnits: () => roster,
        // The count on the face ("Roster · 10"); the screen renders again on
        // every show, so it needs no refresh wiring.
        getCount: () => roster.length,
        emptyText: t('roster.empty'),
      });
      mountControl(this.controlSlot, this.rosterButton.el);
    }

    // The banner naming the sector the run is in, at the top center
    // (position: fixed, so it stays put while the board scrolls), in the
    // battle banner's chrome. An empty title (a bare show()) renders none.
    if (sectorTitle) {
      const banner = document.createElement('div');
      banner.className = 'map-banner';
      const title = document.createElement('div');
      title.className = 'map-banner-title';
      title.textContent = sectorTitle;
      banner.appendChild(title);
      // The boss forewarning's line: the boss rolled at the sector's start,
      // shown from the map's first show so a route can be planned toward it.
      // It rides inside the banner so the two lines share one chrome.
      if (forewarning) {
        const boss = document.createElement('div');
        boss.className = 'map-banner-boss';
        boss.textContent = t('map.bossBanner', {
          name: forewarning.name,
          layout: forewarning.layoutName ?? UNCHARTED_LABEL,
        });
        banner.appendChild(boss);
      }
      container.appendChild(banner);
    }

    // The legend (bottom left, fixed). Inside the container so it fades and
    // disposes with the screen, and so the read-only overlay carries it.
    container.appendChild(buildMapLegend());

    // The board carries the hop-scaled height; the scroll container
    // (.map-screen) clips it. Edges + nodes lay out against the board, not the
    // viewport, so a tall board scrolls without distorting the layout.
    const board = document.createElement('div');
    board.className = 'map-board';
    board.style.height = `${hopCount * HOP_PX}px`;
    // The width cap (see LANE_PX): the board stops stretching to the
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
      // A node is a `<button>`, so the run's main navigation has a keyboard
      // route. A node with nothing to do (current, visited or locked, or
      // every node of a read-only view) is inert by `aria-disabled` and no
      // tab stop, never `disabled`: a disabled button swallows pointer events
      // in both engines, and the boss node's forewarning tooltip must keep
      // its hover while the boss is still locked (the usual case).
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-node';
      el.style.left = `${pos.x * 100}%`;
      el.style.top = `${pos.y * 100}%`;
      // Every node shows its kind's glyph, the root included. A `.{kind}`
      // class rides beside the state classes so the CSS colors each kind's
      // glyph but battle's, which takes the state's color.
      el.textContent = KIND_GLYPH[node.kind];
      el.dataset.nodeId = String(node.id);
      el.classList.add(node.kind);
      // The boss node names its forewarned fight on hover (the banner's line
      // is the copy always in view; this is the spatial anchor). The node is
      // a control (a frontier click enters it), so the touch route is the
      // long-press.
      if (node.kind === 'boss' && forewarning) {
        attachTooltip(el, `${forewarning.name} — ${forewarning.layoutName ?? UNCHARTED_LABEL}`, {
          touch: 'press',
        });
      }

      let live = false;
      if (node.id === currentNodeId) {
        el.classList.add('current');
      } else if (frontier.has(node.id)) {
        el.classList.add('frontier');
        // A read-only view keeps the frontier styling (the plan-ahead read is
        // the overlay's point) but never dispatches; the CSS drops the
        // pointer cursor under .map-screen--readonly.
        if (!this.readOnly) {
          live = true;
          el.addEventListener('click', () => {
            this.audio.play('click');
            this.dispatcher.dispatch({ kind: 'enterNode', nodeId: node.id });
          });
        }
      } else if (visited.has(node.id)) {
        el.classList.add('visited');
      } else {
        el.classList.add('locked');
      }
      if (!live) {
        el.setAttribute('aria-disabled', 'true');
        el.tabIndex = -1;
      }

      board.appendChild(el);
    }

    return container;
  }
}
