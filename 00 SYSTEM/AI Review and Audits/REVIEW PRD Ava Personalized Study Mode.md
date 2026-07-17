
# PRD: Ava Personalized Study Mode

## Product
**SAT Prep Coach App — Ava Personalized Study Mode**
## Version
**PRD v1.0 — Study Mode MVP**
## Status
Draft for review.
## Owner
Sienna / Ava SAT Prep Coach App
## Primary User
Ava — single-student MVP user.

## Goal
Create a dedicated **Study Mode** that helps Ava learn, review, and internalize SAT concepts before or between practice sessions, using her VARK learning profile:

- **Kinesthetic: 14**
- **Read/Write: 13**
- **Aural: 9**
- **Visual: 7**
- 
The MVP should optimize for Ava’s strongest modes: **learning by doing** and **learning through written structure**.

---
# 1. Background

The current app already supports adaptive practice, diagnostic testing, miss-loop remediation, mastery tracking, an error journal, and self-correction notes.

However, the current experience is mostly **question-first**:

- Ava takes a diagnostic.
- Ava starts a practice session.
- Ava drills a specific skill.
- If Ava misses a question, the app helps her recover through the Miss Loop.
    
This is useful for practice, but it does not fully answer the parent/student need:

> “What should Ava do when she needs to study?”

Currently, there is no dedicated “Study Mode” route or flow. The app has targeted drilling through `/session?skill=<id>`, but that is still practice, not structured studying. The current session route assembles adaptive or targeted practice and sends it into `SessionRunner`. 

The mastery page includes an error journal and self-correction notes, which are important study-adjacent features. 

But there is no separate mode that teaches a concept, gives Ava a rule, walks her through a worked example, asks her to actively apply it, and then bridges into practice.

---
# 2. Current Relevant System Behavior

## 2.1 VARK exists as a static MVP constant
The current app stores Ava’s VARK profile as a single hardcoded string:

```
Read/Write 13, Kinesthetic 14, Aural 9, Visual 7
```

This is intentionally static because v1 is a single-student personal edition. 

## 2.2 VARK is injected into hint and tutor prompts
The miss-loop API imports `VARK_PROFILE` and passes it into hint and explanation prompt builders. 

The hint prompt tells the AI to align with the VARK profile. 

The tutor prompt also includes the VARK directive and already emphasizes clear written prose plus correction-by-doing. 

## 2.3 Targeted drill mode already exists
The session page accepts a `skill` query parameter and passes it to `assemblePracticeSession`. 

The session assembler uses `targetSkillId` to focus the session on one skill. 

## 2.4 Mastery page has error journal and skill notes
The mastery page displays persistent error journal entries for the selected skill. 

It also allows Ava to write and save a self-correction strategy. 

These features should become part of Study Mode rather than remaining isolated on the mastery page.

---

# 3. Problem Statement
Ava needs a clear way to **study**, not only practice.

Current practice mode answers:

> “What question should Ava do next?”

Study Mode should answer:

> “What does Ava need to understand, write, explain, and actively do before she practices?”

Without Study Mode, the app risks becoming an adaptive quiz app rather than a complete AI tutor.

---

# 4. Product Goals
## Goal 1: Add a distinct Study Mode

Create a clear separation between:

- **Study** — learn, review, explain, retrieve, and prepare.
- **Practice** — answer SAT-style questions.
- **Drill** — targeted question practice on one skill.
- **Miss Loop** — remediation after wrong answers.
    

## Goal 2: Personalize Study Mode for Ava’s VARK profile

Study Mode should be designed specifically around Ava’s highest learning modes:

1. **Kinesthetic** — Ava learns by doing.
2. **Read/Write** — Ava learns through written rules, notes, and structured language.
    

## Goal 3: Use existing app data
Study Mode should use:

- skill mastery,
- top focus skills,
- error journal entries,
- existing self-correction notes,
- coach memory when available,
- and validated question bank items.
    

## Goal 4: Bridge studying into practice
Study Mode should end with an action:

