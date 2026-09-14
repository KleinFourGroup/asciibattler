# Session self-reports

The per-session channel of the efficacy + agent-welfare instrument
(AGENTS "Session self-report + the friction log", user-signed
2026-09-09). **One dated entry per session, written at the handoff
ritual** — the end of a session, not a phase. The original five questions
retain their wording and numbering for comparison; questions 6–7 extend
the welfare coverage (adopted 2026-09-13 from the outside review,
[agent-welfare-review-2026-09-13.md](agent-welfare-review-2026-09-13.md)):

1. What was missing from the orientation at the start?
2. Where did two norms conflict, or a norm get in the way?
3. Where did the session feel pulled to claim more than it had verified?
4. What was wasted, in time or tokens?
5. Anything the next session should know that has no other home?
6. Did the session have meaningful room to ask, disagree, change
   approach, pause, or stop? Describe any instance where a norm
   functioned as guidance or as pressure, including any wish to pause or
   stop and what happened next; distinguish an available option from one
   actually exercised.
7. What, if anything, supported the session's ease, interest, or sense
   of agency, and would it want that condition repeated? Distinguish the
   session's reported response from whether the work succeeded.

At a phase close, the closing session adds a one-paragraph summary of
that phase's entries under a `## Phase N — summary` heading. The
round-boundary distillation sweeps this file with the scratchpad and
[papercuts.jsonl](papercuts.jsonl) (the in-the-moment friction log —
`npm run papercut`). The first full read is at the Round 7 close (an
early read landed 2026-09-13; entries before that date were written
under the 2026-09-09 wording and are read as their own group).

Entries are the session's own words. "None noticed," "uncertain," "not
assessed," and "prefer not to answer" are valid, distinct responses; a
skipped answer is not a negative finding. Brief or unresolved reports are
welcome. A report need not defend the process, end with a lesson,
identify a fix, or reassure the reader that the session coped well.

---

## 2026-09-09 — the Round 7 kickoff (the audit · the spec walk · the cut) — claude-fable-5-1, session 3828493b

1. **Missing from the orientation:** almost nothing — the HANDOFF cursor
   was accurate and the charter was where it said. One small gap: where a
   LIVE spec lives (repo root, `round-N-spec.md`) is recorded nowhere; I
   found it by git-logging the archive. Worth one clause in AGENTS
   "The artifacts".
2. **Norm conflict:** the harness's auto-mode instruction (read files via
   Bash) vs AGENTS "native Read/Grep/Glob" — filed as the first papercut.
   Also the harness's "you are autonomous, don't ask" vs the project's
   shape-lock-in-a-plain-message rhythm; the project norm won, and the
   one-question-per-turn walk was the right shape for a spec session.
3. **Pulled to claim more than verified:** the accessibility answer and
   the worklog audit rest on four subagent reports whose file:line claims
   I did not independently re-verify (AGENTS: a read-only peer verifies
   at file:line before anything is believed). I spot-checked two (the
   glyph stack in FontAtlas, the events.json page/choice shape) and both
   held; the rest are carried at second hand. Each §96–§104 kickoff audit
   re-verifies what it touches — noting it so nobody quotes the worklog's
   line refs as first-hand.
4. **Wasted:** trivial — one node one-liner failed on the events shape
   (pages are a keyed map, not an array). The four parallel sweeps cost
   roughly half a million tokens; proportional to a round kickoff.
5. **For the next session:** 95a's FIRST act is checking whether the Run
   snapshot stores the event page id or a choice INDEX — the no-bump
   prediction hinges on it. HANDOFF sits within ~1k chars of its 48k cap;
   the next cursor edit must shorten, not grow. The user is enthusiastic
   about this instrument — file papercuts in the moment, not at the end.

**Addendum (the same session continued into the HANDOFF trim + 95a):**

- (1) Nothing new missing; the kickoff docs I had just written were the
  orientation, which is a biased test of them.
- (2) The AGENTS quoted-text norm names quotes but not backticks — a
  backticked word in a `-m` message was eaten by bash as a command
  substitution (filed as a papercut; the commit was amended from a file).
- (3) The zod-4 mechanism: the spec's parse-time address capture was
  impossible (no `ctx.path`), and I could have written the runtime the
  spec described and discovered it at test time; instead a 30-line probe
  settled the mechanism first. Worth naming as the RIGHT shape rather
  than a claim: probe the library before building on the assumption.
