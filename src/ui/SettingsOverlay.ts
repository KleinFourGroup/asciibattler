/**
 * 116d — THE SETTINGS (Round 8 spec D7): one modal, the 96f shell
 * (src/ui/modal.ts), with two openers. On the menu it is the Settings row.
 * During a run it is a chip in the chrome column, third, between the cache
 * and the map chips, so it never moves: the two above it never hide while a
 * run is live. Opened from a run, the modal also holds Quit to menu.
 *
 * WHILE IT IS OPEN the battle behind it stands still and no hotkey fires:
 * the modal takes a hold on the playback (`PlaybackSpeed.hold`, which stops
 * the pre-battle countdown too and leaves the player's own pause alone) and
 * suspends the key registry (`Keybindings.suspend`), and gives both back
 * when it closes, by whichever route. A key pressed in the modal is the
 * modal's: Tab walks it, Esc closes it, Enter and Space press its buttons.
 *
 * THE ROWS (DESIGN §UI idioms, "Fields"): a name on the left, with a line
 * under it where the name alone doesn't say what the row does, and the
 * control on the right. A CHOICE is a group of toggle buttons, the chosen
 * one filled (a fill survives the grey read; a hue alone would not) and
 * mirrored as `aria-pressed`. A LEVEL is a native range input with a − and
 * a + beside it, so every value is a click away, and its value in a readout
 * of fixed width. Each control writes its setting as it changes, and the
 * setting reaches its consumer through `connectSettings`
 * (src/settings/apply.ts): nothing here touches the audio player's levels,
 * the motion gate or the renderer.
 *
 * A KEY (116e) is a button that shows an action's key. A click on it waits
 * for a key, and the next one pressed is the action's; `keySection` has the
 * rest.
 *
 * The body is built once per open, from the settings as they are then, and
 * each control repaints itself. Nothing in it comes or goes while it is up.
 *
 * Landing notes: the Palette row arrives at 116g, the data rows at 116h and
 * the text scale at 116k, each as a section here.
 */

import type { AudioPlayer } from '../audio/AudioPlayer';
import type { KeybindAction } from '../config/keybindings';
import { t } from '../i18n/ui';
import type { SettingsModel } from '../settings/model';
import {
  AURA_CHOICES,
  MOTION_CHOICES,
  SHAKE_CHOICES,
  type AuraChoice,
  type MotionChoice,
  type ShakeChoice,
} from '../settings/settings';
import { button } from './button';
import { captureVerdict, type Keybindings } from './Keybindings';
import { openModal, type ModalHandle } from './modal';
import type { PlaybackSpeed } from './PlaybackSpeed';

export interface SettingsOverlayDeps {
  /** Whether a run is live, which is when the modal offers Quit to menu. */
  runLive(): boolean;
  /** Whether that run is in the slot, for Continue to find after a quit. */
  runSaved(): boolean;
  /** Leave the live run for the menu (`Game.quitToMenu`). */
  quitToMenu(): void;
}

/** One click of a level's − or +, and one step of its slider, in percent. */
const LEVEL_STEP = 5;

// One literal key per choice, so a new choice fails to compile until it has
// its label (the rarity labels' shape).
const AURA_LABEL: Readonly<Record<AuraChoice, string>> = {
  track: t('settings.aura.track'),
  fill: t('settings.aura.fill'),
};
const MOTION_LABEL: Readonly<Record<MotionChoice, string>> = {
  system: t('settings.motion.system'),
  reduced: t('settings.motion.reduced'),
  full: t('settings.motion.full'),
};
const SHAKE_LABEL: Readonly<Record<ShakeChoice, string>> = {
  player: t('settings.shake.player'),
  enemy: t('settings.shake.enemy'),
  both: t('settings.shake.both'),
  none: t('settings.shake.none'),
};

