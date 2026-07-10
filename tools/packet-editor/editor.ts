/**
 * Packet editor (49g). Standalone Vite page — visit
 * http://localhost:5173/tools/packet-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Authors `config/packets.json` — each packet's identity + use contexts +
 * ONE effect op — with the affordances the sector/encounter/reward editors
 * established:
 *
 *  1. **Live schema validation.** Every edit re-runs the SAME `PacketsSchema`
 *     the game boots on (src/config/packets.ts) — which carries the whole
 *     (op × target × context) legality matrix, the per-op duration
 *     restrictions, and the `applyTo`/`crit` dealHit-only guards — plus the
 *     boot asserts a bad save would trip at the NEXT load:
 *     `assertPacketStatusRefs` (an injected `applyStatus` must name a real
 *     status) and the rewards-side check in reverse (renaming/deleting a
 *     packet a committed reward table references would fail
 *     `assertRewardPacketRefs`). Save is disabled while any complain.
 *  2. **The matrix drives the form.** Picking an op swaps in that op's
 *     sub-form, auto-sets `target` from `PACKET_OP_TARGET`, and constrains
 *     the `usableIn` checkboxes to `PACKET_OP_CONTEXTS` (the `midBattle`
 *     box renders but stays disabled — the dormant seam, admitted by no op).
 *  3. **Save to disk.** Posts the formatted whole-file JSON (through
 *     `formatPacketsJson`) to the dev-only `/__save-config` endpoint
 *     (vite.config.ts allowlists `packets.json`). Copy / Download stay as
 *     offline fallbacks; the save-reload stash restores the active tab.
 *
 * A **Referenced by** pane lists the committed reward tables whose packet
 * entries name the active packet (attach entries in the reward editor).
 */

import './editor.css';
import {
  PACKETS,
  PACKET_OP_TARGET,
  PACKET_OP_CONTEXTS,
  PacketsSchema,
  USE_CONTEXTS,
  assertPacketStatusRefs,
  type PacketConfig,
  type PacketEffect,
  type UseContext,
} from '../../src/config/packets';
import { BATTLE_TRIGGER_KEYS } from '../../src/config/daemons';
import { STATUS_DEFS } from '../../src/config/statuses';
import { REWARD_TABLES } from '../../src/config/rewards';
import { STAT_LABELS } from '../../src/ui/statLabels';
import type { UnitStats } from '../../src/sim/Unit';
import { formatPacketsJson } from './format';

// ---- State ----
type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;
type WorkingPacket = DeepMutable<PacketConfig>;
type WorkingEffect = DeepMutable<PacketEffect>;
type PacketOp = PacketEffect['op'];
type StatKey = keyof UnitStats;

const PACKET_OPS = Object.keys(PACKET_OP_TARGET) as PacketOp[];
const STAT_KEYS = Object.keys(STAT_LABELS) as StatKey[];
const STATUS_IDS = Object.keys(STATUS_DEFS);

let working: WorkingPacket[] = structuredClone(PACKETS) as WorkingPacket[];
let activeIndex = 0;
let lastValid = true;

const SAVE_STASH_KEY = 'packetEditor.justSaved';

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const newBtn = mustQuery<HTMLButtonElement>('#new-btn');
const deleteBtn = mustQuery<HTMLButtonElement>('#delete-btn');
const idEl = mustQuery<HTMLInputElement>('#id');
const nameEl = mustQuery<HTMLInputElement>('#name');
const descEl = mustQuery<HTMLInputElement>('#description');
const opEl = mustQuery<HTMLSelectElement>('#op');
const targetEl = mustQuery<HTMLSpanElement>('#target');
const contextsEl = mustQuery<HTMLDivElement>('#contexts');
const effectFormEl = mustQuery<HTMLDivElement>('#effect-form');
const previewEl = mustQuery<HTMLDListElement>('#preview');
const refsEl = mustQuery<HTMLDListElement>('#refs');
const validationEl = mustQuery<HTMLUListElement>('#validation');
const exportEl = mustQuery<HTMLTextAreaElement>('#export');
const saveBtn = mustQuery<HTMLButtonElement>('#save-btn');
const revertBtn = mustQuery<HTMLButtonElement>('#revert-btn');
const saveStatusEl = mustQuery<HTMLParagraphElement>('#save-status');
const copyBtn = mustQuery<HTMLButtonElement>('#copy-btn');
const downloadBtn = mustQuery<HTMLButtonElement>('#download-btn');