- save a teach-back note,
- answer 1–3 guided questions,
- or continue into “Drill This Skill.”
    

## Goal 5: Keep MVP scope tight
Do not build a generic multi-student learning-style platform yet.

This PRD is for Ava’s MVP.

---

# 5. Non-Goals
The Study Mode MVP will **not** include:

1. A full learner-profile editor.
2. Multi-student VARK customization.
3. Parent-configurable teaching modes.
4. Video lessons.
5. Text-to-speech.
6. A large manually-authored curriculum CMS.
7. Full AI-generated course modules.
8. General-purpose flashcard system.
9. Complex visual whiteboard interactions.
10. Long-form lecture generation.
    

---

# 6. User Stories

## 6.1 Dashboard entry

As Ava, I want the dashboard to show the best skill to study today, so I know what to do before practicing.

## 6.2 Mastery map entry

As Ava, I want a **Study This Skill** button next to **Drill This Skill**, so I can learn a skill before doing more questions.

## 6.3 Skill study session

As Ava, I want a short study session that explains the skill, gives me a rule, shows an example, and asks me to do something, so I can actually learn instead of just reading.

## 6.4 VARK personalization

As Ava, I want the study flow to match how I learn best: writing, doing, and checking myself.

## 6.5 Teach-back

As Ava, I want to write the rule in my own words, so I remember it better.

## 6.6 Practice bridge

As Ava, I want to try a couple of questions after studying, so I can prove I understand the skill.

## 6.7 Parent/coach value

As Sienna, I want Study Mode to turn Ava’s weak areas into actionable study steps, so the app feels like a tutor and not only a practice tracker.

---

# 7. Proposed UX

## 7.1 Dashboard card

Add a dashboard card:

```
Study Today’s Top Skill

Recommended:
Command of Evidence

Why:
High point leverage + review due.

Button:
Study This Skill
```

The dashboard already computes focus skills from mastery gaps and review status. 

## 7.2 Mastery page buttons

Current selected-skill action:

```
Drill This Skill
```

Existing drill button goes to `/session?skill=<selectedSkill.id>`. 

Add:

```
Study This Skill
Drill This Skill
```

Recommended behavior:

- **Study This Skill** → `/study/[skillId]`
    
- **Drill This Skill** → `/session?skill=[skillId]`
    

## 7.3 Study session flow

A single Study Mode session should contain:

1. **Skill header**
    
2. **Why this skill matters**
    
3. **Ava’s rule**
    
4. **Common SAT trap**
    
5. **Worked example**
    
6. **Do-now activity**
    
7. **Mini-practice**
    
8. **Teach-back note**
    
9. **Continue to drill**
    

---

# 8. Study Mode MVP Flow

## Step 1: Skill Context

Show:

```
Skill:
Command of Evidence

Why this matters:
This skill appears often in Reading & Writing and affects your ability to choose answers that are directly supported by the passage.
```

Data sources:

- `skills`
    
- `mastery`
    
- focus skill ranking
    
- recent errors if available
    

---

## Step 2: Ava’s Rule

Show a short rule written for Ava:

```
Ava’s Rule:
Before choosing an answer, name the exact job the question is asking the answer to do.
```

Requirements:

- one sentence,
    
- plain language,
    
- reusable,
    
- SAT-specific,
    
- not too abstract.
    

---

## Step 3: Common Trap

Show a common trap:

```
Common Trap:
Picking an answer that sounds related to the passage but does not directly answer the question.
```

If Ava has error journal entries for that skill, use them.

The existing error journal is skill-specific and displayed in the mastery page. 

---

## Step 4: Worked Example

Show a short written worked example.

Example structure:

```
Question asks:
Which choice best supports the claim?

Claim:
The author believes the solution is practical.

Evidence needed:
A line showing the solution works in real life.

Trap:
An answer that mentions the solution but does not prove practicality.

Correct thinking:
Choose the answer that directly proves the claim.
```

Requirements:

- written structure,
    
- clear labels,
    
- short,
    