// The key rows' names, in the order they are drawn: the time controls and the
// map down the first column, the orders and the tooltip key down the second.
// One literal key per action, so a new action fails to compile until it has
// its row. The names are the words the HUD and the map chip use.
const KEY_NAME: Readonly<Record<KeybindAction, string>> = {
  togglePause: t('hud.pause.pause'),
  speedHalf: t('settings.key.speed', { speed: 0.5 }),
  speed1: t('settings.key.speed', { speed: 1 }),
  speed2: t('settings.key.speed', { speed: 2 }),
  speed3: t('settings.key.speed', { speed: 3 }),
  toggleSectorMap: t('sectormap.chipTooltip'),
  engageObjective: t('hud.objective.engage'),
  focusObjective: t('hud.objective.focus'),
  holdObjective: t('hud.objective.hold'),
  stopObjective: t('hud.objective.stop'),
  showTooltip: t('settings.key.tooltip'),
};
const KEY_ROWS = Object.keys(KEY_NAME) as KeybindAction[];

interface Choice<T> {
  readonly value: T;
  readonly label: string;
}

export class SettingsOverlay {
  private readonly chip: HTMLButtonElement;
  private modal: ModalHandle | null = null;
  /** What the open body has to give back when the modal closes. */
  private readonly closers: Array<() => void> = [];

  constructor(
    /** The page mount: the MODAL's host (it must not sit inside the chrome
     *  column's stacking context). */
    private readonly mount: HTMLElement,
    /** The chrome column the CHIP mounts into (src/ui/chip.ts). */
    chips: HTMLElement,
    private readonly audio: AudioPlayer,
    private readonly settings: SettingsModel,
    private readonly playback: PlaybackSpeed,
    private readonly keybindings: Keybindings,
    private readonly deps: SettingsOverlayDeps,
  ) {
    // The glyph stays outside the locale value (DESIGN §UI idioms, Strings).
    this.chip = button(`⚙ ${t('settings.chip')}`, {
      className: 'chip settings-chip is-hidden',
      tooltip: t('settings.chipTooltip'),
      onClick: () => {
        this.audio.play('click');
        this.open();
      },
    });
    chips.appendChild(this.chip);
  }

  /** Game.swap pushes whether the chip shows: while a run is live and its
   *  end screen is not up. The menu has its own row. */
  setAvailable(available: boolean): void {
    this.chip.classList.toggle('is-hidden', !available);
  }

  get isOpen(): boolean {
    return this.modal !== null;
  }

  /** Open the modal (idempotent). Focus returns to whatever had it, the chip
   *  or the menu's row, when the modal closes (the shell's rule). */
  open(): void {
    if (this.modal !== null) return;
    const releaseHold = this.playback.hold();
    const releaseKeys = this.keybindings.suspend();
    this.modal = openModal(this.mount, {
      title: t('settings.title'),
      panelClass: 'settings-modal',
      onCloseClick: () => this.audio.play('click'),
      onClose: () => {
        for (const undo of this.closers.splice(0)) undo();
        releaseHold();
        releaseKeys();
        this.modal = null;
      },
    });
    this.modal.replaceBody(this.body());
  }

  close(): void {
    this.modal?.close(); // the shell's onClose releases the hold and the keys
  }

  private body(): HTMLDivElement {
    const now = this.settings.get();
    const body = document.createElement('div');
    body.className = 'settings-body';
    body.append(
      section(t('settings.section.sound')),
      this.levelRow('volumeMaster', t('settings.volumeMaster'), now.volumeMaster),
      this.levelRow('volumeSfx', t('settings.volumeSfx'), now.volumeSfx),
      section(t('settings.section.battle')),
      this.choiceRow(
        t('settings.speed'),
        t('settings.speed.hint'),
        this.playback.steps.map((value) => ({ value, label: `${value}×` })),
        now.speed,
        (value) => this.settings.set('speed', value),
      ),
      this.choiceRow(
        t('settings.aura'),
        t('settings.aura.hint'),
        AURA_CHOICES.map((value) => ({ value, label: AURA_LABEL[value] })),
        now.aura,
        (value) => this.settings.set('aura', value),
      ),
      section(t('settings.section.comfort')),
      this.choiceRow(
        t('settings.motion'),
        t('settings.motion.hint'),
        MOTION_CHOICES.map((value) => ({ value, label: MOTION_LABEL[value] })),
        now.motion,
        (value) => this.settings.set('motion', value),
      ),
      this.choiceRow(
        t('settings.shake'),
        t('settings.shake.hint'),
        SHAKE_CHOICES.map((value) => ({ value, label: SHAKE_LABEL[value] })),
        now.shake,
        (value) => this.settings.set('shake', value),
      ),
      section(t('settings.section.keys')),
      ...this.keySection(),
    );
    if (this.deps.runLive()) body.appendChild(this.quitRow());
    return body;
  }

