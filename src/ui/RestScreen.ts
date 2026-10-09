/**
 * The rest page. Shown while the run holds in the serialized `rest` phase:
 * a heading in the map's own glyph and word for the node, the rest's text,
 * and its one option with a line under it saying what the option does.
 *
 * The layout and classes are the event screen's (EventScreen.ts), in the
 * rest node's hue (`.event-screen--rest`), so a rest reads as the same kind
 * of page an event is. The content is not an event: a rest is a phase and a
 * command of its own (Run.ts, `handleChooseRestOption`).
 *
 * Display honesty: the effect line is `run.restPreview()`, which reads the
 * same pool arithmetic the option applies, so the line can't promise a heal
 * the click won't give (a full pool says so). Nothing is applied until the
 * click: a run saved here resumes here, unhealed.
 *
 * The option lands the run on 'promotion' (its own swap) or on 'map', which
 * Game's `chooseRestOption` case swaps; this screen never dismisses itself.
 */

import { t } from '../i18n/ui';
import type { RunDispatcher } from '../run/Command';
import type { AudioPlayer } from '../audio/AudioPlayer';
import type { Run } from '../run/Run';
import { KIND_GLYPH, KIND_LABEL } from './MapScreen';
import { Screen } from './Screen';
import { fmtPool } from './SectorClearedScreen';

/** The line under the rest's option: how far morale rises and the XP each
 *  unit banks. A full pool is named instead of a "+0". */
export function restEffectLine(preview: { readonly heal: number; readonly xp: number }): string {
  return preview.heal > 0
    ? t('rest.effect', { heal: fmtPool(preview.heal), xp: preview.xp })
    : t('rest.effectFull', { xp: preview.xp });
}

export class RestScreen extends Screen {
  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    private readonly run: Run,
  ) {
    super(mount);
  }

  show(): void {
    this.hide();
    const panel = document.createElement('div');
    panel.className = 'event-screen event-screen--rest';

    const body = document.createElement('div');
    body.className = 'event-body';
    panel.appendChild(body);

    const heading = document.createElement('div');
    heading.className = 'event-heading';
    heading.textContent = `${KIND_GLYPH.rest} ${KIND_LABEL.rest}`;
    body.appendChild(heading);

    const text = document.createElement('div');
    text.className = 'event-page-text';
    text.textContent = t('rest.text');
    body.appendChild(text);

    const choices = document.createElement('div');
    choices.className = 'event-choices';
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'event-choice';
    const label = document.createElement('div');
    label.className = 'event-choice__label';
    label.textContent = `▸ ${t('rest.option')}`;
    option.appendChild(label);
    const preview = this.run.restPreview();
    if (preview !== null) {
      const effect = document.createElement('div');
      effect.className = 'event-choice__req';
      effect.textContent = restEffectLine(preview);
      option.appendChild(effect);
    }
    option.addEventListener('click', () => {
      this.audio.play('click');
      this.dispatcher.dispatch({ kind: 'chooseRestOption', optionIndex: 0 });
    });
    choices.appendChild(option);
    body.appendChild(choices);

    this.present(panel);
  }
}
