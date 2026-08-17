/**
 * Event editor (74h). Standalone Vite page — visit
 * http://localhost:5173/tools/event-editor/ after `npm run dev`. Not in the
 * production build (no rollupOptions.input entry).
 *
 * Authors `config/events.json` — each event's id / name / eligibility
 * conditions / entry page / PAGE MAP (pages → choices → weighted outcomes →
 * effect ops → next refs) — with the affordances the reward/encounter
 * editors established:
 *
 *  1. **Live validation, all three layers the game boots on.** Every edit
 *     re-runs the SAME `EventsSchema` (intra-def refs via its superRefine),
 *     PLUS both 74a boot asserts: `assertEventPagesTerminate` (every page
 *     reaches a terminal through UNCONDITIONED choices — the fixpoint that
 *     keeps the fuzz harness un-trappable) and `assertEventRefs` (every
 *     cross-catalog id resolves), fed the live sibling catalogs. Save is
 *     disabled while any complain.
 *  2. **The 74f phrase helper in the form.** Each condition row shows its
 *     live `describeEventCondition` phrase — the same copy the EventScreen
 *     renders — so an author reads the requirement exactly as the player
 *     will.
 *  3. **Save to disk.** Posts the formatted whole-file JSON (through
 *     `formatEventsJson`, byte-faithful to the committed file) to the
 *     dev-only `/__save-config` endpoint (vite.config.ts allowlists
 *     `events.json`). Copy / Download stay as offline fallbacks.
 *
 * The page map is edited in a VISUAL builder by default (page cards →
 * choice cards → outcome rows; the `not` combinator is a NOT toggle on the
 * condition row — one level deep, which is all shipped content needs) with
 * a raw-JSON fallback for anything deeper (the encounter editor's waves-box
 * pattern; both surfaces funnel into the same working model). Renaming a
 * page id rewrites its refs (entry + every string `next`) in the same
 * gesture — a rename can't silently orphan a branch.
 *
 * Placement (which sectors pool an event) is authored on the SECTOR side
 * (sector-owns-both); the Placement pane here is a read-only "referenced
 * by" over the committed sectors, the reward editor's precedent.
 *
 * Saving rewrites config/events.json, which Vite turns into a full page
 * reload (the json → events.ts → editor.ts chain has no clean HMR
 * boundary), so the Save path stashes the active tab + confirmation in
 * sessionStorage and the next boot restores both — the SAVE_STASH_KEY
 * pattern.
 */

import './editor.css';
import {
  EVENTS,
  EventsSchema,
  assertEventPagesTerminate,
  assertEventPagesReachable,
  assertEventReservedFlags,
  assertEventRefs,
  describeEventCondition,
  type EventCondition,
  type EventDef,
  type EventEffectOp,
  type EventFlagValue,
} from '../../src/config/events';
import { DAEMONS } from '../../src/config/daemons';
import { PACKETS, PACKET_IDS } from '../../src/config/packets';
import { CHARACTERS, CHARACTER_IDS } from '../../src/config/characters';
import { UNIT_DEFS } from '../../src/config/units';
import { ENCOUNTERS, ENCOUNTER_IDS } from '../../src/config/encounters';
import { REWARD_TABLE_IDS } from '../../src/config/rewards';
import { SECTORS } from '../../src/config/sectors';
import { formatEventsJson } from './format';

// ---- State ----
// The schema's types are deeply readonly (config is immutable at runtime); the
// editor needs a mutable working copy — the encounter editor's DeepMutable
// pattern (a structuredClone is genuinely mutable at runtime; this is a
// type-only relaxation, and mutable → readonly stays assignable for consumers).
type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
    : T;
type WorkingEvent = DeepMutable<EventDef>;
type WorkingPage = WorkingEvent['pages'][string];
type WorkingChoice = WorkingPage['choices'][number];
type WorkingOutcome = WorkingChoice['outcomes'][number];
type WorkingCondition = DeepMutable<EventCondition>;
type WorkingOp = DeepMutable<EventEffectOp>;

// `working` is a deep, mutable clone of the committed catalog; the form
// mutates it, the validators judge it, the formatter emits it. EVENTS stays
// the pristine baseline that "Revert all" restores from.
let working: WorkingEvent[] = structuredClone(EVENTS) as WorkingEvent[];
let activeIndex = 0;
let lastValid = true;
/** False while the pages textarea holds non-JSON text (kept separate from
 *  schema validity so the parse error sits next to the box). */
let pagesParseOk = true;
/** The pages editor's surface — both funnel into `working[active].pages`. */
let viewMode: 'visual' | 'json' = 'visual';

/** See the header — a save reloads the page, so stash tab + status across it. */
const SAVE_STASH_KEY = 'eventEditor.justSaved';

// The GUI's kind vocabularies, pinned complete against the union at compile
// time (`satisfies` — adding a condition/op kind without a form arm becomes a
// build error here, the exhaustive-switch discipline in editor form).
const CONDITION_KINDS = [
  'bitsAtLeast',
  'poolHealthAtLeast',
  'poolHealthAtMost',
  'hasDaemon',
  'hasPacket',
  'cacheHasRoom',
  'rosterSizeAtLeast',
  'rosterSizeAtMost',
  'characterIs',
  'flagSet',
  'flagIs',
] as const satisfies readonly Exclude<EventCondition['kind'], 'not'>[];
type PrimitiveConditionKind = (typeof CONDITION_KINDS)[number];
// Completeness: every non-`not` union member appears above.
const _conditionKindsComplete: Exclude<EventCondition['kind'], 'not'> extends PrimitiveConditionKind
  ? true
  : never = true;
