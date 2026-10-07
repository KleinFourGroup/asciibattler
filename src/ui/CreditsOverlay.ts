/**
 * 116j — THE CREDITS (Round 8 spec D6): a static panel, the 96f shell
 * (src/ui/modal.ts). The menu's Credits row opens it, and so does the end of
 * the first won run, over the menu it leads to (`creditsOnTheWay`,
 * src/scenes/menuRules.ts). Nothing in it moves or scrolls by itself, so
 * reduced motion needs no second form.
 *
 * WHO IS IN IT (the §116 shape-lock, call 10): the developer; Claude; the
 * two fonts and the three bundled libraries, each with its licence's name;
 * the tools the game is built with; the two tools its sounds were made in;
 * and the playtesters, thanked without names. Every line is a locale value,
 * the names too, so the screen is one table to a translator. The licences'
 * full texts are not here: they ship beside the build
 * (public/THIRD-PARTY-LICENSES.txt), and the last line says so.
 * tests/licences.test.ts holds that file to the libraries the game bundles;
 * a library it names that is not in the rows below wants its row here.
 *
 * The body is a scroll box with a tab stop, so on a window too short for
 * the list the keyboard can scroll it; its only control is the shell's ✕.
 *
 * Landing note: the translators' group arrives with the first second
 * locale, from `localeCredits()` (src/i18n/credits.ts), which gives nothing
 * for `en`.
 */

import type { AudioPlayer } from '../audio/AudioPlayer';
import { t } from '../i18n/ui';
import { openModal, type ModalHandle } from './modal';

/** A row: a name, and what is said beside it (a licence). */
type Row = readonly [name: string, note?: string];

export class CreditsOverlay {
  private modal: ModalHandle | null = null;

  constructor(
    /** The page mount: the modal's host. */
    private readonly mount: HTMLElement,
    private readonly audio: AudioPlayer,
  ) {}

  get isOpen(): boolean {
    return this.modal !== null;
  }

  /** Open the panel (idempotent). Focus returns to whatever had it, the
   *  menu's row or the menu itself, when it closes (the shell's rule). */
  open(): void {
    if (this.modal !== null) return;
    this.modal = openModal(this.mount, {
      title: t('credits.title'),
      panelClass: 'credits-modal',
      onCloseClick: () => this.audio.play('click'),
      onClose: () => {
        this.modal = null;
      },
    });
    this.modal.replaceBody(body());
  }
}

function body(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'credits-body';
  el.tabIndex = 0;
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', t('credits.title'));
  const mit = t('credits.licence.mit');
  el.append(
    group(t('credits.developer'), [[t('credits.developer.name')]]),
    group(t('credits.with'), [[t('credits.with.claude')]]),
    group(t('credits.fonts'), [
      [t('credits.fonts.jetbrains'), t('credits.licence.ofl')],
      [t('credits.fonts.dejavu'), t('credits.licence.vera')],
    ]),
    group(t('credits.libraries'), [
      [t('credits.libraries.three'), mit],
      [t('credits.libraries.simplex-noise'), mit],
      [t('credits.libraries.zod'), mit],
    ]),
    group(t('credits.tools'), [[t('credits.tools.list')]]),
    group(t('credits.sound'), [[t('credits.sound.list')]]),
    group(t('credits.thanks'), [[t('credits.thanks.playtesters')]]),
  );
  const licences = document.createElement('div');
  licences.className = 'credits-licences';
  licences.textContent = t('credits.licences');
  el.appendChild(licences);
  return el;
}

function group(label: string, rows: readonly Row[]): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'credits-group';
  const head = document.createElement('div');
  head.className = 'credits-group__label';
  head.textContent = label;
  el.appendChild(head);
  for (const [name, note] of rows) {
    const row = document.createElement('div');
    row.className = 'credits-row';
    const nameEl = document.createElement('span');
    nameEl.className = 'credits-row__name';
    nameEl.textContent = name;
    row.appendChild(nameEl);
    if (note !== undefined) {
      const noteEl = document.createElement('span');
      noteEl.className = 'credits-row__note';
      noteEl.textContent = note;
      row.appendChild(noteEl);
    }
    el.appendChild(row);
  }
  return el;
}