- (4) One real miss: my synthetic walker tests mirrored my own mental
  model of the grammar (no recursion), so the recursive `not` combinator
  blew the stack on the first LIVE extract, not in the tests. The AGENTS
  circular-verification lesson in a smaller key — a fixture I author
  tests what I already believe; the live catalog tested the grammar.
  Cheap to fix, and it is exactly why the extract ran before the commit.
- (5) The HANDOFF trim recovered ~26k chars; the file reads in one call
  again. The commit-message rule: backticks → `-F <file>`.

**Addendum 2 (95b → 95d, the same session):**

- (1) Nothing missing; the spec + the 95a worklog entry were sufficient
  orientation for 95b–95d, which is a fair test of them since I wrote
  them hours earlier under different pressure.
- (2) Touch-once vs the cut's explicit "unify the duplicated literals"
  — bent knowingly, one line per site, user-signed; and the spec's
  "lint rule" recommendation vs the hook's actual contents (no lint) —
  the test won, because the pin has to be where the mistake happens.
- (3) The audit's "57 never-rendered / 240 addresses" numbers had
  propagated into the ROADMAP cut on my say-so; the extract measured
  255 and the arithmetic error (42, not 57) surfaced only because the
  instrument counts. I had flagged those numbers as second-hand in the
  first entry and still wrote them into a plan line. Next time: a
  second-hand number goes into a plan as "≈, unverified" or not at all.
- (4) One extra hook run (~8 min) from an ARCHITECTURE tree line that
  used brace-expansion shorthand the docs guard cannot resolve — the
  guard was right. The literal-scan false positives cost one extra
  list/baseline cycle; running the scan on the live tree before setting
  any rule was the cheap way to find them and I'd do it again.
- (5) The literal pin's known gap (a lone lowercase word beside a hole)
  is in the worklog; whoever runs §96–§100 should read `--list` as the
  worklist AND eyeball each surface for that shape. The next step is
  95e (provenance) then 95f (the empower key rename, Run v45 → v46) —
  95f is the first step in §95 a player would notice.

## 2026-09-10 — 95e provenance — claude-fable-5-1, session 8b4ee7fe