  /**
   * 116e — THE KEY ROWS: each action's name and a button that shows its key,
   * in two columns where the modal is wide enough, so a swap shows both of
   * its rows at once.
   *
   * A click on a key waits for the next keydown, read through
   * `captureVerdict` (src/ui/Keybindings.ts): a plain key becomes the
   * action's, by the swap rule; Enter, Escape or Tab calls the wait off, and
   * so does a second click, a click elsewhere or a lost focus. While a row
   * waits, the keydown is this section's alone: it is taken in the capture
   * phase and goes no further, so Escape ends the wait and leaves the modal
   * open. The registry is suspended for as long as the modal is up, so no
   * hotkey can fire on the key being chosen.
   *
   * A rebind is stored as the overrides (`keys`), and the rows repaint when
   * the registry takes them back, which is the route a stored set takes at
   * boot. The line under the rows says what the last change did, since a
   * swap moves a second row the player didn't click.
   */
  private keySection(): HTMLElement[] {
    const hint = document.createElement('div');
    hint.className = 'settings-row__hint';
    hint.textContent = t('settings.key.hint');

    // One line, kept while it has no words, so nothing moves when it gets some.
    const notice = document.createElement('div');
    notice.className = 'settings-keys__notice';
    notice.setAttribute('aria-live', 'polite');

    const rows = document.createElement('div');
    rows.className = 'settings-keys';

    const keys = new Map<KeybindAction, HTMLButtonElement>();
    let waiting: KeybindAction | null = null;
    // The key that ended a wait, until it is released: on its way up it can
    // press the focused button (Space does), and that click is not a new wait.
    let stillDown: string | null = null;

    const paint = (): void => {
      for (const [action, el] of keys) {
        const shown = action === waiting ? t('settings.key.press') : this.keybindings.labelFor(action);
        el.textContent = shown;
        el.classList.toggle('is-waiting', action === waiting);
        el.setAttribute('aria-label', t('settings.key.aria', { name: KEY_NAME[action], key: shown }));
      }
    };

    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code !== stillDown) return;
      e.preventDefault();
      window.removeEventListener('keyup', onKeyUp, true);
      // Cleared after the click the release would send, if it sends one.
      window.setTimeout(() => {
        stillDown = null;
      }, 0);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      const action = waiting;
      if (action === null) return;
      const verdict = captureVerdict(e);
      if (verdict === 'pass') return;
      if (verdict === 'walk') {
        stop();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (verdict === 'swallow') return;
      stillDown = e.code;
      window.addEventListener('keyup', onKeyUp, true);
      stop();
      if (verdict === 'bind') this.rebind(action, e.code, notice);
    };
    const stop = (): void => {
      if (waiting === null) return;
      waiting = null;
      window.removeEventListener('keydown', onKeyDown, true);
      paint();
    };
    const start = (action: KeybindAction): void => {
      stop();
      waiting = action;
      window.addEventListener('keydown', onKeyDown, true);
      paint();
    };

    for (const action of KEY_ROWS) {
      const key = button('', {
        className: 'settings-key',
        onClick: (ev) => {
          // A click a key made has no click count; a pointer's has.
          if (stillDown !== null && ev.detail === 0) return;
          this.audio.play('click');
          if (waiting === action) {
            stop();
            return;
          }
          // Not every browser focuses a button it clicks, and the wait ends
          // when focus leaves.
          key.focus();
          start(action);
        },
      });
      key.addEventListener('blur', () => {
        if (waiting === action) stop();
      });
      keys.set(action, key);
      rows.appendChild(row(KEY_NAME[action], null, key));
    }
    paint();

    const reset = button(t('settings.key.reset'), {
      className: 'settings-action',
      onClick: () => {
        stop();
        this.settings.set('keys', {});
        this.audio.play('click');
        notice.textContent = t('settings.key.resetDone');
      },
    });

