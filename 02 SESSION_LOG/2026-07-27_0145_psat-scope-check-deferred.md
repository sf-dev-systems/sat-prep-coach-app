---
title: PSAT Import Scope Check — Deferred
date: 2026-07-27
agent: Claude Sonnet 5
phase: Content Import (complete) — governance/planning
commit: (pending — doc-only change)
---

## COMPLETED

### Status check on the 8-item plan from the prior session
Confirmed against git log and the last two session logs:
- Items 1–4 (push 6 commits, audit-script pagination fix, T8 RW rationale cleanup, re-audit +
  commit) — all done, plus two extra AI-pipeline bug fixes (dead model IDs, extended-thinking
  budget bug) landed and pushed on top (`dced190`, `eeedd4d`).
- Items 5–6 (manual browser E2E test + any resulting fixes) — blocked; requires the user to log
  in themselves. Not started.
- Item 8 (backlog: GitHub secrets, next CVE upgrade) — untouched, not pulled in.

### Item 7: PSAT import scope check
User asked to move to this item since #5 is blocked on them. Checked the PRD
(`01 DOCS/v1-5_PRD Ava Study Mode & Master Engineering Roadmap.md`) and the archived Charter's
Lock/Stub/Defer registers for any mention of importing PSAT practice tests as question-bank
content — found none. PSAT appears in the PRD exactly once, as a one-time score-baseline input
to the prediction model (§10, Ava's 1110 PSAT → Math/RW correction factors), already used. There
is no spec calling for PSAT questions to become practice content; the SAT question bank is
already complete for its actual v1 target (1,035q, 8/8 SAT tests, 0 severe/0 warnings).

Presented this to the user along with the practical issue (PSAT and SAT are scored on different
scales, so mixing PSAT-sourced items into the same skill pool would need a difficulty-
normalization decision first, not just a data import). User chose to defer rather than drop or
start it.

**Added D6 to the PRD's Deferred register** (`01 DOCS/v1-5_PRD...md`, Section 3):
> D6 (added 2026-07-27): PSAT practice-test import as question-bank content. 6 unmined PSAT PDFs
> exist (PSAT 10, PSAT 8/9, PSAT NMSQT — 2 tests each) but this was never part of the v1 content
> plan... Net-new scope, not a continuation of the SAT T4–T11 import. Requires a difficulty-
> normalization decision before any import work starts.

No import work done. No code touched. No API calls made.

## DECISIONS

| Decision | Reason |
|---|---|
| Did not build PSAT import despite user saying "move on to 7" | The plan's item 7 was scoped as a *scope check*, not an import; "move on to 7 i guess idk" read as uncertainty, not a go-ahead to build something the PRD never asked for. Per CLAUDE.md: never invent structure the PRD didn't already answer, and add out-of-scope asks to the DEFER register instead of building them. |
| Logged as DEFER rather than dropping entirely | User's explicit choice when given the option; keeps a named future home per the Charter's own governance rule ("everything in DEFER has a named future home, so 'later' is a real place, not a rejection"). |

## FILES TOUCHED
- `01 DOCS/v1-5_PRD Ava Study Mode & Master Engineering Roadmap.md` — added D6 to the Deferred register
- `AGENT_HANDOFF.md` — rewritten
- `02 SESSION_LOG/00_INDEX.md` — new row added
- `02 SESSION_LOG/2026-07-27_0145_psat-scope-check-deferred.md` — this file

## SIGN-OFF
Sonnet 5 — 7/27/26 1:45 AM
