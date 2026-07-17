## Review Summary  |  7/16 - 8:53 PM

I reviewed the repository structure, package setup, student dashboard flow, diagnostic/session assembly, miss-loop API, AI chokepoint, auth middleware, and the available lint command. I did **not** make code changes, so I did **not** commit or open a PR.

Overall: this is a thoughtful Phase 2 implementation with clear architecture boundaries, good documentation discipline, and several strong “degrade, never block” choices. The biggest opportunities are around **validation**, **server/client trust boundaries**, **test coverage**, **AI cost logging accuracy**, and **production hardening**.

---

## What’s Already Strong

### 1. Clear architecture boundaries

The code maintains the intended portable-core boundary: dashboard data assembly lives in `lib/mastery/dashboard.ts` and explicitly avoids importing from `app/`, `components/`, Next, or React. 

That’s a good foundation because the scoring/mastery/session logic can be tested separately from the UI.

### 2. Auth is consistently session-derived

The dashboard uses Supabase server auth and redirects unauthenticated users to `/login`. 

The miss-loop route also derives the user from session cookies before serving AI-backed help. 

The middleware centralizes auth gating and only exempts login plus cron routes. 

### 3. Diagnostic design is well-scoped

The diagnostic module is explicitly separated from the normal practice assembler because it is two-phase and section-adaptive. 

It also avoids behavior-signal reads for first-run diagnostics, which is a sensible product decision because no historical behavior row can exist yet. 

### 4. AI access has a single chokepoint

Anthropic calls are routed through `callAnthropicWithCeiling`, which resolves daily ceiling, counts calls, chooses model, calls Anthropic, and logs usage. 

That’s the right place to enforce budget, observability, model routing, retries, and safety behavior.

### 5. Dashboard already uses real state

The dashboard is not just mock UI: it computes predicted score, readiness metrics, focus skills, streaks, daily work, calibration, and pacing from Supabase-backed state. 

---

## Highest-Value Enhancements

### 1. Add runtime request validation to API routes

The miss-loop API currently parses JSON, checks that `action` is one of three allowed values, and then casts the body to specific TypeScript interfaces. 

That is fine for compile-time ergonomics, but runtime callers can still send malformed values, for example:

- `hintNumber: 99`
    
- missing `questionId`
    
- empty `studentAnswer`
    
- invalid `confidence`
    
- extra unexpected fields
    
- `questionId` with the wrong type
    

**Recommendation:** use Zod schemas for each action request and return precise `400` errors. The project already uses Zod in the classifier code. 

This would make the API more robust and prevent malformed client calls from reaching prompt construction.

---

### 2. Move attempt logging and mastery updates behind a server route

Right now, the client-side `useMissLoop` hook:

1. Gets the browser Supabase client.
    
2. Reads the authenticated user.
    
3. Inserts an attempt row.
    
4. Updates mastery. 
    

This can work with strong RLS, but it exposes more business logic to the browser than necessary. The client effectively supplies:

- `isCorrect`
    
- `difficulty`
    
- `errorType`
    
- `hintsUsed`
    
- `wasRetry`
    
- `timeSpentSeconds`
    

Those values influence persisted attempts and mastery changes. 

**Recommendation:** create a server route or Server Action like `/api/attempts/log` that accepts the minimal student input, re-fetches the question server-side, recomputes correctness, and then logs the attempt plus mastery update. The browser should not be the source of truth for correctness or mastery-impacting metadata.

This is probably the single most important production-hardening step.

---

### 3. Log AI fallback events too

`callAnthropicWithCeiling` logs successful Anthropic calls after receiving usage. 

However, when the user is already over the daily AI ceiling, the function returns static fallback content without writing an `ai_log` row. 

Similarly, if Anthropic fails and a fallback rationale exists, the function returns a fallback response without logging that fallback event. 

**Recommendation:** log fallback events too, using model values like:

- `fallback-static`
    
- `fallback-error`
    

This would improve observability:

- How often are users hitting the ceiling?
    
- How often is Anthropic failing?
    
- Which AI features are falling back most?
    
- Is the ceiling too low?
    

It also makes the “degrade, never block” behavior auditable.

---

### 4. Add unit tests for scoring, diagnostic assembly, and mastery updates

