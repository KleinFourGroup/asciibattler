/**
 * The stat sheet's page (§149): three read-only tables over the model in
 * this folder — the duel against a sector's enemies, the stat and growth
 * ranks, and the weapon table. No config is written.
 */

import '../../src/fonts.css';
import './page.css';
import { DAEMONS } from '../../src/config/daemons';
import { ESCALATION_LEVELS, leverFactors } from '../../src/config/escalation';
import { SECTORS } from '../../src/config/sectors';
import { UNIT_DEFS } from '../../src/config/units';
import type { EncounterKind } from '../../src/config/encounters';
import type { UnitStats } from '../../src/sim/Unit';
import { duel, rankWithin, ranks, weaponTable } from './duel';
import { placeOf, shade, type ColourMode } from './colour';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const fmt = (x: number, d = 1): string => (Number.isFinite(x) ? x.toFixed(d) : '∞');
const pct = (x: number): string => `${Math.round(x * 100)}%`;

type Mods = Partial<Record<keyof UnitStats, number>>;

/** The empowering daemons' buffs (`grantEmpowers`), read off their rules. */
function empowers(): { name: string; mods: Mods }[] {
  const out: { name: string; mods: Mods }[] = [];
  const walk = (node: unknown, name: string): void => {
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (o.op === 'grantEmpowers') {
      const buff = o.buff as { mods?: Record<string, { add?: number }> } | undefined;
      const mods: Mods = {};
      for (const [k, v] of Object.entries(buff?.mods ?? {})) if (v.add) mods[k as keyof UnitStats] = v.add;
      out.push({ name, mods });
      return;
    }
    for (const v of Object.values(o)) walk(v, name);
  };
  for (const d of DAEMONS) walk(d.rules, d.name);
  return out;
}

const EMPOWERS = empowers();

function option(sel: HTMLSelectElement, value: string, label: string): void {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = label;
  sel.append(o);
}

function setup(): void {
  const arch = $<HTMLSelectElement>('archetype');
  const ids = Object.keys(UNIT_DEFS);
  for (const id of ids.filter((i) => UNIT_DEFS[i]!.draftable)) option(arch, id, `${UNIT_DEFS[id]!.name}`);
  for (const id of ids.filter((i) => !UNIT_DEFS[i]!.draftable)) option(arch, id, `${UNIT_DEFS[id]!.name} (enemy)`);
  const sector = $<HTMLSelectElement>('sector');
  for (const s of SECTORS) option(sector, s.id, s.id);
  const buff = $<HTMLSelectElement>('buff');
  option(buff, '', 'none');
  EMPOWERS.forEach((e, i) => option(buff, String(i), `${e.name} (${Object.entries(e.mods).map(([k, v]) => `+${v} ${k}`).join(', ')})`));
  const esc = $<HTMLSelectElement>('escalation');
  option(esc, '0', '0 (off)');
  ESCALATION_LEVELS.forEach((_, i) => option(esc, String(i + 1), String(i + 1)));
  for (const id of ['archetype', 'level', 'sector', 'kind', 'buff', 'escalation', 'group', 'which', 'colour']) {
    $(id).addEventListener('change', render);
  }
}

/** A cell: its text, and a background when it is coloured. */
type Cell = string | { readonly text: string; readonly bg: string };

function table(el: HTMLTableElement, head: string[], rows: Cell[][], mark?: (i: number) => boolean): void {
  const td = (c: Cell): string => (typeof c === 'string' ? `<td>${c}</td>` : `<td style="background:${c.bg}">${c.text}</td>`);
  el.innerHTML =
    `<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>` +
    rows.map((r, i) => `<tr${mark?.(i) ? ' class="mine"' : ''}>${r.map(td).join('')}</tr>`).join('') +
    '</tbody>';
}

const colourMode = (): ColourMode => $<HTMLSelectElement>('colour').value as ColourMode;

