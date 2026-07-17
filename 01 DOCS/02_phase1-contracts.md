# Phase 1: Validation, Types & Backend Safety
(`01 DOCS/02_phase1-contracts.md`)

_Pure backend. No UI. Lock down contracts before anything else is built._

**Always read alongside:** `01_sys-context.md` (invariants, VARK, folder layout).

---

## Current code state (what exists to build on)

- `lib/ai/index.ts` — `callAnthropicWithCeiling` handles ceiling check, model selection, Anthropic call, success logging. **Gap:** over-ceiling and error paths return without logging to `ai_log`.
- `app/api/miss-loop/route.ts` — handles `hint | explanation | classify | EXPLAIN_NOW`. **Gap:** uses `(body as any).questionId` casts; no Zod validation.
- `lib/db/index.ts` — typed Supabase helpers including `upsertSkillNote`. **Gap:** no helpers for fetching skill-by-id, error journal by skill, or skill note by skill.
- Zod is installed. `lib/validation/` does not yet exist.
- Full DB schema already migrated (see Section 1).

---

## 1. Database Schema (LOCKED — do not alter without a new migration file)

```sql
create table skills (
  id uuid primary key default gen_random_uuid(),
  section text check (section in ('rw','math','strategy')),
  domain text,
  name text,
  parent_skill_id uuid references skills(id),
  weight numeric
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid references skills(id),
  source text check (source in ('official','generated')),
  difficulty int check (difficulty between 1 and 3),
  stem text,
  choices jsonb,
  correct_answer text,
  rationale text,
  distractor_notes jsonb,
  trap_type text,
  license text default null,
  external_id text default null,
  validated boolean default false,
  created_at timestamptz default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  started_at timestamptz,
  ended_at timestamptz,
  session_type text check (session_type in ('diagnostic','practice','review','full_test_entry')),
  questions_served int,
  questions_correct int,
  reflection text
);

create table attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id uuid references questions(id),
  skill_id uuid references skills(id),
  session_id uuid references sessions(id),
  answer text,
  is_correct boolean,
  confidence text check (confidence in ('high','medium','low')),
  error_type text check (error_type in ('concept','calculation','misread','careless','timing','guess')),
  time_spent_seconds int,
  hints_used int default 0,
  was_retry boolean default false,
  created_at timestamptz default now()
);

create table mastery (
  user_id uuid not null references auth.users(id),
  skill_id uuid not null references skills(id),
  p_mastery numeric default 0.3,
  stability numeric default 1.0,
  attempts_count int default 0,
  last_practiced timestamptz,
  next_review timestamptz,
  primary key (user_id, skill_id)
);

create table practice_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  taken_at date,
  total_score int, rw_score int, math_score int,
  domain_breakdown jsonb
);

create table error_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  skill_id uuid references skills(id),
  question_id uuid references questions(id),
  ai_observation text,
  student_note text,
  locked_status boolean default false,
  created_at timestamptz default now()
);

create table skill_notes (
  user_id uuid not null references auth.users(id),
  skill_id uuid not null references skills(id),
  content text,
  updated_at timestamptz,
  primary key (user_id, skill_id)
);

create table coach_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  narrative text,
  updated_at timestamptz default now()
);

create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  week_of date,
  content text,
  created_at timestamptz default now()
);

create table behavior_signals (
  user_id uuid primary key references auth.users(id),
  computed_at timestamptz default now(),
  avg_pace_by_difficulty jsonb,
  fatigue_minute int,
  avg_focus_minutes int,
  time_of_day_performance jsonb,
  post_miss_accuracy numeric,
  calibration_score numeric
);

create table ai_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id uuid references questions(id),
  call_type text,
  action_flag text,
  model text,
  input_tokens int,
  output_tokens int,
  metadata jsonb,
  created_at timestamptz default now()
);

create table profiles (
  user_id uuid primary key references auth.users(id),
  display_name text,
  plan text default 'founder',
  ai_daily_ceiling int,
  created_at timestamptz default now()
);

create table config ( key text primary key, value jsonb );

create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  event_type text not null,
  payload jsonb,
  created_at timestamptz default now()
);
```

---

## 2. Study Mode Lesson Contract (LOCKED — implement against this shape exactly)

### Request
```json
{ "skillId": "string (uuid)" }
```

### Response
```json
{
  "skill": {
    "id": "string",
    "name": "string",
    "section": "math" | "rw" | "strategy",
    "domain": "string | null"
  },
  "lesson": {
    "whyItMatters": "string",
    "avaRule": "string",
    "checklist": ["string"],
    "commonTrap": "string",
    "workedExample": {
      "setup": "string",
      "steps": ["string"],
      "takeaway": "string"
    },
    "doNowPrompt": "string",
    "retrievalPrompt": "string",
    "teachBackPrompt": "string"
  },
  "context": {
    "usedErrorJournal": true,
    "usedExistingNote": true,
    "overCeiling": false,
    "source": "ai" | "fallback"
  }
}
```

---

## 3. Zod Schemas (LOCKED — paste these exactly, do not modify field names)