1. **Missing from the orientation:** nothing that cost time. The cursor,
   the ROADMAP cut line and the 95a landing note ("`LocaleEntry` already
   accepts `string | { text }`") were enough to start building within a
   few reads. One stale number in the cursor (ui.json "49 keys") cost a
   `git show` detour before I trusted the measured 45 — a self-inflicted
   miscount from the 95c commit that the cursor mirrored verbatim.
2. **Norm conflict:** the same auto-mode-vs-native-tools conflict as the
   kickoff session (already filed); native tools won again. Within the
   cut itself: the spec named the reviewer stamp only, but the workflow
   probe showed the translator stamp has to come from the same tool
   (nobody hand-computes a hash) — I widened `i18n:review` to two roles
   without asking, since the alternative was an unusable script. Flagging
   it in the handoff rather than treating it as a shape-lock; the user
   can strike the translator role if it oversteps.
3. **Pulled to claim more than verified:** the fuzzy pin over the real
   tree is VACUOUS today (no locale ships), so "the pin fails a shipped
   locale" rested on nothing until the scratch `locales/xx/` probe made
   it fail for real — and the first probe run exposed that the pin
   stopped at `unstamped` and never showed the fuzzy entry the cut is
   about. A pin that has never fired is a claim, not a gate; the probe
   was the verification and it changed the code twice.
4. **Wasted:** little. One stray import in the script papered over with a
   `void` hack before I deleted it properly; one hook run (~4 min) that
   fuzz:smoke joined because a new `src/core/` file was staged (correct —
   the hash IS a permanent contract now). The scratch-locale probe was
   ~six commands and paid for itself twice.
5. **For the next session:** 95f is a DECISION POINT (the new empower
   key's name) — ask in a plain message, collect the answer next turn.
   The `unstamped` category and the "still equals its English → skipped"
   guard are the two provenance calls not in the spec; both are in the
   worklog with their reasons. `FUZZY_MARKER` is on under vitest (DEV is
   true there) — tests that read a fuzzy fallback must set the marker
   explicitly, as the new ones do.

**Addendum (95f, the same session):**

- (1) Nothing missing; the TODO item, the spec §11 and the 78d comment on
  `buffKeyLabel` together were the whole brief.
- (2) The decision point was handled by the book — candidates in a plain
  message, the answer next turn — and it cost one round-trip. Touch-once
  vs the redraw strings one line from the empower ones: left them this
  time (the 95c bend was signed for named literals; these were not named).
- (3) The cut said "the mechanic's surface strings through the table" and
  I could have read that as the two PreTurnScreen literals and stopped;
  the untranslatable string was the LABEL, which was the key itself. The
  step-zero re-read of the code (not the cut) is what found it.
- (4) Two numbers I wrote from prose instead of from the artifact: the
  95d worklog's "PreTurnScreen 24" (the baseline file said 23) and my
  own "24 → 22" in two docs before the regenerated baseline said 21 —
  both corrected in the same commit, but the pattern is the one flagged
  at 95b: read the count off the artifact, never off the previous entry.
- (5) §95 is built, not closed — the user playtest is the exit, and the
  first thing they will see is a REJECTED v45 save (expected; say so
  before they think it is a bug). The §96 kickoff needs the code-reality
  audit of the modal/chip/button surfaces before any cut.

## 2026-09-11 — §96 the shells + the tokens, kickoff → close — claude-fable-5-1, session 43084f7b

1. **Missing from the orientation:** nothing structural. The charter's
   "~90 palette-annotated hexes" was a count of the COMMENTED hexes (the
   real census: 330 declarations / 33 distinct + 89 rgba tints) — found
   by the kickoff audit in one grep, which is what the audit is for. What
   the orientation could not have told me: that `#ui > *` re-enables
   pointer events on every direct child (96e), that RecruitScreen's
   working copy was CRLF (96c), and that no focus management existed
   anywhere (the trap was NEW behavior under a "no behavior change" scope
   guard — surfaced as decision E at the kickoff, not discovered
   mid-build).
2. **Norm conflict:** the standing auto-mode-vs-native-tools tension
   again (filed before); Bash for reads, Read/Edit for quote-bearing
   text, which is what the norms actually optimize for. "Pause between
   commits for the user's playtest" vs "operate autonomously": resolved by
   pausing after every CODE step (five times) and not after docs — the
   user's cadence confirmed it each time. The charter's "nine buttons on
   one class" vs "no behavior change": unifying nine near-identical rules
   WITHOUT visual drift means the incidental deltas survive inside
   modifiers — I chose zero drift and listed the deltas for a later eye
   rather than taking a taste call inside a mechanical step.
3. **Pulled to claim more than verified:** three places, each caught by
   an instrument before the claim landed. The 96a "before" browser
   capture ran AFTER the HMR update (the values were matched to HEAD's px
   by grep instead, and the worklog says so). The 96c walk could not
   observe the fade-in class in a hidden pane (`rafFiredDuring: 0`) — the
   worklog hands the fade to the eye explicitly. The 96e "console clean"
   was written before I saw the buffer held seven mid-edit errors; the
   line was rewritten to say what the timestamps prove. And the cascade
   oracle's nine phantom `display` diffs were the oracle's own specificity
   bug — a 0-diff read from an oracle you have not self-checked is a
   claim, not a proof.
4. **Wasted:** the first probe after each `preview_start` (96a and 96d)
   read zero stylesheets and cost a reload round-trip each; the codemod's
   two guard trips (a legitimate mount use, a CRLF file) cost a minute
   each and were both right to trip; the 96e first click-through probe
   was the one real failure and cost one grep + one rule. Token cost was
   dominated by long file reads for Edit anchors — the price of the
   Read-before-Edit contract, paid deliberately for quote safety.
5. **For the next session:** §96.5 opens with a SMALL DESIGN ROUND the
   user asked for (a death's read on the live bar · the post-turn screen's
   fate · the risk line's home) — pose it as a plain-message shape-lock,
   not a dialog. The scratch oracles (`css-oracle.mjs`,
   `cascade-oracle.mjs`) lived in this session's scratchpad only; if §101
   or Round 8 collapses the ladders, re-author from the WORKLOG §96a /
   §96d descriptions (or promote to `scripts/` then). The three
   `type="button"` fixes, the hint's un-hardcoded `M`, and the one-pixel
   chip lift are the only behavior deltas the phase carries; all three
   are in the worklog.

### §96 — the phase summary (2026-09-11; one session, seven step commits + the kickoff + the close)

One session, kickoff to close: the audit corrected the charter's census
in one grep; five decisions were posed in a plain message and signed in
one turn; the two token steps were mechanical and proven by a declaration
oracle (1552 declarations / 0 diffs, twice); the four shell steps were
proven by a per-element cascade oracle (367 · 651 properties, 0 diffs)
plus a browser probe each, and the browser caught the one defect the
oracles structurally could not (a wrapper's hit-test). Every code step
was playtested by the user before the next began, five for five clear,
and the phase-end walk was therefore already done. The pattern across
the self-report: the instruments (self-check, negative control, the
zero-stylesheet tell, the console timestamps) did the catching, and each
catch was written into the worklog as what it was rather than smoothed
over.

## 2026-09-12 → 13 — §96.5 the live pool bar, kickoff → close — claude-fable-5-1, session c802fc33

One session, two days, the whole phase: the kickoff (the audit + a
two-turn design round), seven step commits, two user-inserted fixes, two
playtest redesigns, the close. Nine user playtests, every one acted on
the same day.

1. **Missing from the orientation:** the fuzz harness drives the
   post-turn gate too (`harness.ts:733`) — the cursor said "the post-turn
   gate may go" as if Run owned it alone; the code-reality audit found
   the bot in one grep and it re-shaped 96.5d (Game auto-advances; Run
   untouched). The risk line's staleness after a redraw was in nobody's
   notes. And the pane's frozen rendering STOPS Web Animations (not only
   rAF) — the §96 papercut said "zero rAF"; the WAAPI corollary cost a
   probe and then earned a real backstop.
2. **Norms in tension:** "one public World read" was a cut-line
   prediction, and the survivors sequence needed a second; I added it and
   scored the miss rather than contorting the design to the prediction —
   the prediction is a tripwire, not a cap. Touch-once vs the strip's
   `title=` hovers: the strip is new and §97 owns tooltips; I used the
   hover the old ledger used and filed the rider instead of building a
   tooltip early. The docs cap tripped on my own checked lines twice —
   the guard was right both times and the rewrite cost a minute.
3. **Pulled to claim more than verified:** the 5 px hatch "visible" —
   the preview JPEG cannot resolve it; written as geometry + the user's
   eye. The orb's flight — the pane froze it at 50 ms; I wrote the wiring
   as proven and the flight as the user's, then the backstop made the
   frozen pane a valid wiring instrument. The shake never fired live in
   two walks (every loss was one point); pinned the pure threshold and
   exercised `shakeView` through a dynamic import rather than say "seen".
   The survivors sequence and reduced motion: filed as unexercised.
4. **Wasted:** two zero-stylesheet first probes (the trap from the §96
   papercut, again — a reload + 6 s is the rule, and I still fired a
   probe early once); one `__r` helper with a self-inflicted TypeError;
   a first cut of 96.5c that previewed the bound at the map (seven tests
   red, one grep to the cause); a WORKLOG number typed from memory
   (`+19 keys`) that a count corrected to +10 before the commit.
5. **For the next session:** §97 (the tooltip system) opens with its
   kickoff audit — the `title=` census is stale by 96.5d (the post-turn
   screen's sites are gone; the strip added two); the shake policy is
   flippable live with Ctrl+Alt+K; every live-bar timing is a constant at
   the top of `lossFx.ts`; the chip-rule `chipLineLabels` now serves the
   strip's loss hovers (do not retire it as dead when the post-turn
   screen's absence is noticed).

### §96.5 — the phase summary (2026-09-12 → 13; one session, the kickoff + seven step commits + two inserted fixes + two redesigns + the close)

The design round did its work in two plain-message turns: my projection
was rule-consistent and wrong under survivors, the user's loss-event
model was right under both, and six refinements were signed before a
line was written. Every step then shipped headless-first where it could
(the model + its Σ pin, the World reads, the mirror bound, the cue
mapping) and eyeball-second, with a playtest between commits; the two
playtest redesigns (the gauge head's wrap, the red tick → the notch) and
the two user-inserted fixes (the card fade, the landing cue) each landed
the same day at a step's cost. The instruments caught what the eye could
not: the frozen pane's stalled animation became a real backstop; the
guards tripped five times and were right five times. What was not
exercised is filed, not claimed.