There is currently no visible test script in `package.json`; scripts are limited to dev/build/start/lint and data scripts. 

Given how much educational logic lives in portable `lib/` modules, you would get a lot of value from tests around:

- `difficultyForAccuracy`
    
- diagnostic section allocation
    
- no duplicate diagnostic questions
    
- predicted-score calculation
    
- confidence interval clamping
    
- BKT update behavior
    
- FSRS-style review scheduling
    
- miss-loop mastery impacts
    
- behavior-signal calculations
    

**Recommendation:** add Vitest or Jest and start with pure-function tests in `lib/`. This repo is a great candidate for testing because many important functions do not need a browser.

---

### 5. Clamp displayed score confidence intervals

The dashboard confidence interval is calculated directly around `predictedScore`. 

If prediction is near the SAT boundaries, the displayed range could theoretically go below 400 or above 1600 depending on upstream score calculations and correction factors.

**Recommendation:** clamp display to SAT bounds:

- total score: `400–1600`
    
- section score: `200–800`
    

Even if `calculateSectionScore` already clamps internally, the confidence band itself should also clamp for user trust.

---

### 6. Improve dashboard empty-state granularity

The dashboard treats `masteryMap.size === 0` as “no data,” then sends the student to diagnostic. 

That is reasonable for first run, but after partial failures or interrupted diagnostics, you may have states like:

- session exists but no mastery rows
    
- mastery rows exist but no attempts
    
- attempts exist but diagnostic not complete
    
- diagnostic was abandoned
    
- only strategy mastery exists
    
- content skills missing because seed/import partially failed
    

**Recommendation:** add a more explicit onboarding/progress state model, for example:

```
type StudentSetupState =
  | 'needs_diagnostic'
  | 'diagnostic_in_progress'
  | 'diagnostic_incomplete'
  | 'ready'
  | 'data_repair_needed';
```

Then the dashboard can provide a more accurate call to action.

---

### 7. Replace hardcoded daily goals with profile/settings values

The dashboard hardcodes:

- `dailyGoalMinutes = 25`
    
- `dailyGoalQuestions = 20` 
    

That is fine for Phase 2, but for a personal tutor app, these should eventually reflect the student’s plan, exam date, workload, parent preferences, or coach recommendations.

**Recommendation:** add profile fields or app settings for daily goals, then derive dashboard progress from those.

---

### 8. Add loading and failure UX around attempt persistence

`useMissLoop` exposes `isSaving`. 

Session and diagnostic runners use this for disabling or pending UI in some places, but the architecture would benefit from a consistent “saving failed, retry” state. Right now, if attempt persistence throws, the hook logs to console and rethrows. 

**Recommendation:** surface a visible error state with retry behavior before the student can advance. Attempt logging is core learning data; silent or console-only failures are risky.

---

### 9. Add data-quality/admin tooling for question bank coverage

The diagnostic assembler has sparse-bank fallback logic and may return fewer than the target count if question coverage is insufficient. 

That’s good defensive behavior, but it would be better to catch gaps before students encounter them.

**Recommendation:** add a script/report that checks:

- questions per leaf skill
    
- validated questions per skill
    
- distribution by difficulty
    
- missing rationales
    
- missing distractor notes
    
- duplicate external IDs
    
- skills with zero usable questions
    

This would directly improve diagnostic/session reliability.

---

### 10. Make model selection configurable

The AI chokepoint hardcodes:

- `claude-3-5-haiku-20241022` for classification
    
- `claude-3-5-sonnet-20241022` for everything else 
    

This is acceptable for a locked phase, but model names change over time and cost/performance tradeoffs may differ by call type.

**Recommendation:** read model names from environment variables, for example:

- `ANTHROPIC_MODEL_CLASSIFY`
    
- `ANTHROPIC_MODEL_TUTOR`
    
- `ANTHROPIC_MODEL_REPORT`
    
- `ANTHROPIC_MODEL_GENERATOR`
    

Keep safe defaults, but avoid code changes for future model swaps.

---

## Product/UX Enhancements

### 1. Add an “Explain my dashboard” coach card

The dashboard already shows predicted score, confidence band, readiness, focus skills, and daily goal progress. 