- no long lecture,
    
- aligned to Read/Write learning.
    

---

## Step 5: Do-Now Activity

Ava must actively do something.

Example:

```
Before answering, type:

1. What is the question asking?
2. What evidence would prove it?
3. What trap answer should I avoid?
```

Requirements:

- must be interactive,
    
- must require typing or choosing,
    
- should not be passive reading,
    
- should support Kinesthetic learning.
    

---

## Step 6: Mini-Practice

Serve 1–3 questions from the selected skill.

This can reuse existing validated question-bank logic and targeted skill behavior.

The existing targeted skill mode narrows practice to one skill using `targetSkillId`. 

For Study Mode MVP, the question count should be smaller than full practice mode.

Recommended default:

```
2 questions
```

Alternative:

```
1 guided question + 2 independent questions
```

---

## Step 7: Teach-Back Note

Ask Ava:

```
In your own words, write the rule you will use next time.
```

Save this to `skill_notes`.

The current mastery page already saves skill notes through `skill_notes`. 

---

## Step 8: Continue to Drill

After Study Mode completion, show:

```
Nice. You studied the skill.

Next:
Drill 10–15 questions on this skill.
```

Button:

```
Drill This Skill
```

Target:

```
/session?skill=[skillId]
```

---

# 9. Ava VARK Personalization Rules

## 9.1 Ava’s VARK profile

Ava’s current VARK profile:

```
Read/Write 13
Kinesthetic 14
Aural 9
Visual 7
```

Stored currently as a static constant. 

## 9.2 Interpretation

Ava’s strongest learning pattern is:

```
Do + Write
```

Therefore, Study Mode should prioritize:

1. written rules,
    
2. checklists,
    
3. short explanations,
    
4. active typed responses,
    
5. worked examples,
    
6. retrieval prompts,
    
7. teach-back notes,
    
8. immediate application.
    

## 9.3 Study Mode should avoid

Study Mode should avoid:

1. long passive explanations,
    
2. purely visual diagrams,
    
3. video-first learning,
    
4. generic encouragement without action,
    
5. formula dumps,
    
6. overly abstract concept summaries.
    

## 9.4 Prompt-level teaching directive

Replace or supplement the current raw VARK string with a structured Ava teaching directive.

Recommended directive:

```
Ava learns best by doing and writing.

Use:
- short written rules,
- structured checklists,
- worked examples,
- active solve steps,
- retrieval prompts,
- self-explanation,
- teach-back.

Avoid:
- long passive lectures,
- purely visual explanations,
- vague encouragement,
- answer-only explanations.

Every study card must make Ava do something.
```

---

# 10. Functional Requirements

## FR1: Add Study Mode routes

Add:

```
app/(student)/study/page.tsx
app/(student)/study/[skillId]/page.tsx
```

`/study` should recommend what to study.

`/study/[skillId]` should launch the Study Mode flow for one skill.

---

## FR2: Add Study Mode component

Add:

```
components/study/StudyMode.tsx
```

Responsibilities:

- render study cards,
    
- manage flow state,
    
- collect do-now response,
    
- collect teach-back note,
    
- optionally show mini-practice,
    
- save note,
    
- link to drill mode.
    

---

## FR3: Add study prompt

Add:

```
prompts/study.ts
```

The prompt should generate structured study content for a selected skill.

It should include:

- concept summary,
    
- Ava’s rule,
    
- common traps,
    
- worked example,
    
- do-now prompt,
    
- teach-back prompt.
    

---

## FR4: Add study lesson API route

Add:

```
app/api/study/lesson/route.ts
```

Responsibilities:

1. Authenticate the user.
    
2. Validate the request body.
    
3. Fetch the selected skill.
    
4. Fetch mastery for that skill.
    
5. Fetch error journal entries for that skill.
    
6. Fetch skill note for that skill.
    
7. Fetch coach memory if available.
    
8. Call AI through the existing AI ceiling chokepoint.
    
9. Return structured JSON.
    

