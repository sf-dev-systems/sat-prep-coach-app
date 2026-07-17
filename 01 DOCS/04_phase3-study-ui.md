# Phase 3: Study Routes & UI
(`01 DOCS/04_phase3-study-ui.md`)

_Build the pages and component. No new API logic — consume what Phase 2 built._

**Always read alongside:** `01_sys-context.md` (invariants, VARK, folder layout).
**Phases 1 and 2 must be complete first** — this phase consumes `/api/study/lesson` and `lib/validation/study.ts`.

---

## Current code state (what exists to build on)

- `app/(student)/` — has `page.tsx` (dashboard), `session/page.tsx`, `mastery/page.tsx`, `diagnostic/`. All auth-gated server components.
- `app/api/study/lesson/route.ts` — exists (Phase 2); returns `StudyLessonResponse`.
- `components/session/` — has `SessionRunner.tsx`, `MissLoop.tsx`, `useMissLoop.ts`. Use as pattern reference for client component structure.
- `lib/validation/study.ts` — `StudyLessonResponse` type available for import.
- Tailwind is configured; use existing class patterns from `mastery/page.tsx` and `page.tsx` as style reference.

---

## 1. Routes to Create

### `/study` — Landing page
File: `app/(student)/study/page.tsx`

- Server component. Auth-gated (same pattern as `dashboard/page.tsx`).
- Fetch top focus skill from dashboard data (reuse existing `computeDashboard` or equivalent).
- **If a focus skill exists:** show a CTA card linking to `/study/[skillId]` for that skill. Optionally list top 3.
- **If no mastery data yet:** show "Complete the diagnostic first" with a link to `/diagnostic`.
- No client interactivity needed — this is a routing/landing page only.

### `/study/[skillId]` — Active lesson page
File: `app/(student)/study/[skillId]/page.tsx`

- Server component. Auth-gated.
- Validate `params.skillId` is a non-empty string (shape check only — existence is verified by the API).
- Fetch the skill name + section server-side so it's available before the client component loads (avoids flash of empty content).
- Render `<StudyMode skillId={skillId} skillName={skill.name} section={skill.section} />`.
- If skill fetch fails (not found): render a "Skill not found" message with a back link to `/study`.

---

## 2. StudyMode Component

File: `components/study/StudyMode.tsx`

Client component (`'use client'`). Receives `{ skillId, skillName, section }` as props.

### 8-step lesson flow (render in this order)

The component fetches the lesson on mount via `POST /api/study/lesson` with `{ skillId }`. Show a loading state while fetching. On error, show the fallback gracefully (the API always returns a valid lesson shape — a true network error should show a retry button).

**Render each step sequentially — do not render all at once:**

1. **Why it matters** — `lesson.whyItMatters`. One paragraph. No interaction required; auto-displayed.

2. **The rule** — `lesson.avaRule`. Styled as a highlighted rule block. Label: "Write this down."

3. **Checklist** — `lesson.checklist`. Render as a numbered list. Each item should be checkable (local state only — no persistence). Label: "Use this every time."

4. **Common trap** — `lesson.commonTrap`. Styled as a warning block. Label: "Watch out for this."

5. **Worked example** — `lesson.workedExample`. Render: setup paragraph → numbered steps → takeaway sentence. Label: "Step through this."

6. **Do it now** — `lesson.doNowPrompt`. A typed text input (uncontrolled or controlled local state). Label: "Your turn." No submission needed — this is a self-check prompt. Ava types her response for herself.

7. **Retrieve it** — `lesson.retrievalPrompt`. A separate typed text area. Label: "Without looking — answer this." Same pattern as step 6.

8. **Teach it back** — `lesson.teachBackPrompt`. A textarea with a Save button. Label: "Teach it back in your own words." On save: `POST /api/skill-notes` (or direct Supabase upsert) with `{ skillId, content }`. Show success state and a visible error + retry if save fails (do not silently swallow errors — see ENG-9).

**After step 8 completes (teach-back saved or explicitly skipped):**
Show a CTA: "Practice this skill now →" linking to `/session?skill=${skillId}`.

### Loading and fallback states

- While fetching lesson: show a skeleton or "Loading your lesson..." text.
- If `lesson.context.overCeiling` is true: show a small notice "AI is resting for today — here's a standard lesson" above the content. The lesson still renders normally.
- If `lesson.context.source === 'fallback'`: optionally show the same notice. Do not make it alarming.

### Teach-back save behavior

Append to `skill_notes.content` with a timestamp prefix rather than replacing. Format:
```
[Study Mode — YYYY-MM-DD]: {teachBackContent}
```
If an existing note is present, append on a new line. Do not overwrite the entire note field.

Use `upsertSkillNote` from `lib/db/index.ts` via a server action or a thin `/api/skill-notes` route that derives `userId` from cookies.

---

## 3. File Task List

### CREATE `app/(student)/study/page.tsx`
- Auth-gated server component.
- Fetch top focus skill; render CTA card or diagnostic prompt.
- Link to `/study/[skillId]`.

### CREATE `app/(student)/study/[skillId]/page.tsx`
- Auth-gated server component.
- Fetch skill by ID server-side; pass name + section to `StudyMode`.
- Handle not-found case.

### CREATE `components/study/StudyMode.tsx`
- Client component.
- Fetch lesson from `/api/study/lesson` on mount.
- Render 8 steps in order.
- Handle teach-back save with visible success + error states.
- End with CTA to `/session?skill=${skillId}`.

### CREATE `app/api/skill-notes/route.ts` (if not using direct client upsert)
- `POST` only.
- Validate body: `{ skillId: string (uuid), content: string }` with Zod.
- Derive `userId` from cookies.
- Call `upsertSkillNote` — but **append** to existing content rather than replacing (fetch existing first, then concatenate).
- Return 200 on success, 400 on validation failure, 401 if unauthenticated.

---

## 4. Acceptance Criteria

- [ ] `GET /study` renders a focus skill CTA or diagnostic prompt (no flash of unstyled content)
- [ ] `GET /study/[skillId]` renders the full 8-step lesson for a valid skill
- [ ] `GET /study/[skillId]` with an unknown skillId shows a not-found message, not a 500
- [ ] Teach-back save appends to `skill_notes.content` with a timestamp — does not overwrite existing notes
- [ ] Save failure shows a visible error + retry option (not a silent console.error)
- [ ] "Practice this skill" CTA links to `/session?skill=[skillId]` and appears after teach-back
- [ ] `lesson.context.overCeiling === true` shows the "AI resting" notice but renders the lesson normally
- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] Responsive down to 375px (test on mobile viewport)