A student may not understand _why_ those changed. Add a small coach explanation:

> “Your predicted score rose because Algebra accuracy improved, but Reading pacing is still a drag.”

This could be static first, then AI-generated later.

### 2. Add “why this question?” in practice sessions

The session plan already has composition categories and confidence-builder insertion. 

Students benefit when they know why they’re seeing a question:

- Review due
    
- Weak skill
    
- Mixed practice
    
- Calibration
    
- Confidence builder
    

This increases buy-in and reduces the feeling of random drilling.

### 3. Add a parent-safe progress view before full Phase 4 reports

The dashboard has a “Latest Weekly Report” placeholder for Phase 4. 

Before full narrative reports, a lightweight parent view could show:

- minutes studied this week
    
- questions answered
    
- focus skills
    
- diagnostic status
    
- current predicted band
    
- next recommended action
    

This can be mostly read-only and non-AI.

### 4. Add streak recovery / “minimum viable day”

Daily goal progress is visible now. 

To improve retention, add a low-friction recovery path:

- “Do 5 review questions to keep your streak”
    
- “10-minute weak-skill sprint”
    
- “One miss-loop review”
    

This is especially useful for SAT prep consistency.

---

## Engineering Enhancements

### 1. Add CI checks

At minimum:

- install
    
- lint
    
- typecheck
    
- test
    
- build
    

The repo currently has `lint`, but in this environment it could not run because dependencies are not installed. 

### 2. Add `typecheck` script

Add:

```
"typecheck": "tsc --noEmit"
```

This catches issues independently of Next build.

### 3. Add Supabase migration verification

Given the app’s reliance on RLS and schema constraints, add a script/check that can verify:

- migrations apply cleanly
    
- expected tables exist
    
- RLS enabled on user-owned tables
    
- policies exist for attempts/mastery/sessions
    
- content tables are read-only to authenticated users
    

### 4. Replace broad `any` usage in API and middleware

Examples:

- miss-loop uses `(body as any).questionId`.
    
- middleware casts cookie options as `any`. 
    
- route catch uses `err: any`.
    

Some `any` may be pragmatic, but the API body one should disappear with Zod validation.

### 5. Add observability for key learning events

The schema appears to include `event_log` support from the DB interfaces, and the dashboard depends on session/attempt data. Consider logging structured events for:

- diagnostic started/completed/abandoned
    
- miss loop started/resolved
    
- hint requested
    
- confidence-builder inserted
    
- session exited early
    
- daily goal completed
    
- predicted score changed materially
    

This would support both debugging and parent/coach reporting.

---

## Suggested Priority Order

### P0 — Production correctness/security

1. Server-side attempt logging and mastery updates.
    
2. Zod validation for API request bodies.
    
3. Log AI fallback/ceiling events.
    
4. Add typecheck/test scripts and CI.
    

### P1 — Learning reliability

1. Unit tests for mastery, scoring, diagnostic, and behavior signals.
    
2. Question-bank coverage QA script.
    
3. Better incomplete diagnostic handling.
    
4. Clamp score confidence intervals.
    

### P2 — Student experience

1. “Why this question?” labels.
    
2. Dashboard coach explanation.
    
3. Retryable save-error UX.
    
4. Streak recovery / short-session mode.
    

### P3 — Admin/parent polish

1. Lightweight parent progress view.
    
2. Weekly report implementation.
    
3. Configurable model routing.
    
4. Admin validation pipeline for generated questions.
    

---

## Commands Used

**Inspection / review commands**

- `pwd && rg --files -g 'AGENTS.md' -g 'package.json' -g 'README*' -g 'src/**' -g 'app/**' -g 'pages/**' -g 'components/**' -g 'vite.config.*' -g 'next.config.*' -g 'tsconfig.json' -g '!node_modules' | head -200`
    
- `find .. -name AGENTS.md -print`
    
- `git status --short && sed -n '1,220p' package.json && sed -n '1,220p' README.md`
    
- `find . -name AGENTS.md -print -maxdepth 4; printf '\n--- tree files ---\n'; rg --files -g '!node_modules' | sed -n '1,240p'`
    
- `sed -n '1,260p' lib/db/index.ts; sed -n '1,220p' lib/ai/classifier.ts; sed -n '1,240p' app/api/miss-loop/route.ts`
    