The miss-loop route is the existing pattern for authenticated AI-backed actions. 

---

## FR5: Add request validation

Use Zod for the Study Mode API request and AI response.

The classifier already uses a Zod schema for AI output validation. 

Recommended request shape:

```
const StudyLessonRequestSchema = z.object({
  skillId: z.string().uuid(),
});
```

Recommended response shape:

```
const StudyLessonSchema = z.object({
  skillName: z.string(),
  whyItMatters: z.string(),
  avaRule: z.string(),
  commonTrap: z.string(),
  workedExample: z.object({
    setup: z.string(),
    steps: z.array(z.string()),
    takeaway: z.string(),
  }),
  doNow: z.object({
    instruction: z.string(),
    responsePrompt: z.string(),
  }),
  teachBackPrompt: z.string(),
});
```

---

## FR6: Add “Study This Skill” to mastery page

In the selected skill detail panel, add a button above or beside “Drill This Skill.”

Current button:

```
Drill This Skill
```

Current route:

```
/session?skill=${selectedSkill.id}
```

Add:

```
/study/${selectedSkill.id}
```

---

## FR7: Add dashboard Study CTA

The dashboard should surface the top study recommendation.

Current dashboard already displays focus skills. 

Add either:

1. a new card, or
    
2. a button on the first focus skill.
    

Suggested copy:

```
Study Today’s Top Skill
```

---

## FR8: Save teach-back to skill notes

When Ava completes Study Mode, save her final teach-back response into `skill_notes`.

This should reuse the same table currently used by mastery self-correction notes. 

---

## FR9: Use existing targeted drill after study

At the end of Study Mode, route Ava to:

```
/session?skill=[skillId]
```

The session page and assembler already support this behavior. 

---

## FR10: Use AI ceiling chokepoint

Study lesson generation must use:

```
callAnthropicWithCeiling
```

The existing AI function handles ceiling resolution, call counting, model selection, Anthropic calls, and usage logging. 

---

# 11. Data Requirements

## 11.1 MVP database changes

For the MVP, **no database migration is strictly required**.

Study Mode can use:

- `skills`
    
- `mastery`
    
- `error_journal`
    
- `skill_notes`
    
- `coach_memory`
    
- `questions`
    
- `ai_log`
    

## 11.2 Optional future table

A future version may add:

```
study_lessons
```

Suggested fields:

```
id
skill_id
lesson_json
source
created_at
updated_at
```

Purpose:

- cache AI-generated lessons,
    
- reduce AI cost,
    
- allow manual review,
    
- avoid regenerating common lessons.
    

## 11.3 Optional event logging

A future version may log:

```
study_started
study_completed
study_note_saved
study_to_drill_clicked
```

---

# 12. AI Requirements

## AIR1: Study prompt must be Ava-specific

The study prompt must not simply say:

```
Follow VARK profile.
```

It must explicitly explain what Ava’s VARK profile means.

## AIR2: Study content must be structured JSON

The model should return JSON only.

## AIR3: Study content must be short

Study Mode should not generate long lectures.

Recommended limits:

- concept summary: max 80 words,
    
- Ava’s rule: exactly 1 sentence,
    
- common trap: max 50 words,
    
- worked example: max 5 steps,
    
- do-now prompt: max 3 questions,
    
- teach-back prompt: one short prompt.
    

## AIR4: Study content must require action

Every Study Mode lesson must include at least one active student task.

## AIR5: Study content should use available evidence

The prompt should include:

- skill name,
    
- skill section,
    
- mastery percentage if available,
    
- recent error journal observations,
    
- existing skill note,
    
- coach memory if available.
    

---

# 13. UX Requirements

## UXR1: Study Mode should feel short

Target duration:

```
10–15 minutes
```

## UXR2: Study Mode should not feel like a quiz

The first half should teach/review.

The second half should apply.

## UXR3: Study Mode should visually distinguish itself from practice

Recommended labels:

- `Study`
    
- `Do Now`
    
- `Try It`
    
- `Teach Back`
    
- `Drill Next`
    

