
1. **Highest-Value Enhancements**
2. **Product/UX Enhancements**
3. **Engineering Enhancements**
4. **Study Mode / Ava VARK MVP**
5. **Code-quality / security / reliability improvements**
6. **Future gap-analysis structure**
    

---

# PRD| SAT APP: Enhancement and Study Mode Roadmap

## Version 1
**PRD | SAT App Enhancement + Study Mode Roadmap**
## Product
**SAT Prep  App — Personal Edition for Ava**
## Primary Student
Ava 
## Primary Parent / Owner
Sienna

## Purpose
Define the next product and engineering enhancements needed to evolve the current SAT Prep Coach App from an adaptive practice/miss-loop system into a more complete AI SAT tutoring platform.

This PRD covers:
1. **Study Mode**
2. **Ava-specific VARK personalization**
3. **Highest-value code enhancements**
4. **Product and UX improvements**
5. **Engineering reliability improvements**
6. **Testing and production-hardening requirements**
7. **Future gap-analysis framework**

---
# 1. Executive Summary

The current app already has strong foundations:
- authenticated student dashboard,
- diagnostic flow,
- adaptive practice session assembly,
- targeted drill mode,
- miss-loop remediation,
- AI hints and explanations,
- mastery tracking,
- error journal,
- skill notes,
- behavior signals,
- score prediction,
- Supabase-backed data model.

However, several important gaps remain before the app feels like a complete private SAT tutor.

The largest product gap is that Ava currently has **practice mode**, **drill mode**, and **miss remediation**, but not a dedicated **Study Mode**.

The largest engineering gaps are:
1. client-side attempt logging and mastery updates,
2. weak runtime API validation,
3. lack of test coverage,
4. incomplete AI fallback observability,
5. missing CI/typecheck/test scripts,
6. limited user-facing error recovery around save failures.
    
The MVP roadmap should focus on:
1. **server-side trust boundaries,**
2. **Study Mode for Ava,**
3. **VARK-personalized lesson behavior,**
4. **better dashboard and mastery UX,**
5. **tests and CI,**
6. **question-bank quality tooling.**

---
# 2. Current State Summary

## 2.1 VARK support exists but is limited

The current app stores Ava’s VARK profile as a static constant:

```
Read/Write 13, Kinesthetic 14, Aural 9, Visual 7
```

This is currently a raw string intended for the single-student MVP.

The miss-loop API imports this VARK profile and passes it into hint and explanation prompts.

The hint prompt instructs the AI to align with the VARK profile.

The tutor prompt also references the VARK profile and already pushes written structure and correction-by-doing.

## 2.2 Adaptive practice exists
The `/session` page creates a session plan and passes it to `SessionRunner`.

The session assembler chooses questions based on:

1. spaced-repetition review,
2. low mastery / high vulnerability,
3. difficulty calibrated around expected success.
    

## 2.3 Targeted drill exists
The app supports targeted drill using:

```
/session?skill=[skillId]
```

The session page reads the `skill` query parameter.

The session assembler narrows the active skill list when `targetSkillId` is present.

The mastery page already links selected skills to targeted drill.

## 2.4 Mastery review tools exist
The mastery page includes:
- goal tree / flat list,
- mastery percentages,
- persistent error journal,
- skill notes,
- self-correction strategy,
- drill button.

The error journal UI exists per selected skill.

The self-correction note UI exists and saves student notes.

## 2.5 AI chokepoint exists
Anthropic calls go through `callAnthropicWithCeiling`. This function resolves the daily ceiling, checks current AI usage, chooses the model, makes the Anthropic call, and logs successful usage.

## 2.6 API validation is not yet strong enough
The miss-loop API parses JSON and checks action names, but then uses TypeScript casts and broad body access.

For example, the route reads `questionId` through `(body as any).questionId`.

## 2.7 Attempt logging and mastery updates happen client-side
The `useMissLoop` hook logs attempts and updates mastery directly from the browser client.

This means the client supplies values that affect persistent learning state, including correctness, difficulty, error type, retry status, hints used, and time spent.

---
# 3. Product Vision
The app should become Ava’s private SAT tutor.

It should not merely ask:

> “Can you answer this question?”

It should also ask:

> “What do you need to study, how should you study it, what traps are you repeating, and how can we help you internalize the rule?”

The core product loop should become:

```
Diagnose → Study → Practice → Miss Loop → Reflect → Review → Predict → Adjust
```

Currently, the app strongly supports:

```
Diagnose → Practice → Miss Loop → Track
```