    this.closers.push(this.keybindings.onChange(paint), stop, () => {
      window.removeEventListener('keyup', onKeyUp, true);
    });
    return [hint, rows, notice, row(t('settings.key.all'), null, reset)];
  }

  /** Put `action` on `code` and say what that did. */
  private rebind(action: KeybindAction, code: string, notice: HTMLElement): void {
    const holder = this.keybindings.actionFor(code);
    if (holder === action) return;
    const overrides = this.keybindings.overridesWith(action, code);
    if (overrides === null) return;
    this.settings.set('keys', overrides);
    this.audio.play('click');
    const name = KEY_NAME[action];
    const key = this.keybindings.labelFor(action);
    notice.textContent =
      holder === null
        ? t('settings.key.moved', { name, key })
        : t('settings.key.swapped', {
            name,
            key,
            other: KEY_NAME[holder],
            otherKey: this.keybindings.labelFor(holder),
          });
  }

  /** A choice: one toggle per value, the chosen one filled. */
  private choiceRow<T>(
    name: string,
    hint: string,
    choices: ReadonlyArray<Choice<T>>,
    current: T,
    set: (value: T) => void,
  ): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'settings-choices';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', name);
    const toggles: Array<readonly [T, HTMLButtonElement]> = [];
    const paint = (chosen: T): void => {
      for (const [value, toggle] of toggles) {
        const on = value === chosen;
        toggle.classList.toggle('is-active', on);
        toggle.setAttribute('aria-pressed', String(on));
      }
    };
    for (const choice of choices) {
      const toggle = button(choice.label, {
        className: 'settings-choice',
        onClick: () => {
          set(choice.value);
          paint(choice.value);
          this.audio.play('click');
        },
      });
      toggles.push([choice.value, toggle]);
      group.appendChild(toggle);
    }
    paint(current);
    return row(name, hint, group);
  }

  /** A level, 0 to 1 stored and 0 to 100 % shown: − · the slider · + · the
   *  value. The setting follows the slider as it moves; the click that lets
   *  the player hear the new level plays when the move ends, and on each
   *  press of − or +. */
  private levelRow(key: 'volumeMaster' | 'volumeSfx', name: string, level: number): HTMLDivElement {
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'settings-level__slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = String(LEVEL_STEP);
    slider.setAttribute('aria-label', name);
    // The input keeps what it is given inside its range and on its steps.
    slider.value = String(Math.round(level * 100));

    const readout = document.createElement('span');
    readout.className = 'settings-level__value';
    const show = (): void => {
      readout.textContent = `${slider.value}%`;
    };
    const store = (): void => {
      this.settings.set(key, Number(slider.value) / 100);
      show();
    };
    const nudge = (by: number): void => {
      slider.value = String(Number(slider.value) + by);
      store();
      this.audio.play('click');
    };
    slider.addEventListener('input', store);
    slider.addEventListener('change', () => this.audio.play('click'));

    const lower = button('−', { className: 'settings-step', onClick: () => nudge(-LEVEL_STEP) });
    lower.setAttribute('aria-label', t('settings.lower', { name }));
    const raise = button('+', { className: 'settings-step', onClick: () => nudge(LEVEL_STEP) });
    raise.setAttribute('aria-label', t('settings.raise', { name }));

    const control = document.createElement('div');
    control.className = 'settings-level';
    control.append(lower, slider, raise, readout);
    show();
    return row(name, null, control);
  }

  /** Quit to menu, with what becomes of the run said under it. */
  private quitRow(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'settings-quit';
    wrap.appendChild(
      button(t('settings.quit'), {
        className: 'btn--primary',
        onClick: () => {
          this.audio.play('click');
          this.close();
          this.deps.quitToMenu();
        },
      }),
    );
    const hint = document.createElement('div');
    hint.className = 'settings-row__hint';
    hint.textContent = this.deps.runSaved() ? t('settings.quit.saved') : t('settings.quit.unsaved');
    wrap.appendChild(hint);
    return wrap;
  }
}

function section(title: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'settings-section';
  el.textContent = title;
  return el;
}

function row(name: string, hint: string | null, control: HTMLElement): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'settings-row';
  const label = document.createElement('div');
  label.className = 'settings-row__label';
  const nameEl = document.createElement('div');
  nameEl.className = 'settings-row__name';
  nameEl.textContent = name;
  label.appendChild(nameEl);
  if (hint !== null) {
    const hintEl = document.createElement('div');
    hintEl.className = 'settings-row__hint';
    hintEl.textContent = hint;
    label.appendChild(hintEl);
  }
  el.append(label, control);
  return el;
}
