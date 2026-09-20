# ROADMAP — Round 7.5 (The Board), post-§104

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 7 Idioms ✅ CLOSED 2026-09-20;
Round 7.5 — The Board is NEXT, re-chartered at that close); findings +
rationale land in [WORKLOG.md](WORKLOG.md); live status is HANDOFF's 🧭
Cursor. Sub-steps are cut at each phase kickoff (AGENTS "The planning
stack"), never here — **and from this round each cut step declares its
READ** (`none` · `batch` · `stop`; AGENTS "Reads are cut, not improvised",
on trial through this round). Prior round's plan:
[archive/post-94-roadmap.md](archive/post-94-roadmap.md) (Round 7) with its
worklog and spec beside it; before it
[archive/post-88-roadmap.md](archive/post-88-roadmap.md) (the casualty
experiment).

**Status: AWAITING THE ROUND 7.5 KICKOFF.** This round is SPIKE-first, then
spec: the projection spike informs the spec the way the Electron spike
informs Round 8's store. No phase entries beyond §105's charter exist until
the spike has been read and the spec written. The charter, the decision
points, the exit and the scope guards are in META-ROADMAP §"Round 7.5 — The
Board"; the argument behind the re-charter and the three code sweeps are in
[archive/post-94-worklog.md](archive/post-94-worklog.md) §"The Round 7
close", C1; the carried items are in TODO (§"Round 7 close riders").

## Phase 105 — the projection spike

Charter: settle how the board is PROJECTED before anything is built on it.
A dev-only, render-only instrument set, judged by the user's eye in Firefox
against criteria written down BEFORE anyone looks: the projection dial
(perspective-50 as the control · head-on orthographic · yaw-45 orthographic,
each with a pitch dial; an FOV sweep as a diagnostic only — a long lens
shrinks the lean and deletes no rule, so it is not a candidate) · glyph
pixel height at fit per projection per board size, as a number · a
ground-cue mock, shape per side, read under Ctrl+Alt+G · the uniform-anchor
flag (bypass the ink-derived lifts, anchor every cell identically — the
direct test of what the rule deletion rests on) · the fixtures (a dense
melee clump · a 24×24 board · `endlessCorridors` · screen-edge units · a
render-only FAKE FLYER with a shadow · `rubble_2x2` / `_3x3`) · a headless
lean measurement that becomes the pin "world-up projects to screen-up".

**Why first:** every later phase of the round (the projection built · cell
anchoring + the ground cue · team identity · the elevation requirement · the
camera question) is a different piece of work under each answer, and the
round's spec cannot be written honestly before it. **Depends on:** Round 7
(✅ — Ctrl+Alt+G; DESIGN "Team identity on the board"). **Risk:** low to
build, high in consequence — it is throwaway dev tooling, but its verdict
sets the round. **Decision points:** what makes each option LOSE (posed and
signed before the first look) · the projection itself (head-on / yaw-45 /
pitch — or, only if both orthographic options lose, world-space unit quads,
ranked last) · whether the ground cue is also the identity channel.
**Exit:** the projection decided by the pre-registered criteria, the lean
MEASURED (it is only derived today: ≈24° at a fitted board's flank, ≈40° at
the screen edge), and the round's spec written over it. **Scope guards:**
no sim; nothing the spike builds ships to players (dev-gated, or deleted at
the exit); no rule deletion yet — the spike reads, it does not rework; no
rotatable camera; §101's font gates are out of scope for the whole round.