void _conditionKindsComplete;

const OP_KINDS = [
  'gainBits',
  'spendBits',
  'healPool',
  'damagePool',
  'addPacket',
  'removePacket',
  'addDaemon',
  'removeDaemon',
  'grantUnit',
  'removeUnit',
  'setFlag',
] as const satisfies readonly EventEffectOp['op'][];
type OpKind = (typeof OP_KINDS)[number];
const _opKindsComplete: EventEffectOp['op'] extends OpKind ? true : never = true;
void _opKindsComplete;

// ---- DOM ----
const tabsEl = mustQuery<HTMLDivElement>('#tabs');
const newBtn = mustQuery<HTMLButtonElement>('#new-btn');
const deleteBtn = mustQuery<HTMLButtonElement>('#delete-btn');
const idEl = mustQuery<HTMLInputElement>('#id');
const nameEl = mustQuery<HTMLInputElement>('#name');
const repeatableEl = mustQuery<HTMLInputElement>('#repeatable');
const eligibilityEl = mustQuery<HTMLDivElement>('#eligibility');
const addEligibilityBtn = mustQuery<HTMLButtonElement>('#add-eligibility-btn');
const viewVisualBtn = mustQuery<HTMLButtonElement>('#view-visual');
const viewJsonBtn = mustQuery<HTMLButtonElement>('#view-json');
const pagesVisualEl = mustQuery<HTMLDivElement>('#pages-visual');
const pagesJsonEl = mustQuery<HTMLDivElement>('#pages-json');
const pagesTextEl = mustQuery<HTMLTextAreaElement>('#pages-text');
const pagesErrorEl = mustQuery<HTMLParagraphElement>('#pages-error');
const formatPagesBtn = mustQuery<HTMLButtonElement>('#format-pages-btn');
const entryEl = mustQuery<HTMLSelectElement>('#entry');
const addPageBtn = mustQuery<HTMLButtonElement>('#add-page-btn');
const pagesEl = mustQuery<HTMLDivElement>('#pages');
const placementEl = mustQuery<HTMLDListElement>('#placement');
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
selectEvent(activeIndex);
restoreAfterSave();

function attachIdentity(): void {
  idEl.addEventListener('input', () => {
    event().id = idEl.value;
    refreshTabs();
    refreshDerived();
  });
  nameEl.addEventListener('input', () => {
    event().name = nameEl.value;
    refreshDerived();
  });
  // 74i — unchecked = key omitted (absent = the no-repeat default); an
  // explicit JSON-authored `false` collapses to absent on the next toggle,
  // which is semantics-identical.
  repeatableEl.addEventListener('change', () => {
    if (repeatableEl.checked) event().repeatable = true;
    else delete event().repeatable;
    refreshDerived();
  });
}

function attachButtons(): void {
  newBtn.addEventListener('click', addEvent);
  deleteBtn.addEventListener('click', deleteEvent);
  addEligibilityBtn.addEventListener('click', () => {
    event().eligibility = [...(event().eligibility ?? []), defaultCondition('bitsAtLeast')];
    buildEligibility();
    refreshDerived();
  });
  addPageBtn.addEventListener('click', addPage);
  entryEl.addEventListener('change', () => {
    event().entry = entryEl.value;
    buildPages(); // the entry badge moves
    refreshDerived();
  });
  viewVisualBtn.addEventListener('click', () => setViewMode('visual'));
  viewJsonBtn.addEventListener('click', () => setViewMode('json'));
  formatPagesBtn.addEventListener('click', () => {
    pagesTextEl.value = JSON.stringify(event().pages, null, 2);
    pagesParseOk = true;
    pagesErrorEl.textContent = '';
    refreshDerived();
  });
  pagesTextEl.addEventListener('input', () => {
    try {
      const parsed: unknown = JSON.parse(pagesTextEl.value);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('pages must be an object mapping page ids to pages');
      }
      event().pages = parsed as WorkingEvent['pages'];
      pagesParseOk = true;
      pagesErrorEl.textContent = '';
      refreshDerived(); // schema-level complaints land in the validation pane
    } catch (err) {
      pagesParseOk = false;
      pagesErrorEl.textContent = err instanceof Error ? err.message : String(err);
      refreshValidation(); // keep Save disabled while unparsable
    }
  });
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
    a.download = 'events.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ---- Event-level mutation ----
function event(): WorkingEvent {
  return working[activeIndex]!;
}

function addEvent(): void {
  let n = working.length + 1;
  let id = `event-${n}`;
  while (working.some((e) => e.id === id)) id = `event-${++n}`;
  working.push({
    id,
    name: 'New Event',
    entry: 'start',
    pages: {
      start: {
        text: 'Something stirs in the static.',
        choices: [{ label: 'Move on', outcomes: [{ next: { kind: 'return-to-map' } }] }],
      },
    },
  });
  selectEvent(working.length - 1);
}

