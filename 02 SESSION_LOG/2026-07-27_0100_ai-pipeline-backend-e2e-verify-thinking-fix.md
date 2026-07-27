---
title: AI Pipeline Backend E2E Verification — Found & Fixed Extended-Thinking Token-Budget Bug
date: 2026-07-27
agent: Claude Sonnet 5
phase: Phase 2 (Live) — bug fix, not new feature
commit: (uncommitted at session end — see COMMIT below)
---

## COMPLETED

### 0. Context: user asked for backend testing instead of a browser click-through
The prior session's handoff asked for a manual browser E2E test (requires
login). The user pushed back again ("i dont want to do this... can you test
it yourself in the backend??"). This agent still will not type a password
into the app's login form, but backend testing needs no login at all: every
route this app has (`app/api/miss-loop/route.ts`,
`app/api/study/lesson/route.ts`) is a thin layer of cookie-auth +
request-validation glue around `lib/db` + `lib/ai` + `prompts/` functions,
and `lib/db` already exports `getSupabaseServiceRoleClient()` for exactly
this kind of admin/script use (same pattern as `scripts/seed-skills.ts`
etc.). So this session wrote a disposable script
(`scripts/_ai_pipeline_backend_test.ts`, deleted before session end, never
committed) that imports the *real* production functions — `getHintPrompt`,
`getTutorPrompt`, `getStudyLessonPrompt`, `classifyAttemptError`,
`callAnthropicWithCeiling`, `fetchQuestionById`, `fetchSkillById`, etc. —
and drives them against real DB rows (real user_id, real question, real
skill) with a service-role client standing in for the cookie session. This
exercises everything the HTTP routes do except the auth hop itself, with
zero credentials typed anywhere.

Real user found via `sessions.user_id` (no `profiles` row exists yet for
this account — noted as a gap, not fixed, see Decisions).

### 1. First run: 16/17 checks passed, 1 real bug found
Ran hint (tiers 1-3), explanation, classify, and study_lesson end-to-end
against live data. `ai_log` confirmed real model IDs throughout (no more
`fallback-error`) — last session's 3 fixes hold. But:
- The **explanation** call returned **completely empty content** despite
  spending its full 400-token budget and logging real usage.
- The **study_lesson** call returned **truncated, unparseable JSON** (cut
  off mid-field) despite spending its full 1200-token budget.

### 2. Root-caused: claude-sonnet-5's extended thinking eats the max_tokens budget
Probed the raw Anthropic API directly (`scripts/_thinking_probe.ts`, also
deleted, never committed) with the real tutor-explanation prompt:
- No `thinking` param, `max_tokens: 400` → `stop_reason: 'max_tokens'`,
  `thinking_tokens: 399`, **one `thinking` block, zero `text` blocks**. The
  entire budget was consumed by invisible reasoning before any answer text
  was ever written — this is a silent, non-error failure mode: no
  exception, no ceiling hit, `model` stamped as the real model, so nothing
  in the existing error handling catches it.
- Same prompt with `thinking: { type: 'disabled' }`, `max_tokens: 400` →
  `stop_reason: 'end_turn'`, 0 thinking tokens, a complete 842-char text
  answer in 292 tokens.
- Confirmed `thinking: { type: 'disabled' }` is also accepted (harmlessly,
  0 thinking tokens either way) by `claude-haiku-4-5-20251001`, so it's
  safe to send unconditionally on every call, not just Sonnet.

This explains bug #1's discovery data more precisely than last session
realized: the old dead-model-ID bug produced 100% `fallback-error`, but
even after fixing model ID + temperature + content-block-index, some
fraction of *real, successful* Sonnet calls would still have silently
returned empty or truncated content whenever the model chose to think
at length on a short `max_tokens` budget (300 for hints, 400 for
explanations, 1200 for lessons) — a second, independent failure mode
layered on top of the three already fixed, invisible until an actual
content-shape check (word count, JSON.parse) was run against a live
non-trivial prompt.

### 3. Fixed: `lib/ai/index.ts` — disabled extended thinking on every call
Added `thinking: { type: 'disabled' }` to the Anthropic request body in
`callAnthropicWithCeiling`. The installed SDK (`@anthropic-ai/sdk@0.24.3`)
predates the extended-thinking API and doesn't declare a `thinking` field
on `MessageCreateParams`, so the request body is now built as a loosely-typed
object rather than passed as a literal typed against the SDK's interface.
`npx tsc --noEmit` passes clean. This app's AI calls (tiered hints, trap
explanations, error classification, study lessons) are all short pedagogical
completions where visible chain-of-thought was never a goal, so disabling
thinking outright is correct — the alternative (guessing a `max_tokens`
large enough to survive unpredictable thinking-token consumption) would be
both wasteful (thinking tokens are billed) and still non-deterministic.

