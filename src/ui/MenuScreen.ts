/**
 * 116c — THE MENU, the boot screen (Round 8 spec D6): the game's name, then
 * the rows. Continue is first, and is there only when the run slot holds a
 * run this tab can load; New run goes on to character select; the seed field
 * is last, since most runs never touch it. Above the rows is what a boot has
 * to tell the player about saving: a notice for a rejected save, for a run
 * open in another tab, and for a store that can't save. The build's ID sits
 * in a corner, for a bug report.
 *
 * Everything is drawn once, when the screen is shown, so no row comes or goes
 * while the player aims at one (DESIGN "Layout stability"). A Continue that
 * no longer loads draws the screen again, which then says why.
 *
 * THE SEED FIELD is the first text field in the game (DESIGN §UI idioms,
 * "Fields"): a native `<input>` inside its `<label>`, cleaned to digits as it
 * is typed (src/scenes/menuRules.ts), so it has no refused state. Enter in it
 * is New run. Its text is the page's while character select is up, so Back
 * finds it as it was left.
 *
 * The Settings row (116d) opens the settings modal; focus comes back to the
 * row when it closes. Landing note: the Credits row arrives with the credits
 * (116j), between Settings and the seed field (spec D6's order).
 */

import type { AudioPlayer } from '../audio/AudioPlayer';
import { BUILD_ID } from '../buildId';
import { t } from '../i18n/ui';
import { SEED_MAX_DIGITS, cleanSeedText } from '../scenes/menuRules';
import type { MenuContext, SaveContext } from '../scenes/Scene';
import { runRejectedMessage } from '../store/runSlot';
import { Screen } from './Screen';
import { button } from './button';

/** The hint's id, for the field's `aria-describedby`. One menu is up at a time. */
const SEED_HINT_ID = 'menu-seed-hint';

export class MenuScreen extends Screen {
  constructor(
    mount: HTMLElement,
    private readonly audio: AudioPlayer,
    private readonly save: SaveContext,
    private readonly menu: MenuContext,
  ) {
    super(mount);
  }

  show(): void {
    this.hide();
    this.present(this.render());
  }

  private render(): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'menu-screen';

    const title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = t('menu.title');
    panel.appendChild(title);

    const slot = this.save.slot();
    const notices: string[] = [];
    if (slot === 'rejected') notices.push(runRejectedMessage());
    if (slot === 'elsewhere') notices.push(t('save.elsewhere'));
    if (!this.save.canSave()) notices.push(t('save.unavailable'));
    if (notices.length > 0) {
      const list = document.createElement('div');
      list.className = 'menu-notices';
      for (const text of notices) {
        const notice = document.createElement('div');
        notice.className = 'menu-notice';
        // The glyph stays outside the locale value (DESIGN §UI idioms, Strings).
        notice.textContent = `⚠ ${text}`;
        list.appendChild(notice);
      }
      panel.appendChild(list);
    }

    const rows = document.createElement('div');
    rows.className = 'menu-rows';
    panel.appendChild(rows);

    const field = this.seedField();
    const startNewRun = (): void => {
      this.audio.play('click');
      this.menu.newRun(field.value);
    };

    if (slot === 'saved') {
      rows.appendChild(
        button(t('save.continue'), {
          className: 'btn--primary',
          onClick: () => {
            this.audio.play('click');
            // The save loaded when this screen was drawn. If it no longer
            // does, draw the screen again, which says why.
            if (this.save.continue() !== 'ok') this.show();
          },
        }),
      );
    }
    rows.appendChild(button(t('menu.newRun'), { className: 'btn--primary', onClick: startNewRun }));
    rows.appendChild(
      button(t('menu.settings'), {
        className: 'btn--primary',
        onClick: () => {
          this.audio.play('click');
          this.menu.openSettings();
        },
      }),
    );

    // The field's name is its label's text, so a click on the word focuses it.
    const seed = document.createElement('label');
    seed.className = 'menu-seed';
    const name = document.createElement('span');
    name.className = 'menu-seed__name';
    name.textContent = t('menu.seed.label');
    seed.append(name, field);
    rows.appendChild(seed);
    field.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') startNewRun();
    });

    const hint = document.createElement('div');
    hint.className = 'menu-seed__hint';
    hint.id = SEED_HINT_ID;
    hint.textContent = t('menu.seed.hint');
    rows.appendChild(hint);

    // The build's ID, small in a corner: what a player quotes in a bug report.
    const build = document.createElement('div');
    build.className = 'menu-build';
    build.textContent = BUILD_ID;
    panel.appendChild(build);

    return panel;
  }

  private seedField(): HTMLInputElement {
    const field = document.createElement('input');
    field.type = 'text';
    field.className = 'menu-seed__field';
    // Digits only: a phone shows its number pad, and nothing completes or
    // corrects what is typed.
    field.inputMode = 'numeric';
    field.autocomplete = 'off';
    field.spellcheck = false;
    field.maxLength = SEED_MAX_DIGITS;
    field.placeholder = t('menu.seed.placeholder');
    field.setAttribute('aria-describedby', SEED_HINT_ID);
    field.value = cleanSeedText(this.menu.seedText());
    field.addEventListener('input', () => {
      const clean = cleanSeedText(field.value);
      if (clean !== field.value) field.value = clean;
    });
    return field;
  }
}
