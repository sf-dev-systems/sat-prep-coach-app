# Phase 2: Study Lesson AI Engine
(`01 DOCS/03_Phase2-scoring-ai.md`)

_Pure backend. No UI. Build the study prompt, the lesson API endpoint, and wire up all context injection._

**Always read alongside:** `01_sys-context.md` (invariants, VARK, folder layout).
**Phase 1 must be complete first** — this phase imports from `lib/validation/study.ts` and uses the new DB helpers.

---

## Current code state (what exists to build on)

- `lib/validation/study.ts` — `StudyLessonRequestSchema` and `StudyLessonResponseSchema` exist (Phase 1).
- `lib/db/index.ts` — `fetchSkillById`, `fetchErrorJournalForSkill`, `fetchSkillNoteForSkill`, `fetchValidatedQuestionsBySkill` exist (Phase 1).
- `lib/ai/index.ts` — `callAnthropicWithCeiling` exists with `study_lesson` call type added (Phase 1).
- `prompts/` — has `hint.ts`, `tutor.ts`, `classifier.ts`, `coach.ts`, `generator.ts`, `reporter.ts`. No `study.ts` yet.
- `app/api/` — has `miss-loop/`. No `study/lesson/` yet.
- `lib/scoring/` — score prediction logic already exists; `lib/mastery/dashboard.ts` computes focus skills.

---

## 1. Score Prediction Model (reference — already built in lib/scoring)

The scoring model already exists. Understand it so the study prompt can reference mastery context correctly.

**Weighted mastery index per section:**
```
M_section = Σ(p_mastery × weight) / Σ(weight)
```

**Baseline section score (200–800):**
```
S_section = 200 + (600 × M_section)
```

**After Bluebook test entry (recalibrated):**
```
C_section = (actual_score - 200) / (600 × M_section_at_test_time)
S_recalibrated = 200 + (600 × M_section × C_section)
```

**Strategy multiplier (applied on top):**
```
μ_strategy = 0.90 + (0.15 × M_strat)
S_final = clamp(200 + (600 × M_base × μ_strategy), 200, 800)
```

Skill `weight` is the number you see in the `skills` table. Section-level weights: Math = 1.0, RW = 1.0, Strategy = 0.0 (tracked but not score-predictive).

---

## 2. Study Prompt Spec

### File: `prompts/study.ts`

Export one function: `getStudyLessonPrompt(context: StudyPromptContext): { system: string; user: string }`

```typescript
interface StudyPromptContext {
  skill: {
    id: string
    name: string
    section: 'math' | 'rw' | 'strategy'
    domain: string | null
  }
  masterySnapshot: {
    p_mastery: number       // 0–1
    attempts_count: number
    last_practiced: string | null
  } | null
  recentErrors: Array<{
    ai_observation: string | null
    student_note: string | null
    created_at: string
  }>                        // max 5 entries; empty array if none
  existingNote: string | null
  sampleQuestion: {
    stem: string
    correct_answer: string
    rationale: string
  } | null
}
```

**System prompt must include:**
1. Ava's VARK directive (copy verbatim):
   > "Ava learns by doing and writing (Kinesthetic 14, Read/Write 13). Every lesson must: give one short rule she can write down, a checklist of steps, a worked example with explicit steps, an active 'do this now' prompt, a retrieval prompt to test memory, and a teach-back prompt asking her to restate the rule in her own words. No passive lecture blocks longer than one short paragraph. No video. No pure diagram explanations."
2. The required output shape — instruct the model to return **only valid JSON** matching the `StudyLessonResponseSchema` (Section 2 of `02_phase1-contracts.md`). Include the shape in the prompt.
3. Instruction: if `recentErrors` is non-empty, weave the traps into `commonTrap` and `workedExample`.
4. Instruction: if `existingNote` is non-null, acknowledge it ("Ava already noted: ...") and build on it rather than repeating.

**User prompt must include:**
- Skill name, section, domain
- Mastery snapshot (if available — omit gracefully if null)
- Recent error traps (formatted as a list; omit section if empty)
- Existing note (if any)
- Sample question stem + rationale (if available — gives the model a real example to work from)

---

## 3. Study Lesson API Endpoint

### File: `app/api/study/lesson/route.ts`

Pattern: follow `app/api/miss-loop/route.ts` for auth + Supabase client setup.

**Handler logic (in order):**

