# Round 7 Spec — Idioms

The i18n + UI-audit round the 2026-08-21 macro plan scheduled ahead of
the big UI rounds (menu, settings, tutorial) and the big prose round
(act 3). The draft below is the intent as locked in
[META-ROADMAP.md](META-ROADMAP.md) §Round 7 plus the 2026-09-09 spec
conversation; the **Kickoff resolutions** block is the signed design
record. The code-reality audit that every resolution was posed against:
[WORKLOG.md](WORKLOG.md) §Kickoff (four parallel read-only sweeps at
`730d805`, 2026-09-08). The plan: [ROADMAP.md](ROADMAP.md).

## Intent (the draft, in the user's voice)

Make every user-facing surface translatable and consistent before the
rounds that author the biggest remaining UI and prose. English-only
ships; the layer is what's being bought. The i18n layer goes first so
the audit's per-surface pass extracts strings in the same touch — touch
each file once.

Accessibility beyond input: yes, all of it needs integrating in some
manner. The rule I want is that color is never the sole channel for
anything the player has to act on, with "survives a desaturated
screenshot" as the test; the colorblind palette itself is a Round 8
setting. We need a custom tooltip system — the native one is hover-only,
and ours can trigger on click and keyboard focus and have some visual
flair beyond a grey box. The WASD camera: I'd forgotten it existed; gate
it dev-only, but slot in proper tests of how each camera mode plays —
the original D4 plan was an A/B on which mode players prefer, and I
forgot about that too.

Team identity on the board (both sides share one glyph pool; green vs
red is the only tell) ties into a broader rework of the units: we have
too many special rules around glyph alignment and spacing, all to get
something that only 90% works and is brittle. That rework is its own
round — **Round 7.5 — Units** — not a Round 7 phase. And since nearly
every round now needs one of these, the unscheduled rounds become
regular rounds with a `.5` number; no renumbering, no slugs.

The i18n design: the sidecar. English stays inline in the config where
the editors write it; other locales are derived artifacts with drift
detection. I want an authorship chain per translated string — who wrote
the English, who translated it, which native speaker signed off and
when — as a low-cost path for future volunteers to own a locale and see
their name in the credits. (I suspect the model underestimates its own
ability to capture prose register, but the reviewer field costs nothing.)

The empower naming collision: I'm authorizing the snapshot bump so we
can be done with it now, rather than renaming only the surfaces.

## Kickoff resolutions (LOCKED 2026-09-09 — the spec-audit design conversation)

All twelve user-signed in the 2026-09-09 walk; rationale and the
rejected alternatives are in WORKLOG §Kickoff → "The spec conversation".

### 1. The color rule (LOCKED)

**"Never color alone"** is the idiom, for anything the player must act
on with few categories: team, map node state (which nodes can I
click), passability (deep vs shallow water), rarity, DoT kind. A second
channel exists — shape, text, position, border — so the palette is
comfort, not correctness. **The audit test is a desaturated screenshot:**
if a surface survives grayscale it survives every form of colour-vision
deficiency. Many-category cases (the ten status hues, the five empower
hues) satisfy the rule through their TEXT channel (the card's labelled
chip, the tooltip), not a per-pip shape. The CVD-safe palette proper is
a Round 8 setting and out of scope here; Round 7 leaves it a one-table
swap (§5 of this block, the CSS tokens).

### 2. The tooltip system (LOCKED)