This PRD adds the missing **Study** and strengthens the system around reliability, UX, and production-readiness.

---

# 4. Highest-Value Enhancements

These are the top improvements that should be prioritized because they directly affect correctness, security, reliability, and learning quality.

---

## HVE-1: Add runtime request validation to API routes

### Problem

The miss-loop API currently relies on TypeScript interfaces and casts after JSON parsing.

This does not protect the runtime from malformed requests.

Examples of currently possible malformed input:

```
hintNumber: 99
questionId: null
studentAnswer: {}
confidence: "very sure"
studentErrorTag: "oops"
```

### Requirement

Use Zod validation for API routes.

### Initial target

Start with:

```
app/api/miss-loop/route.ts
```

Then apply the same pattern to future study APIs.

### Acceptance criteria

- invalid body returns `400`,
- invalid action returns `400`,
- invalid enum returns `400`,
- missing `questionId` returns `400`,
- no prompt builder runs until validation passes.
    

### Priority

**P0**

---

## HVE-2: Move attempt logging and mastery updates behind a server route

### Problem

The browser currently logs attempts and updates mastery through `useMissLoop`.
The client supplies mastery-impacting fields.
This is risky because correctness and mastery should be trusted server-side.

### Requirement

Create a server route or Server Action:

```
/api/attempts/log
```

or:

```
server action: logAttemptAndUpdateMastery
```

### Server responsibilities

The server should:

1. authenticate user,
2. validate body,
3. fetch question by ID,
4. recompute correctness,
5. write attempt,
6. update mastery,
7. return success/failure.
    

### Client responsibilities

The client should only send:

```
questionId
sessionId
answer
confidence
errorType
hintsUsed
wasRetry
timeSpentSeconds
```

The server should derive:

```
userId
skillId
difficulty
isCorrect
```

### Acceptance criteria

- browser no longer determines `isCorrect`,
- browser no longer determines `difficulty`,
- browser no longer directly updates mastery,
- all attempt writes use authenticated server user,
- existing RLS remains intact.
    

### Priority

**P0**

---

## HVE-3: Log AI fallback events

### Problem
Successful Anthropic calls are logged.
But over-ceiling fallback returns static content without logging an `ai_log` row.
API-error fallback also returns fallback content without logging fallback usage.

### Requirement
Log AI fallback events with models such as:

```
fallback-static
fallback-error
```

### Why this matters

This allows the app owner to know:
- how often Ava hits the AI ceiling,
- whether Anthropic failures are happening,
- which AI features are most expensive,
- whether static fallbacks are being used too often.
    

### Acceptance criteria
- over-ceiling fallback writes an `ai_log` row,
- API-error fallback writes an `ai_log` row,
- fallback rows include call type,
- fallback rows include model label,
- token counts can be zero.

### Priority
**P0**

---

## HVE-4: Add unit tests for scoring, diagnostic assembly, and mastery

### Problem
The project has scripts for dev/build/start/lint and data imports, but no visible test script.
Important learning logic currently lacks automated test coverage.

### Requirement
Add a test framework such as Vitest.

### Initial test targets

Test:
- `difficultyForAccuracy`,
- `checkCorrect`,
- diagnostic allocation,
- no duplicate diagnostic questions,
- BKT updates,
- FSRS scheduling,
- score prediction,
- confidence interval clamping,
- behavior signal calculations,
- targeted skill session assembly.
    

### Acceptance criteria

- `npm test` exists,
    
- unit tests cover pure functions in `lib/`,
    
- CI can run tests,
    
- at least mastery/scoring/session tests exist.
    

### Priority

**P0/P1**

---

## HVE-5: Clamp displayed score confidence intervals

### Problem

The dashboard builds the confidence interval around `predictedScore`.

The displayed interval should never exceed SAT score boundaries.

### Requirement

Clamp displayed confidence interval:

```
total SAT: 400–1600
section SAT: 200–800
```

### Acceptance criteria

- confidence lower bound never below 400,
    
- confidence upper bound never above 1600,
    
- score display remains rounded to nearest 10.
    

### Priority

**P1**

---

## HVE-6: Improve dashboard empty-state granularity

### Problem

The dashboard treats `masteryMap.size === 0` as no data and sends Ava to diagnostic.

But real users can have partial states:

- diagnostic started but not completed,
    
- attempts exist but mastery rows missing,
    
- mastery exists but attempts missing,
    
- only strategy rows exist,
    
- seed/import incomplete.
    

### Requirement

Create explicit setup state.