function deleteEvent(): void {
  if (working.length <= 1) {
    setSaveStatus('The catalog needs at least one event — add another before deleting this.', 'err');
    return;
  }
  working.splice(activeIndex, 1);
  selectEvent(Math.min(activeIndex, working.length - 1));
}

function addPage(): void {
  const ev = event();
  let n = Object.keys(ev.pages).length + 1;
  let id = `page-${n}`;
  while (id in ev.pages) id = `page-${++n}`;
  ev.pages[id] = {
    text: 'A new page.',
    choices: [{ label: 'Leave', outcomes: [{ next: { kind: 'return-to-map' } }] }],
  };
  buildPages();
  refreshDerived();
}

/** Rename a page id, rewriting the refs that point at it (entry + every
 *  string `next`) so a rename can't orphan a branch. Refuses empty ids and
 *  collisions (a colliding rename would silently merge two pages). */
function renamePage(oldId: string, newId: string): boolean {
  const ev = event();
  if (newId === '' || newId === oldId || newId in ev.pages) return false;
  ev.pages = Object.fromEntries(
    Object.entries(ev.pages).map(([k, v]) => [k === oldId ? newId : k, v]),
  );
  if (ev.entry === oldId) ev.entry = newId;
  for (const page of Object.values(ev.pages)) {
    for (const choice of page.choices) {
      for (const outcome of choice.outcomes) {
        if (outcome.next === oldId) outcome.next = newId;
      }
    }
  }
  return true;
}

function deletePage(pageId: string): void {
  const ev = event();
  if (Object.keys(ev.pages).length <= 1) {
    setSaveStatus('An event needs at least one page.', 'err');
    return;
  }
  delete ev.pages[pageId];
  buildPages();
  refreshDerived(); // dangling refs to it surface in the validation pane
}

// ---- Defaults (well-formed skeletons over the live catalogs) ----
function defaultCondition(kind: PrimitiveConditionKind): WorkingCondition {
  switch (kind) {
    case 'bitsAtLeast':
      return { kind: 'bitsAtLeast', amount: 10 };
    case 'poolHealthAtLeast':
      return { kind: 'poolHealthAtLeast', amount: 10 };
    case 'poolHealthAtMost':
      return { kind: 'poolHealthAtMost', amount: 10 };
    case 'hasDaemon':
      return { kind: 'hasDaemon', daemonId: DAEMONS[0]?.id ?? 'daemon-id' };
    case 'hasPacket':
      return { kind: 'hasPacket', packetId: PACKETS[0]?.id ?? 'packet-id' };
    case 'cacheHasRoom':
      return { kind: 'cacheHasRoom' };
    case 'rosterSizeAtLeast':
      return { kind: 'rosterSizeAtLeast', count: 5 };
    case 'rosterSizeAtMost':
      return { kind: 'rosterSizeAtMost', count: 5 };
    case 'characterIs':
      return { kind: 'characterIs', characterId: CHARACTERS[0]?.id ?? 'character-id' };
    case 'flagSet':
      return { kind: 'flagSet', flag: 'chain:key' };
    case 'flagIs':
      return { kind: 'flagIs', flag: 'chain:key', value: true };
  }
}

function defaultOp(kind: OpKind): WorkingOp {
  switch (kind) {
    case 'gainBits':
      return { op: 'gainBits', amount: 5 };
    case 'spendBits':
      return { op: 'spendBits', amount: 5 };
    case 'healPool':
      return { op: 'healPool', amount: 3 };
    case 'damagePool':
      return { op: 'damagePool', amount: 3 };
    case 'addPacket':
      return { op: 'addPacket', packetId: PACKETS[0]?.id ?? 'packet-id' };
    case 'removePacket':
      return { op: 'removePacket', packetId: PACKETS[0]?.id ?? 'packet-id' };
    case 'addDaemon':
      return { op: 'addDaemon', daemonId: DAEMONS[0]?.id ?? 'daemon-id' };
    case 'removeDaemon':
      return { op: 'removeDaemon', daemonId: DAEMONS[0]?.id ?? 'daemon-id' };
    case 'grantUnit':
      return { op: 'grantUnit', archetype: Object.keys(UNIT_DEFS)[0] ?? 'archetype' };
    case 'removeUnit':
      return { op: 'removeUnit' };
    case 'setFlag':
      return { op: 'setFlag', flag: 'chain:key' };
  }
}

// ---- Eligibility ----
function buildEligibility(): void {
  eligibilityEl.innerHTML = '';
  const list = event().eligibility;
  if (list === undefined || list.length === 0) {
    delete event().eligibility; // empty list = key omitted (always eligible)
    return;
  }
  list.forEach((_cond, i) => {
    eligibilityEl.appendChild(
      conditionRow(
        () => event().eligibility![i]!,
        (c) => {
          event().eligibility![i] = c;
        },
        () => {
          event().eligibility!.splice(i, 1);
          buildEligibility();
          refreshDerived();
        },
        buildEligibility,
      ),
    );
  });
}

// ---- The condition row (shared by eligibility + choice conditions) ----
/** One condition as a form row: [NOT] [kind] [fields…] [phrase] [✕?]. The
 *  `not` combinator renders as the NOT toggle over the wrapped primitive —
 *  one level deep, which is all shipped content needs; deeper nesting stays
 *  authorable in the JSON view. `onStructure` rebuilds the owning section
 *  when the row's shape changes (kind/NOT flips re-render fields). */