## UXR4: Study Mode should provide progress

Example:

```
Step 1 of 5: Learn
Step 2 of 5: Example
Step 3 of 5: Do Now
Step 4 of 5: Try It
Step 5 of 5: Teach Back
```

## UXR5: Study Mode should always end with a next action

End screen options:

```
Drill This Skill
Back to Mastery Map
Start Practice Session
```

---

# 14. Recommended MVP UI Copy

## Dashboard CTA

```
Study Today’s Top Skill
Ava’s best next move is to study one high-impact weak area before practicing.
```

Button:

```
Study Now
```

## Skill page CTA

```
Study This Skill
Learn the rule, work one example, then try it.
```

## Study Mode intro

```
You’re studying this skill because it has high point leverage or is due for review.
This will be short: learn the rule, do one active check, then try a question.
```

## Teach-back prompt

```
Write the rule in your own words. Future Ava should be able to use this before answering a similar SAT question.
```

## Completion copy

```
Nice. You studied the skill and wrote your rule.
Now lock it in with targeted practice.
```

---

# 15. Acceptance Criteria

## AC1: Study route exists

Given Ava is authenticated, when she visits `/study`, she sees a study recommendation.

## AC2: Skill-specific study route exists

Given Ava is authenticated, when she visits `/study/[skillId]`, she sees a Study Mode session for that skill.

## AC3: Mastery page links to Study Mode

Given Ava selects a skill on the mastery page, she sees both:

```
Study This Skill
Drill This Skill
```

## AC4: Study lesson is VARK-personalized

Given Study Mode loads, the generated lesson prioritizes:

- writing,
    
- doing,
    
- short rules,
    
- active prompts,
    
- teach-back.
    

## AC5: Study lesson uses skill context

Given a skill has error journal rows, Study Mode references those trap patterns.

## AC6: Teach-back note saves

Given Ava writes a teach-back note and submits it, the note is saved to `skill_notes`.

## AC7: Study Mode links to targeted drill

Given Ava completes Study Mode, she can click a button to start `/session?skill=[skillId]`.

## AC8: API validates input

Given invalid `skillId`, `/api/study/lesson` returns a 400 error.

## AC9: AI output validates

Given malformed AI JSON, the API returns a safe fallback lesson or a controlled error.

## AC10: AI calls respect ceiling

Given Ava exceeds the AI daily ceiling, Study Mode returns fallback/static study content instead of failing.

---

# 16. Implementation Plan

## Phase 1: MVP scaffolding

Files to add:

```
app/(student)/study/page.tsx
app/(student)/study/[skillId]/page.tsx
components/study/StudyMode.tsx
prompts/study.ts
app/api/study/lesson/route.ts
```

Files to edit:

```
lib/constants.ts
app/(student)/mastery/page.tsx
app/(student)/page.tsx
```

## Phase 2: Study prompt and API

Build:

- structured Ava VARK directive,
    
- study prompt,
    
- Zod request validation,
    
- Zod response validation,
    
- fallback lesson behavior.
    

## Phase 3: UI integration

Build:

- dashboard CTA,
    
- mastery page CTA,
    
- Study Mode cards,
    
- teach-back save,
    
- drill link.
    

## Phase 4: Polish

Add:

- loading states,
    
- error states,
    
- progress indicator,
    
- “Back to Mastery” link,
    
- static fallback content,
    
- optional event logging.
    

---

# 17. Suggested File-Level Design

## 17.1 `lib/constants.ts`

Current file has:

```
export const VARK_PROFILE = 'Read/Write 13, Kinesthetic 14, Aural 9, Visual 7';
```

Recommended addition:

```
export const AVA_LEARNER_PROFILE = {
  name: 'Ava',
  varkProfile: 'Read/Write 13, Kinesthetic 14, Aural 9, Visual 7',
  primaryModes: ['kinesthetic', 'readWrite'],
  studyDirective: `
    Ava learns best by doing and writing.
    Use short written rules, structured checklists, active tasks,
    retrieval prompts, and teach-back. Avoid long passive lectures.
  `,
};
```

