/**
 * H4b — the post-turn outcome screen. Shown after each turn resolves (on
 * `turn:resolved`): the tactical winner, what each pool LOST this turn (the
 * APPLIED chips, §91a2 — labeled by the rule set the turn paid, §91d: the
 * opposing survivors under the survivors rule, each pool's own fallen under
 * casualties, both on a tick-capped turn under the surcharge), both pools
 * after the chip, and the encounter's status. Advances ONLY on the Continue
 * click (M3 removed the H4b auto-timer, matching the K3 pre-turn change —
 * turn pacing is fully player-driven); `advanceTurn` either rolls into the
 * next turn or ends the encounter.
 */

import type { GameEvents } from '../core/events';
import { t } from '../i18n/ui';
import type { RunDispatcher } from '../run/Command';
import type { FallenRecord } from '../run/Run';
import type { AudioPlayer } from '../audio/AudioPlayer';
import { rulesForTurn } from '../run/chipRule';
import { ARCHETYPE_CONFIG, glyphForArchetype } from '../sim/archetypes';
import { chipLineLabels, POOL_LABELS } from './chipLabels';
import { Screen } from './Screen';
import { button } from './button';
import { renderPoolGauge } from './poolGauge';

export class PostTurnScreen extends Screen {

  constructor(
    mount: HTMLElement,
    private readonly dispatcher: RunDispatcher,
    private readonly audio: AudioPlayer,
  ) {
    super(mount);
  }

  show(info: GameEvents['turn:resolved']): void {
    this.hide();
    this.present(this.render(info));
  }

  private advance(): void {
    this.dispatcher.dispatch({ kind: 'advanceTurn' });
  }

  private render(info: GameEvents['turn:resolved']): HTMLDivElement {
    const panel = document.createElement('div');
    panel.className = 'postturn-screen';

    const heading = document.createElement('div');
    heading.className = `postturn-heading postturn-heading--${info.winner}`;
    // §91d — a draw names its kind: a tick-cap stall (the surcharge's trigger)
    // reads differently from a mutual wipe (the largest casualty turn).
    heading.textContent =
      info.winner === 'player'
        ? 'Skirmish Won'
        : info.winner === 'enemy'
          ? 'Skirmish Lost'
          : info.reason === 'cap'
            ? 'Skirmish Drawn — tick cap'
            : info.reason === 'mutualWipe'
              ? 'Skirmish Drawn — mutual wipe'
              : 'Skirmish Drawn';
    panel.appendChild(heading);

    // §91d — the chip lines are labeled by the rule set THIS turn paid (the
    // live modes + the reason), so the words match the applied numbers under
    // either rule, and a two-rule cap turn says so.
    const labels = chipLineLabels(rulesForTurn(info.reason));
    const chips = document.createElement('div');
    chips.className = 'postturn-chips';
    chips.append(
      chipLine('player', labels.toEnemyPool, info.enemyPoolChip),
      chipLine('enemy', labels.toPlayerPool, info.playerPoolChip),
    );
    panel.appendChild(chips);

    // 94d — the fallen ledger: who fell THIS turn on each side (the rows the
    // chip lines above add up to), then the encounter's record by turn.
    panel.appendChild(renderFallen(info.fallen, info.turn));

    const pools = document.createElement('div');
    pools.className = 'postturn-pools';
    pools.append(
      renderPoolGauge('player', POOL_LABELS.player, info.playerHealth, info.playerHealthMax),
      renderPoolGauge('enemy', POOL_LABELS.enemy, info.enemyHealth, info.enemyHealthMax),
    );
    panel.appendChild(pools);

    const status = document.createElement('div');
    status.className = `postturn-status postturn-status--${info.result}`;
    status.textContent =
      info.result === 'won'
        ? 'Encounter cleared!'
        : info.result === 'lost'
          ? 'Your run ends here.'
          : `Next: Turn ${info.turn + 1}`;
    panel.appendChild(status);

    const cont = button(`${t('common.continue')} ▸`, {
      className: 'btn--primary',
      onClick: () => {
        this.audio.play('click');
        this.advance();
      },
    });
    panel.appendChild(cont);

    return panel;
  }
}

function chipLine(side: 'player' | 'enemy', label: string, amount: number): HTMLDivElement {
  const row = document.createElement('div');
  row.className = `postturn-chip postturn-chip--${side}`;
  const text = document.createElement('span');
  text.textContent = label;
  const value = document.createElement('span');
  value.className = 'postturn-chip-amount';
  // A 0 chip (a side fully wiped this turn) shows "0", not "−0".
  value.textContent = amount > 0 ? `−${amount}` : '0';
  row.append(text, value);
  return row;
}