// ---- Build ----
attachIdentity();
attachButtons();
buildOpSelect();
selectPacket(activeIndex);
restoreAfterSave();

function attachIdentity(): void {
  idEl.addEventListener('input', () => {
    packet().id = idEl.value;
    refreshTabs();
    refreshDerived();
  });
  nameEl.addEventListener('input', () => {
    packet().name = nameEl.value;
    refreshDerived();
  });
  descEl.addEventListener('input', () => {
    packet().description = descEl.value;
    refreshDerived();
  });
}

function attachButtons(): void {
  newBtn.addEventListener('click', addPacket);
  deleteBtn.addEventListener('click', deletePacket);
  saveBtn.addEventListener('click', () => void save());
  revertBtn.addEventListener('click', revert);
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(exportEl.value);
    flash(copyBtn, 'Copied!');
  });
  downloadBtn.addEventListener('click', () => {
    const blob = new Blob([`${exportEl.value}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'packets.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function buildOpSelect(): void {
  for (const op of PACKET_OPS) opEl.appendChild(option(op));
  opEl.addEventListener('change', () => {
    const op = opEl.value as PacketOp;
    const p = packet();
    p.effect = defaultEffect(op);
    // The matrix drives the rest: target is DERIVED, contexts prune to legal
    // (keeping current picks where still legal; never empty).
    p.target = PACKET_OP_TARGET[op];
    const legal = PACKET_OP_CONTEXTS[op];
    p.usableIn = p.usableIn.filter((c) => (legal as readonly UseContext[]).includes(c));
    if (p.usableIn.length === 0) p.usableIn = [legal[0]!];
    rebuildForm();
    refreshDerived();
  });
}

// ---- Packet mutation ----
function packet(): WorkingPacket {
  return working[activeIndex]!;
}

function addPacket(): void {
  let n = working.length + 1;
  let id = `packet-${n}`;
  while (working.some((p) => p.id === id)) id = `packet-${++n}`;
  working.push({
    id,
    name: 'New Packet',
    description: 'Describe the fire.',
    usableIn: [PACKET_OP_CONTEXTS.healPool[0]!],
    target: PACKET_OP_TARGET.healPool,
    effect: defaultEffect('healPool'),
  });
  selectPacket(working.length - 1);
}

function deletePacket(): void {
  if (working.length <= 1) {
    setSaveStatus('The catalog needs at least one packet — add another before deleting this.', 'err');
    return;
  }
  working.splice(activeIndex, 1);
  selectPacket(Math.min(activeIndex, working.length - 1));
}

/** A well-formed skeleton effect per op (the author then tunes it). */
function defaultEffect(op: PacketOp): WorkingEffect {
  switch (op) {
    case 'applyBuff':
      return {
        op: 'applyBuff',
        buff: { key: 'buffed', mods: { strength: { add: 4 } }, merge: 'add' },
        duration: 'encounter',
      };
    case 'grantRedraws':
      return { op: 'grantRedraws', redrawsPerTurn: 1, maxCardsPerTurn: 2 };
    case 'injectRule':
      return {
        op: 'injectRule',
        rule: {
          on: 'dealHit',
          effect: { op: 'applyStatus', statusId: STATUS_IDS[0] ?? 'poison', applyTo: 'target' },
        },
        duration: 'encounter',
      };
    case 'healPool':
      return { op: 'healPool', amount: 3 };
  }
}

// ---- The form ----
function selectPacket(index: number): void {
  activeIndex = index;
  const p = packet();
  idEl.value = p.id;
  nameEl.value = p.name;
  descEl.value = p.description;
  opEl.value = p.effect.op;
  rebuildForm();
  refreshTabs();
  refreshDerived();
}

/** Rebuild the op-dependent parts: the derived target line, the context
 *  checkboxes (matrix-constrained), and the effect sub-form. */
function rebuildForm(): void {
  const p = packet();
  targetEl.textContent =
    p.target === 'unit'
      ? 'unit — a hand card pre-turn, a roster unit out-of-battle'
      : p.target;
  buildContexts();
  buildEffectForm();
}

function buildContexts(): void {
  contextsEl.innerHTML = '';
  const p = packet();
  const legal: readonly UseContext[] = PACKET_OP_CONTEXTS[p.effect.op];
  for (const context of USE_CONTEXTS) {
    const wrap = el('label', 'check-row');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = p.usableIn.includes(context);
    box.disabled = !legal.includes(context);
    box.addEventListener('change', () => {
      if (box.checked) {
        if (!p.usableIn.includes(context)) p.usableIn.push(context);
        // Keep the array in the canonical vocabulary order (stable exports).
        p.usableIn.sort((a, b) => USE_CONTEXTS.indexOf(a) - USE_CONTEXTS.indexOf(b));
      } else {
        p.usableIn = p.usableIn.filter((c) => c !== context);
      }
      refreshDerived();
    });
    wrap.appendChild(box);
    wrap.append(
      el(
        'span',
        legal.includes(context) ? undefined : 'muted',
        context + (context === 'midBattle' ? ' (dormant seam — no op admits it)' : ''),
      ),
    );
    contextsEl.appendChild(wrap);
  }
}

function buildEffectForm(): void {
  effectFormEl.innerHTML = '';
  const effect = packet().effect;
  switch (effect.op) {
    case 'healPool':
      effectFormEl.appendChild(
        numField('amount (pool HP restored)', effect.amount, 1, (v) => {
          effect.amount = Math.max(1, Math.trunc(v));
          refreshDerived();
        }),
      );
      break;
    case 'grantRedraws':
      effectFormEl.appendChild(
        numField('redraw actions granted', effect.redrawsPerTurn, 1, (v) => {
          effect.redrawsPerTurn = Math.max(0, Math.trunc(v));
          refreshDerived();
        }),
      );
      effectFormEl.appendChild(
        numField('max cards per action', effect.maxCardsPerTurn, 1, (v) => {
          effect.maxCardsPerTurn = Math.max(0, Math.trunc(v));
          refreshDerived();
        }),
      );
      break;
    case 'applyBuff':
      buildBuffForm(effect);
      break;
    case 'injectRule':
      buildRuleForm(effect);
      break;
  }
}

// ---- applyBuff sub-form ----
function buildBuffForm(effect: Extract<WorkingEffect, { op: 'applyBuff' }>): void {
  const keyWrap = el('label', 'pool-num wide');
  keyWrap.append(el('span', undefined, 'buff key (distinct per source — the badge/merge identity)'));
  const keyInput = el('input');
  keyInput.type = 'text';
  keyInput.spellcheck = false;
  keyInput.value = effect.buff.key;
  keyInput.addEventListener('input', () => {
    effect.buff.key = keyInput.value;
    refreshDerived();
  });
  keyWrap.appendChild(keyInput);
  effectFormEl.appendChild(keyWrap);

  const mergeWrap = el('label', 'pool-num');
  mergeWrap.append(el('span', undefined, 'merge (re-applying the same key)'));
  const mergeSel = el('select');
  for (const m of ['replace', 'add', 'multiply', 'independent']) mergeSel.appendChild(option(m));
  mergeSel.value = effect.buff.merge;
  mergeSel.addEventListener('change', () => {
    effect.buff.merge = mergeSel.value as typeof effect.buff.merge;
    refreshDerived();
  });
  mergeWrap.appendChild(mergeSel);
  effectFormEl.appendChild(mergeWrap);

  const durNote = el(
    'p',
    'hint',
    'duration: encounter (schema-fixed — a run-duration buff needs a store nothing ships).',
  );
  effectFormEl.appendChild(durNote);

  const modsWrap = el('div', 'pool');
  const modsLabel = el('p', 'hint', 'stat mods (add and/or ×mul per stat; blank = omitted):');
  effectFormEl.append(modsLabel, modsWrap);
  buildModRows(effect, modsWrap);

  const addMod = el('button', undefined, '+ Add stat mod');
  addMod.type = 'button';
  addMod.addEventListener('click', () => {
    const free = STAT_KEYS.find((s) => !(s in effect.buff.mods));
    if (free === undefined) return; // every stat already modded
    effect.buff.mods[free] = { add: 1 };
    buildModRows(effect, modsWrap);
    refreshDerived();
  });
  effectFormEl.appendChild(addMod);
}

function buildModRows(
  effect: Extract<WorkingEffect, { op: 'applyBuff' }>,
  modsWrap: HTMLDivElement,
): void {
  modsWrap.innerHTML = '';
  for (const stat of Object.keys(effect.buff.mods) as StatKey[]) {
    const mod = effect.buff.mods[stat]!;
    const row = el('div', 'pool-row');

    const statSel = el('select');
    for (const s of STAT_KEYS) statSel.appendChild(option(s, STAT_LABELS[s]));
    statSel.value = stat;
    statSel.addEventListener('change', () => {
      const next = statSel.value as StatKey;
      if (next !== stat && !(next in effect.buff.mods)) {
        effect.buff.mods[next] = effect.buff.mods[stat]!;
        delete effect.buff.mods[stat];
      }
      buildModRows(effect, modsWrap);
      refreshDerived();
    });
    row.appendChild(statSel);

    row.appendChild(
      optionalNumField('add', mod.add, (v) => {
        if (v === undefined) delete mod.add;
        else mod.add = v;
        refreshDerived();
      }),
    );
    row.appendChild(
      optionalNumField('×mul', mod.mul, (v) => {
        if (v === undefined) delete mod.mul;
        else mod.mul = v;
        refreshDerived();
      }),
    );

    const remove = el('button', 'pool-remove', '✕');
    remove.type = 'button';
    remove.title = 'Remove this stat mod';
    remove.addEventListener('click', () => {
      delete effect.buff.mods[stat];
      buildModRows(effect, modsWrap);
      refreshDerived();
    });
    row.appendChild(remove);
    modsWrap.appendChild(row);
  }
}

// ---- injectRule sub-form ----
function buildRuleForm(effect: Extract<WorkingEffect, { op: 'injectRule' }>): void {
  const durWrap = el('label', 'pool-num');
  durWrap.append(el('span', undefined, 'duration (when the rule expires)'));
  const durSel = el('select');
  for (const d of ['encounter', 'run']) durSel.appendChild(option(d));
  durSel.value = effect.duration;
  durSel.addEventListener('change', () => {
    effect.duration = durSel.value as typeof effect.duration;
    refreshDerived();
  });
  durWrap.appendChild(durSel);
  effectFormEl.appendChild(durWrap);

  const onWrap = el('label', 'pool-num');
  onWrap.append(el('span', undefined, 'trigger'));
  const onSel = el('select');
  for (const t of BATTLE_TRIGGER_KEYS) onSel.appendChild(option(t));
  onSel.value = effect.rule.on;
  onSel.addEventListener('change', () => {
    effect.rule.on = onSel.value as typeof effect.rule.on;
    // The dealHit-only axes prune when the trigger leaves dealHit (the
    // parse matrix would reject them — keep the form always-saveable).
    if (effect.rule.on !== 'dealHit') {
      if (effect.rule.filter !== undefined) delete effect.rule.filter.crit;
      if (effect.rule.filter !== undefined && Object.keys(effect.rule.filter).length === 0) {
        delete effect.rule.filter;
      }
      if (effect.rule.effect.op === 'applyStatus') delete effect.rule.effect.applyTo;
    }
    buildEffectForm();
    refreshDerived();
  });
  onWrap.appendChild(onSel);
  effectFormEl.appendChild(onWrap);

  effectFormEl.appendChild(
    optionalNumField('chance (blank = always; 0–1)', effect.rule.chance, (v) => {
      if (v === undefined) delete effect.rule.chance;
      else effect.rule.chance = v;
      refreshDerived();
    }),
  );

  const archWrap = el('label', 'pool-num');
  archWrap.append(el('span', undefined, 'filter: acting archetype (blank = any)'));
  const archInput = el('input');
  archInput.type = 'text';
  archInput.spellcheck = false;
  archInput.value = effect.rule.filter?.archetype ?? '';
  archInput.addEventListener('input', () => {
    setRuleFilter(effect, 'archetype', archInput.value.trim() === '' ? undefined : archInput.value.trim());
    refreshDerived();
  });
  archWrap.appendChild(archInput);
  effectFormEl.appendChild(archWrap);

  if (effect.rule.on === 'dealHit') {
    const critWrap = el('label', 'pool-num');
    critWrap.append(el('span', undefined, 'filter: crit (dealHit only)'));
    const critSel = el('select');
    for (const [v, label] of [
      ['', '(any)'],
      ['true', 'crits only'],
      ['false', 'non-crits only'],
    ] as const) {
      critSel.appendChild(option(v, label));
    }
    critSel.value = effect.rule.filter?.crit === undefined ? '' : String(effect.rule.filter.crit);
    critSel.addEventListener('change', () => {
      setRuleFilter(effect, 'crit', critSel.value === '' ? undefined : critSel.value === 'true');
      refreshDerived();
    });
    critWrap.appendChild(critSel);
    effectFormEl.appendChild(critWrap);
  }

  const kindWrap = el('label', 'pool-num');
  kindWrap.append(el('span', undefined, 'rule effect'));
  const kindSel = el('select');
  for (const k of ['gainBits', 'applyStatus']) kindSel.appendChild(option(k));
  kindSel.value = effect.rule.effect.op;
  kindSel.addEventListener('change', () => {
    effect.rule.effect =
      kindSel.value === 'gainBits'
        ? { op: 'gainBits', amount: 1 }
        : { op: 'applyStatus', statusId: STATUS_IDS[0] ?? 'poison' };
    buildEffectForm();
    refreshDerived();
  });
  kindWrap.appendChild(kindSel);
  effectFormEl.appendChild(kindWrap);

  const ruleEffect = effect.rule.effect;
  if (ruleEffect.op === 'gainBits') {
    effectFormEl.appendChild(
      numField('bits per firing', ruleEffect.amount, 1, (v) => {
        ruleEffect.amount = Math.max(1, Math.trunc(v));
        refreshDerived();
      }),
    );
  } else {
    const statusWrap = el('label', 'pool-num');
    statusWrap.append(el('span', undefined, 'status'));
    const statusSel = el('select');
    for (const id of STATUS_IDS) statusSel.appendChild(option(id, STATUS_DEFS[id]?.name ?? id));
    statusSel.value = ruleEffect.statusId;
    statusSel.addEventListener('change', () => {
      ruleEffect.statusId = statusSel.value;
      refreshDerived();
    });
    statusWrap.appendChild(statusSel);
    effectFormEl.appendChild(statusWrap);

    effectFormEl.appendChild(
      optionalNumField('magnitude (blank = 1)', ruleEffect.magnitude, (v) => {
        if (v === undefined) delete ruleEffect.magnitude;
        else ruleEffect.magnitude = v;
        refreshDerived();
      }),
    );
    effectFormEl.appendChild(
      optionalNumField('duration seconds (blank = the status default)', ruleEffect.durationSeconds, (v) => {
        if (v === undefined) delete ruleEffect.durationSeconds;
        else ruleEffect.durationSeconds = v;
        refreshDerived();
      }),
    );

    if (effect.rule.on === 'dealHit') {
      const applyWrap = el('label', 'pool-num');
      applyWrap.append(el('span', undefined, 'lands on (dealHit only)'));
      const applySel = el('select');
      for (const [v, label] of [
        ['', 'actor (default — the striker)'],
        ['actor', 'actor (explicit)'],
        ['target', 'target (the struck unit)'],
      ] as const) {
        applySel.appendChild(option(v, label));
      }
      applySel.value = ruleEffect.applyTo ?? '';
      applySel.addEventListener('change', () => {
        if (applySel.value === '') delete ruleEffect.applyTo;
        else ruleEffect.applyTo = applySel.value as 'actor' | 'target';
        refreshDerived();
      });
      applyWrap.appendChild(applySel);
      effectFormEl.appendChild(applyWrap);
    }
  }
}

function setRuleFilter(
  effect: Extract<WorkingEffect, { op: 'injectRule' }>,
  key: 'archetype' | 'crit',
  value: string | boolean | undefined,
): void {
  if (value === undefined) {
    if (effect.rule.filter !== undefined) {
      delete effect.rule.filter[key];
      if (Object.keys(effect.rule.filter).length === 0) delete effect.rule.filter;
    }
    return;
  }
  effect.rule.filter ??= {};
  if (key === 'archetype') effect.rule.filter.archetype = value as string;
  else effect.rule.filter.crit = value as boolean;
}

// ---- Refresh ----
function refreshTabs(): void {
  tabsEl.innerHTML = '';
  working.forEach((p, i) => {
    const btn = el('button', 'tab', p.id || '(untitled)');
    btn.type = 'button';
    btn.classList.toggle('active', i === activeIndex);
    btn.addEventListener('click', () => selectPacket(i));
    tabsEl.appendChild(btn);
  });
}

function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPreview();
  refreshRefs();
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  const issues: string[] = [];

  const result = PacketsSchema.safeParse({ packets: working });
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }
  try {
    assertPacketStatusRefs(working, STATUS_DEFS);
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }
  // The rewards-side check in reverse: a committed table naming a packet id
  // this edit removes/renames would fail assertRewardPacketRefs at boot.
  const ids = new Set(working.map((p) => p.id));
  for (const table of REWARD_TABLES) {
    for (const entry of table.entries) {
      if (entry.kind === 'packet' && !ids.has(entry.packet)) {
        issues.push(
          `reward table "${table.id}" references packet "${entry.packet}" — renaming or deleting it would fail the boot assert`,
        );
      }
    }
  }

  lastValid = issues.length === 0;
  if (lastValid) {
    addValidation('ok', 'Valid — matches the game schema (matrix + status + reward refs). Safe to save.');
  } else {
    for (const text of issues) addValidation('error', text);
  }
  saveBtn.disabled = !lastValid;
}

function refreshExport(): void {
  exportEl.value = formatPacketsJson(working);
}

/** The fire summary: where it's usable, what it targets, what it does. */
function refreshPreview(): void {
  previewEl.innerHTML = '';
  const p = packet();
  addRow(previewEl, 'usable in', p.usableIn.join(', ') || '(none — schema-invalid)');
  addRow(previewEl, 'target', p.target);
  addRow(previewEl, 'effect', describeEffect(p.effect));
}

function describeEffect(effect: WorkingEffect): string {
  switch (effect.op) {
    case 'healPool':
      return `restore ${effect.amount} pool HP (instant)`;
    case 'grantRedraws':
      return `insert a redraw grant at the cursor — ${effect.redrawsPerTurn} action(s), ≤${effect.maxCardsPerTurn} cards each`;
    case 'applyBuff': {
      const mods = Object.entries(effect.buff.mods)
        .map(([stat, mod]) => {
          const parts: string[] = [];
          if (mod?.add !== undefined) parts.push(`${mod.add >= 0 ? '+' : ''}${mod.add}`);
          if (mod?.mul !== undefined) parts.push(`×${mod.mul}`);
          return `${parts.join(' ')} ${STAT_LABELS[stat as StatKey]}`;
        })
        .join(' · ');
      return `buff "${effect.buff.key}" (${mods || 'no mods'}) for the ${effect.duration}`;
    }
    case 'injectRule': {
      const r = effect.rule;
      const what =
        r.effect.op === 'gainBits'
          ? `earn ${r.effect.amount} bits`
          : `apply ${STATUS_DEFS[r.effect.statusId]?.name ?? r.effect.statusId} to the ${
              r.effect.applyTo === 'target' ? 'STRUCK unit' : 'acting unit'
            }`;
      const gate = [
        r.filter?.archetype !== undefined ? `${r.filter.archetype} only` : null,
        r.filter?.crit !== undefined ? (r.filter.crit ? 'crits only' : 'non-crits only') : null,
        r.chance !== undefined ? `${Math.round(r.chance * 100)}% chance` : null,
      ]
        .filter((s) => s !== null)
        .join(', ');
      return `on ${r.on}${gate ? ` (${gate})` : ''}: ${what} — for the ${effect.duration}`;
    }
  }
}

function refreshRefs(): void {
  refsEl.innerHTML = '';
  const id = packet().id;
  let any = false;
  for (const table of REWARD_TABLES) {
    for (const entry of table.entries) {
      if (entry.kind === 'packet' && entry.packet === id) {
        any = true;
        addRow(refsEl, table.id, `weight ${entry.weight}`);
      }
    }
  }
  if (!any) addRow(refsEl, '(none)', 'no committed reward table drops this packet', true);
}

// ---- Save / revert ----
async function save(): Promise<void> {
  if (!lastValid) return;
  setSaveStatus('Saving…', 'hint');
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'packets.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const savedId = packet().id;
      const status =
        `Saved to config/packets.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new catalog.`;
      setSaveStatus(status, 'ok');
      try {
        sessionStorage.setItem(SAVE_STASH_KEY, JSON.stringify({ savedId, status }));
      } catch {
        // sessionStorage unavailable — non-fatal (see the reward editor).
      }
    } else {
      setSaveStatus(`Save failed: ${data.error ?? res.statusText}`, 'err');
    }
  } catch (err) {
    setSaveStatus(`Save failed: ${String(err)} — is the dev server running?`, 'err');
  }
}

function revert(): void {
  working = structuredClone(PACKETS) as WorkingPacket[];
  selectPacket(Math.min(activeIndex, working.length - 1));
  setSaveStatus('Reverted to the committed config (not yet saved).', 'hint');
}

function restoreAfterSave(): void {
  let stash: string | null = null;
  try {
    stash = sessionStorage.getItem(SAVE_STASH_KEY);
    if (stash) sessionStorage.removeItem(SAVE_STASH_KEY);
  } catch {
    return;
  }
  if (!stash) return;
  try {
    const { savedId, status } = JSON.parse(stash) as { savedId?: string; status?: string };
    if (savedId) {
      const idx = working.findIndex((p) => p.id === savedId);
      if (idx >= 0) selectPacket(idx);
    }
    if (status) setSaveStatus(status, 'ok');
  } catch {
    // Malformed stash — ignore.
  }
}

// ---- Small helpers (the reward editor's set) ----
function addRow(dl: HTMLDListElement, term: string, value: string, muted = false): void {
  const dt = el('dt', muted ? 'muted' : undefined, term);
  const dd = el('dd', muted ? 'muted' : undefined, value);
  dl.append(dt, dd);
}

function addValidation(level: 'ok' | 'error', text: string): void {
  validationEl.appendChild(el('li', level, text));
}

function setSaveStatus(text: string, cls: 'hint' | 'ok' | 'err'): void {
  saveStatusEl.textContent = text;
  saveStatusEl.className = cls === 'hint' ? 'hint' : `hint ${cls}`;
}

function flash(btn: HTMLButtonElement, label: string): void {
  const original = btn.textContent;
  btn.textContent = label;
  window.setTimeout(() => {
    btn.textContent = original;
  }, 800);
}

function numField(label: string, value: number, step: number, onChange: (v: number) => void): HTMLLabelElement {
  const wrap = el('label', 'pool-num');
  wrap.append(el('span', undefined, label));
  const input = el('input');
  input.type = 'number';
  input.min = '0';
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('input', () => {
    const v = Number.parseFloat(input.value);
    onChange(Number.isFinite(v) ? v : 0);
  });
  wrap.appendChild(input);
  return wrap;
}

/** A number input where BLANK means "field absent" (exact-optional knobs:
 *  chance, magnitude, durationSeconds, add, mul). */
function optionalNumField(
  label: string,
  value: number | undefined,
  onChange: (v: number | undefined) => void,
): HTMLLabelElement {
  const wrap = el('label', 'pool-num');
  wrap.append(el('span', undefined, label));
  const input = el('input');
  input.type = 'number';
  input.step = 'any';
  input.value = value === undefined ? '' : String(value);
  input.addEventListener('input', () => {
    if (input.value.trim() === '') {
      onChange(undefined);
      return;
    }
    const v = Number.parseFloat(input.value);
    onChange(Number.isFinite(v) ? v : undefined);
  });
  wrap.appendChild(input);
  return wrap;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function option(value: string, label = value): HTMLOptionElement {
  const o = el('option');
  o.value = value;
  o.textContent = label;
  return o;
}

function mustQuery<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`packet-editor: missing element "${selector}"`);
  return node;
}
