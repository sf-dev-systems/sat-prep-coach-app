---
title: Phase 2 — Study Lesson AI Engine
date: 2026-07-17
agent: Claude (Sonnet 4.6)
phase: Phase 2 (03_Phase2-scoring-ai.md)
---

## COMPLETED

**Pre-work**
- Phase 1 committed (5a2d81d) in same session before Phase 2 began.

**Phase 2 file tasks — both completed, tsc --noEmit passes clean**

1. **CREATED** `prompts/study.ts`:
   - Exports `StudyPromptContext` interface (skill, masterySnapshot, recentErrors, existingNote, sampleQuestion).
   - Exports `getStudyLessonPrompt(context)` returning `{ system, user }`.
   - System prompt: VARK directive verbatim + full JSON output shape (matching StudyLessonResponseSchema) + error-trap and existing-note injection instructions.
   - User prompt: dynamically assembled from all context fields; gracefully omits sections when data is absent.

2. **CREATED** `app/api/study/lesson/route.ts`:
   - Follows 10-step spec from phase doc exactly.
   - Parallel fetch: `fetchErrorJournalForSkill`, `fetchSkillNoteForSkill`, `fetchValidatedQuestionsBySkill`, mastery row — all after skill existence check.
   - Stamps `usedErrorJournal` and `usedExistingNote` from actual data, not from AI response (AI writes `false` for those; route overwrites with truth).
   - Three fallback paths: over-ceiling (`overCeiling: true`), JSON parse failure, Zod schema failure — all return `buildStaticFallback`, never a 500.
   - `tsc --noEmit` clean (dc12458).

## DECISIONS

- Skill is fetched first (before the parallel batch) so we can return a clean 404 without burning DB round-trips on a nonexistent skill.
- `usedErrorJournal` / `usedExistingNote` are stamped by the route, not trusted from the AI's JSON — the AI's `context` block is fully overwritten before responding so these are always accurate.
- `fallbackRationale` passed to `callAnthropicWithCeiling` is the serialized static fallback JSON — this ensures the `fallback-error` path in lib/ai also gets a usable lesson shape (though the route checks `overCeiling` flag first so this rarely matters in practice).

## SIGN-OFF

Claude (Sonnet 4.6) — 7/17/26
