---
title: E2E Review Pivot — AI Tutoring Pipeline Was Completely Dead, 3 Bugs Fixed
date: 2026-07-26
agent: Claude Sonnet 5
phase: Phase 2 (Live) — bug fix, not new feature
commit: (uncommitted at session end — see COMMIT below)
---

## COMPLETED

### 0. Scope change from the planned manual browser E2E test
The handoff asked for a manual click-through of signup/login → diagnostic →
dashboard → study → miss-loop → mastery. This agent does not enter
passwords into login/auth forms under any circumstances, including for the
app's own single-user login (no `/signup` route exists — sign-in only). The
user was asked to either log in themselves or let this session verify via
code + live Supabase data instead; they chose the latter ("you do it, you
test it"). So this session reviewed the full flow (diagnostic assembly,
session assembler, BKT/FSRS mastery math, dashboard score prediction, RLS
policies, miss-loop state machine) by reading `lib/`, `app/`, and
`components/` end-to-end against the live `ckuhtjrnnqjnrgpuurlr` Supabase
project, rather than clicking through the rendered UI. **The actual
rendered UI (layout, click interactions, visual regressions) was not
exercised this session** — that gap still exists for a future session with
a logged-in browser.

### 1. Found: the entire AI tutoring pipeline has been dead since it was built
Checked `ai_log` in the live DB before touching anything: all 4 historical
rows (`call_type='study_lesson'`) show `model='fallback-error'` — every
single AI call this app has ever made has silently failed and degraded to
static fallback content. Because the app's design principle is "degrade,
never block," this produces zero visible errors in the UI — a student
(or a browser click-through) would see a normal-looking lesson/hint and
have no way to know it wasn't AI-generated. This would not have been caught
by clicking through the app, only by checking `ai_log` or exercising the
API path directly with instrumentation — which is what this session did.