One component, one live element, in the terminal idiom. Triggers: hover,
keyboard focus, tap-toggle on touch, and a keyboard key; closes on Esc,
pointer-leave, focus-out. **Flip-positioned so it never shifts layout**
(the hysteresis class). Rich content — the status entry carries its
swatch, name and the `×N · P/s · Ns` meta. `aria-describedby`-linked.
The 19 native `title=` sites become 19 call sites, each converted in
the same touch as its surface's string extraction. **Rule: a tooltip is
never the sole channel for information the player must act on** — the
four sole-source sites (the board status pip's name, the empower `▲`
key, the compact card's level/power, the boss forewarning) get a
persistent label where one fits.

### 3. The camera bindings (LOCKED, amended)

The `Backquote` fit↔scroll toggle and the WASD/arrow pan
(`Renderer.ts:55-63`) are **gated dev-only now** behind the existing
Ctrl+Alt dev-keys pattern, closing the 78e-class hole (a pure-mouse
player cannot reach them; they bypass the registry). **The D4 A/B rides
Round 7.5:** D4 shipped as "dev fit + game scroll" and fit became the
default by inertia, never by a call. The two modes are a legibility
lever (scroll's 12-tile window ~doubles on-screen glyph size on big
boards), so the preference test is run against the reworked glyphs:
testers get the toggle, one session each mode; the winner gets a HUD
control and a Round 8 default-mode setting.

### 4. Team identity → Round 7.5 — Units; the unscheduled-round convention (LOCKED)

A shape channel for team identity needs a new per-instance field
through the sprite renderer against a 47/48 atlas, on top of the
glyph-alignment stack (per-glyph measured ink boxes, the floor-family
vs baseline stand-line classifier, the descender room, three derived
lifts, the font-fallback probe, the subset gate). That is a deep
render rework, not wide-and-shallow, and it needs its own code-reality
audit of what each special rule was defending against. **It is its own
round, Round 7.5 — Units**, between 7 and 8, with Round 7's obligation
being a written team-identity requirement in the idiom reference that
the rework must satisfy.

**Convention:** unscheduled rounds inserted between planned ones take
the `.5` number (the `<phase><letter>` form is already the step
address). Round numbers are charter identities, never renumbered; the
phase counter is the durable ordering key. **The macro re-audit joins
the close ritual:** at each round close, re-read the next round's
charter against code reality and insert any needed `.5` round then, as
a planned entry — so the next one is a line written at the close, not a
surprise at the kickoff. (Slugs + a cite mechanism: rejected — a
resolver pass over every doc and commit for the remainder of the
project isn't worth it.)

### 5. The locale layer — the sidecar (LOCKED)

**Config prose: the sidecar, keyed by address.**

- **The config keeps the English.** English stays inline in the 34
  config files, authored through the nine editors, which do not change.
  English is locale zero; its value is its own key, so it cannot drift
  from one.
- **The schema declares prose.** Each zod loader wraps its prose fields
  in a `prose()` helper instead of a bare string. That is the manifest,
  in the one place a new prose field must be added anyway. The audit's
  field list (WORKLOG §A) is the set that gets the wrapper.
- **Loading resolves through the locale.** The loader walks the prose
  fields, derives an address from family · entity id · field path
  (`events.shrine.pages.start.text`), and resolves it in the active
  locale. English returns the inline value; another locale returns its
  sidecar entry or fails loudly.
- **One sidecar per family per locale.** A generated `locales/en/<family>.json`
  is the translator's source (an extract script walks the same
  declarations); `locales/<lang>/<family>.json` holds the translation at
  the same addresses.
- **The pins, derived from the live catalog (the EMPOWER_DISPLAY shape,
  never a hand list):** per shipped locale — *missing* (every live
  address has an entry), *orphan* (every entry has a live address),
  *fuzzy* (the entry's stored source hash matches the current English).
  A fuzzy entry falls back to English at runtime with a dev-mode marker;
  a shipped locale with fuzzy entries fails the pin.
- **The positional joint gets an id.** Event pages are already a keyed
  map; event choices are a positional array (65 strings). Choices gain
  an optional `id` in the schema, stamped by the event editor on save,
  and the address uses it. The last positional address is gone.

**UI literals: an explicit-key string table** (`locales/en/ui.json`),
through the same `t()` runtime. They live in code with no entity id and
share strings across sites, which is the case explicit keys are for.
Interpolation via placeholders (word order becomes the translator's);
plurals and numbers via the browser's `Intl.PluralRules` /
`Intl.NumberFormat` with a tiny substitution helper — **no dependency**.
A word branched inside a sentence (`HUD.ts:513`'s left/right) becomes
two whole strings. The glyph-prefix convention (`◈ ▤ ⌖ ▸ ⚠`) stays
OUTSIDE locale values (a CSS/`::before` concern, not prose).

**Provenance per translated entry** (the fuzzy pin needs the stored
source anyway):

```json
"events.shrine.pages.start.text": {
  "text": "…",
  "source": "<hash of the English at translation time>",
  "translator": { "who": "claude-fable-5-1", "on": "2027-03-02" },
  "reviewer":   { "who": "Native Speaker X",  "on": "2027-03-14" }
}
```

English authorship is git's. An `i18n:review` script stamps the
reviewer for a locale; a translation whose source drifted after review
is fuzzy again and needs a fresh sign-off (the gettext fuzzy-flag
discipline, rebuilt on the pin we already need). A generated translators
credit reads the provenance for the Round 8 credits screen — the
volunteer path.

**The literal pin** ("fails on a new hardcoded user-facing literal"):
the guard rides `npm test` / pre-commit on the forgetful path — a lint
rule that rejects a string literal flowing into a text sink
(`textContent` / `innerText` / `title` / `placeholder` / `createTextNode`)
outside the locale layer, with an allowlist for glyph-only strings and a
per-file baseline for not-yet-migrated surfaces that shrinks to zero by
the round's exit. Exact mechanism is the §95 cut's call.

`textKey` indirection: REJECTED for config prose (moves the English out
of the config, every editor writes two files, and opens the reverse
drift where a renamed key orphans its text — worth it only when many
people author prose or a string serves many sites, which is the UI
table's case, not the config's).

### 6. The 57 never-rendered strings (LOCKED)

Encounter / sector / camp / layout `description` and camp `name` are
editor metadata. They stay plain strings, NOT `prose()`; if one ever
gains a render site the wrapper is a one-word change and the pin
catches the untranslated landing.

### 7. Layouts join the families (LOCKED)

`layouts.json` `name` (11) renders at three sites including the boss
forewarning; it gets the wrapper like every other family. The charter's
ten families become eleven.

### 8. The wail / hex rework — split (LOCKED)

The "lacks projectiles" observation is literal (impact-only fx, no
release/travel phase; no projectile exists in `abilities.json`). **A
release phase + a projectile fx key is presentation** — config +
fxRegistry, the readability class this audit owns — IN. **Any range /
cooldown / duration retune is board work** — OUT, carried to Round 9
with the kit watches. `TODO.md:343` splits along that line.

### 9. Two riders retire (LOCKED)

The event-screen pool gauge (`TODO.md:344`) was delivered by §94e (the
page-lifetime PoolOverlay); the HUD stat-line rider (`TODO.md:182`)
cites `formatStats`, deleted at `5a52962` (Q6). Both tick with a pointer
to the audit. The one sliver — full gauge vs chip on the event screen —
becomes a line in the per-surface checklist.

### 10. The reduced-motion seam (LOCKED)

IN, as two small pieces, both OS-driven now and setting-driven in Round
8 without touching the seam again: a `prefers-reduced-motion` block in
`ui.css` covering the seven keyframes and the one infinite pulse, and a
channel-stripping filter in the FX descriptor resolver
(`fxRegistry.ts:238-240`, the single choke point all three dispatch
sites walk — pure, headless-testable) driven by the same media query.
The bloom strength dial and the scanline toggle stay in Round 8 (useful
only as settings).

### 11. The empower naming collision — the KEY renames (LOCKED, snapshot bump authorized)

The buff key `"empowered"` (`config/daemons.json:15`, `config/empower.json:5`)
collides with the pre-turn EMPOWER mechanic. **The key renames**, which
is a Run-snapshot bump (it serializes inside `encounterEffects`) plus the
EMPOWER_DISPLAY pin — **the user authorized the bump** (reject-stale
until 1.0, no migration). The mechanic's surface strings rename through
the string table in the same step. The scope guard is amended
accordingly (below).

### 12. The sound registry sequencing (LOCKED)

It stays the round's LAST phase, but it is not independent: the
sector-cleared sting is the registry's own line (`Game.ts:347`) and the
run-end stats screen shares `GameOverScreen.ts` with the run stings. The
sting rider moves INTO the registry phase; the stats screen is built as
a surface in the audit phase with its sting dispositioned in the
registry phase. The registry dispositions all **47** events (the plan
counted ~45 and predates `run:poolChanged`, `pools:chipped` and
`turn:resolved.reason`).

## Scope guards (amended)

- No new screens (the menu is Round 8). The run-end stats body lands on
  the EXISTING GameOverScreen.
- No translation beyond English; the layer, the pins, the provenance
  schema and the extract ship; no second locale file is authored.
- **No sim change. ONE snapshot bump — the empower key rename (§11) —
  is authorized;** no other serialized-shape change.
- No board/balance work: the wail/hex retune, the PRIEST parity, the
  kit watches, the DP-tail redesign all carry to Round 9.
- No settings surface, no persistence: every toggle-shaped item
  (mute/volume, default speed, colorblind palette, aura graduation,
  bloom dial, scanline toggle, text scale, rebind UI) stays Round 8;
  Round 7 leaves each one a one-table / one-seam change.
- The unit/glyph rework and the team-identity shape channel are Round
  7.5.

## Exit

- The literal pin green with a ZERO baseline on every migrated surface;
  the three sidecar pins green for `en`.
- The idiom reference (DESIGN §UI idioms) signed — including the color
  rule + its grayscale test, the tooltip rule, the hysteresis class, the
  shells (modal / chip / button / screen), the input-accessibility rule
  extended to hover and to keyboard focus, and the team-identity
  requirement Round 7.5 must satisfy.
- The accessibility rule audited on every surface (the per-surface
  checklist, one row per surface, every row ticked).
- The event-keyed sound registry + coverage pin, 47 events dispositioned.
- META-ROADMAP: Round 7.5 — Units entered with a charter stub; the `.5`
  convention and the close-ritual re-audit written into AGENTS.

## Marked uncertainty (open at signing)

- **The tooltip's keyboard trigger key** and whether it joins the
  rebindable registry — the §96 cut's call.
- **The literal pin's exact mechanism** (lint rule vs headless DOM
  scan) — the §95 cut's call; the lint rule is the recommendation.
- **Deep-water coplanarity** was an aesthetic decision
  (`TerrainRenderer.ts:219-222`); giving deep water a depth tell is a
  one-line change but a design re-decision — ⛔ decision point in the
  color-redundancy step.
- **Whether choice ids are stamped by the editor or hand-authored** in
  the 13 existing events; either works, the editor stamp is the default.
- **The new empower key's name** — chosen at the rename step.