- `sed -n '1,260p' components/session/SessionRunner.tsx; sed -n '1,260p' components/session/useMissLoop.ts; sed -n '1,220p' components/diagnostic/DiagnosticRunner.tsx`
    
- `nl -ba app/api/miss-loop/route.ts | sed -n '1,220p'; nl -ba components/session/useMissLoop.ts | sed -n '1,140p'`
    
- `nl -ba 'app/(student)/page.tsx' | sed -n '1,260p'; nl -ba lib/mastery/dashboard.ts | sed -n '1,260p'; nl -ba lib/sessions/diagnostic.ts | sed -n '1,260p'`
    
- `nl -ba lib/mastery/dashboard.ts | sed -n '256,380p'; nl -ba lib/ai/index.ts | sed -n '1,260p'; nl -ba middleware.ts | sed -n '1,220p'`
    
- `git status --short`
    

**Testing**

- ⚠️ `npm run lint` — could not complete because project dependencies are not installed in the environment; `next` was not found.



---
# STUDY MODE

Code-wise, **there is not currently a true “Study Mode.”** The app has:
1. **Diagnostic mode** — establishes baseline mastery.
2. **Practice Session mode** — adaptive question practice.
3. **Drill This Skill mode** — targeted practice from the mastery map.
4. **Miss Loop** — corrective tutoring after wrong answers.
5. **Mastery Map / Error Journal / Self-Correction Notes** — review tools.
    

But it does **not yet have a separate study experience** where Ava can choose a weak skill and get a VARK-personalized mini lesson, concept review, examples, retrieval prompts, and then practice.

For Ava’s MVP, I would add a **Study Mode built around her VARK profile**: high **Kinesthetic 14** and **Read/Write 13**, moderate **Aural 9**, lower **Visual 7**. The code already stores this as a static profile. 

---

# What exists today

## 1. VARK exists, but only inside AI hint/tutor prompts

The current VARK profile is hardcoded:

```
Read/Write 13, Kinesthetic 14, Aural 9, Visual 7
```

That lives in `lib/constants.ts`. 

It is injected into the miss-loop API for hints and explanations. 

The hint prompt tells the AI to align strictly with the student’s VARK profile. 

The tutor prompt also includes the VARK profile and already says explanations should be structured written prose plus “correction-by-doing.” 

So: **VARK exists**, but it is currently used mostly when Ava gets something wrong and asks for help.

---

## 2. Practice mode exists

The `/session` page assembles an adaptive practice session and renders `SessionRunner`. 

The session assembler selects questions by:

1. Spaced-repetition due review.
    
2. Low mastery / high vulnerability.
    
3. Difficulty calibrated to about a 75% success target. 
    

It also supports targeted drill mode through a `skill` query param. 

So the app can already answer: **“What should Ava practice next?”**

But it does not yet fully answer: **“How should Ava study this skill before practicing?”**

---

## 3. Drill This Skill exists, but it is still practice, not study

The mastery page has a button that sends Ava into `/session?skill=<selectedSkill.id>`. 

The session assembler then narrows active skills to that selected skill. 

That is useful, but it is still question-first. It does not provide:

- a lesson,
- a worked example,
- a “teach it back” prompt,
- a memory hook,
- guided notes,
- a before/after mini-check,
- or VARK-specific study activities.
    

---

## 4. Error Journal and Self-Correction Notes exist

The mastery page shows an error journal per skill. 

It also lets Ava write a self-correction strategy. 

This is probably the closest thing to “study mode” today. But it is passive/manual. It does not actively generate a study path for her.

---

# What is missing

## Missing 1: A dedicated Study Mode

I would add a new route:

```
/study
/study/[skillId]
```

or:

```
app/(student)/study/page.tsx
app/(student)/study/[skillId]/page.tsx
```

This would be different from practice.

### Practice mode asks:

> Can you answer this SAT-style question?

### Study mode asks:

> Do you understand the concept well enough to explain it, apply it, and recognize traps?

That distinction matters.

Right now the app is strong on **adaptive practice** and **error correction**, but weaker on **pre-practice learning**.

---

## Missing 2: Skill lesson content