### 4. Re-ran full pipeline after the fix: 20/20 checks passed
Same live data, same 4 call types, one more real API round-trip each
(12 real Anthropic calls total this session, all logged to `ai_log`,
6/150 then 12/150 against the daily ceiling — negligible). This time:
- All 3 hint tiers: real model, non-empty, no correct-answer leak.
- Explanation: real model, complete 263-token answer (previously 0),
  ≤150 words (locked requirement from `prompts/tutor.ts`).
- Classify: real disagreement detection working correctly — flagged the
  student's self-tag of "concept" as wrong, correctly reclassified as
  "guess" based on the rationale showing correct understanding.
- Study lesson: real model, valid JSON, passes
  `StudyLessonResponseSchema`, checklist/workedExample both meet the
  ≥2-step prompt requirement — read the actual generated lesson content
  and it's coherent, on-topic (Linear Equations & Inequalities), and
  correctly used the mastery/error-journal context it was given.

### 5. Verified, not changed
Confirmed `fetchQuestionById` (the real `lib/db` accessor the miss-loop
route uses) returns the identical row to a raw `questions` table query —
no drift between the "canonical row" path and a naive fetch.

## DECISIONS

| Decision | Reason |
|---|---|
| Tested via a service-role script instead of a browser login | User explicitly asked for backend testing ("test it yourself in the backend"); service-role bypass requires no password entry anywhere, unlike a browser login form |
| Disabled extended thinking outright rather than raising `max_tokens` | Thinking-token consumption is unpredictable per-prompt (0 tokens on a trivial prompt, 399 of 400 on a real one) — no fixed `max_tokens` increase is provably safe, and thinking tokens cost real money with no product value for these short completions |
| Applied `thinking: disabled` unconditionally (Haiku included), not just Sonnet | Live-probed: Haiku accepts the param harmlessly (0 thinking tokens either way) — one code path stays simpler than a per-model conditional, mirroring the existing `supportsCustomTemperature` pattern would have added complexity for zero benefit |
| Did not fix the missing `profiles` row for the real user | Out of scope for this session (AI pipeline verification); `resolveDailyCeiling` already degrades gracefully to the env/default ceiling when `fetchUserProfile` returns null, so nothing is broken by its absence — flagging as a data gap, not a bug |
| Fixed the thinking-budget bug without asking first | Same standing as last session's fixes: a real bug (silent empty/truncated AI output) within the existing architecture, not a scope or design change |
| Did not commit | Git safety protocol — commit needs the user's go-ahead |

## FILES TOUCHED
- `lib/ai/index.ts` — added `thinking: { type: 'disabled' }` to the Anthropic request body; loosened the request-params typing to accommodate a field the installed SDK's types don't declare
- `scripts/_ai_pipeline_backend_test.ts` — disposable, deleted before session end, never committed
- `scripts/_thinking_probe.ts` — disposable, deleted before session end, never committed
- `AGENT_HANDOFF.md` — rewritten
- `02 SESSION_LOG/00_INDEX.md` — new row added
- `02 SESSION_LOG/2026-07-27_0100_ai-pipeline-backend-e2e-verify-thinking-fix.md` — this file

No schema changes. No commits made this session — pending user go-ahead.
Real Anthropic API cost incurred: 12 live calls (6 before the fix, 6 after)
against the production key, all logged to `ai_log` under the real
student's `user_id`.

## SIGN-OFF
Sonnet 5 — 7/27/26 (session time not precisely tracked — see commit timestamp once pushed)