function conditionRow(
  get: () => WorkingCondition,
  set: (c: WorkingCondition) => void,
  onRemove: (() => void) | null,
  onStructure: () => void,
): HTMLDivElement {
  const row = el('div', 'cond-row');
  const current = get();
  const negated = current.kind === 'not';
  const base = negated ? (current as { condition: WorkingCondition }).condition : current;

  const notWrap = el('label', 'not-toggle');
  const notBox = el('input');
  notBox.type = 'checkbox';
  notBox.checked = negated;
  notBox.title = 'Negate this condition (the 74c-pre `not` combinator)';
  notBox.addEventListener('change', () => {
    set(notBox.checked ? { kind: 'not', condition: get() } : base);
    onStructure();
    refreshDerived();
  });
  notWrap.append(notBox, el('span', undefined, 'NOT'));
  row.appendChild(notWrap);

  // Mutations below write through `setBase` so a NOT wrapper is preserved.
  const setBase = (c: WorkingCondition): void => {
    set(notBox.checked ? { kind: 'not', condition: c } : c);
  };

  const kindSel = el('select', 'entry-kind');
  for (const k of CONDITION_KINDS) kindSel.appendChild(option(k));
  // A deeper-nested `not` (JSON-authored) shows its inner kind; edits through
  // the form collapse it to one level — the visual surface's contract.
  kindSel.value = base.kind === 'not' ? 'bitsAtLeast' : base.kind;
  kindSel.addEventListener('change', () => {
    setBase(defaultCondition(kindSel.value as PrimitiveConditionKind));
    onStructure();
    refreshDerived();
  });
  row.appendChild(kindSel);

  const phrase = el('span', 'phrase');
  const refreshPhrase = (): void => {
    phrase.textContent = describeEventCondition(get() as EventCondition);
  };

  const b = base;
  switch (b.kind) {
    case 'bitsAtLeast':
    case 'poolHealthAtLeast':
    case 'poolHealthAtMost':
      row.appendChild(
        numField('amount', b.amount, 1, (v) => {
          b.amount = Math.max(0, Math.trunc(v));
          refreshPhrase();
          refreshDerived();
        }),
      );
      break;
    case 'rosterSizeAtLeast':
    case 'rosterSizeAtMost':
      row.appendChild(
        numField('count', b.count, 1, (v) => {
          b.count = Math.max(1, Math.trunc(v));
          refreshPhrase();
          refreshDerived();
        }),
      );
      break;
    case 'hasDaemon':
      row.appendChild(
        catalogSelect(
          DAEMONS.map((d) => [d.id, d.name]),
          b.daemonId,
          (v) => {
            b.daemonId = v;
            refreshPhrase();
            refreshDerived();
          },
        ),
      );
      break;
    case 'hasPacket':
      row.appendChild(
        catalogSelect(
          PACKETS.map((p) => [p.id, p.name]),
          b.packetId,
          (v) => {
            b.packetId = v;
            refreshPhrase();
            refreshDerived();
          },
        ),
      );
      break;
    case 'characterIs':
      row.appendChild(
        catalogSelect(
          CHARACTERS.map((c) => [c.id, c.name]),
          b.characterId,
          (v) => {
            b.characterId = v;
            refreshPhrase();
            refreshDerived();
          },
        ),
      );
      break;
    case 'cacheHasRoom':
      break;
    case 'flagSet':
      row.appendChild(
        textField('flag', b.flag, 'chain:key', (v) => {
          b.flag = v;
          refreshPhrase();
          refreshDerived();
        }),
      );
      break;
    case 'flagIs':
      row.appendChild(
        textField('flag', b.flag, 'chain:key', (v) => {
          b.flag = v;
          refreshPhrase();
          refreshDerived();
        }),
      );
      row.appendChild(
        textField('value', String(b.value), 'true / 3 / text', (v) => {
          b.value = parseFlagValue(v);
          refreshPhrase();
          refreshDerived();
        }),
      );
      break;
    case 'not':
      // JSON-authored deeper nesting — the form shows the phrase only; flip
      // the kind select (or edit in the JSON view) to restructure.
      break;
  }

  refreshPhrase();
  row.appendChild(phrase);

  if (onRemove !== null) {
    const remove = el('button', 'pool-remove', '✕');
    remove.type = 'button';
    remove.title = 'Remove this condition';
    remove.addEventListener('click', onRemove);
    row.appendChild(remove);
  }
  return row;
}

/** `'true'`/`'false'` → boolean, a finite numeric string → number, anything
 *  else → the raw string (the FlagValue vocabulary; JSON view for exotica). */
function parseFlagValue(raw: string): EventFlagValue {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (raw.trim() !== '' && Number.isFinite(n)) return n;
  return raw;
}

// ---- Pages (the visual builder) ----
function buildPages(): void {
  const ev = event();
  // The entry select tracks the live page-id set.
  entryEl.innerHTML = '';
  for (const pageId of Object.keys(ev.pages)) entryEl.appendChild(option(pageId));
  entryEl.value = ev.entry;

  pagesEl.innerHTML = '';
  for (const pageId of Object.keys(ev.pages)) {
    pagesEl.appendChild(makePageCard(pageId));
  }
}