The current `skills` table tracks section/domain/name/weight, but there is no obvious first-class “lesson” content tied to a skill. The `Skill` interface includes metadata like section, domain, name, parent skill, and weight. 

For study mode, I would add either a table or generated layer for:

```
skill_lessons
- id
- skill_id
- concept_summary
- sat_pattern
- common_traps
- worked_example
- memory_hook
- vark_study_steps
- created_at
- updated_at
```

For MVP, this can be generated on demand by AI and cached, or written manually for the highest-value skills first.

---

## Missing 3: Ava-specific VARK study plan

The current VARK string is raw score data. 

The prompts say “align with VARK,” but they do not give the model detailed Ava-specific behavior. For an MVP, I would convert this:

```
Read/Write 13, Kinesthetic 14, Aural 9, Visual 7
```

into explicit tutor instructions:

```
Ava learns best by doing and writing.
Prioritize:
1. short written rule,
2. worked example,
3. active solve step,
4. self-explanation,
5. retrieval prompt,
6. correction checklist.

Use visuals only when they clarify structure.
Use audio-style explanation sparingly.
Avoid long passive lectures.
```

The existing tutor prompt already hints at this with “structured, written prose” and “correction-by-doing.” 

But I would make this much more specific.

---

# What Study Mode should do for Ava

Because Ava’s strongest modes are **Kinesthetic** and **Read/Write**, her study mode should be based on:

1. **Do something**
    
2. **Write the rule**
    
3. **Apply the rule**
    
4. **Check the trap**
    
5. **Repeat from memory**
    

Not videos. Not long lectures. Not purely visual diagrams.

---

## Recommended MVP Study Mode flow

For each selected skill, show a 10–15 minute study card:

### Step 1: “What this skill means”

Short written explanation.

Example:

> This skill is about identifying the relationship between the question stem and the evidence in the passage. On SAT Reading & Writing, the trap is usually an answer that sounds related but does not directly satisfy the task.

This fits Read/Write.

---

### Step 2: “Ava’s rule”

A one-sentence rule she can copy/rewrite.

Example:

> Before choosing an answer, I must name the exact job the question is asking the answer to do.

This fits Read/Write + Kinesthetic because she actively writes/rephrases.

---

### Step 3: “Watch one worked example”

A concise example with labels:

```
Question asks: Which choice best supports the claim?
Claim: ...
Evidence needed: ...
Trap answer: related but too broad.
Correct answer: directly proves the claim.
```

This is partly visual-structural, but still text-first.

---

### Step 4: “Now you do one”

Give Ava a micro-task before a full question:

```
Before answering, type:
1. What is the question asking?
2. What evidence would prove it?
3. What trap should I avoid?
```

This is very Ava-aligned because she learns by action.

---

### Step 5: “One SAT question”

Then serve one targeted question from the bank.

If she gets it right, move to another retrieval prompt.

If she gets it wrong, send her to the existing Miss Loop.

The Miss Loop already supports tagging, hints, retry, explanation, variant, and error journal writes. 

---

### Step 6: “Teach it back”

Final text box:

```
In your own words, write the rule you will use next time.
```

This can save to `skill_notes`, which already exists and is used on the mastery page. 

---

# The Study Mode I would build for MVP

## Name

I would call it:

> **Study a Skill**

or more Ava-friendly:

> **Learn + Lock It In**

The dashboard could show:

```
Today:
1. Study one weak skill
2. Practice 15 adaptive questions
3. Review missed traps
```

---

## Route design

### Add:

```
app/(student)/study/page.tsx
app/(student)/study/[skillId]/page.tsx
components/study/StudyMode.tsx
app/api/study/lesson/route.ts
prompts/study.ts
lib/study/index.ts
```

### Why these files

- `study/page.tsx`: choose what to study next.
    
- `study/[skillId]/page.tsx`: specific skill study session.
    
- `StudyMode.tsx`: client interaction flow.
    
- `/api/study/lesson`: server route for AI-generated lesson content.
    
- `prompts/study.ts`: Ava-specific VARK lesson prompt.
    
- `lib/study/index.ts`: pure selection/caching logic.
    

---

# What the VARK-specific prompt should say

I would add a new prompt file like:

```
prompts/study.ts
```

