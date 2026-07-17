
# My recommended setup
## Use Claude Code as the main implementation agent

Why:
- This repo has a lot of rules, docs, PRDs, session logs, and architectural constraints.
- Claude Code is specifically built to work in real codebases, edit files, run commands, use Git, and follow terminal workflows. Anthropic describes it as an agentic coding tool that understands your codebase, edits files, runs commands, and works with Git/MCP tools. Claude Code official page

- This project needs careful multi-step changes:
    - new routes,
    - new prompts,
    - new API route,
    - validation,
    - server-side attempt logging,
    - Study Mode UX,
    - dashboard integration,
    - mastery page integration,
    - tests,
    - PRD/gap-analysis alignment.
        

That kind of work is exactly where a codebase-aware agent is stronger than a simple chat model.

---

## Use Cursor for UX iteration and manual review

Cursor is a full AI code editor, not just a model. Its strongest use here is being your **interactive design/build surface**.

Cursor’s official positioning is agentic development inside an IDE, with agents that can turn ideas into code and automate repetitive work. Cursor official site

For this project, Cursor would be especially helpful for:

- reviewing UI files visually,
- tweaking Tailwind layouts,
- iterating on Study Mode cards,
- checking dashboard copy,
- making small design changes quickly,
- exploring component structure,
- manually accepting/rejecting changes.
    

So I would not think of this as:

> Claude vs Cursor

I would think of it as:

> Claude Code for serious implementation, Cursor for interactive UX polishing.

---

# My ranking

## 1. Claude Code — best primary builder

### Best for

- full-stack implementation,
- repo-wide refactors,
- respecting architecture,
- PRD-to-code execution,
- API routes,
- validation,
- tests,
- database-aware logic,
- long multi-file changes,
- commit/PR workflow.
    

### Why I’d pick it

This app is not just a front-end mockup. It has:
- Supabase auth,
- RLS assumptions,
- AI prompt routing,
- student mastery logic,
- scoring logic,
- session assembly,
- diagnostic logic,
- error journals,
- skill notes,
- dashboard prediction.
    

Claude Code is better suited for making careful changes across those layers.

### Specific fit for your PRD

Claude Code should build:

1. `/study` route
2. `/study/[skillId]`
3. `components/study/StudyMode.tsx`
4. `prompts/study.ts`
5. `/api/study/lesson`
6. structured Ava VARK profile
7. server-side attempt logging
8. Zod validation
9. tests
10. gap analysis implementation checklist
    

---

## 2. Cursor — best UX build environment

### Best for

- UI iteration,
- component polish,
- seeing the app structure while editing,
- making copy/layout changes,
- hands-on product refinement,
- accepting diffs manually.
    

### Why I’d use it

For the **Study Mode UX**, Cursor would be very useful.

The Study Mode experience needs to feel good:

```
Learn → Example → Do Now → Teach Back → Drill
```

That is more product-design-heavy than pure backend logic.

Cursor is probably the nicer environment for:

- card layout,
- stepper UI,
- button hierarchy,
- dashboard CTA placement,
- mastery page CTA placement,
- loading/error states,
- responsive layout.
    

### But
Cursor itself is the environment. The quality still depends on the model you use inside it.
So my practical recommendation would be:

> Use Cursor, but choose Claude as the model when doing complex edits.

---

## 3. Gemini Pro / Gemini Code Assist — useful, but not my first pick

### Best for
- second opinions,
- product brainstorming,
- Google ecosystem work,
- quick alternative implementations,
- reviewing PRDs,
- generating test ideas.
    

Google’s current Gemini Code Assist agent mode supports multi-file edits, full project context, built-in tools, MCP integration, and human-in-the-loop oversight, but the docs also mark agent mode as preview. Google Gemini Code Assist docs

The release notes also indicate older Gemini Code Assist tools were replaced by agent mode. Gemini Code Assist release notes

### Why I would not make it primary

For this repo, I care most about:

- careful codebase comprehension,
- respecting project instructions,
- disciplined multi-file edits,
- robust TypeScript/Next/Supabase implementation,
- not overbuilding,
- keeping PRD alignment.
    

Claude Code is the safer primary choice for that.

---

# Best role split

## Claude Code should do

### Architecture and implementation

- Study Mode routes
- API route
- Zod schemas
- prompt file
- server-side attempt logging
- AI fallback logging
- tests
- typecheck script
- question-bank audit script
    

### Why

These changes are broad and need codebase discipline.

---

## Cursor should do

### UX pass

- Study Mode card layout
- dashboard CTA layout
- mastery page button placement
- wording and microcopy
- responsive polish
- final visual review
    

### Why

Cursor is excellent when you want to sit inside the editor and shape the UI.

---

## Gemini should do

### Review / challenge

- ask it to review the PRD,
- ask it for alternative Study Mode flows,
- ask it to critique the VARK design,
- ask it to generate edge cases,
- ask it to review whether the implementation meets the PRD.
    

### Why