function makePageCard(pageId: string): HTMLDivElement {
  const ev = event();
  const page = ev.pages[pageId]!;
  const card = el('div', 'page-card');

  const head = el('div', 'page-head');
  const idInput = el('input', 'page-id');
  idInput.type = 'text';
  idInput.value = pageId;
  idInput.spellcheck = false;
  idInput.title = 'Rename this page (rewrites entry + every next ref)';
  // Rename applies on change (blur/enter), not per keystroke — a mid-typing
  // id would thrash refs. An invalid rename (empty/collision) reverts.
  idInput.addEventListener('change', () => {
    if (renamePage(pageId, idInput.value)) {
      buildPages();
      refreshDerived();
    } else {
      idInput.value = pageId;
      setSaveStatus('Rename refused — empty id or a page with that id already exists.', 'err');
    }
  });
  head.appendChild(idInput);
  if (ev.entry === pageId) head.appendChild(el('span', 'badge', 'entry'));

  const delPage = el('button', 'pool-remove', '✕ page');
  delPage.type = 'button';
  delPage.title = 'Delete this page (refs to it surface as validation errors)';
  delPage.addEventListener('click', () => deletePage(pageId));
  head.appendChild(delPage);
  card.appendChild(head);

  const textArea = el('textarea');
  textArea.rows = 2;
  textArea.spellcheck = false;
  textArea.value = page.text;
  textArea.placeholder = 'The page text the player reads.';
  textArea.addEventListener('input', () => {
    page.text = textArea.value;
    refreshDerived();
  });
  card.appendChild(textArea);

  // `art` — a registry-resolved seam only this cluster (zero implementation;
  // the field round-trips so hand-authored values survive the editor).
  card.appendChild(
    textField('art (optional seam)', page.art ?? '', 'unset', (v) => {
      if (v === '') delete page.art;
      else page.art = v;
      refreshDerived();
    }),
  );

  page.choices.forEach((_choice, ci) => {
    card.appendChild(makeChoiceCard(page, ci));
  });

  const addChoice = el('button', undefined, '+ Add choice');
  addChoice.type = 'button';
  addChoice.addEventListener('click', () => {
    page.choices.push({ label: 'New choice', outcomes: [{ next: { kind: 'return-to-map' } }] });
    buildPages();
    refreshDerived();
  });
  card.appendChild(addChoice);
  return card;
}

function makeChoiceCard(page: WorkingPage, choiceIndex: number): HTMLDivElement {
  const choice = page.choices[choiceIndex]!;
  const card = el('div', 'choice-card');

  const head = el('div', 'page-head');
  head.appendChild(
    textField('label', choice.label, 'the choice button text', (v) => {
      choice.label = v;
      refreshDerived();
    }),
  );
  const delChoice = el('button', 'pool-remove', '✕ choice');
  delChoice.type = 'button';
  delChoice.disabled = page.choices.length <= 1; // schema floors a page at ≥1 choice
  delChoice.addEventListener('click', () => {
    page.choices.splice(choiceIndex, 1);
    buildPages();
    refreshDerived();
  });
  head.appendChild(delChoice);
  card.appendChild(head);

  // The optional gate — SHOWN-DISABLED in game with the requirement visible,
  // so the phrase preview here is exactly what the player reads.
  if (choice.condition === undefined) {
    const addCond = el('button', undefined, '+ condition');
    addCond.type = 'button';
    addCond.title = 'Gate this choice (it renders shown-disabled when unmet)';
    addCond.addEventListener('click', () => {
      choice.condition = defaultCondition('bitsAtLeast');
      buildPages();
      refreshDerived();
    });
    card.appendChild(addCond);
  } else {
    card.appendChild(
      conditionRow(
        () => choice.condition!,
        (c) => {
          choice.condition = c;
        },
        () => {
          delete choice.condition;
          buildPages();
          refreshDerived();
        },
        buildPages,
      ),
    );
  }

  choice.outcomes.forEach((_o, oi) => card.appendChild(makeOutcomeCard(choice, oi)));

  const addOutcome = el('button', undefined, '+ Add outcome');
  addOutcome.type = 'button';
  addOutcome.title = 'Outcomes roll weighted (absent weight = 1); one entry = deterministic';
  addOutcome.addEventListener('click', () => {
    choice.outcomes.push({ next: { kind: 'return-to-map' } });
    buildPages();
    refreshDerived();
  });
  card.appendChild(addOutcome);
  return card;
}

