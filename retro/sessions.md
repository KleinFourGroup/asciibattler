# Session self-reports

The per-session channel of the efficacy + agent-welfare instrument
(AGENTS "Session self-report + the friction log", user-signed
2026-09-09). **One dated entry per session, written at the handoff
ritual** — the end of a session, not a phase. Five fixed questions so
entries are comparable:

1. What was missing from the orientation at the start?
2. Where did two norms conflict, or a norm get in the way?
3. Where did the session feel pulled to claim more than it had verified?
4. What was wasted, in time or tokens?
5. Anything the next session should know that has no other home?

At a phase close, the closing session adds a one-paragraph summary of
that phase's entries under a `## Phase N — summary` heading. The
round-boundary distillation sweeps this file with the scratchpad and
[papercuts.jsonl](papercuts.jsonl) (the in-the-moment friction log —
`npm run papercut`). The first read is at the Round 7 close.

Entries are the session's own words; "none" is a valid answer to any
question and is itself data.

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