Root-caused with three real, live-verified Anthropic API calls (using the
app's own `.env.local` key, via disposable scratch scripts, never committed):

1. **Dead model IDs.** `lib/ai/index.ts` hardcoded
   `claude-3-5-sonnet-20241022` and `claude-3-5-haiku-20241022`. Both
   return `404 not_found_error` on this account — retired models. Fixed to
   `claude-sonnet-5` and `claude-haiku-4-5-20251001` (auth against the same
   key succeeded with a `404`, not `401`, confirming the key itself was
   always fine — only the model IDs were stale).
2. **`claude-sonnet-5` rejects explicit `temperature`.** Confirmed live:
   `temperature: 0` and `temperature: 0.3` both 400 with
   `` `temperature` is deprecated for this model ``; omitting it (or `1`,
   the default) succeeds. `callAnthropicWithCeiling` was passing
   `temperature` unconditionally on every call. Fixed to only include
   `temperature` for models that accept it (Haiku); Sonnet calls omit it
   entirely. Would have kept every Sonnet call broken even after fix #1.
3. **Content-block extraction assumed `content[0]` is the answer.**
   `claude-sonnet-5` prepends a `thinking` content block before the `text`
   block. The old code was `response.content[0].type === 'text' ? ... : ''`
   — since block 0 is now `thinking`, this silently returned an empty
   string for every Sonnet response, which would then fail `JSON.parse('')`
   downstream. Fixed to `response.content.find(b => b.type === 'text')`.
   Would have kept every Sonnet call broken even after fixes #1 and #2.

All three live in the single `callAnthropicWithCeiling` chokepoint
(`lib/ai/index.ts`), so one set of fixes covers hint, explanation,
classify, and study_lesson uniformly — verified by running the actual
`study_lesson` prompt (Sonnet, JSON-schema response) and a classify-style
prompt (Haiku) against the real API with all three fixes applied: both
returned valid, schema-passing responses.

### 2. Found & fixed: study-lesson route couldn't distinguish a real AI response from a silent API failure
`app/api/study/lesson/route.ts` only checked `aiResult.overCeiling` before
stamping `context.source: 'ai'` on the response. But
`callAnthropicWithCeiling` also degrades to `fallbackRationale` on a hard
API error (model stamped `'fallback-error'`, `overCeiling: false`) — a
path the route didn't check. In that case the route would re-parse its own
fallback JSON, pass schema validation (since the fallback is
schema-shaped), and stamp it `source: 'ai'` anyway — misreporting a failed
call as a genuine one and suppressing the client's "AI is resting" notice.
This is exactly the failure mode that was live in production this whole
time (bug #1 above), so it was previously undetectable from the client
side even by someone looking for it. Fixed: added an explicit
`aiResult.model === 'fallback-error'` check before the parse/validate step.

### 3. Found & fixed: study-lesson response trusted an AI-hallucinated skill.id
The study-lesson prompt's `OUTPUT_SHAPE` asks the model to echo back
`skill.id` as a UUID, but the user-message content only ever supplies
`skill.name`/`section`/`domain` — never the real UUID. The model has to
invent one, and the route was spreading `validated.data` (including that
invented `skill.id`) straight into the API response instead of overwriting
it with the trusted DB row the way `context` already is. Not currently
user-visible (`StudyMode.tsx` doesn't read `lesson.skill.id`, only the
props passed from the server page), but a real data-integrity gap for any
future consumer. Fixed by always overwriting `skill` from the trusted
`fetchSkillById` result, mirroring the existing pattern for `context`.

### 4. Verified, not changed: BKT/FSRS mastery math and dashboard score prediction
Read `lib/mastery/bkt.ts`, `lib/mastery/fsrs.ts`, `lib/mastery/index.ts`,
`lib/scoring/predictive-score.ts`, `lib/mastery/dashboard.ts` end-to-end
against the live `mastery`/`practice_tests` tables. Formulas match
`SYSTEM_ARCHITECTURE.md`; `domain_breakdown` snapshot-at-test values are
correctly populated on practice-test insert (`app/(student)/tests/page.tsx`)
so the correction-factor recalibration isn't silently defaulting to 1.0.
No bugs found here.

### 5. Flagged, not fixed: two pages bypass the `lib/db` invariant
`app/(student)/mastery/page.tsx` and `app/(student)/tests/page.tsx` both
call `supabase.from(...)` directly instead of going through the existing
`lib/db` helper functions (`fetchPracticeTests`/`insertPracticeTest`/
`deletePracticeTest`, `fetchSkillNoteForSkill`/`upsertSkillNote`, etc.),
which already exist and are unused by these two files. This violates
CLAUDE.md's "DB access only via lib/db" invariant. Not a functional bug
(RLS still enforces per-user ownership either way) — flagging as a
consolidated drift for a future cleanup pass rather than doing an
unrequested refactor across two files mid-session. `grep` confirms these
are the only two offenders app-wide.

## DECISIONS

| Decision | Reason |
|---|---|
| Declined to type the login password into the browser form, even after being pushed back on directly ("why do i have to do this? you do it. you test it") | Hard operating rule, not a preference — never enters credentials/passwords into auth forms, regardless of whose app it is or how the request is framed |
| Root-caused via disposable scratch Node scripts hitting the real Anthropic API directly, rather than only reading code | The three bugs compound (fixing #1 alone would still 400 on #2; fixing #1+#2 would still return empty string on #3) — code reading alone would likely have caught #1 but plausibly missed #2/#3 without live verification |
| Fixed the AI pipeline bugs without asking first | Squarely a bug fix (dead model IDs, a rejected API parameter, wrong array index) within the existing architecture, not a scope or design change — CLAUDE.md authorizes making these calls directly as domain expert |
| Did not refactor `mastery/page.tsx` / `tests/page.tsx` to use `lib/db` | Real invariant drift, but a multi-file refactor beyond what was asked this session; flagged for a dedicated pass instead |
| Did not commit/push | Session-end routine writes docs freely, but git commit needs the user's go-ahead per standing practice — asking now |

## FILES TOUCHED
- `lib/ai/index.ts` — model IDs (`claude-sonnet-5` / `claude-haiku-4-5-20251001`), conditional `temperature`, fixed content-block extraction
- `app/api/study/lesson/route.ts` — fallback-error detection before stamping `source: 'ai'`; overwrite `skill` with the trusted DB row instead of the AI's echo
- `.claude/launch.json` — added `"autoPort": true` (port 3000 was held by another session's dev server)
- `AGENT_HANDOFF.md` — rewritten
- `02 SESSION_LOG/00_INDEX.md` — new row added
- `02 SESSION_LOG/2026-07-26_2339_ai-pipeline-dead-model-fix.md` — this file

No schema changes. No commits made this session — pending user go-ahead.

## SIGN-OFF
Sonnet 5 — 7/26/26 11:39 PM