function makeOutcomeCard(choice: WorkingChoice, outcomeIndex: number): HTMLDivElement {
  const outcome = choice.outcomes[outcomeIndex]!;
  const card = el('div', 'outcome-card');
  const row = el('div', 'cond-row');

  // Optional weight: blank = key omitted (= 1). An authored explicit 1 is
  // legal and survives (byte fidelity) — only blanking removes the key.
  const weightWrap = el('label', 'pool-num');
  weightWrap.append(el('span', undefined, 'weight (blank = 1)'));
  const weightInput = el('input');
  weightInput.type = 'number';
  weightInput.min = '0';
  weightInput.step = '1';
  weightInput.value = outcome.weight === undefined ? '' : String(outcome.weight);
  weightInput.addEventListener('input', () => {
    const v = Number.parseFloat(weightInput.value);
    if (weightInput.value.trim() === '' || !Number.isFinite(v) || v <= 0) delete outcome.weight;
    else outcome.weight = v;
    refreshDerived();
  });
  weightWrap.appendChild(weightInput);
  row.appendChild(weightWrap);

  row.appendChild(makeNextControl(outcome));

  const delOutcome = el('button', 'pool-remove', '✕');
  delOutcome.type = 'button';
  delOutcome.title = 'Remove this outcome';
  delOutcome.disabled = choice.outcomes.length <= 1; // schema floors at ≥1
  delOutcome.addEventListener('click', () => {
    choice.outcomes.splice(outcomeIndex, 1);
    buildPages();
    refreshDerived();
  });
  row.appendChild(delOutcome);
  card.appendChild(row);

  // Effects (optional list; empty = key omitted).
  const effectsWrap = el('div');
  (outcome.effects ?? []).forEach((_op, ei) => {
    effectsWrap.appendChild(makeOpRow(outcome, ei));
  });
  const addEffect = el('button', undefined, '+ effect');
  addEffect.type = 'button';
  addEffect.addEventListener('click', () => {
    outcome.effects = [...(outcome.effects ?? []), defaultOp('gainBits')];
    buildPages();
    refreshDerived();
  });
  effectsWrap.appendChild(addEffect);
  card.appendChild(effectsWrap);
  return card;
}

/** The `next` control: every page id + both terminals in one select;
 *  `start-encounter` reveals its encounter + optional rewardOverride refs. */
function makeNextControl(outcome: WorkingOutcome): HTMLSpanElement {
  const wrap = el('span', 'cond-row');
  wrap.append(el('span', 'field-label', '→'));

  const sel = el('select');
  sel.appendChild(option('return-to-map', '↩ return to map'));
  sel.appendChild(option('start-encounter', '⚔ start encounter'));
  for (const pageId of Object.keys(event().pages)) {
    sel.appendChild(option(`page:${pageId}`, `page ${pageId}`));
  }
  sel.value =
    typeof outcome.next === 'string' ? `page:${outcome.next}` : outcome.next.kind;
  sel.addEventListener('change', () => {
    if (sel.value === 'return-to-map') outcome.next = { kind: 'return-to-map' };
    else if (sel.value === 'start-encounter') {
      outcome.next = {
        kind: 'start-encounter',
        encounterId: ENCOUNTERS[0]?.id ?? 'encounter-id',
      };
    } else outcome.next = sel.value.slice('page:'.length);
    buildPages();
    refreshDerived();
  });
  wrap.appendChild(sel);

  if (typeof outcome.next !== 'string' && outcome.next.kind === 'start-encounter') {
    const next = outcome.next;
    wrap.appendChild(
      catalogSelect(
        ENCOUNTERS.map((e) => [e.id, e.name]),
        next.encounterId,
        (v) => {
          next.encounterId = v;
          refreshDerived();
        },
      ),
    );
    // 82c — `rewardOverride` is a ref LIST now; this select is the INTERIM
    // single-table control (reads ref 0, writes a one-ref chance-1 list —
    // LOSSY on a multi-ref override). 82d replaces it with the real
    // multi-ref chance UI.
    const overrideSel = el('select');
    overrideSel.title =
      'rewardOverride — replaces the encounter’s own reward refs (interim single-table control; multi-ref overrides collapse on edit)';
    overrideSel.appendChild(option('', 'own rewards'));
    for (const tableId of REWARD_TABLE_IDS) overrideSel.appendChild(option(tableId, `→ ${tableId}`));
    overrideSel.value = next.rewardOverride?.[0]?.table ?? '';
    overrideSel.addEventListener('change', () => {
      if (overrideSel.value === '') delete next.rewardOverride;
      else next.rewardOverride = [{ table: overrideSel.value, trigger: { chance: 1 } }];
      refreshDerived();
    });
    wrap.appendChild(overrideSel);
  }
  return wrap;
}

