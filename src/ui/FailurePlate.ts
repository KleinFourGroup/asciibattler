/**
 * 117.5i — THE FAILURE PLATE: what the page says when it has failed
 * (src/failure). The modal shell, not dismissable, over every other surface:
 * a title and a sentence for the kind of failure, the error's own text, the
 * build's ID, and Reload, the one way on. The error's text and the ID can be
 * selected, so a player can copy them into a report.
 *
 * It has to go up whatever failed, a boot included, so it takes nothing from
 * the Game: it mounts into `#ui` (which index.html holds) and reaches only
 * the shell, the button factory and the string table. It takes down the
 * loading line as it speaks, since a failed boot leaves that standing.
 *
 * Nothing under it hears a key: a hotkey, or Esc on a modal that was open
 * when the page failed, would move a game the plate has said is stopped.
 * Reload is the only stop for Tab, and Enter and Space press it as they
 * press any button.
 */

import { BUILD_ID } from '../buildId';
import type { FailureKind, FailureReport } from '../failure/rules';
import { t } from '../i18n/ui';
import { button } from './button';
import { openModal } from './modal';

function titleOf(kind: FailureKind): string {
  switch (kind) {
    case 'webgl':
    case 'boot':
      return t('failure.boot.title');
    case 'run':
      return t('failure.run.title');
    case 'context':
      return t('failure.context.title');
  }
}

function bodyOf(kind: FailureKind): string {
  switch (kind) {
    case 'webgl':
      return t('failure.webgl.body');
    case 'boot':
      return t('failure.boot.body');
    case 'run':
      return t('failure.run.body');
    case 'context':
      return t('failure.context.body');
  }
}

export function showFailurePlate(report: FailureReport): void {
  document.getElementById('boot-line')?.remove();

  const modal = openModal(document.getElementById('ui') ?? document.body, {
    title: titleOf(report.kind),
    panelClass: 'failure-plate',
    onClose: () => {},
  });
  modal.setDismissable(false);
  modal.overlay.classList.add('failure-overlay');

  const body = document.createElement('p');
  body.className = 'failure-plate__body';
  body.id = 'failure-plate-body';
  body.textContent = bodyOf(report.kind);

  const error = document.createElement('pre');
  error.className = 'failure-plate__error';
  error.textContent = report.text;

  const build = document.createElement('span');
  build.className = 'failure-plate__build';
  build.textContent = BUILD_ID;
  const reload = button(t('failure.reload'), {
    className: 'btn--primary',
    onClick: () => location.reload(),
  });
  const foot = document.createElement('div');
  foot.className = 'failure-plate__foot';
  foot.append(build, reload);

  modal.content.append(body, error, foot);
  // An alert, described by its sentence: a screen reader says both as the
  // plate takes focus.
  modal.content.setAttribute('role', 'alertdialog');
  modal.content.setAttribute('aria-describedby', body.id);
  reload.focus({ preventScroll: true });

  window.addEventListener(
    'keydown',
    (e) => {
      e.stopImmediatePropagation();
      if (e.key !== 'Tab') return;
      e.preventDefault();
      reload.focus({ preventScroll: true });
    },
    true,
  );
}