function renderDuel(): void {
  const archetype = $<HTMLSelectElement>('archetype').value;
  const level = Math.max(1, Math.min(20, Math.round(Number($<HTMLInputElement>('level').value) || 1)));
  const sector = $<HTMLSelectElement>('sector').value;
  const kind = $<HTMLSelectElement>('kind').value as EncounterKind;
  const buffIdx = $<HTMLSelectElement>('buff').value;
  const escLevel = Number($<HTMLSelectElement>('escalation').value);
  const factors = escLevel > 0 ? leverFactors(ESCALATION_LEVELS[escLevel - 1]!) : undefined;
  const d = duel(archetype, level, sector, kind, {
    ...(buffIdx === '' ? {} : { buffs: EMPOWERS[Number(buffIdx)]!.mods }),
    ...(factors ? { waveSizeMultiplier: factors.waveSize, levelBudgetMultiplier: factors.levelBudget } : {}),
  });
  const edge = d.ttkReceived / d.ttkDealt;
  $('duel-summary').innerHTML =
    `<b>${UNIT_DEFS[archetype]!.name}</b> at level ${level}: HP <b>${fmt(d.unit.hp)}</b>, weapon <b>${d.unit.weapon ?? 'none'}</b>` +
    (d.unit.hps > 0 ? `, heals <b>${fmt(d.unit.hps)}</b> a second` : '') +
    `<br>Against ${sector}'s ${kind} enemies: deals <b>${fmt(d.dpsDealt)}</b> a second, takes <b>${fmt(d.dpsReceived)}</b>; ` +
    `kills one in <b>${fmt(d.ttkDealt)} s</b>, is killed in <b>${fmt(d.ttkReceived)} s</b> (edge <b>${fmt(edge, 2)}×</b>)` +
    (d.neverKilledShare > 0 ? `; ${pct(d.neverKilledShare)} of them it cannot kill within 120 s` : '') +
    (d.neverKillsShare > 0 ? `; ${pct(d.neverKillsShare)} of them cannot kill it` : '');
  table(
    $<HTMLTableElement>('duel-table'),
    ['enemy', 'level', 'share', 'HP', 'DEF', 'kill it in', 'killed in', 'dealt /s', 'taken /s'],
    d.rows.map((r) => [
      UNIT_DEFS[r.archetype]?.name ?? r.archetype,
      String(r.level),
      pct(r.share),
      fmt(r.hp, 0),
      fmt(r.defense, 0),
      `${fmt(r.ttkDealt)} s`,
      `${fmt(r.ttkReceived)} s`,
      fmt(r.dpsDealt),
      fmt(r.dpsReceived),
    ]),
  );
}

function renderRanks(): void {
  const group = $<HTMLSelectElement>('group').value as 'draftable' | 'enemy';
  const which = $<HTMLSelectElement>('which').value as 'base' | 'growth';
  const archetype = $<HTMLSelectElement>('archetype').value;
  const r = ranks(group);
  const ids = Object.keys(r);
  const keys = Object.keys(r[ids[0]!]![which]);
  const digits = which === 'growth' ? 2 : 0;
  table(
    $<HTMLTableElement>('rank-table'),
    ['unit', ...keys],
    ids.map((id) => [
      UNIT_DEFS[id]!.name,
      ...keys.map((k) => {
        const c = r[id]![which][k]!;
        return {
          text: `${c.value.toFixed(digits)}<span class="pct">${pct(c.percentile)} · ${fmt(c.ofMean, 2)}×</span>`,
          bg: shade(placeOf(colourMode(), c.percentile, c.ofMean)),
        };
      }),
    ]),
    (i) => ids[i] === archetype,
  );
}

function renderWeapons(): void {
  const rows = weaponTable();
  const strikes = rows.filter((w) => w.verb !== 'heal');
  const perSecond = (w: (typeof rows)[number]): number => w.might / w.cooldownSeconds;
  // Coloured among the strikes alone; a heal's might is a different verb.
  const coloured = (w: (typeof rows)[number], f: (x: (typeof rows)[number]) => number, text: string): Cell => {
    if (w.verb === 'heal') return text;
    const r = rankWithin(strikes.map(f), f(w));
    return { text, bg: shade(placeOf(colourMode(), r.percentile, r.ofMean)) };
  };
  table(
    $<HTMLTableElement>('weapon-table'),
    ['weapon', 'carried by', 'verb', 'might', 'might /s', 'scales on', 'cooldown (high = slow)', 'range', 'target', 'crit base', 'past DEF', 'riders'],
    rows.map((w) => [
      w.id,
      w.wielders.map((u) => UNIT_DEFS[u]?.name ?? u).join(', '),
      w.verb,
      coloured(w, (x) => x.might, String(w.might)),
      coloured(w, perSecond, fmt(perSecond(w), 2)),
      w.scaling,
      `${w.cooldownSeconds} s${w.speedScaled ? '' : ' flat'}`,
      coloured(w, (x) => x.rangeCells, w.minRangeCells > 0 ? `${w.minRangeCells}–${w.rangeCells}` : String(w.rangeCells)),
      w.target,
      coloured(w, (x) => x.critBase, w.critBase > 0 ? pct(w.critBase) : '—'),
      w.bypassDefense ? 'yes' : '',
      w.riders.join(', '),
    ]),
  );
}

function render(): void {
  renderDuel();
  renderRanks();
  renderWeapons();
}

setup();
render();