The prompt should not just include raw VARK numbers. It should interpret them.

Example instruction:

```
You are Ava’s SAT study coach.

Ava’s VARK profile:
- Kinesthetic 14: strongest
- Read/Write 13: very strong
- Aural 9: moderate
- Visual 7: lower

Therefore:
- Do not give a long lecture.
- Teach through short written rules and active tasks.
- Every explanation must require Ava to do something.
- Use “write this,” “try this,” “check this,” and “teach it back.”
- Prefer checklists, sentence frames, worked examples, and retrieval prompts.
- Use diagrams only if the concept truly needs structure.
- End with a mini action: one problem, one self-explanation, or one trap check.
```

This is much more useful than only passing:

```
Read/Write 13, Kinesthetic 14, Aural 9, Visual 7
```

The current prompt only injects the raw profile. 

---

# What “Study Mode” should include

## 1. Concept card

For the selected skill:

- What it means
- How the SAT asks it
- What Ava should look for
- One sentence rule
    

## 2. Trap card

Use existing error journal data if available.

The error journal already stores AI observations per skill. 

Study mode should surface:

```
Your common trap in this skill:
You tend to pick answers that are related to the passage but do not answer the exact question.
```

## 3. Active written step

Because Ava is Read/Write strong:

```
Rewrite the rule in your own words.
```

This can save to `skill_notes`.

The app already has skill notes and save behavior. 

## 4. Kinesthetic “do it now” step

Because Ava is Kinesthetic strong:

```
Before solving, mark:
- What is being asked?
- What information matters?
- What trap answer would be tempting?
```

This should happen before the actual SAT question.

## 5. Mini-practice

Serve 1–3 questions from that skill.

The existing session assembler already supports targeted skill sessions. 

For Study Mode, I would not start with a full 15–25 question session. The existing session budget is designed around 15–25 questions. 

Study mode should be shorter:

```
1 lesson
1 worked example
2 guided questions
1 teach-back note
```

---

# Code-wise: what needs to be edited or redone

## 1. Refactor VARK from a raw string into a structured profile

Current:

```
export const VARK_PROFILE = 'Read/Write 13, Kinesthetic 14, Aural 9, Visual 7';
```

Better:

```
export const AVA_LEARNER_PROFILE = {
  name: 'Ava',
  vark: {
    readWrite: 13,
    kinesthetic: 14,
    aural: 9,
    visual: 7,
  },
  primaryModes: ['kinesthetic', 'readWrite'],
  teachingDirective: `
    Ava learns best by doing and writing.
    Use short written rules, active steps, retrieval prompts,
    and teach-back moments. Avoid long passive lectures.
  `,
};
```

Then pass `AVA_LEARNER_PROFILE.teachingDirective` into prompts instead of only the raw score string.

---

## 2. Add `prompts/study.ts`

This should generate structured JSON, not free-form text.

Example output shape:

```
{
  "skillName": string,
  "conceptSummary": string,
  "avaRule": string,
  "workedExample": {
    "prompt": string,
    "steps": string[]
  },
  "commonTraps": string[],
  "doNow": {
    "instruction": string,
    "studentResponsePrompt": string
  },
  "teachBackPrompt": string
}
```

Why JSON? Because the UI can reliably render cards.

The existing classifier already uses Zod parsing for AI output. 

Study mode should do the same.

---

## 3. Add `/api/study/lesson`

This should:

1. Authenticate user.
    
2. Validate `skillId`.
    
3. Fetch skill.
    
4. Fetch recent error journal rows for that skill.
    
5. Fetch existing skill note.
    
6. Fetch latest coach memory if available.
    
7. Call AI through `callAnthropicWithCeiling`.
    
8. Return structured lesson JSON.
    

The miss-loop route is a good model for session-authenticated AI calls. 

---

## 4. Add a “Study This Skill” button next to “Drill This Skill”

Current mastery page has only the drill button. 

Add:

```
Study This Skill
Drill This Skill
```

“Study” should go to `/study/[skillId]`.

“Drill” should stay as `/session?skill=<id>`.

This makes the distinction clear:

- Study = learn/review.
    
- Drill = practice questions.
    

---

## 5. Add dashboard CTA for study

The dashboard currently has “Start Practice Session.” 