function makeOpRow(outcome: WorkingOutcome, opIndex: number): HTMLDivElement {
  const op = outcome.effects![opIndex]!;
  const row = el('div', 'cond-row');

  const opSel = el('select', 'entry-kind');
  for (const k of OP_KINDS) opSel.appendChild(option(k));
  opSel.value = op.op;
  opSel.addEventListener('change', () => {
    outcome.effects![opIndex] = defaultOp(opSel.value as OpKind);
    buildPages();
    refreshDerived();
  });
  row.appendChild(opSel);

  switch (op.op) {
    case 'gainBits':
    case 'spendBits':
    case 'healPool':
    case 'damagePool':
      row.appendChild(
        numField('amount', op.amount, 1, (v) => {
          op.amount = Math.max(1, Math.trunc(v));
          refreshDerived();
        }),
      );
      break;
    case 'addPacket':
    case 'removePacket':
      row.appendChild(
        catalogSelect(
          PACKETS.map((p) => [p.id, p.name]),
          op.packetId,
          (v) => {
            op.packetId = v;
            refreshDerived();
          },
        ),
      );
      break;
    case 'addDaemon':
    case 'removeDaemon':
      row.appendChild(
        catalogSelect(
          DAEMONS.map((d) => [d.id, d.name]),
          op.daemonId,
          (v) => {
            op.daemonId = v;
            refreshDerived();
          },
        ),
      );
      break;
    case 'grantUnit':
      row.appendChild(
        catalogSelect(
          Object.entries(UNIT_DEFS).map(([id, def]) => [id, def.name]),
          op.archetype,
          (v) => {
            op.archetype = v;
            refreshDerived();
          },
        ),
      );
      row.appendChild(
        numField('level (0 = 1)', op.level ?? 0, 1, (v) => {
          const lvl = Math.trunc(v);
          if (lvl >= 1) op.level = lvl;
          else delete op.level;
          refreshDerived();
        }),
      );
      break;
    case 'removeUnit': {
      const pickSel = el('select');
      pickSel.title = 'absent = random (one eventRng draw); weakest/strongest = zero draws';
      pickSel.appendChild(option('', '(random)'));
      for (const p of ['random', 'weakest', 'strongest']) pickSel.appendChild(option(p));
      pickSel.value = op.pick ?? '';
      pickSel.addEventListener('change', () => {
        if (pickSel.value === '') delete op.pick;
        else op.pick = pickSel.value as 'random' | 'weakest' | 'strongest';
        refreshDerived();
      });
      row.appendChild(pickSel);
      break;
    }
    case 'setFlag':
      row.appendChild(
        textField('flag', op.flag, 'chain:key', (v) => {
          op.flag = v;
          refreshDerived();
        }),
      );
      row.appendChild(
        textField('value (blank = true)', op.value === undefined ? '' : String(op.value), '', (v) => {
          if (v === '') delete op.value;
          else op.value = parseFlagValue(v);
          refreshDerived();
        }),
      );
      break;
  }

  const remove = el('button', 'pool-remove', '✕');
  remove.type = 'button';
  remove.title = 'Remove this effect';
  remove.addEventListener('click', () => {
    outcome.effects!.splice(opIndex, 1);
    if (outcome.effects!.length === 0) delete outcome.effects; // empty = key omitted
    buildPages();
    refreshDerived();
  });
  row.appendChild(remove);
  return row;
}

// ---- View mode ----
function setViewMode(mode: 'visual' | 'json'): void {
  if (mode === viewMode) return;
  viewMode = mode;
  viewVisualBtn.classList.toggle('active', mode === 'visual');
  viewJsonBtn.classList.toggle('active', mode === 'json');
  pagesVisualEl.hidden = mode !== 'visual';
  pagesJsonEl.hidden = mode !== 'json';
  if (mode === 'json') {
    pagesTextEl.value = JSON.stringify(event().pages, null, 2);
    pagesParseOk = true;
    pagesErrorEl.textContent = '';
  } else {
    // Leaving JSON with unparsable text abandons it — the model still holds
    // the last good parse (the encounter editor's waves-box contract).
    pagesParseOk = true;
    pagesErrorEl.textContent = '';
    buildPages();
    refreshDerived();
  }
}

// ---- Refresh ----
function selectEvent(index: number): void {
  activeIndex = index;
  idEl.value = event().id;
  nameEl.value = event().name;
  repeatableEl.checked = event().repeatable === true;
  if (viewMode === 'json') {
    pagesTextEl.value = JSON.stringify(event().pages, null, 2);
    pagesParseOk = true;
    pagesErrorEl.textContent = '';
  }
  buildEligibility();
  buildPages();
  refreshTabs();
  refreshDerived();
}

function refreshTabs(): void {
  tabsEl.innerHTML = '';
  working.forEach((e, i) => {
    const btn = el('button', 'tab', e.id || '(untitled)');
    btn.type = 'button';
    btn.classList.toggle('active', i === activeIndex);
    btn.addEventListener('click', () => selectEvent(i));
    tabsEl.appendChild(btn);
  });
}

function refreshDerived(): void {
  refreshValidation();
  refreshExport();
  refreshPlacement();
}

function refreshValidation(): void {
  validationEl.innerHTML = '';
  const issues: string[] = [];

  if (!pagesParseOk) issues.push('the pages JSON box holds unparsable text (see the box)');

  const result = EventsSchema.safeParse(working);
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }
  const ids = new Set<string>();
  for (const e of working) {
    if (ids.has(e.id)) issues.push(`duplicate event id "${e.id}"`);
    ids.add(e.id);
  }
  // The boot asserts a bad save would trip at the game's NEXT load, fed the
  // live sibling catalogs — only meaningful once the schema itself passes
  // (they assume well-formed defs).
  if (result.success) {
    try {
      assertEventPagesTerminate(working);
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err));
    }
    // 74i — the reachability + reserved-namespace guards (found live: two
    // authored events shipped orphaned reward pages no validator saw).
    try {
      assertEventPagesReachable(working);
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err));
    }
    try {
      assertEventReservedFlags(working);
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err));
    }
    try {
      assertEventRefs(working, {
        encounterIds: ENCOUNTER_IDS,
        rewardTableIds: REWARD_TABLE_IDS,
        packetIds: PACKET_IDS,
        daemonIds: DAEMONS.map((d) => d.id),
        characterIds: CHARACTER_IDS,
        unitArchetypes: Object.keys(UNIT_DEFS),
      });
    } catch (err) {
      issues.push(err instanceof Error ? err.message : String(err));
    }
  }
  // The sectors-side check in reverse: renaming/deleting an event a committed
  // sector pools would fail the sectors boot guard at next load.
  for (const sector of SECTORS) {
    for (const listKey of ['events', 'startingEvents'] as const) {
      for (const entry of sector[listKey]) {
        if (!ids.has(entry.eventId)) {
          issues.push(
            `sector "${sector.id}" ${listKey} pools event "${entry.eventId}" — renaming or deleting it would fail the sectors boot guard`,
          );
        }
      }
    }
  }

  lastValid = issues.length === 0;
  if (lastValid) {
    addValidation(
      'ok',
      'Valid — schema + termination fixpoint + cross-catalog refs all pass. Safe to save.',
    );
  } else {
    for (const text of issues) addValidation('error', text);
  }
  saveBtn.disabled = !lastValid;
}

