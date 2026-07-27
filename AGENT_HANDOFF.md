# AGENT HANDOFF — v65
_Rewritten each session. Full history in `02 SESSION_LOG/`._

## Status: AI tutoring pipeline is now verified genuinely live end-to-end via real backend calls (no browser needed). Question bank remains content-complete. One new fix pending commit.

### Question Bank
| Source | Questions | Status |
|---|---|---|
| RW (T4–T11) | 657 | imported, 8/8 tests — complete |
| Math (T4–T11) | 378 | imported, 8/8 tests — complete |
| **TOTAL** | **1,035** | **0 SEVERE, 0 WARNINGS** (unchanged this session) |

## What Was Done This Session (2026-07-27, early morning)
Last session's fixes (dead model IDs, rejected `temperature`, wrong
content-block index — commit `dced190`) had already been committed and
pushed by the time this session started (the previous handoff's "uncommitted"
note was stale). The remaining ask was the manual browser E2E test. The user
pushed back again: "i dont want to do this... can you test it yourself in
the backend??"

Backend testing needs no login at all — `lib/db` already exports
`getSupabaseServiceRoleClient()` (used by other admin scripts in this repo),
and both AI-calling routes (`app/api/miss-loop/route.ts`,
`app/api/study/lesson/route.ts`) are thin cookie-auth wrappers around real
`lib/db` + `lib/ai` + `prompts/` functions. So this session wrote a
disposable script (deleted before session end, never committed) that calls
those *real* production functions directly against a real user_id, real
question, and real skill from the live DB — exercising everything the HTTP
routes do except the auth hop.

**First run: 16/17 checks passed, found a real, previously-undetected bug:**
- `explanation` call: real model, full 400-token budget spent, but returned
  **completely empty content**.
- `study_lesson` call: real model, full 1200-token budget spent, but
  returned **truncated, unparseable JSON**.

**Root cause (confirmed by probing the raw Anthropic API directly):**
`claude-sonnet-5` invokes extended thinking by default on non-trivial
prompts, and thinking tokens draw from the same `max_tokens` budget as the
answer. On the real tutor-explanation prompt with `max_tokens: 400`, the
model spent 399 tokens thinking and hit `stop_reason: 'max_tokens'` with
**zero** text output — a silent failure mode with no exception, no ceiling
hit, and a real model name logged, so nothing existing catches it.
Confirmed `thinking: { type: 'disabled' }` eliminates this (0 thinking
tokens, full budget to the answer) and is safe on Haiku too (accepted
harmlessly).

**Fixed:** `lib/ai/index.ts` — added `thinking: { type: 'disabled' }` to
every Anthropic call in `callAnthropicWithCeiling`. The installed SDK
(`@anthropic-ai/sdk@0.24.3`) predates this API field, so the request body
is now built as a loosely-typed object rather than the SDK's
`MessageCreateParams` literal. `tsc --noEmit` is clean.

**Re-ran full pipeline after the fix: 20/20 checks passed.** All 4 call
types (hint tiers 1-3, explanation, classify, study_lesson) now return
real, complete, schema-valid content against live production data — read
the actual generated lesson/explanation text and it's coherent and
correctly uses the mastery/error-journal context supplied. 12 real
Anthropic API calls were made this session (6 before the fix, 6 after),
all logged to `ai_log` under the real student's `user_id` — negligible cost
(12/150 of the daily ceiling).

Full detail: `02 SESSION_LOG/2026-07-27_0100_ai-pipeline-backend-e2e-verify-thinking-fix.md`

## Single Next Action
**Ask the user whether to commit and push** this session's fix
(`lib/ai/index.ts` — the `thinking: disabled` change). Nothing else is
pending in the working tree. Once committed, the AI pipeline gap from the
last two sessions is fully closed at the backend level.

The **rendered UI itself still hasn't been clicked through** by any agent —
that gap is now lower priority since the underlying AI calls are proven to
work correctly with real, well-formed content; a future session should still
do it when the user is available to log in themselves (diagnostic →
dashboard → study session → miss-loop → mastery updates), to catch any
purely visual/layout issues.

## Open Decisions
- **`lib/db` bypass in 2 pages** (`mastery/page.tsx`, `tests/page.tsx`) —
  flagged in the 2026-07-26 session, not fixed. Low priority, no security
  impact.
- **No `profiles` row exists yet for the real user** — `resolveDailyCeiling`
  already degrades gracefully (falls back to env/default ceiling), so
  nothing is broken, but this is worth a look eventually (should a profile
  row have been created at signup? Is there a missing onboarding step?).
- **PSAT import** — 6 unmined PDFs exist but this is net-new scope per the
  Charter, not a continuation of "more SAT tests." Do not start without
  explicit user go-ahead, own dedicated session.
- **`scripts/test8_rw_questions.json` mojibake** — pre-existing local-file
  encoding corruption, DB itself is clean UTF-8, app unaffected. Not fixed.
- **GitHub secrets for DB backup workflow** not set (non-blocking).
- **next@14.2.35 CVEs** — upgrade when convenient.
- **Module-boundary auto-detection for paper-format PDFs (`6XSLxx`)** still
  not generalized in `recon_rw.py` — moot unless a new paper-format source
  shows up.

## Commit
dced190 -- fix: dead AI tutoring pipeline (retired model IDs, temperature, content block)
(origin/main is up to date through this commit. This session's change —
`lib/ai/index.ts` (`thinking: disabled` fix) plus this handoff/session-log —
is UNCOMMITTED. Ask the user before committing/pushing.)