I would add another CTA:

```
Study Today’s Top Skill
```

It should pick the top focus skill from `focusSkills`.

The dashboard already computes top focus skills by point-leverage gap and review due status. 

---

## 6. Make Study Mode short and Ava-specific

Do **not** make study mode a long AI lecture.

For Ava, MVP study mode should be:

```
3 minutes: rule + example
3 minutes: guided do-now
5 minutes: 2 questions
2 minutes: teach-back note
```

That maps to her profile better than passive content.

---

# What I would not do yet

## I would not build a generic VARK system for every possible student

For this MVP, you said this is for Ava. So I would not over-engineer:

- no full learner-profile editor yet,
    
- no multi-student VARK database,
    
- no parent-configured modality settings,
    
- no complex adaptive modality engine.
    

Use a hardcoded Ava profile, but structure it better.

The current code already assumes single-student personal edition V1. The VARK constant comment says single student v1 uses a static constant instead of a per-user profile field. 

That is okay for MVP.

---

# Is anything missing for “study”?

Yes. These are the missing pieces:

|Area|Current state|Needed|
|---|---|---|
|VARK|Raw static string|Structured Ava learning directive|
|Study route|Missing|`/study` and `/study/[skillId]`|
|Study prompt|Missing|`prompts/study.ts`|
|Study API|Missing|`/api/study/lesson`|
|Lesson content|Missing|Generated/cached skill lesson|
|Skill study CTA|Missing|“Study This Skill” button|
|Dashboard study CTA|Missing|“Study Today’s Top Skill”|
|Teach-back loop|Partial|Save study reflection to skill notes|
|Study analytics|Missing|Log study sessions/events|
|Study-to-practice bridge|Partial|Use existing targeted session/drill mode|

---

# How this app should help Ava when she needs to “study”

The ideal Ava flow should be:

## From dashboard

1. Ava logs in.
    
2. Dashboard says:
    

```
Today’s best study target:
Command of Evidence — Weak but high value.
```

3. She clicks:
    

```
Study This Skill
```

## Study Mode opens

It shows:

```
Ava, this is a high-value Reading & Writing skill.
You tend to miss this when the answer is related but not directly proven.
```

## Then it gives her:

1. A short written rule.
    
2. One worked example.
    
3. A “do this now” active prompt.
    
4. One or two SAT-style questions.
    
5. A teach-back note box.
    
6. A button to drill more questions.
    

That would make the app feel like a tutor, not just a quiz engine.

---

# My strongest recommendation

If you want the highest-impact next code edit, I would do this:

## Add “Study This Skill” MVP

Minimum files:

```
prompts/study.ts
app/api/study/lesson/route.ts
app/(student)/study/[skillId]/page.tsx
components/study/StudyMode.tsx
```

Then edit:

```
lib/constants.ts
app/(student)/mastery/page.tsx
app/(student)/page.tsx
```

The MVP does not need a new database table at first. It can generate the study lesson on demand and save Ava’s final teach-back into existing `skill_notes`.

That uses what already exists:

- VARK profile constant.
    
- Skill map.
    
- Error journal.
    
- Skill notes.
    
- Targeted drill mode.
    
- AI ceiling chokepoint.
    

So it is a natural enhancement rather than a rewrite.

---

## Commands Used

- `nl -ba lib/constants.ts | sed -n '1,220p'; nl -ba prompts/hint.ts | sed -n '1,220p'; nl -ba prompts/tutor.ts | sed -n '1,220p'`
    
- `nl -ba 'app/(student)/mastery/page.tsx' | sed -n '1,260p'; nl -ba 'app/(student)/session/page.tsx' | sed -n '1,240p'; nl -ba components/session/MissLoop.tsx | sed -n '1,300p'`
    
- `rg -n "study|VARK|visual|auditory|read|kinesthetic|AVA|Ava|vark|mode|notes|coach|journal|learn|review" -g '!node_modules'`
    
- `nl -ba 'app/(student)/mastery/page.tsx' | sed -n '260,330p'; nl -ba lib/sessions/index.ts | sed -n '1,360p'; git status --short`
    

**Testing**

- ⚠️ No test command rerun in this follow-up; this was a code review / product-architecture review only.