# Phase 5: Engineering Quality & Observability
(`01 DOCS/06_phase5-eng-quality.md`)

_No new features. Add tooling, tests, and structured learner profile._

**Always read alongside:** `01_sys-context.md` (invariants, VARK, folder layout).
**All prior phases should be functionally complete before this phase.**

---

## Current code state (what exists to build on)

- `package.json` — has `dev`, `build`, `start`, `lint`, `seed:skills`, `import:bank`. **Missing:** `typecheck`, `test`, `audit:question-bank`.
- Pure functions exist in `lib/mastery/` (BKT, FSRS), `lib/scoring/`, `lib/mastery/dashboard.ts` — good Vitest targets.
- Zod schemas from Phase 1 (`lib/validation/`) are pure and directly testable.
- `lib/constants.ts` — VARK profile is a raw string. Needs structured representation.
- No test framework or config exists.

---

## 1. Typecheck script (ENG-4)

File: `package.json`

Add to `scripts`:
```json
"typecheck": "tsc --noEmit"
```

Run `npm run typecheck` to verify. Fix any pre-existing type errors before marking this done.

---

## 2. Vitest setup (ENG-5)

Install:
```
npm install --save-dev vitest @vitest/coverage-v8
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
})
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

### Initial test files to create

**`__tests__/validation/miss-loop.test.ts`**
- Valid hint payload parses successfully.
- Missing `questionId` on hint returns error.
- Invalid `action` value returns error.
- `EXPLAIN_NOW` with no extra fields parses successfully.

**`__tests__/validation/study.test.ts`**
- Valid request parses successfully.
- Non-uuid `skillId` returns error.
- Valid full response parses successfully.
- Missing `lesson.checklist` returns error.

**`__tests__/mastery/dashboard.test.ts`**
- Confidence interval is clamped to [400, 1600] when raw value is out of range.
- `FocusSkill` includes `skillId`.
- Empty mastery map returns `setupState: 'no_diagnostic'`.

**`__tests__/scoring/predictive-score.test.ts`** (if `lib/scoring` has pure functions)
- Known mastery input → expected score output (use Scenario 1 from v1.5 Section 10 as the test case).
- Section score is always between 200 and 800.

---

## 3. Question bank audit script (ENG-6)

File: `scripts/audit-question-bank.ts`

Add to `package.json` scripts:
```json
"audit:question-bank": "tsx scripts/audit-question-bank.ts"
```

Script behavior:
1. Connect to Supabase using `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`.
2. Fetch all rows from `questions` joined with `skills` (left join on `skill_id`).
3. Check each row and report:
   - Missing `skill_id` (orphaned question)
   - `difficulty` outside [1, 3]
   - `choices` is null on non-math questions (warn; math grid-in may be legitimately null)
   - `correct_answer` is null or empty
   - `rationale` is null or empty
   - `validated = false` on `source = 'official'` rows (should be validated)
   - Duplicate `external_id` values (flag pairs)
   - `skill_id` references a skill that does not exist (orphaned FK — shouldn't happen with DB constraints but worth auditing)
4. Print a summary table to stdout.
5. Exit with code 1 if any **severe** issues found (missing skill_id, missing correct_answer, invalid difficulty). Exit 0 for warnings only.

---

## 4. Structured learner profile (ARCH-1)

File: `lib/learner-profile.ts` (create) + update `lib/constants.ts`

Replace the raw VARK string with a typed object that prompts can import directly:

```typescript
export const AVA_LEARNER_PROFILE = {
  name: 'Ava',
  vark: {
    kinesthetic: 14,
    readWrite: 13,
    aural: 9,
    visual: 7,
  },
  dominantModes: ['kinesthetic', 'readWrite'] as const,
  avoidances: ['long passive reading blocks', 'video-only explanations', 'diagram-only explanations'],
  lessonConstraints: {
    maxPassiveParagraphs: 1,
    requiresActiveStepBeforeContinuing: true,
    ttsSupported: true,
  },
  instructionalStyle: 'Do + Write',
} as const

export type LearnerProfile = typeof AVA_LEARNER_PROFILE
```

Update `prompts/study.ts` (and any other prompt files that hardcode VARK text) to import and use `AVA_LEARNER_PROFILE` instead of a hardcoded string.

---

## 5. File Task List

### MODIFY `package.json`
- Add `typecheck`, `test`, `test:watch`, `audit:question-bank` scripts.

### CREATE `vitest.config.ts`

### CREATE `__tests__/validation/miss-loop.test.ts`
### CREATE `__tests__/validation/study.test.ts`
### CREATE `__tests__/mastery/dashboard.test.ts`
### CREATE `__tests__/scoring/predictive-score.test.ts`

### CREATE `scripts/audit-question-bank.ts`

### CREATE `lib/learner-profile.ts`
### MODIFY `lib/constants.ts`
- Remove or replace the raw VARK string with an import from `lib/learner-profile.ts`.
### MODIFY `prompts/study.ts`
- Import `AVA_LEARNER_PROFILE` and use its fields instead of hardcoded VARK text.

---

## 6. Acceptance Criteria

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` runs and all initial tests pass
- [ ] `npm run audit:question-bank` runs without crashing; produces a summary report
- [ ] `lib/learner-profile.ts` exports `AVA_LEARNER_PROFILE` as a typed const
- [ ] `prompts/study.ts` imports from `lib/learner-profile.ts` (no hardcoded VARK strings)
- [ ] No pre-existing `(body as any)` patterns remain in the codebase (verify with `grep -r "as any" app/api/`)
