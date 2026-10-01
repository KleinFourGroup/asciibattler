/**
 * Game Over modal. Two variants:
 *   - 'defeat'  — enemy wiped the player team.
 *   - 'complete' — player won the terminal battle.
 *
 * Same structure for both: heading, subtext, the run-end stats body (102d),
 * and the two actions side by side: "Begin a new run" and "Export run".
 * Variant only changes the copy and accent color, so reusing one component
 * keeps the reset/button flow uniform. The first button dispatches a
 * `resetRun` command (Game handles it by disposing the current Run and
 * starting a fresh one); the second downloads the run's journal as a
 * `.json` file (114e).
 *
 * 102d — THE STATS BODY ("the fallen"): `summarizeFallen(Run.fallenLedger)`
 * drawn as the run's totals and one row per encounter somebody fell in
 * (where · name · yours · theirs) — every side cell an archetype run
 * (`M×5 a×2`) + the morale it cost, the per-turn breakdown in the run's
 * tooltip. Grouped everywhere: a fight is many waves, and one glyph per
 * fallen does not fit a row. The
 * ledger records DEATHS only, so the table is worded as the fallen — a
 * bloodless fight has no row and the screen never claims to list the fights.
 */

import type { RunDispatcher } from '../run/Command';
import type { FallenRecord } from '../run/Run';
import {
  summarizeFallen,
  type EncounterFallen,
  type FallenSideStats,
  type RunFallenStats,
} from '../run/fallenStats';
import { getEncounter } from '../config/encounters';
import { t } from '../i18n/ui';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { journalFileName, type RunJournal } from '../journal/journal';
import { Screen } from './Screen';
import { button } from './button';
import { downloadText } from './download';
import { archetypeGlyphRun, archetypeLines, fallenSide } from './fallenSide';

export type GameOverVariant = 'defeat' | 'complete';

interface VariantCopy {
  heading: string;
  subtext: string;
}

const COPY: Record<GameOverVariant, VariantCopy> = {
  defeat: { heading: t('gameover.defeat.heading'), subtext: t('gameover.defeat.subtext') },
  complete: { heading: t('gameover.complete.heading'), subtext: t('gameover.complete.subtext') },
};

const SIDES = [
  { side: 'player', label: () => t('lastturn.yours') },
  { side: 'enemy', label: () => t('lastturn.theirs') },
] as const;

export class GameOverScreen extends Screen {

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
    /** The finished run's journal (`SceneContext.journal`). */
    private readonly journal: () => RunJournal | null,
  ) {
    super(mount);
  }

  show(variant: GameOverVariant = 'defeat', ledger: readonly FallenRecord[] = []): void {
    this.hide();
    this.present(this.render(variant, ledger));
  }

  private render(variant: GameOverVariant, ledger: readonly FallenRecord[]): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = `gameover-screen gameover-screen--${variant}`;

    const copy = COPY[variant];

    const heading = document.createElement('div');
    heading.className = 'gameover-heading';
    heading.textContent = copy.heading;
    panel.appendChild(heading);

    const subtext = document.createElement('div');
    subtext.className = 'gameover-subtext';
    subtext.textContent = copy.subtext;
    panel.appendChild(subtext);

    panel.appendChild(renderStats(summarizeFallen(ledger)));

    const actions = document.createElement('div');
    actions.className = 'gameover-actions';
    actions.appendChild(
      button(t('gameover.newRun'), {
        className: 'btn--primary btn--exit',
        onClick: () => {
          this.audio.play('click');
          this.dispatcher.dispatch({ kind: 'resetRun' });
        },
      }),
    );
    // 114e — the run's journal as a file (telemetry tier 1, Round 8 spec D5).
    // No button when the page holds no journal (its recorder failed). The
    // journal is read again at the click: this screen mounts from inside the
    // command that ended the run, before that journal has closed.
    if (this.journal() !== null) {
      actions.appendChild(
        button(t('gameover.export'), {
          className: 'btn--primary btn--exit',
          tooltip: t('gameover.exportTip'),
          onClick: () => {
            const journal = this.journal();
            if (journal === null) return;
            this.audio.play('click');
            downloadText(journalFileName(journal), JSON.stringify(journal));
          },
        }),
      );
    }
    panel.appendChild(actions);

    return panel;
  }
}

function renderStats(stats: RunFallenStats): HTMLDivElement {
  const body = document.createElement('div');
  body.className = 'gameover-stats';

  const title = document.createElement('div');
  title.className = 'gameover-stats-title';
  title.textContent = t('gameover.stats.title');
  body.appendChild(title);

  if (stats.encounters.length === 0) {
    const none = document.createElement('div');
    none.className = 'gameover-stats-none';
    none.textContent = t('gameover.stats.none');
    body.appendChild(none);
    return body;
  }

  // The run's totals: one glyph per fallen would not fit a whole run, so the
  // run-wide form groups by archetype.
  const totals = document.createElement('div');
  totals.className = 'gameover-stats-totals';
  for (const { side, label } of SIDES) {
    const s: FallenSideStats = stats[side];
    totals.appendChild(
      fallenSide({
        side,
        label: label(),
        glyphs: archetypeGlyphRun(s.byArchetype),
        glyphTooltip: archetypeLines(s.byArchetype),
        loss: s.power,
      }),
    );
  }
  body.appendChild(totals);

  const table = document.createElement('div');
  table.className = 'gameover-stats-table';
  for (const encounter of stats.encounters) table.append(...encounterRow(encounter));
  body.appendChild(table);
  return body;
}

/** One table row = four grid cells: where · the encounter's name · yours ·
 *  theirs. Each side's tooltip breaks its run down by turn. */
function encounterRow(encounter: EncounterFallen): HTMLElement[] {
  const where = document.createElement('span');
  where.className = 'gameover-stats-where';
  where.textContent = t('gameover.stats.where', { sector: encounter.sector + 1, hop: encounter.hop });

  const name = document.createElement('span');
  name.className = 'gameover-stats-name';
  name.textContent = getEncounter(encounter.encounterId)?.name ?? encounter.encounterId;

  // The archetype form here too, never one glyph per fallen: an encounter is
  // many waves (the first pane read drew 27 brigands in one no-wrap run and
  // pushed the table past the viewport) — grouped, a cell is bounded by the
  // archetype count, and so is each turn's block in the tooltip.
  const sides = SIDES.map(({ side, label }) =>
    fallenSide({
      side,
      label: label(),
      glyphs: archetypeGlyphRun(encounter[side].byArchetype),
      glyphTooltip: encounter.turns
        .filter((turn) => turn[side].count > 0)
        .map((turn) => `${t('gameover.stats.turn', { turn: turn.turn })}\n${archetypeLines(turn[side].byArchetype)}`)
        .join('\n'),
      loss: encounter[side].power,
    }),
  );
  return [where, name, ...sides];
}