It can be a useful second brain, but I would not give it the keys as primary builder for this app.

---

# My practical recommendation

If I were running this build, I would do this:

## Step 1: Claude Code

Prompt:

```
Read the Study Mode PRD. Do not code yet. Produce a gap analysis against the current repo with file-level implementation tasks, risks, and sequencing.
```

## Step 2: Claude Code

Prompt:

```
Implement Phase 1 only:
- structured Ava learner profile
- prompts/study.ts
- /api/study/lesson
- /study/[skillId]
- Study This Skill button
Do not touch attempt logging yet.
```

## Step 3: Cursor

Open the app visually and polish:
- Study Mode UI,
- dashboard CTA,
- mastery page layout,
- copy,
- spacing,
- mobile behavior.
    

## Step 4: Claude Code

Implement engineering hardening:
- Zod validation for miss-loop,
- server-side attempt logging,
- AI fallback logging,
- typecheck/test scripts,
- tests.

## Step 5: Gemini
Use as an external reviewer:

```
Review this PRD and implementation for missing SAT pedagogy, UX gaps, and edge cases.
```

---

# If you only want one
If you only want to choose one tool/personality to build it:

## Pick **Claude Code**
Because this is not just UX. It is a full-stack educational app with AI, Supabase, auth, mastery state, prompts, and scoring.

---

# If you care most about UX
If your biggest worry is:

> “Will Study Mode feel good for Ava?”

Then I would use:

## Cursor + Claude model

Because Cursor gives you a better hands-on interface for shaping the experience, while Claude gives you stronger reasoning and implementation.

---

# Final answer
My recommendation:

```
Primary builder: Claude Code
UX polishing environment: Cursor
Secondary reviewer: Gemini Pro / Gemini Code Assist
```

If choosing only one:

```
Claude Code
```

If choosing the best UX workflow:

```
Cursor using Claude as the model
```

---

## Commands Used
No terminal commands were used for this response. I used current official product information from Anthropic, Cursor, and Google to avoid relying on stale assumptions.

---

```
You are working in the repo sat-prep-coach-app.

Do not code yet.

Read the current codebase and produce a gap analysis for implementing this PRD:

Goal:
Add an Ava-personalized Study Mode to the SAT Prep Coach app.

Current desired product:
- The app already has diagnostic, adaptive practice, targeted drill, mastery map, miss loop, error journal, and skill notes.
- It does not yet have a true Study Mode.
- Study Mode should help Ava study a skill before practicing it.
- Ava’s VARK profile is:
  - Kinesthetic 14
  - Read/Write 13
  - Aural 9
  - Visual 7
- Therefore Study Mode should prioritize doing + writing:
  - short written rules
  - structured checklists
  - worked examples
  - active typed responses
  - retrieval prompts
  - teach-back notes
  - immediate application
- Avoid long passive lectures or purely visual explanations.

Required Study Mode MVP:
1. Add /study route.
2. Add /study/[skillId] route.
3. Add a StudyMode component.
4. Add prompts/study.ts.
5. Add /api/study/lesson route.
6. Add “Study This Skill” next to “Drill This Skill” on the mastery page.
7. Add a dashboard CTA for “Study Today’s Top Skill.”
8. Save Ava’s teach-back response into existing skill_notes.
9. End Study Mode with a link to /session?skill=[skillId].
10. Use existing error_journal entries as context for common traps.
11. Use existing AI ceiling infrastructure for any AI-generated study lesson.
12. Use Zod validation for the study API request and AI response.

Also include these engineering enhancements in the gap analysis:
- Move attempt logging and mastery updates server-side in a later phase.
- Add Zod validation to existing miss-loop API.
- Log AI fallback events.
- Add typecheck script.
- Add test script and basic unit tests.
- Add question-bank audit script.
- Clamp dashboard confidence intervals.
- Improve dashboard empty/incomplete diagnostic states.

Output format:
1. Current-state summary.
2. Gap analysis table with:
   - Requirement
   - Current support
   - Gap
   - Files impacted
   - Priority
   - Notes
3. Recommended implementation phases.
4. File-by-file task list.
5. Risks and decisions needed.
6. Do not modify files yet.
```

After Cursor gives the gap analysis, review it.

Then your next prompt should be:

```
Implement Phase 1 only.

Phase 1 scope:
- Structured Ava learner profile in lib/constants.ts.
- prompts/study.ts.
- app/api/study/lesson/route.ts.
- app/(student)/study/[skillId]/page.tsx.
- components/study/StudyMode.tsx.
- Add “Study This Skill” button to mastery page.
- End Study Mode with link to /session?skill=[skillId].
- Save teach-back into existing skill_notes.
- Use Zod validation.
- Do not implement server-side attempt logging yet.
- Do not refactor miss-loop yet.
- Do not add database migrations unless absolutely necessary.

After coding:
- Run typecheck if available.
- Run lint if available.
- Summarize files changed.
- Tell me any risks or follow-up work.
```

Use that.