Suggested type:

```
type StudentSetupState =
  | 'needs_diagnostic'
  | 'diagnostic_in_progress'
  | 'diagnostic_incomplete'
  | 'ready'
  | 'data_repair_needed';
```

### Acceptance criteria

- dashboard can distinguish no diagnostic from incomplete diagnostic,
    
- user gets correct CTA,
    
- data repair state is detectable.
    

### Priority

**P1**

---

## HVE-7: Replace hardcoded daily goals with profile/settings values

### Problem

The dashboard hardcodes:

```
dailyGoalMinutes = 25
dailyGoalQuestions = 20
```

### Requirement

Move daily goals into profile/settings/config.

### Acceptance criteria

- dashboard reads daily goal from data source,
    
- fallback defaults remain,
    
- future parent/admin settings can update goals.
    

### Priority

**P2**

---

## HVE-8: Add loading and failure UX around persistence

### Problem

`useMissLoop` has `isSaving`, but failed persistence currently logs to console and rethrows.

### Requirement

Show visible error states and retry actions when attempt save fails.

### Acceptance criteria

- student cannot silently advance after failed attempt save,
    
- retry button exists,
    
- clear user-facing error appears,
    
- app avoids duplicate saves.
    

### Priority

**P1**

---

## HVE-9: Add question-bank coverage QA tooling

### Problem

The session and diagnostic assemblers include fallback behavior for sparse question banks.

But coverage gaps should be caught before Ava hits them.

### Requirement

Add a script:

```
scripts/audit-question-bank.ts
```

### It should report:

- questions per skill,
    
- validated questions per skill,
    
- difficulty distribution,
    
- missing rationales,
    
- missing distractor notes,
    
- missing trap types,
    
- duplicate external IDs,
    
- skills with zero usable questions.
    

### Acceptance criteria

- script runs locally,
    
- outputs clear table,
    
- exits nonzero for severe gaps if desired.
    

### Priority

**P1**

---

## HVE-10: Make AI model selection configurable

### Problem

AI model names are hardcoded in `callAnthropicWithCeiling`.

### Requirement

Support environment-driven model selection.

Suggested env vars:

```
ANTHROPIC_MODEL_CLASSIFY
ANTHROPIC_MODEL_TUTOR
ANTHROPIC_MODEL_HINT
ANTHROPIC_MODEL_REPORT
ANTHROPIC_MODEL_STUDY
```

### Acceptance criteria

- code has safe defaults,
    
- environment values override defaults,
    
- no code edit needed to swap models.
    

### Priority

**P2**

---

# 5. Product / UX Enhancements

---

## PUX-1: Add Study Mode

### Problem

There is currently no true Study Mode.

The app supports targeted practice and miss remediation, but not pre-practice learning.

### Requirement

Create a dedicated Study Mode.

Routes:

```
/study
/study/[skillId]
```

### Core flow

```
Skill context
Ava’s rule
Common trap
Worked example
Do-now activity
Mini-practice
Teach-back note
Continue to drill
```

### Priority

**P0/P1**

---

## PUX-2: Add “Explain My Dashboard” coach card

### Problem

The dashboard shows predicted score, confidence band, readiness metrics, and focus skills, but Ava may not understand why the numbers changed.

### Requirement

Add a coach explanation card.

Example:

```
Your predicted score rose because Algebra accuracy improved, but Reading pacing is still a drag.
```

### MVP version

Static logic-generated copy.

### Future version

AI-generated narrative using coach memory.

### Priority

**P2**

---

## PUX-3: Add “Why This Question?” labels

### Problem

The session plan knows categories like review, priority, mixed, and confidence-builder.

But Ava may not understand why a specific question appears.

### Requirement

Show question reason labels:

```
Spaced Review
Weak Skill
Mixed Practice
Confidence Builder
Calibration
```

### Existing source

`PlannedSessionItem.category` already exists.

### Priority

**P1**

---

## PUX-4: Add parent-safe progress view before full weekly reports

### Problem

The dashboard has a weekly report placeholder for Phase 4.

### Requirement

Add a lightweight parent progress view before full narrative weekly reports.

Show:

- minutes studied,
    
- questions answered,
    
- focus skills,
    
- current predicted band,
    
- diagnostic status,
    
- next recommended action.
    

### Priority

**P2**

---

## PUX-5: Add streak recovery / minimum viable day

### Problem

Daily goals are visible, but there is no low-friction recovery option when Ava is busy.

### Requirement

Add a short mode:

```
Keep My Streak
5-question review
10-minute weak-skill sprint
1 miss-loop review
```

### Priority

**P2**

---

# 6. Study Mode PRD

This section defines the dedicated Study Mode in detail.

---

## 6.1 Study Mode Goal

Create a short, Ava-specific study experience that helps her understand and internalize a skill before drilling questions.

Study Mode should answer:

> “How should Ava study this skill?”

Not just:

> “What question should Ava answer next?”

---

## 6.2 Ava’s VARK profile

Current static profile:

```
Read/Write 13, Kinesthetic 14, Aural 9, Visual 7
```

Interpretation:

- Ava is strongest in **Kinesthetic**.
    
- Ava is also very strong in **Read/Write**.
    
- Ava is moderate in **Aural**.
    
- Ava is lower in **Visual**.
    

Therefore, Study Mode should use:

1. short written rules,
    
2. structured checklists,
    
3. active solve steps,
    
4. typed responses,
    
5. retrieval prompts,
    
6. teach-back,
    
7. immediate application.
    

It should avoid:

1. long lectures,
    
2. generic explanations,
    
3. purely visual instruction,
    
4. passive reading-only experiences.
    

---

## 6.3 Study Mode route requirements

Add:

```
app/(student)/study/page.tsx
app/(student)/study/[skillId]/page.tsx
components/study/StudyMode.tsx
app/api/study/lesson/route.ts
prompts/study.ts
```

---

## 6.4 Study Mode flow

### Step 1: Skill context

Show:

```
You are studying [skill].
This matters because [reason].
```

### Step 2: Ava’s rule

Show a one-sentence reusable rule.

### Step 3: Common trap

Show a trap from:

1. authored skill pattern,
    
2. error journal,
    
3. AI-generated fallback.
    

### Step 4: Worked example

Show concise structured written example.

### Step 5: Do-now

Ask Ava to type or choose an active response.

### Step 6: Mini-practice

Serve 1–3 questions.

### Step 7: Teach-back

Save Ava’s rewritten rule into `skill_notes`.

### Step 8: Continue to drill

Link to:

```
/session?skill=[skillId]
```

---

## 6.5 Study prompt requirements

Add:

```
prompts/study.ts
```

The prompt should return structured JSON.

Suggested schema:

```
{
  skillName: string;
  whyItMatters: string;
  avaRule: string;
  commonTrap: string;
  workedExample: {
    setup: string;
    steps: string[];
    takeaway: string;
  };
  doNow: {
    instruction: string;
    responsePrompt: string;
  };
  teachBackPrompt: string;
}
```

---

## 6.6 Study API requirements

Add:

```
app/api/study/lesson/route.ts
```

Responsibilities:

1. authenticate user,
    
2. validate `skillId`,
    
3. fetch skill,
    
4. fetch mastery,
    
5. fetch error journal entries,
    
6. fetch skill note,
    
7. fetch coach memory,
    
8. call AI through `callAnthropicWithCeiling`,
    
9. validate response,
    
10. return study lesson.
    

---

## 6.7 Study Mode acceptance criteria

Study Mode is complete when:

- `/study` exists,
    
- `/study/[skillId]` exists,
    
- mastery page has “Study This Skill,”
    
- dashboard has a study CTA,
    
- Study Mode uses Ava’s VARK directive,
    
- Study Mode displays a rule, trap, example, do-now, and teach-back,
    
- teach-back saves to `skill_notes`,
    
- completion links to targeted drill,
    
- invalid API input returns controlled error,
    
- AI fallback works when over ceiling.
    

---

# 7. Engineering Enhancements

---

## ENG-1: Add CI checks

### Requirement

Add CI for:

```
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

### Priority

**P0/P1**

---

## ENG-2: Add `typecheck` script

### Current state

`package.json` has no `typecheck` script.

### Requirement

Add:

```
"typecheck": "tsc --noEmit"
```

### Priority

**P0**

---

## ENG-3: Add test script

### Requirement

Add:

```
"test": "vitest run"
```

or equivalent.

### Priority

**P0/P1**

---

## ENG-4: Add Supabase migration verification

### Requirement

Add script/check to verify:

- migrations apply cleanly,
    
- expected tables exist,
    
- RLS enabled,
    
- owner policies exist,
    
- public/shared content tables are read-only where appropriate.
    

### Priority

**P1**

---

## ENG-5: Reduce broad `any` usage

### Examples

Miss-loop body access uses `any`.

Middleware cookie options cast as `any`.

Route catch uses `err: any`.

### Requirement

Replace avoidable `any` with:

- Zod-inferred types,
    
- typed helper functions,
    
- narrowed unknown errors.
    

### Priority

**P1/P2**

---

## ENG-6: Add structured event logging

### Requirement

Log important learning events:

```
diagnostic_started
diagnostic_completed
diagnostic_abandoned
study_started
study_completed
miss_loop_started
miss_loop_resolved
hint_requested
confidence_builder_inserted
session_exited
daily_goal_completed
predicted_score_changed
```

### Priority

**P2**

---

# 8. Implementation Priority

## P0 — Production correctness/security

1. Move attempt logging/mastery updates server-side.
    
2. Add Zod validation to miss-loop API.
    
3. Add AI fallback logging.
    
4. Add `typecheck`.
    
5. Add test framework.
    

## P1 — Learning reliability

1. Add Study Mode MVP.
    
2. Add question-bank QA script.
    
3. Clamp score confidence intervals.
    
4. Improve dashboard setup states.
    
5. Add persistence failure UX.
    

## P2 — Product polish

1. Explain My Dashboard card.
    
2. Why This Question labels.
    
3. Streak recovery mode.
    
4. Lightweight parent progress view.
    
5. Configurable model routing.
    

## P3 — Future platform

1. Study lesson cache table.
    
2. Parent weekly report.
    
3. Multi-student profile settings.
    
4. Admin validation pipeline.
    
5. Full study analytics.
    

---

# 9. Proposed Gap Analysis Format

After this PRD is approved, the next deliverable should be a gap analysis.

Recommended table:

|Requirement|Current Support|Gap|Files Impacted|Priority|Notes|
|---|---|---|---|---|---|

Example rows:

|Requirement|Current Support|Gap|Files Impacted|Priority|Notes|
|---|---|---|---|---|---|
|Study Mode route|None|Add `/study` and `/study/[skillId]`|`app/(student)/study/*`|P1|New feature|
|VARK directive|Raw string exists|Needs structured Ava profile|`lib/constants.ts`|P1|Keep old export|
|Study prompt|None|Add `prompts/study.ts`|`prompts/study.ts`|P1|JSON output|
|Server-side attempts|Client logs attempts|Move to API route|`useMissLoop`, new API|P0|Security|
|API validation|Partial action check|Add Zod schemas|`app/api/miss-loop/route.ts`|P0|Runtime safety|
|AI fallback logging|Successful calls logged|Fallbacks not logged|`lib/ai/index.ts`|P0|Observability|
|Typecheck|Missing|Add script|`package.json`|P0|CI|
|Question-bank QA|Missing|Add audit script|`scripts/*`|P1|Coverage|

---

# 10. Acceptance Criteria for Overall PRD

This PRD is considered implemented when:

## Product

- Ava has a dedicated Study Mode.
    
- Study Mode is VARK-personalized.
    
- Dashboard points Ava to study, not only practice.
    
- Mastery page supports both study and drill.
    
- Study Mode saves teach-back notes.
    
- Study Mode bridges into targeted drill.
    

## Reliability

- Attempt logging happens server-side.
    
- Mastery updates happen server-side.
    
- API requests are runtime-validated.
    
- AI fallback events are logged.
    
- Score bands are clamped.
    
- Failed saves show retryable UX.
    

## Engineering

- `typecheck` exists.
    
- tests exist,
    
- CI runs lint/typecheck/test/build,
    
- question-bank audit script exists,
    
- avoidable `any` usage is reduced.
    

## Observability

- study events can be logged,
    
- miss-loop and AI fallback behavior is auditable,
    
- dashboard state is more explainable.
    

---

# 11. Final Recommendation

The most sensible build order is:

## First

Fix the **trust boundary**:

1. server-side attempt logging,
    
2. Zod validation,
    
3. AI fallback logging.
    

## Second

Build **Study Mode MVP**:

1. structured Ava profile,
    
2. study prompt,
    
3. study API,
    
4. study route,
    
5. mastery/dashboard CTAs.
    

## Third

Add **tests and CI**:

1. typecheck,
    
2. unit tests,
    
3. question-bank audit.
    

## Fourth

Add product polish:

1. Explain My Dashboard,
    
2. Why This Question,
    
3. streak recovery,
    
4. parent-safe progress view.
    

This gives you a clean path from the current app to a more complete tutor experience.

---

## Commands Used

No new commands were executed for this response, per your earlier instruction not to execute. This expanded PRD is based on the previously reviewed files and the prior recommendation