1. Parse and validate request body with `StudyLessonRequestSchema.safeParse()`. Return 400 on failure.
2. Get authenticated user from cookies (`createServerClient` + `supabase.auth.getUser()`). Return 401 if no session.
3. Fetch study context in parallel:
   - `fetchSkillById(supabase, skillId)` — 404 if not found
   - `fetchErrorJournalForSkill(supabase, userId, skillId, 5)`
   - `fetchSkillNoteForSkill(supabase, userId, skillId)`
   - `fetchValidatedQuestionsBySkill(supabase, skillId, 1)`
   - Mastery row: `supabase.from('mastery').select('p_mastery,attempts_count,last_practiced').eq('user_id', userId).eq('skill_id', skillId).maybeSingle()`
4. Build `StudyPromptContext` from fetched data.
5. Call `getStudyLessonPrompt(context)` to get `{ system, user }`.
6. Call `callAnthropicWithCeiling({ callType: 'study_lesson', userId, systemPrompt: system, userPrompt: user, fallbackContent: STATIC_FALLBACK })`.
7. If over ceiling: return the static fallback lesson (see Section 4) with `context.overCeiling: true, source: 'fallback'`.
8. Parse AI response text as JSON. Validate with `StudyLessonResponseSchema.safeParse()`.
9. If parse fails: log the failure, return static fallback with `source: 'fallback'`.
10. Return validated lesson with `source: 'ai'`.

**Response shape:** always `StudyLessonResponse` (never a raw error to the client — degrade gracefully).

---

## 4. Static Fallback Lesson

When AI is over ceiling or returns invalid JSON, return this shape (fill in skill name dynamically):

```typescript
function buildStaticFallback(skill: { id: string; name: string; section: string; domain: string | null }): StudyLessonResponse {
  return {
    skill,
    lesson: {
      whyItMatters: `${skill.name} appears regularly on the SAT. Getting it right reliably adds points.`,
      avaRule: `Write down the core rule for ${skill.name} in one sentence before you attempt any question.`,
      checklist: [
        'Read the question stem completely before looking at choices.',
        'Identify the skill being tested.',
        'Apply your written rule.',
        'Eliminate wrong choices before committing.',
      ],
      commonTrap: 'Rushing to an answer that looks right but does not match the specific skill being tested.',
      workedExample: {
        setup: `A typical ${skill.name} question will ask you to identify or apply a specific pattern.`,
        steps: [
          'Read the stem and identify exactly what is being asked.',
          'Apply the rule you wrote down.',
          'Check your answer against the rule, not just your intuition.',
        ],
        takeaway: 'The rule always comes first. Apply it before you look at the choices.',
      },
      doNowPrompt: `In your own words, write the rule for ${skill.name}.`,
      retrievalPrompt: `Without looking at your notes, what is the one thing to remember about ${skill.name}?`,
      teachBackPrompt: `Explain ${skill.name} as if you were teaching it to someone who has never seen it.`,
    },
    context: {
      usedErrorJournal: false,
      usedExistingNote: false,
      overCeiling: true,
      source: 'fallback',
    },
  }
}
```

---

## 5. File Task List

### CREATE `prompts/study.ts`
- Export `getStudyLessonPrompt(context: StudyPromptContext)` returning `{ system: string; user: string }`.
- Include VARK directive verbatim (Section 2).
- Instruct model to output only valid JSON matching the response schema.
- Inject error traps, existing note, sample question where available.

### CREATE `app/api/study/lesson/route.ts`
- `export async function POST(req: NextRequest)`
- Follow the 10-step handler logic in Section 3 exactly.
- Never return a raw error to the client — always degrade to `buildStaticFallback`.

### No new DB migrations needed for this phase.

---

## 6. Acceptance Criteria

- [ ] `prompts/study.ts` exports `getStudyLessonPrompt` with correct `StudyPromptContext` signature
- [ ] System prompt includes the VARK directive and the full JSON output shape
- [ ] `POST /api/study/lesson` with a valid `skillId` returns a `StudyLessonResponse`
- [ ] `POST /api/study/lesson` with invalid body returns 400
- [ ] `POST /api/study/lesson` unauthenticated returns 401
- [ ] When AI ceiling is exceeded, endpoint returns a valid `StudyLessonResponse` with `source: 'fallback'` and `overCeiling: true`
- [ ] When AI returns malformed JSON, endpoint returns the static fallback (not a 500)
- [ ] `npx tsc --noEmit` passes with no new errors