### `lib/validation/miss-loop.ts`

```typescript
import { z } from 'zod'

const HintAction = z.object({
  action: z.literal('hint'),
  questionId: z.string().uuid(),
  hintNumber: z.number().int().min(1).max(3),
  sessionId: z.string().uuid().optional(),
})

const ExplanationAction = z.object({
  action: z.literal('explanation'),
  questionId: z.string().uuid(),
  studentAnswer: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  studentErrorTag: z.enum(['concept','calculation','misread','careless','timing','guess']).optional(),
  sessionId: z.string().uuid().optional(),
})

const ClassifyAction = z.object({
  action: z.literal('classify'),
  questionId: z.string().uuid(),
  studentAnswer: z.string().min(1),
  studentErrorTag: z.enum(['concept','calculation','misread','careless','timing','guess']),
  sessionId: z.string().uuid().optional(),
})

const ExplainNowAction = z.object({
  action: z.literal('EXPLAIN_NOW'),
  questionId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
})

export const MissLoopRequestSchema = z.discriminatedUnion('action', [
  HintAction,
  ExplanationAction,
  ClassifyAction,
  ExplainNowAction,
])

export type MissLoopRequest = z.infer<typeof MissLoopRequestSchema>
```

### `lib/validation/study.ts`

```typescript
import { z } from 'zod'

export const StudyLessonRequestSchema = z.object({
  skillId: z.string().uuid(),
})

const WorkedExampleSchema = z.object({
  setup: z.string(),
  steps: z.array(z.string()).min(1),
  takeaway: z.string(),
})

export const StudyLessonResponseSchema = z.object({
  skill: z.object({
    id: z.string().uuid(),
    name: z.string(),
    section: z.enum(['math', 'rw', 'strategy']),
    domain: z.string().nullable(),
  }),
  lesson: z.object({
    whyItMatters: z.string(),
    avaRule: z.string(),
    checklist: z.array(z.string()).min(1),
    commonTrap: z.string(),
    workedExample: WorkedExampleSchema,
    doNowPrompt: z.string(),
    retrievalPrompt: z.string(),
    teachBackPrompt: z.string(),
  }),
  context: z.object({
    usedErrorJournal: z.boolean(),
    usedExistingNote: z.boolean(),
    overCeiling: z.boolean(),
    source: z.enum(['ai', 'fallback']),
  }),
})

export type StudyLessonRequest = z.infer<typeof StudyLessonRequestSchema>
export type StudyLessonResponse = z.infer<typeof StudyLessonResponseSchema>
```

---

## 4. File Task List

### CREATE `lib/validation/miss-loop.ts`
Paste schema from Section 3 exactly.

### CREATE `lib/validation/study.ts`
Paste schema from Section 3 exactly.

### MODIFY `lib/ai/index.ts`
1. Add `'study_lesson'` to the `callType` union in `AiCallConfig` (or equivalent type).
2. In the **over-ceiling** return path: before returning the fallback, insert a row into `ai_log` with `model: 'fallback-static'`, `input_tokens: 0`, `output_tokens: 0`, `call_type` matching the request.
3. In the **Anthropic error / catch** path: insert a row into `ai_log` with `model: 'fallback-error'`, `input_tokens: 0`, `output_tokens: 0`.

### MODIFY `lib/db/index.ts`
1. Add `'study_lesson'` to the `call_type` literal union in `AiLog` type (if typed).
2. Add `fetchSkillById(supabase, skillId: string)` — single row from `skills`.
3. Add `fetchErrorJournalForSkill(supabase, userId: string, skillId: string, limit = 5)` — most recent N rows from `error_journal` ordered by `created_at desc`.
4. Add `fetchSkillNoteForSkill(supabase, userId: string, skillId: string)` — single row from `skill_notes` or null.
5. Add `fetchValidatedQuestionsBySkill(supabase, skillId: string, limit = 2)` — validated questions for prompt context.

### MODIFY `app/api/miss-loop/route.ts`
1. Import `MissLoopRequestSchema` from `lib/validation/miss-loop.ts`.
2. Replace all `(body as any)` casts and manual field checks with `MissLoopRequestSchema.safeParse(body)`.
3. On parse failure: return `NextResponse.json({ error: result.error.flatten() }, { status: 400 })`.
4. Use `result.data` (typed) for all downstream logic — no more `as any`.

---

## 5. Acceptance Criteria

- [ ] `lib/validation/miss-loop.ts` exists and exports `MissLoopRequestSchema` + `MissLoopRequest`
- [ ] `lib/validation/study.ts` exists and exports `StudyLessonRequestSchema`, `StudyLessonResponseSchema`, and their inferred types
- [ ] `app/api/miss-loop/route.ts` has zero `(body as any)` casts; returns 400 with structured error on invalid input
- [ ] `lib/ai/index.ts` writes an `ai_log` row on over-ceiling path (`fallback-static`) and on error path (`fallback-error`)
- [ ] `lib/db/index.ts` exports the 4 new fetch helpers
- [ ] `npx tsc --noEmit` passes with no new type errors