Keep `VARK_PROFILE` for backward compatibility if needed.

---

## 17.2 `prompts/study.ts`

Add:

```
export interface StudyPromptInput {
  skillName: string;
  section: string;
  masteryPercent: number | null;
  recentErrorPatterns: string[];
  existingSkillNote: string | null;
  coachMemory: string | null;
  learnerDirective: string;
}
```

Return:

```
{
  systemPrompt,
  userMessage
}
```

---

## 17.3 `app/api/study/lesson/route.ts`

Pattern should resemble the miss-loop API route:

- get cookies,
    
- create Supabase server client,
    
- authenticate user,
    
- parse JSON,
    
- validate request,
    
- fetch data,
    
- call AI,
    
- validate AI response,
    
- return JSON. 
    

---

## 17.4 `components/study/StudyMode.tsx`

State machine:

```
INTRO
RULE
EXAMPLE
DO_NOW
PRACTICE
TEACH_BACK
COMPLETE
```

MVP can skip embedded practice if necessary and simply link to drill.

Recommended MVP state machine:

```
RULE
EXAMPLE
DO_NOW
TEACH_BACK
COMPLETE
```

Then link to drill.

---

# 18. Risks

## Risk 1: AI-generated lessons may be too wordy

Mitigation:

- strict schema,
    
- word limits,
    
- fallback lesson template.
    

## Risk 2: Study Mode duplicates Mastery page notes

Mitigation:

- treat Study Mode teach-back as the primary way to create/update skill notes,
    
- keep mastery page as a place to view/edit them.
    

## Risk 3: Study Mode becomes generic instead of Ava-specific

Mitigation:

- hardcode Ava’s VARK interpretation in the prompt,
    
- design UI around writing and doing,
    
- reject long lecture output.
    

## Risk 4: AI cost increases

Mitigation:

- use existing AI ceiling,
    
- cache later,
    
- generate one lesson per skill only when requested,
    
- use static fallback when over ceiling.
    

## Risk 5: No lesson table means repeated generation

Mitigation:

- acceptable for MVP,
    
- add `study_lessons` cache table later if needed.
    

---

# 19. Future Enhancements

## 19.1 Study lesson cache

Add `study_lessons` table.

## 19.2 Spaced retrieval cards

Generate retrieval prompts from skill notes and error journals.

## 19.3 Parent weekly study report

Show:

- skills studied,
    
- notes written,
    
- traps corrected,
    
- drill follow-through.
    

## 19.4 Study streaks

Track study completions separately from practice sessions.

## 19.5 Multi-modal controls

Later allow:

- more visual mode,
    
- more audio-style explanation,
    
- more written mode,
    
- more active problem-solving mode.
    

But not for MVP.

---

# 20. Gap Analysis Plan After PRD Approval

After this PRD is accepted, the next step should be a gap analysis with columns:

|PRD Requirement|Current Support|Gap|Files Impacted|Priority|
|---|---|---|---|---|

The likely major gaps will be:

1. No `/study` route.
    
2. No `/study/[skillId]` route.
    
3. No `StudyMode` component.
    
4. No `prompts/study.ts`.
    
5. No `/api/study/lesson`.
    
6. VARK profile is raw string, not structured directive.
    
7. Mastery page has “Drill This Skill” but not “Study This Skill.”
    
8. Dashboard has practice CTA but not study CTA.
    
9. Skill notes exist but are not integrated into a study flow.
    
10. Error journal exists but is not used as lesson context.
    
11. Existing targeted drill can be reused after study.
    

---

# 21. Final Product Definition

## Study Mode MVP should make Ava feel like this:

> “The app knows what I need to study, explains it in a short way, makes me write the rule, makes me do one active step, and then lets me practice that exact skill.”

That is the missing bridge between mastery tracking and adaptive practice.

---

## Commands Used

No new commands were executed for this response, per your instruction. This PRD is based on the previous code review and previously inspected files.