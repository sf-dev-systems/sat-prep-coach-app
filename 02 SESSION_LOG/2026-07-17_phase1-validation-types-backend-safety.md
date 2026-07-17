---
title: Phase 1 — Validation, Types & Backend Safety
date: 2026-07-17
agent: Claude (Sonnet 4.6)
phase: Phase 1 (02_phase1-contracts.md)
---

## COMPLETED

**Pre-work**
- Cleared `.next` build cache (Tailwind regression fix)

**Phase 1 file tasks — all 5 completed, tsc --noEmit passes clean**

1. **CREATED** `lib/validation/miss-loop.ts` — Zod discriminated union (HintAction, ExplanationAction, ClassifyAction, ExplainNowAction); exports `MissLoopRequestSchema` + `MissLoopRequest` type.

2. **CREATED** `lib/validation/study.ts` — Zod schemas for study lesson request + response (WorkedExampleSchema inlined); exports `StudyLessonRequestSchema`, `StudyLessonResponseSchema`, and both inferred types.

3. **MODIFIED** `lib/ai/index.ts`:
   - Added `'study_lesson'` to `AiCallConfig.callType` union.
   - Over-ceiling path: `logAiCall(supabase, userId, callType, 'fallback-static', 0, 0)` before returning fallback; wrapped in try/catch so logging failure never blocks the degraded response.
   - Error/catch path: same pattern with `'fallback-error'`.

4. **MODIFIED** `lib/db/index.ts`:
   - Added `'study_lesson'` to `AiLog.call_type` union.
   - Added `fetchSkillById(supabase, skillId)` — single row from `skills`.
   - Added `fetchErrorJournalForSkill(supabase, userId, skillId, limit=5)` — recent error_journal rows for skill.
   - Added `fetchSkillNoteForSkill(supabase, userId, skillId)` — single skill_notes row or null.
   - Added `fetchValidatedQuestionsBySkill(supabase, skillId, limit=2)` — validated questions for prompt context.

5. **MODIFIED** `app/api/miss-loop/route.ts`:
   - Imported `MissLoopRequestSchema` from `@/lib/validation/miss-loop`.
   - Removed all manual type interfaces (`HintRequestBody`, `ExplanationRequestBody`, `ClassifyRequestBody`, `MissLoopRequestBody`, `MissLoopAction`).
   - Replaced `(body as any).questionId` cast and manual action-list check with `MissLoopRequestSchema.safeParse(rawBody)`; returns `{ error: parsed.error.flatten() }` with status 400 on failure.
   - All downstream logic uses `parsed.data` (fully typed by discriminated union narrowing).
   - Added `EXPLAIN_NOW` branch returning 501 (Phase 2 scope — Zod parses it cleanly, route stubs it).
   - One intentional cast: `body.hintNumber as 1 | 2 | 3` because Zod's `.min(1).max(3)` narrows to `number` not the literal union that `getHintPrompt` requires; Zod validation guarantees range.

## DECISIONS

- `EXPLAIN_NOW` returns 501 rather than being silently dropped: the Zod schema validates it, so the route must handle the branch. 501 is accurate and safe — the client can gracefully degrade.
- `logAiCall` on fallback paths is wrapped in try/catch — logging failure must never block the degraded response (invariant: degrade, never block).
- `hintNumber as 1 | 2 | 3` cast is the minimal fix — changing the Zod schema to `.refine()` for a literal union would be over-engineering; the range constraint is sufficient.

## SIGN-OFF

Claude (Sonnet 4.6) — 7/17/26