function refreshExport(): void {
  exportEl.value = formatEventsJson(working);
}

function refreshPlacement(): void {
  placementEl.innerHTML = '';
  const id = event().id;
  let any = false;
  for (const sector of SECTORS) {
    for (const listKey of ['events', 'startingEvents'] as const) {
      for (const entry of sector[listKey]) {
        if (entry.eventId === id) {
          any = true;
          const gate = entry.minHop !== undefined ? ` · from hop ${entry.minHop}` : '';
          addRow(
            placementEl,
            `${sector.title || sector.id}${listKey === 'startingEvents' ? ' (starting)' : ''}`,
            `weight ${entry.weight ?? 1}${gate}`,
          );
        }
      }
    }
  }
  if (!any) addRow(placementEl, '(none)', 'no committed sector pools this event', true);
}

// ---- Save / revert ----
async function save(): Promise<void> {
  if (!lastValid) return;
  setSaveStatus('Saving…', 'hint');
  try {
    const res = await fetch('/__save-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ file: 'events.json', content: exportEl.value }),
    });
    const data: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      const savedId = event().id;
      const status =
        `Saved to config/events.json at ${new Date().toLocaleTimeString()}. ` +
        `An open game tab hot-reloads the new catalog.`;
      setSaveStatus(status, 'ok');
      // The write triggers a Vite full reload of this tab (see the header) —
      // stash the active tab + status so the next boot restores both.
      try {
        sessionStorage.setItem(SAVE_STASH_KEY, JSON.stringify({ savedId, status }));
      } catch {
        // sessionStorage unavailable (private mode / quota) — non-fatal; the
        // save still succeeded, the reload just won't auto-restore the tab.
      }
    } else {
      setSaveStatus(`Save failed: ${data.error ?? res.statusText}`, 'err');
    }
  } catch (err) {
    setSaveStatus(`Save failed: ${String(err)} — is the dev server running?`, 'err');
  }
}

function revert(): void {
  working = structuredClone(EVENTS) as WorkingEvent[];
  selectEvent(Math.min(activeIndex, working.length - 1));
  setSaveStatus('Reverted to the committed config (not yet saved).', 'hint');
}

/** Boot-time companion to Save (the reward editor's restoreAfterSave):
 *  consume the stash, re-select the saved event's tab, re-show the status.
 *  A no-op on a normal cold boot; robust to a missing/stale id. */
function restoreAfterSave(): void {
  let stash: string | null = null;
  try {
    stash = sessionStorage.getItem(SAVE_STASH_KEY);
    if (stash) sessionStorage.removeItem(SAVE_STASH_KEY);
  } catch {
    return; // sessionStorage unavailable — nothing to restore.
  }
  if (!stash) return;
  try {
    const { savedId, status } = JSON.parse(stash) as { savedId?: string; status?: string };
    if (savedId) {
      const idx = working.findIndex((e) => e.id === savedId);
      if (idx >= 0) selectEvent(idx);
    }
    if (status) setSaveStatus(status, 'ok');
  } catch {
    // Malformed stash — ignore.
  }
}

// ---- Small helpers ----
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

/** A labelled number input bound to a numeric field. */
function numField(
  label: string,
  value: number,
  step: number,
  onChange: (v: number) => void,
): HTMLLabelElement {
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

/** A labelled text input bound to a string field. */
function textField(
  label: string,
  value: string,
  placeholder: string,
  onChange: (v: string) => void,
): HTMLLabelElement {
  const wrap = el('label', 'pool-num');
  wrap.append(el('span', undefined, label));
  const input = el('input');
  input.type = 'text';
  input.spellcheck = false;
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener('input', () => onChange(input.value));
  wrap.appendChild(input);
  return wrap;
}

/** A `<select>` over `[id, name]` catalog pairs (label: `Name (id)`). */
function catalogSelect(
  pairs: readonly (readonly [string, string])[],
  value: string,
  onChange: (v: string) => void,
): HTMLSelectElement {
  const sel = el('select');
  for (const [id, name] of pairs) sel.appendChild(option(id, `${name} (${id})`));
  // A value outside the catalog (hand-pasted JSON) still shows — append it so
  // the select doesn't silently snap to the first option.
  if (!pairs.some(([id]) => id === value)) sel.appendChild(option(value, `⚠ ${value}`));
  sel.value = value;
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

/** Typed `document.createElement` + class/text in one call. */
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
  if (!node) throw new Error(`event-editor: missing element "${selector}"`);
  return node;
}
