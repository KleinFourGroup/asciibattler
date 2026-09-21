/**
 * 105b — the board explorer's DOM shell: one control per `DIALS` row, built
 * from the table (a new dial needs no code here). Dev chrome, deliberately
 * outside every UI idiom: it mounts on `<body>`, NOT `#ui` (gotcha #137 — a
 * direct child of `#ui` inherits an ID-specificity `pointer-events` rule),
 * carries its own injected `<style>` (nothing lands in ui.css, so the focus /
 * motion / token pins never see it), and uses native controls.
 *
 * Keys typed INSIDE the panel stop here: the Keybindings registry dispatches
 * on bare `KeyboardEvent.code` with no modifier or focus check, so an arrow
 * key on a slider would pan the dev camera and Space on a checkbox would
 * pause the battle. Ctrl+Alt chords pass through (Ctrl+Alt+P must close the
 * panel from inside it, Ctrl+Alt+G must grey the board while a dial has focus).
 */

import { DIALS, DIAL_KEYS, type DialKey, type DialSpec, type DialState } from './state';

const STYLE_ID = 'board-panel-style';

const CSS = `
.board-panel {
  position: fixed; top: 8px; right: 8px; z-index: 2000;
  width: 288px; max-height: calc(100vh - 16px); overflow-y: auto;
  padding: 8px 10px 10px; box-sizing: border-box;
  background: rgba(8, 12, 10, 0.92); color: #cfe8d4;
  border: 1px solid #3c6b4a; border-radius: 3px;
  font: 12px/1.35 'JetBrains Mono', 'DejaVu Sans Mono', monospace;
}
.board-panel[hidden] { display: none; }
.board-panel h2 { margin: 0 0 6px; font-size: 12px; font-weight: 400; color: #7fd69a; letter-spacing: 0.06em; }
.board-panel .bp-row { display: grid; grid-template-columns: 92px 1fr 40px; align-items: center; gap: 6px; margin: 3px 0; }
.board-panel .bp-row label { color: #9fc4a8; }
.board-panel .bp-row output { text-align: right; color: #e6f4e9; font-variant-numeric: tabular-nums; }
.board-panel select, .board-panel input[type='range'] { width: 100%; min-width: 0; }
.board-panel select { background: #0d1510; color: inherit; border: 1px solid #3c6b4a; font: inherit; }
.board-panel .bp-hint { grid-column: 1 / -1; margin: -1px 0 3px; color: #6f8f78; font-size: 11px; }
.board-panel .bp-changed label { color: #ffd37a; }
.board-panel .bp-foot { display: flex; gap: 6px; margin-top: 8px; }
.board-panel button { flex: 1; background: #0d1510; color: inherit; border: 1px solid #3c6b4a; font: inherit; padding: 3px 0; cursor: pointer; }
.board-panel button:hover, .board-panel button:focus-visible { border-color: #7fd69a; }
.board-panel .bp-status { margin-top: 6px; color: #6f8f78; font-size: 11px; white-space: pre-wrap; }
`;

export interface PanelCallbacks {
  onChange(key: DialKey, value: string | number | boolean): void;
  onReset(): void;
}

export class BoardPanelView {
  readonly root: HTMLElement;
  private readonly rows = new Map<DialKey, { row: HTMLElement; read: () => void }>();
  private readonly status: HTMLElement;

  constructor(
    private readonly state: () => DialState,
    private readonly callbacks: PanelCallbacks,
  ) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    this.root = document.createElement('section');
    this.root.className = 'board-panel';
    this.root.hidden = true;
    this.root.setAttribute('aria-label', 'Board explorer (dev)');
    this.root.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey && e.altKey)) e.stopPropagation();
    });

    const title = document.createElement('h2');
    title.textContent = 'BOARD EXPLORER · dev · Ctrl+Alt+P';
    this.root.appendChild(title);

    for (const key of DIAL_KEYS) this.root.appendChild(this.buildRow(key, DIALS[key]));

    const foot = document.createElement('div');
    foot.className = 'bp-foot';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'reset to today';
    reset.addEventListener('click', () => this.callbacks.onReset());
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'copy bookmark';
    copy.addEventListener('click', () => {
      void navigator.clipboard?.writeText(location.href).then(
        () => this.setStatus('bookmark copied'),
        () => this.setStatus(location.href),
      );
    });
    foot.append(reset, copy);
    this.root.appendChild(foot);

    this.status = document.createElement('div');
    this.status.className = 'bp-status';
    this.root.appendChild(this.status);

    document.body.appendChild(this.root);
  }

  private buildRow(key: DialKey, spec: DialSpec): HTMLElement {
    const row = document.createElement('div');
    row.className = 'bp-row';
    const id = `bp-${key}`;
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = spec.label;
    const readout = document.createElement('output');
    let control: HTMLSelectElement | HTMLInputElement;
    let read: () => void;

    if (spec.kind === 'enum') {
      const select = document.createElement('select');
      for (const option of spec.options) select.add(new Option(option, option));
      select.addEventListener('change', () => this.callbacks.onChange(key, select.value));
      read = () => {
        select.value = String(this.state()[key]);
      };
      control = select;
    } else if (spec.kind === 'range') {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.addEventListener('input', () => this.callbacks.onChange(key, Number(input.value)));
      read = () => {
        input.value = String(this.state()[key]);
        readout.textContent = Number(this.state()[key]).toFixed(2);
      };
      control = input;
    } else {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.style.justifySelf = 'start';
      input.addEventListener('change', () => this.callbacks.onChange(key, input.checked));
      read = () => {
        input.checked = this.state()[key] === true;
      };
      control = input;
    }
    control.id = id;
    row.append(label, control, readout);
    if (spec.hint !== undefined) {
      const hint = document.createElement('div');
      hint.className = 'bp-hint';
      hint.textContent = spec.hint;
      row.appendChild(hint);
    }
    this.rows.set(key, {
      row,
      read: () => {
        read();
        row.classList.toggle('bp-changed', this.state()[key] !== spec.def);
      },
    });
    return row;
  }

  /** Re-read every control from the state (after a reset or a URL load). */
  refresh(): void {
    for (const { read } of this.rows.values()) read();
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  setOpen(open: boolean): void {
    this.root.hidden = !open;
    if (open) this.refresh();
  }
}