/** 94d — the archetype's display name (the catalog's), falling back to the id
 *  for a row whose archetype left the catalog (an old save). */
function nameOf(archetype: string): string {
  return ARCHETYPE_CONFIG[archetype]?.name ?? archetype;
}

/** 94d — the fallen block: two columns for THIS turn (yours / theirs, in
 *  death order: glyph · name · level · what the pool lost), then the
 *  encounter so far as one line per turn of glyphs per side. Pure DOM off
 *  the `turn:resolved.fallen` rows — the sums match the chip lines by
 *  construction (the Run test pins it). */
function renderFallen(fallen: GameEvents['turn:resolved']['fallen'], turn: number): HTMLDivElement {
  const block = document.createElement('div');
  block.className = 'postturn-fallen';

  const title = document.createElement('div');
  title.className = 'postturn-fallen-title';
  title.textContent = `Fallen — Turn ${turn}`;
  block.appendChild(title);

  const sides = document.createElement('div');
  sides.className = 'postturn-fallen-sides';
  sides.append(
    renderSide('player', 'Yours', fallen.thisTurn.filter((r) => r.side === 'player')),
    renderSide('enemy', 'Theirs', fallen.thisTurn.filter((r) => r.side === 'enemy')),
  );
  block.appendChild(sides);

  // The encounter so far — only worth a block once there is a second turn.
  const turns = [...new Set(fallen.encounter.map((r) => r.turn))].sort((a, b) => a - b);
  if (turns.length > 1) {
    const ledgerTitle = document.createElement('div');
    ledgerTitle.className = 'postturn-fallen-title';
    ledgerTitle.textContent = 'This encounter';
    block.appendChild(ledgerTitle);
    const ledger = document.createElement('div');
    ledger.className = 'postturn-ledger';
    for (const t of turns) {
      const row = document.createElement('div');
      row.className = `postturn-ledger-turn${t === turn ? ' postturn-ledger-turn--current' : ''}`;
      const label = document.createElement('span');
      label.className = 'postturn-ledger-label';
      label.textContent = `Turn ${t}`;
      const rows = fallen.encounter.filter((r) => r.turn === t);
      row.append(label, glyphRun('player', rows), glyphRun('enemy', rows));
      ledger.appendChild(row);
    }
    block.appendChild(ledger);
  }
  return block;
}

function renderSide(side: 'player' | 'enemy', label: string, rows: readonly FallenRecord[]): HTMLDivElement {
  const col = document.createElement('div');
  col.className = `postturn-fallen-side postturn-fallen-side--${side}`;
  const head = document.createElement('div');
  head.className = 'postturn-fallen-side-head';
  const name = document.createElement('span');
  name.textContent = label;
  const total = document.createElement('span');
  const lost = rows.reduce((s, r) => s + r.power, 0);
  total.textContent = lost > 0 ? `−${lost}` : '0';
  head.append(name, total);
  col.appendChild(head);
  if (rows.length === 0) {
    const none = document.createElement('div');
    none.className = 'postturn-fallen-none';
    none.textContent = 'nobody fell';
    col.appendChild(none);
    return col;
  }
  for (const r of rows) {
    const line = document.createElement('div');
    line.className = 'postturn-fallen-row';
    const who = document.createElement('span');
    const glyph = document.createElement('span');
    glyph.className = 'postturn-fallen-glyph';
    glyph.textContent = glyphForArchetype(r.archetype);
    const text = document.createElement('span');
    text.textContent = `${nameOf(r.archetype)} Lv${r.level}`;
    who.append(glyph, text);
    const cost = document.createElement('span');
    cost.textContent = r.power > 0 ? `−${r.power}` : '0';
    line.append(who, cost);
    col.appendChild(line);
  }
  return col;
}

/** One side's fallen for a turn as a run of glyphs (`·` when nobody fell),
 *  titled with the names for a hover. */
function glyphRun(side: 'player' | 'enemy', rows: readonly FallenRecord[]): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `postturn-ledger-glyphs postturn-ledger-glyphs--${side}`;
  const mine = rows.filter((r) => r.side === side);
  span.textContent = mine.length ? mine.map((r) => glyphForArchetype(r.archetype)).join(' ') : '·';
  span.title = mine.map((r) => `${nameOf(r.archetype)} Lv${r.level} (−${r.power})`).join(', ');
  return span;
}
