# ROADMAP — Round 7 (Idioms), post-§94

The active PLAN (it stays a plan for its whole life). The macro order is
[META-ROADMAP.md](META-ROADMAP.md) (Round 6 ✅ CLOSED 2026-09-02; the
encounter feel interstitial — THE CASUALTY EXPERIMENT, §89–§94 — ✅ CLOSED
2026-09-08; Round 7 Idioms is NEXT); findings + rationale land in
[WORKLOG.md](WORKLOG.md); live status is HANDOFF's 🧭 Cursor. Sub-steps
are cut at each phase kickoff (AGENTS "The planning stack"), never here.
Prior round's plan: [archive/post-88-roadmap.md](archive/post-88-roadmap.md)
(the casualty experiment) with its worklog and spec beside it; before it
[archive/post-83-roadmap.md](archive/post-83-roadmap.md) (Round 6).

**Status: AWAITING THE ROUND 7 KICKOFF** (spec-first, per AGENTS: the
spec artifact is produced before the roadmap is written, audited against
code reality). No phase entries exist until that session produces the
spec and the cut. The charter, why-this-order, dependencies, risk, and
scope guards are in META-ROADMAP §"Round 7 — Idioms"; the carried items
from §94 are in TODO (§92/§94 riders) and the named watches on the signed
sheet (BALANCE 2026-09-08 §94h).

## Phase 95 — Round 7 (Idioms): the spec + the i18n layer

Charter (META-ROADMAP §"Round 7 — Idioms", locked 2026-08-21 v2): make
every user-facing surface translatable and consistent BEFORE the rounds
that author the biggest remaining UI (menu, settings, tutorial) and prose
(act 3). The first phase is the SPEC artifact (spec-first, audited against
code reality — the ~270 prose fields and every UI surface counted before
the design conversation) and the i18n layer: a `t(key)` layer + locale
files + the config-prose convention (events / encounters / daemons /
packets / characters / sectors / camps / statuses / units / abilities
resolved through the locale, not inlined) + **a coverage pin that fails on
a new hardcoded user-facing literal** (the EMPOWER_DISPLAY idiom); the
existing events migrate while they are few. English-only ships; the layer
is what is being bought. **Why first:** ordering principle #1 applied to
text — every later surface is authored against the layer. **Depends on:**
Round 6 ✅ + the casualty experiment ✅ (2026-09-08); no board work in
flight — this round never touches sim. **Risk:** low-medium (wide but
shallow; the string pin is the only new gate). **Decision point:** the
locale-file shape for config prose (sidecar `events.en.json` vs `textKey`
indirection) — ⛔ at the spec session. **Exit:** the literal pin green on
every migrated surface; the spec signed. **Scope guards:** no new screens
(the menu is Round 8); no translation beyond English; no sim / snapshot
change; the UI style & robustness audit and the sound registry are the
round's LATER phases, cut at their own kickoffs.
