# Scratchpad — rolling notes on process, decisions, gotchas

Running notebook of "things worth talking about" — drop short observations here
as you build. **Swept at every round/cluster boundary** by the distillation
ritual (AGENTS.md §"The planning stack"): each entry gets **promoted** (to
AGENTS / GOTCHAS / TESTING / TODO) or **archived** with the round's docs, so
this file holds only undistilled observations from the current round. Keep
entries short; link commits; group by theme.

Prior eras: the MVP→H7 backlog was swept 2026-07-06 (the ritual's first run) →
[archive/retro-scratchpad-mvp-to-h7.md](../archive/retro-scratchpad-mvp-to-h7.md);
the process-audit + Cluster-3 backlog was swept 2026-07-11 (the second run, at
the micro-round kickoff) →
[archive/retro-scratchpad-cluster-3.md](../archive/retro-scratchpad-cluster-3.md);
the micro-round backlog was swept 2026-07-21 (the third run, at the Cluster-4
kickoff) →
[archive/retro-scratchpad-micro-round.md](../archive/retro-scratchpad-micro-round.md);
the Cluster-4 backlog was swept 2026-07-29 (the fourth run, at the 68h round
close) →
[archive/retro-scratchpad-cluster-4.md](../archive/retro-scratchpad-cluster-4.md);
the rollout-arbitration-interstitial backlog was swept 2026-08-04 (the fifth
run, at the 72f round close) →
[archive/retro-scratchpad-rollout-arbitration.md](../archive/retro-scratchpad-rollout-arbitration.md);
the Cluster-5 backlog was swept 2026-08-21 (the sixth run, at the §83g
cluster close) →
[archive/retro-scratchpad-cluster-5.md](../archive/retro-scratchpad-cluster-5.md);
the Round-6 (Instruments) backlog was swept 2026-09-02 (the seventh run, at
the 88e round close — promoted: six norms to AGENTS [the macro-plan code
audit · count-the-shape-before-timing + profile-between-levers · the
paired-bench warm-leg/subshell rule · verify-the-tree-died after any kill +
no `pgrep` in Git Bash · poll scales to batch size · adversarial review +
a read-only verifying peer], one caveat to BALANCE [exact zeros = an
instrument smell]) →
[archive/retro-scratchpad-round-6.md](../archive/retro-scratchpad-round-6.md);
the casualty-experiment (§89–§94) backlog was swept 2026-09-08 (the eighth
run, at the §94i close — promoted: five norms to AGENTS [the worktree build
under a cohort · Write/Edit for quote-bearing text · self-check a reader +
pool by script · pre-sign the chain · a knob pin through the resolver + the
first live read of an inert-by-design mechanism]) →
[archive/retro-scratchpad-casualty-experiment.md](../archive/retro-scratchpad-casualty-experiment.md);
the MVP-era entries had earlier fed [post-mvp-review.md](post-mvp-review.md).

---

---

_(The post-§94 entries start here — Round 7, Idioms.)_

## The close ritual

- **A round close without a playtest ships its presentation findings to
  the next round's first playtest** (2026-09-10, the §95 playtest — the
  first since §94 closed; the user: "clearly I forgot to do a playtest
  then"). The §94 close had a signed sheet, a frozen config and a
  fallen-ledger screen nobody had looked at in a live run: two findings
  (the morale chip doubling the HUD/turn-screen gauges; the 94d
  shape-lock's live bar NEVER BUILT — it fell through the data/
  presentation split, with no TODO or roadmap line to catch it) cost
  nothing to find and an inserted phase (§96.5) to fix. Candidate norm
  for the close ritual (AGENTS "The round close ritual"): the close
  PROPOSES a playtest as a step, and a shape-lock note that splits a
  step into "data now, presentation later" writes the deferred half
  into TODO in the same commit (the 47c landing-note rule, applied to
  a user's idea instead of a code seam).

## The idiom pass (§96)

- **A behavior-equivalence refactor of PRESENTATION gets a stylesheet
  oracle, not a fuzz oracle** (2026-09-11, 96a–96e): the 47c/47d diff
  oracle re-derived on CSS — parse HEAD's sheet and the working sheet,
  resolve `var()` / relative color syntax / rem on the new side, compare
  declaration by declaration (96a/b: 1552 declarations, 0 diffs) or, when
  selectors move, element by element through a tiny cascade (96d/e:
  class lists × pseudo states × whole-selector specificity). Same rules
  as the fuzz oracle: self-check on HEAD-vs-HEAD FIRST (it found two
  defects in the oracle before it read anything real, and a third —
  descendant-selector specificity — at 96e), negative-control it (strip a
  modifier: 29 diffs), and pin the "before" from `git show HEAD:`, never
  the live file. Candidate: a `scripts/css-oracle` promoted from the
  scratchpad if §101 or Round 8 collapses the ladders.
- **The oracle proves the CASCADE; the browser proves the BOX** (96e):
  a fixed flex column read 0 diffs and still swallowed map clicks in its
  gaps — and the obvious `pointer-events: none` was silently outranked by
  `#ui > * { pointer-events: auto }` at id specificity. Two lessons: a
  layout wrapper is a hit-test change no declaration-diff can see (probe
  `elementFromPoint` in the wrapper's empty space), and before writing a
  rule against `#ui`'s children, grep for the precedent (`#ui >
  .battle-countdown` had the answer).
- **A preview probe that reads zero stylesheets is reading nothing**
  (96a, 96d — twice): `preview_start` returns before the page has loaded;
  a `getComputedStyle` probe in the same breath reads UA defaults (13.33px
  buttons, black text) and looks like a catastrophic regression. Reload +
  a 5 s wait, and assert `document.styleSheets.length` + `window.__game`
  before believing a number.
- **The console buffer is cumulative and HMR fires between edits** (96e):
  seven `ReferenceError`s from reloads that ran while an import landed
  after its first use. Read the console only after a fresh navigation of
  the FINISHED tree, and read the `?t=` timestamps against the last edit
  before calling anything a bug.
- **A codemod with exactly-once guards is a code-reality audit that runs
  itself** (96c): every replacement asserting one match caught a
  legitimate second `mount.appendChild` (the exit clones) and a CRLF
  working copy against an LF index — both real, neither a regression.
  Normalize line endings on read; loosen a guard only to the exact shape
  it was wrong about.
- **A hidden pane runs no rAF, so a fade-in class flip can never be
  observed there** (96c): `rafFiredDuring: 0`. Assert the structural half
  (one root mounted per swap, the outgoing one gone after its fade) and
  hand the visual half to the playtest explicitly — don't write
  "verified" over a class you could not see.
- **The per-step playtest paid for itself five times** (§96): the user
  played after every commit instead of once at the close; nothing was
  found, which is the point — a phase that touches every screen with a
  step's worth of change at a time is auditable by eye; a phase-end walk
  of seven steps' changes would not have been.

### §96.5 — the live pool bar (2026-09-12 → 13)

- **Fire at the moment the rule makes it a fact.** My first design
  projected "what the rule would charge if the battle ended now" — the
  same function that books the turn, so it could not disagree with it —
  and under the survivors rule it ghosted the WHOLE wave off the player's
  bar at tick 0 and shrank it per kill: consistent and backwards. The
  user's model fires one event per loss when that loss becomes a fact (a
  death now, a survivor at the end) and reads right under either rule.
  Rule-agnosticism by re-using the booking function is not the same as
  reading right; the test is what the bar says at tick 0.
- **A frozen pane freezes the Web Animations API too** (b2): the orb sat
  at `currentTime` 50 ms with `visibilityState` "visible" and a
  programmatic `finish()` flipped `playState` without firing its event.
  The §96 "zero rAF" papercut generalizes: anything that rides the
  rendering loop is dead there. The instrument's limitation turned out to
  be a REAL hole (a throttled background tab strands the outro), so the
  fix was a wall-clock backstop in the code, not a workaround in the
  probe — and the backstop then made the frozen pane a valid wiring
  instrument.
- **The guards were right five times in two days** — the ROADMAP phase
  cap on my own checked lines (twice), the literal pin on a CSS transform
  string, a media query and a deleted file's baseline entry, the token
  pin on two grays orphaned by a deletion. Zero false positives; each
  cost a minute. A guard that trips on the closer's own prose is the
  guard working — rewrite the prose, never widen the guard.
- **Control-probe the design's premise, not just the bug's** (96.5b2-pre,
  96.5c2): the gauge-head wrap probe on the UNFIXED tree found the head
  already on two lines for a long encounter name — the parenthetical was
  one more way across a wrap that varied per encounter; the notch's
  "moves during the outro" was a real anchoring bug the redesign fixed in
  passing. A user's presentation note is a bug report until proven
  otherwise.
- **A prediction is a tripwire, not a cap** (96.5b1's "one public World
  read" → two; "the fuzz smoke fires once" → four, all held). Score the
  miss in the worklog and move on; a cut line that was reasoned about
  only one consumer is the finding.
- **Playtest per step, again, and the redesigns absorb in-phase** — two
  user redesigns (the gauge head, the tick → the notch) and two inserted
  fixes (the fade, the cue) each landed the same day at one step's cost;
  a phase-end walk would have found them all at once and re-opened three
  commits.
- **Count before you write the number** — a WORKLOG close line typed
  "+19 keys" from memory; one `Object.keys().length` read +10 before the
  commit. The AGENTS "second-hand number" rule applies to one's own
  memory too.
- **The instrument's first read came early, and paid** (2026-09-13,
  mid-Round 7, user-called): seven papercuts + four session reports were
  enough to show one class biting four times with no doc home (the
  `preview_start` first-probe trap → a HANDOFF tip), one norm overridden
  identically by every session (native-tools → retired, the batching
  discipline kept), an attribution gap in the log itself (five of seven
  entries unattributed — `$CLAUDE_SESSION_ID` is empty under the desktop
  app; the script now warns), and a norm candidate named in three
  sessions' Q4 (numbers typed from prose, not the artifact — held for
  the close read). Zero distress entries; the doc's distress examples are
  all large events, so whether a smaller one would be recognized as
  filable is an open question for the close read. Lesson: a long round's
  instrument gets a mid-round read — the designated close is a floor,
  not a schedule.


## §97 — the tooltip system (2026-09-14 → 15)

- **Re-derive the delivered signal before naming the bug** — three
  pane reads in one phase would each have minted a false bug: a real
  `/` press arrived with `code: ''` (the registry dispatches on code —
  "the key does not pin"); `await import('/src/ui/tooltip.ts')` after an
  HMR cycle was a SECOND module instance (`openTooltipTrigger()` null
  while the DOM showed the tooltip open); a rAF-painted chip read 0 in
  the same eval as the scene swap and 1 a frame later. Each was resolved
  by reading what was actually delivered (the event's fields, the DOM,
  the next frame) — the §79g "symptom fingerprint" rule for probes.
- **A "sole-source" audit finding is a hypothesis about the CSS too** —
  the pip's title sat under a `pointer-events: none` host and had never
  shown; the boss node's copy was on the banner per a code comment the
  audit had not read. Two of four resolved away at the kickoff re-audit;
  a label minted for either would have been noise.
- **Self-check the reader on the tree you replaced** — the tripwire's
  regex was run against `9812f6c~1` before being trusted; a line-based
  `grep -E` variant read 5 for a known 7 (values on the next line), the
  `(?!=)` lookahead read 7. Cheap, and it is the 94c rule applied to a
  three-line test.
- **A signed rule earns its corollary at the next site** — "text taps,
  controls long-press" (call B) met a text chip nested in a clickable
  card at 97d; "nested text inherits the control's route" followed
  without a re-ask and applied again at 97e by team. Worth writing the
  corollary into the idiom paragraph the moment it is used twice.
- **A new label makes an old gap legible** — the countdown had skipped
  the HUD's paint pass since §32c; a faint triangle hid it, `▲ HONED`
  did not. Presentation changes are also instruments on the code they
  sit on.
- **The pause norm read by purpose:** with nothing player-visible (97a,
  97b) the per-commit pause is a formality; the pause after the first
  visible step (97c) and at the exit were the ones that mattered.


## §98 — color redundancy (2026-09-15 → 16)

- **The pane's floor, named:** a 2 px ring style, a shader seam, and a
  0.6 s hitsplat are all below what the pane's JPEG resolves. Three
  substitutes worked, each once: a computed-style read for the rings
  (`borderStyle` / `outlineStyle`), a `MutationObserver` on `.hitsplat`
  insertions for the numbers (110 captured in ~30 s), and the user's
  native eye for the seam (the apron diagonal flip — the pane could not
  have shown it). Reach for the substitute BEFORE writing "verified".
- **One formula in two coordinate spaces is a bug class** — tile-UV on
  the board, world space on the apron, "the same sin" drew opposite
  diagonals because the tile's V runs against world Z. When two shaders
  must agree, give them the same varying, not the same expression.
- **A tell that reads as a warning is a tuning question, not a design
  one** — two bands per tile read as a hazard stripe; one band read as
  water. The amplitude never moved. Widen before you dim.
- **"Very hard to test" from the user is a rider, the same day** — the
  hitsplat split needed a forced encounter + a DOM observer to see once;
  a dev key that spawns one of each kind is a two-second check forever.
  Filed at 98e under TODO §98.
- **The desktop app stops the dev-preview server between turns** — twice
  this session; the hook's "no preview server is running" line was the
  tell each time. Budget a `preview_start` per verify turn, not per
  session.
- **A build-first instrument pays for the phase:** Ctrl+Alt+G (98a) was
  the first commit and every later step had its own lint in hand; the
  before-set it produced re-scoped 98c (name the kinds, not only the
  states) and reframed 98e (a margin, not a rescue).

## §100 — input accessibility (2026-09-17)

- **The pane cannot Enter a native button, and a synthetic key proves only
  JS.** Two reads in one phase said the same thing from opposite sides: the
  charselect card and a map node took focus but never activated on the
  pane's Enter (native default actions never fire from its key tool); the
  pressable helper's Enter / Space WERE provable, because they are JS
  listeners, by a click counter on the card. Name which kind a route is
  before choosing the instrument.
- **A control probe on the OLD path, again:** the objective pane never
  showed an active mode after the keyboard pick — and a plain
  `card.click()` (the unchanged 78b mouse path) read the same. Ten seconds
  of probe saved a wrong mechanism story (the §99 hidden-pane sim stall
  was the likely cause). Same shape at 100b: the hover twin "absent" on
  the focused card read the same on a HOVERED card — the instrument (a
  parked transition), not the sheet.
- **Firefox-only bugs exist in the Tab order, and the pane wraps
  silently.** The chrome column's DOM position (100c1 → 100e → 100e2) was
  invisible to Chromium-in-a-pane: no browser UI to detour through. The
  user's read found it twice; the second time the diagnosis was right and
  the fix was one wrapper div. When a finding is "the walk goes somewhere
  odd", ask WHERE IN THE DOM the next control sits, not where focus starts.
- **A test that restates English is a hook failure waiting** — three of
  them this phase (`hud.card.targetHint`, `'Paused'`, the delta labels).
  The fix each time: derive the expectation from the table (`t()` /
  `UI_EN`). The balance-proof rule's converse ("primitive tests pin
  literals") does not cover UI COPY — copy is content, and content moves.
- **Extract what the scan misses when you are in the file anyway** (the
  `$ Port` heading, `— level N`): the heuristic is the pin, not the goal;
  the touch-once rule is the goal.
- **No source writes while a pane sequence is in flight** — a prettier
  pass reloaded the tab mid-walk (100c1). Format BEFORE the walk, or after.
- **One stab, capped by the user, is a fine shape for a host we are
  leaving** (the Electron move): the 100e2 wrapper took ten minutes; a
  design would have taken the afternoon.
