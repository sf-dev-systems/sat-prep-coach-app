#### 1. Current-State Summary

The app already has a strong foundation for Ava-personalized Study Mode, but the Study Mode itself is not implemented yet.

- The reviewed roadmap explicitly frames the next milestone as expanding the app from diagnostic, adaptive practice, miss-loop remediation, mastery tracking, error journal, skill notes, behavior signals, score prediction, and Supabase-backed state into a fuller tutoring platform with dedicated Study Mode. {line_range_start=48 line_range_end=65 path=00 SYSTEM/AI Review and Audits/REVIEW - Enhance and Study Roadmap.md git_url="https://github.com/sf-dev-systems/sat-prep-coach-app/blob/main/00 SYSTEM/AI Review and Audits/REVIEW - Enhance and Study Roadmap.md#L48-L65"}
    
- Ava’s VARK profile is present as a static MVP constant, but only as a raw string: `Read/Write 13, Kinesthetic 14, Aural 9, Visual 7`. 
    
- VARK is already injected into miss-loop hint and explanation prompt calls through `app/api/miss-loop/route.ts`, so the AI-personalization pattern exists but is limited to remediation rather than pre-practice study. 
    
- Targeted drilling already exists through `/session?skill=[skillId]`: the session page reads `searchParams.skill` and passes it into `assemblePracticeSession`. 
    
- The mastery page already exposes per-skill mastery, error journal entries, and self-correction notes, and it already has a “Drill This Skill” entry point. 
    
- The database already has the main tables Study Mode needs for MVP data integration: `error_journal`, `skill_notes`, `coach_memory`, `behavior_signals`, and `ai_log`. 
    
- The AI ceiling chokepoint exists in `callAnthropicWithCeiling`, which resolves a per-user or environment daily ceiling, checks usage, selects a model, calls Anthropic, and logs successful calls. 
    
- Runtime validation is incomplete: the miss-loop API parses JSON and checks only the top-level action before using casts and `(body as any).questionId`. 
    
- Attempt logging and mastery updates still happen client-side through `useMissLoop`, which accepts correctness, difficulty, error type, hints used, retry status, and timing from the browser before writing attempts and updating mastery. 
    
- Dashboard scoring and focus-skill selection exist in a portable `lib/` module, but confidence interval display is not clamped, and the empty state is currently a single `hasData` boolean based on `masteryMap.size === 0`. 
    
- Tooling is minimal: `package.json` has `dev`, `build`, `start`, `lint`, and data scripts, but no `typecheck`, no `test`, and no question-bank audit script. 
    

#### 2. Gap Analysis Table

|**Requirement ID / Name**|**Current Support State** (What exists)|**The Gap** (What is missing)|**Files Impacted** (Specific file paths/directories)|**Priority** (High / Medium / Low)|**Technical Notes / Constraints**|
|---|---|---|---|---|---|
|SM-1 / `/study` route|App Router is in use under `app/(student)`, with existing authenticated student routes such as dashboard, mastery, diagnostic, and session.|No `/study` landing route exists.|Create `app/(student)/study/page.tsx`; possibly update `middleware.ts` only if route allow/deny logic requires adjustment.|High|Should derive auth server-side like dashboard/session pages and recommend top study skill from dashboard/focus-skill logic.|
|SM-2 / `/study/[skillId]` route|Targeted skill routing pattern exists through `/session?skill=[skillId]`.|No dynamic route exists for a single skill study lesson.|Create `app/(student)/study/[skillId]/page.tsx`.|High|Must validate skill existence and ownership-independent skill visibility. Should fetch skill, mastery, error journal, skill notes, and optionally coach memory server-side.|
|SM-3 / Ava VARK Study UX|VARK is present as a static constant and remediation prompts already receive it.|No Study Mode component exists; current UX is practice/remediation-focused, not pre-practice learning.|Create `components/study/StudyMode.tsx`; possibly `components/study/TeachBackEditor.tsx` if split.|High|UX should prioritize short written rules, checklists, worked examples, active typed responses, retrieval prompts, teach-back notes, and immediate application. Avoid long passive reading and purely visual explanations per PRD. {line_range_start=15 line_range_end=23 path=00 SYSTEM/AI Review and Audits/REVIEW - PRD Personalized Study Mode.md git_url="https://github.com/sf-dev-systems/sat-prep-coach-app/blob/main/00 SYSTEM/AI Review and Audits/REVIEW - PRD Personalized Study Mode.md#L15-L23"}|
|SM-4 / `prompts/study.ts`|Prompt files exist for hint, tutor, classifier, coach, generator, reporter. Miss-loop uses prompt builder functions.|No Study Mode prompt exists.|Create `prompts/study.ts`.|High|Should define both system and user prompt builders plus a strict response schema expectation. Prompt must include VARK directives and compact output constraints.|
|SM-5 / `/api/study/lesson`|API route pattern exists for miss-loop with Supabase server auth and AI ceiling usage.|No study lesson API exists.|Create `app/api/study/lesson/route.ts`; update `lib/ai/index.ts` call-type union; update `lib/db/index.ts` AI log type union if typed.|High|Must authenticate user from cookies, validate request with Zod, fetch canonical skill context server-side, call `callAnthropicWithCeiling`, parse/validate AI response with Zod, and degrade safely.|
|SM-6 / Zod request validation for Study API|Zod is already installed.|No Study API schemas exist.|Create schemas in `app/api/study/lesson/route.ts` or shared `lib/validation/study.ts`.|High|Request should validate `skillId`, optional lesson preferences if any, and no client-supplied trusted context.|
|SM-7 / Zod AI response validation for Study API|No existing AI response validation is visible in the study flow because the flow does not exist.|Need a strict study lesson payload schema.|`app/api/study/lesson/route.ts`; `prompts/study.ts`; optionally `lib/validation/study.ts`.|High|Response shape should be small and deterministic: `rule`, `checklist`, `workedExample`, `activePrompt`, `retrievalPrompt`, `teachBackPrompt`, `applicationCta`. If invalid, log fallback and return static lesson scaffold.|
|SM-8 / Error journal context injection|Error journal table and types exist.  Mastery page reads `error_journal` per user and displays entries per skill.|Study lesson generation does not yet fetch or inject skill-specific error journal entries.|Add DB helper or reuse `fetchErrorJournal`; `app/api/study/lesson/route.ts`; `prompts/study.ts`.|High|Limit recent entries to control token usage. Empty journal should produce neutral wording, not an error.|
|SM-9 / AI ceiling integration for Study Mode|`callAnthropicWithCeiling` already enforces daily ceiling and returns static fallback content when over ceiling.|`AiCallConfig.callType` does not include `study_lesson`, and no Study API uses the chokepoint.|`lib/ai/index.ts`; `lib/db/index.ts`; `app/api/study/lesson/route.ts`; possibly migration/comment only if type constrained later.|High|Add a `study_lesson` call type. Current DB column is text, so DB migration may not be required unless stricter constraints are later added.|
|SM-10 / Save teach-back to `skill_notes`|`skill_notes` table exists with `(user_id, skill_id)` primary key.  Existing mastery UI upserts notes directly from the browser.|Study Mode does not exist and therefore cannot save teach-back responses. There is also no dedicated server route for notes.|`components/study/StudyMode.tsx`; either use existing Supabase browser client or create `app/api/skill-notes/route.ts`; optionally use `upsertSkillNote` in `lib/db/index.ts`.|High|MVP can reuse existing schema. Safer implementation is a server route that derives user from cookies and validates `skillId`/`content` with Zod.|
|SM-11 / Exit CTA to `/session?skill=[skillId]`|Targeted drill URL works and mastery page links to it.|Study flow does not exist and thus has no terminal CTA.|`components/study/StudyMode.tsx`; `app/(student)/study/[skillId]/page.tsx`.|High|CTA should be visible after teach-back/save, but accessible even if save fails with a warning.|
|SM-12 / Mastery page “Study This Skill” button|Mastery page has selected skill metadata, journal, notes, and one drill CTA.|No “Study This Skill” button next to “Drill This Skill.”|Modify `app/(student)/mastery/page.tsx`.|High|Add link to `/study/${selectedSkill.id}` near existing drill button. Consider button hierarchy: Study primary or paired with Drill.|
|SM-13 / Dashboard CTA card for “Study Today’s Top Skill”|Dashboard computes and renders top focus skills.|Focus skills lack IDs, and dashboard has no Study CTA card.|Modify `lib/mastery/dashboard.ts`; modify `app/(student)/page.tsx`.|High|`FocusSkill` must include `skillId`. CTA should link to `/study/[skillId]`. Handle `focusSkills.length === 0`.|
|ENG-1 / Add Zod validation to miss-loop API|Miss-loop route has TypeScript request interfaces and top-level action check.|Runtime request validation is incomplete; malformed values can reach prompt construction.|Modify `app/api/miss-loop/route.ts`; optionally create `lib/validation/miss-loop.ts`.|High|Use a discriminated union on `action`. Validate `questionId`, `hintNumber`, `studentAnswer`, `confidence`, and `studentErrorTag`.|
|ENG-2 / Future server-side attempt logging and mastery updates|`logAttempt` and `updateMasteryOnAttempt` exist in portable modules.|Browser still supplies correctness, difficulty, error type, hints used, retry status, and timing before persistence.|Future create `app/api/attempts/log/route.ts`; modify `components/session/useMissLoop.ts`; possibly `components/session/SessionRunner.tsx` and `components/session/MissLoop.tsx`.|High|Server route should re-fetch canonical question, recompute correctness, and then log attempt/update mastery. Keep as a planned phase if not in Study MVP.|
|ENG-3 / AI fallback telemetry|Successful AI calls are logged to `ai_log`.|Over-ceiling fallback and Anthropic error fallback return without logging.|Modify `lib/ai/index.ts`; possibly `lib/db/index.ts` call-type typing.|High|Log `fallback-static` and `fallback-error` models with zero tokens. Be careful not to call `countTodayAiCalls` in a way that causes recursive fallback logging loops.|
|ENG-4 / `typecheck` script|TypeScript is installed.|No `typecheck` script exists.|Modify `package.json`; update `package-lock.json` only if dependencies change.|Medium|Add `"typecheck": "tsc --noEmit"`.|
|ENG-5 / `test` script and basic unit framework|Portable pure logic exists in `lib/`, especially dashboard/scoring/mastery.|No test framework or `test` script exists.|Modify `package.json`, `package-lock.json`; create `vitest.config.ts`; create tests under `__tests__/` or colocated `*.test.ts`.|Medium|Vitest is a good fit. Initial tests should cover pure functions: scoring clamps, dashboard confidence band, BKT/FSRS, validation schemas.|
|ENG-6 / Standalone question-bank audit script|Data import scripts exist: `seed-skills` and `import-bank`.|No `question-bank` audit script exists.|Create `scripts/audit-question-bank.ts`; modify `package.json`.|Medium|Should detect missing skill IDs, invalid difficulty, unvalidated official rows, duplicate external IDs, missing rationales, malformed choices, and orphaned skills.|
|ENG-7 / Dashboard confidence interval clamp|Dashboard computes predicted score and confidence band.|Confidence interval is not clamped to SAT total bounds.|Modify `lib/mastery/dashboard.ts`; add tests.|Medium|Clamp total display to `400–1600`; if section bands are added later, clamp to `200–800`.|
|ENG-8 / Dashboard empty/incomplete diagnostic states|Dashboard returns `hasData: false` when `masteryMap.size === 0`.  UI sends user to diagnostic.|No distinction among first run, diagnostic in progress, diagnostic incomplete, partial data, or data repair needed.|Modify `lib/mastery/dashboard.ts`; modify `app/(student)/page.tsx`; possibly add DB helper queries for diagnostic sessions/attempts.|Medium|Introduce `StudentSetupState` union and render more precise CTAs. Avoid blocking dashboard if only non-critical metrics are missing.|
|ENG-9 / Skill notes save error UX|Mastery page catches note save errors and logs to console.|User-facing save failure state is missing.|Modify `app/(student)/mastery/page.tsx`; apply similar pattern in Study Mode.|Medium|Add `errorMsg` state and retry guidance. Important because Study Mode teach-back save is part of MVP flow.|
|ARCH-1 / Structured learner profile|VARK is a raw string constant.|Study Mode needs more structured guidance than a raw string.|Modify `lib/constants.ts` or create `lib/learner-profile.ts`; update prompts.|Medium|Keep single-student MVP but expose structured fields: dominant modes, avoidances, lesson constraints, max reading length, required active steps.|
|ARCH-2 / Study lesson data source and fallback|Questions can be fetched by skill and validated question helpers exist.|Need clear fallback if AI fails or question/context is sparse.|`app/api/study/lesson/route.ts`; `prompts/study.ts`; optionally `lib/study/fallback.ts`.|High|Static fallback can use skill name, existing note, recent error journal entries, and a generic “rule/checklist/teach-back” scaffold.|

#### 3. Recommended Implementation Phases

**Phase 1: Validation, Types, and Backend Safety Foundations**

- Add Zod schemas for `miss-loop` API request validation.
    
- Add shared Study Mode request/response schemas.
    
- Extend AI call typing to include `study_lesson`.
    
- Add fallback logging inside `callAnthropicWithCeiling`.
    
- Add any missing DB helper functions needed for skill-specific study context:
    
    - fetch one skill by ID,
        
    - fetch recent error journal entries by skill,
        
    - fetch one skill note by skill,
        
    - optionally fetch one or two validated sample questions for immediate application.
        

**Phase 2: Study Lesson API and Prompt Contract**

- Create `prompts/study.ts`.
    
- Create `app/api/study/lesson/route.ts`.
    
- Server-side behavior should:
    
    - authenticate from cookies,
        
    - validate request with Zod,
        
    - fetch canonical skill/context server-side,
        
    - include Ava’s VARK directives,
        
    - include recent error journal entries for traps,
        
    - include existing skill note if present,
        
    - call `callAnthropicWithCeiling`,
        
    - parse returned JSON,
        
    - validate AI response with Zod,
        
    - fall back to a static validated lesson payload on ceiling/API/schema failure.
        

**Phase 3: Study Routes and UI**

- Create `/study` landing page.
    
- Create `/study/[skillId]` page.
    
- Create `components/study/StudyMode.tsx`.
    
- Implement the MVP learning flow:
    
    1. short rule,
        
    2. checklist,
        
    3. worked example,
        
    4. active typed response,
        
    5. retrieval prompt,
        
    6. teach-back note,
        
    7. save to `skill_notes`,
        
    8. CTA to `/session?skill=[skillId]`.
        

**Phase 4: Entry Points and Dashboard/Mastery Integration**

- Add “Study This Skill” button next to “Drill This Skill” on the mastery page.
    
- Add `skillId` to dashboard `FocusSkill`.
    
- Add dashboard card: “Study Today’s Top Skill.”
    
- Improve empty/incomplete diagnostic states enough that the Study CTA does not appear when no studyable skill is known.
    

**Phase 5: Engineering Quality-of-Life and Observability**

- Add `typecheck` script.
    
- Add `test` script and basic Vitest setup.
    
- Add unit tests around schemas, scoring/dashboard clamp behavior, and pure mastery/scoring utilities.
    
- Add standalone question-bank audit script.
    
- Add dashboard confidence interval clamping.
    
- Add user-visible note-save failure handling.
    

**Phase 6: Future Server-Side Attempt Logging Plan**

- Design `/api/attempts/log`.
    
- Move correctness recomputation and mastery updates server-side.
    
- Keep current `useMissLoop` contract temporarily but gradually reduce trusted browser input.
    
- Add tests for route validation and correctness derivation.
    

#### 4. File-by-File Task List

**Create `app/(student)/study/page.tsx`**

- Auth-gated server component, matching dashboard/session patterns.
    
- Fetch dashboard or mastery-derived recommendation.
    
- If no data exists, show diagnostic CTA.
    
- If a focus skill exists, link to `/study/[skillId]`.
    
- Optionally list top 3 studyable skills.
    

**Create `app/(student)/study/[skillId]/page.tsx`**

- Auth-gated server component.
    
- Validate `skillId` shape.
    
- Fetch canonical skill.
    
- Render `StudyMode`.
    
- Pass only minimal safe props: `skillId`, `skillName`, `section`, maybe existing note snapshot.
    

**Create `components/study/StudyMode.tsx`**

- Client component for interactive study flow.
    
- Fetch lesson from `/api/study/lesson`.
    
- Render VARK-aligned sections:
    
    - “Write the rule,”
        
    - “Use this checklist,”
        
    - “Worked example,”
        
    - “Your turn,”
        
    - “Retrieve it from memory,”
        
    - “Teach it back.”
        
- Save teach-back response to `skill_notes`.
    
- Display fallback/over-ceiling status gracefully.
    
- End with CTA to `/session?skill=${skillId}`.
    

**Create `prompts/study.ts`**

- Export `getStudyLessonPrompt`.
    
- Include structured Ava VARK directive:
    
    - prioritize doing/writing,
        
    - no long passive lecture,
        
    - short rule,
        
    - checklist,
        
    - worked example,
        
    - active prompt,
        
    - retrieval prompt,
        
    - teach-back prompt.
        
- Instruct AI to return strict JSON matching the Zod response schema.
    
- Include context slots:
    
    - skill name,
        
    - section/domain,
        
    - mastery snapshot,
        
    - recent error journal traps,
        
    - existing note,
        
    - sample question/rationale if available.
        

**Create `app/api/study/lesson/route.ts`**

- Use `NextRequest`, `NextResponse`, cookies, Supabase server client.
    
- Validate request with Zod.
    
- Fetch authenticated user.
    
- Fetch skill and skill-specific context server-side.
    
- Call `callAnthropicWithCeiling` with `callType: 'study_lesson'`.
    
- Validate AI response with Zod.
    
- Return `{ lesson, overCeiling, source }`.
    
- On AI failure or invalid response, return a valid static fallback lesson.
    

**Modify `lib/ai/index.ts`**

- Add `study_lesson` to `AiCallConfig.callType`.
    
- Add fallback logging for over-ceiling returns.
    
- Add fallback logging for Anthropic error returns when `fallbackRationale` is used.
    
- Consider returning `fallbackReason?: 'ceiling' | 'provider_error' | 'invalid_response'`.
    

**Modify `lib/db/index.ts`**

- Add `study_lesson` to `AiLog['call_type']` union if keeping typed list.
    
- Add helper functions:
    
    - `fetchSkillById`,
        
    - `fetchErrorJournalForSkill`,
        
    - `fetchSkillNoteForSkill`,
        
    - optionally `fetchValidatedQuestionsBySkill`.
        
- Consider a helper `upsertSkillNote` already exists and can be used server-side.  _(The function continues immediately after the cited range in the same file; it should be reused rather than duplicating upsert logic.)_
    

**Modify `app/api/miss-loop/route.ts`**

- Replace ad hoc parsing and TypeScript casts with a Zod discriminated union.
    
- Remove `(body as any).questionId`.
    
- Return precise 400 errors for:
    
    - invalid action,
        
    - missing question ID,
        
    - invalid hint number,
        
    - invalid confidence,
        
    - invalid student error tag,
        
    - empty student answer where required.
        

**Modify `app/(student)/mastery/page.tsx`**

- Add “Study This Skill” link near the existing “Drill This Skill” link.
    
- Link to `/study/${selectedSkill.id}`.
    
- Improve note save failure UX with visible error state.
    
- Optionally refactor duplicated note save behavior into a reusable API route or component.
    

**Modify `app/(student)/page.tsx`**

- Add a “Study Today’s Top Skill” CTA card.
    
- Use the top `focusSkills[0]`.
    
- Link to `/study/[skillId]`.
    
- Show a graceful alternate state if focus skills are empty.
    
- Update imports to remove unused icons and include any new icon needed.
    

**Modify `lib/mastery/dashboard.ts`**

- Add `skillId` to `FocusSkill`.
    
- Clamp confidence interval display to `400–1600`.
    
- Consider adding `setupState` instead of only `hasData`.
    
- Add richer empty/incomplete state detection:
    
    - no mastery rows,
        
    - diagnostic session started but incomplete,
        
    - mastery rows exist but no attempts,
        
    - attempts exist but no scoreable mastery.
        

**Modify `package.json`**

- Add `"typecheck": "tsc --noEmit"`.
    
- Add `"test": "vitest run"` after installing Vitest.
    
- Add `"audit:question-bank": "tsx scripts/audit-question-bank.ts"`.
    

**Modify `package-lock.json`**

- Update only if adding Vitest or related dev dependencies.
    

**Create `vitest.config.ts`**

- Configure TypeScript test environment.
    
- Keep environment as `node` initially unless React component tests are introduced later.
    

**Create initial tests, likely under `__tests__/` or colocated files**

- `lib/mastery/dashboard.test.ts`
    
    - confidence interval clamp,
        
    - focus skill includes ID,
        
    - empty-state logic.
        
- `app/api/miss-loop/validation.test.ts` or `lib/validation/miss-loop.test.ts`
    
    - valid/invalid action payloads.
        
- `lib/study/schema.test.ts`
    
    - valid/invalid AI response payloads.
        
- Optional:
    
    - `lib/mastery/bkt.test.ts`,
        
    - `lib/mastery/fsrs.test.ts`,
        
    - `lib/scoring/predictive-score.test.ts`.
        

**Create `scripts/audit-question-bank.ts`**

- Read question rows either from local JSON data files and/or Supabase depending on environment.
    
- Validate:
    
    - difficulty range,
        
    - `skill_id` presence,
        
    - choices shape,
        
    - correct answer consistency,
        
    - rationale presence,
        
    - duplicate external IDs,
        
    - unvalidated generated questions,
        
    - orphaned skill references,
        
    - suspicious empty distractor notes.
        
- Print a summary and exit non-zero on severe issues.
    

**Optional create `lib/validation/study.ts`**

- Shared Zod schemas:
    
    - `StudyLessonRequestSchema`,
        
    - `StudyLessonResponseSchema`,
        
    - `TeachBackSaveSchema` if a server save route is added.
        

**Optional create `app/api/skill-notes/route.ts`**

- Safer note persistence API.
    
- Validates `skillId` and `content`.
    
- Derives `userId` server-side.
    
- Calls `upsertSkillNote`.
    

#### 5. Risks, Assumptions, and Decisions Needed

**Risks**

- **AI response reliability:** If Study Mode depends on strict JSON from the model, malformed output can break the lesson unless the API validates and falls back. This is why AI response Zod validation is high priority.
    
- **Token growth from error journals:** Injecting all error journal entries could exceed reasonable prompt size. Limit to the most recent 3–5 skill-specific entries and summarize if needed.
    
- **Fallback observability gap:** Current successful AI calls are logged, but fallback-static and fallback-error paths are not logged. This hides ceiling pressure and provider failures. 
    
- **Client trust boundary:** Current attempt logging and mastery updates trust browser-supplied correctness and difficulty. This is acceptable for an MVP but should not remain the production trust model. 
    
- **Study vs. practice overlap:** Study Mode should not become another question session. It should teach, ask Ava to write/do/retrieve, then bridge to targeted practice.
    
- **Empty data states:** A new dashboard Study CTA depends on focus skills. If dashboard data is empty or partially initialized, the CTA needs a fallback path instead of breaking or recommending a nonsensical skill.
    
- **Skill notes overwrite behavior:** Saving teach-back directly into `skill_notes.content` may overwrite the existing self-correction note. Decide whether Study Mode should append, replace, or prefix teach-back content.
    
- **No schema field for study artifacts:** MVP can reuse `skill_notes`, but long-term it may need a `study_sessions` or `study_notes` table if parent review, history, or analytics become important.
    

**Assumptions**

- The app remains a single-student personal edition for Ava in this MVP, so a static learner profile is acceptable.
    
- `/study/[skillId]` should be authenticated like other student pages.
    
- `skill_notes` is the correct MVP destination for teach-back responses because the requirement explicitly says to save teach-back directly into the existing `skill_notes` table/schema.
    
- Study Mode should use the existing AI ceiling infrastructure rather than introducing separate model/cost handling.
    
- The first dashboard Study CTA should use the top focus skill generated by current point-leverage/review-due logic.
    

**Decisions Needed Before Coding**

1. **Teach-back save semantics:** Should Study Mode replace the existing skill note, append a timestamped teach-back section, or maintain a structured markdown block inside `content`?
    
2. **Study API response shape:** Confirm exact lesson payload fields before implementing prompt + schema.
    
3. **Server route for notes:** Decide whether MVP can save teach-back directly from the client like mastery currently does, or whether to add a server-side notes route immediately.
    
4. **Fallback lesson content:** Decide whether static fallback should be generic per section, skill-name based, or seeded from an existing validated question/rationale.
    
5. **Dashboard setup state model:** Decide whether to implement only minimal polish now or introduce a full `StudentSetupState` union as part of this work.
    
6. **Test framework:** Vitest is recommended, but confirm before adding dependencies and lockfile updates.
    
7. **Question-bank audit source:** Decide whether the audit script should inspect local `data/*.json`, live Supabase rows, or both.
    

#### 6. Checks Performed and Repository Change Status

No code files were modified, per your instruction: “Do not modify or write any code files yet.” Because there were no code changes, I did not commit and did not create a pull request.

**Testing / Checks**

- ✅ `pwd && find .. -name AGENTS.md -print`
    
- ✅ `find /workspace -name AGENTS.md -print`
    
- ✅ `rg --files | sed 's#^#/#' | head -200 && printf '\n--- review files ---\n' && find "00 SYSTEM/AI Review and Audits" -maxdepth 1 -type f -name 'REVIEW - *' -print`
    
- ✅ `for f in "00 SYSTEM/AI Review and Audits"/REVIEW\ -\ *; do echo "\n===== $f ====="; sed -n '1,220p' "$f"; done`
    
- ✅ `sed -n '1,220p' package.json; printf '\n--- routes ---\n'; sed -n '1,240p' app/api/miss-loop/route.ts; printf '\n--- ai ---\n'; sed -n '1,260p' lib/ai/index.ts; printf '\n--- constants ---\n'; sed -n '1,160p' lib/constants.ts`
    
- ✅ `sed -n '1,280p' app/'(student)'/mastery/page.tsx; printf '\n--- dashboard ---\n'; sed -n '1,260p' app/'(student)'/page.tsx; printf '\n--- session page ---\n'; sed -n '1,180p' app/'(student)'/session/page.tsx`
    
- ✅ `sed -n '280,560p' app/'(student)'/mastery/page.tsx; printf '\n--- db types funcs ---\n'; sed -n '1,340p' lib/db/index.ts`
    
- ✅ `sed -n '340,760p' lib/db/index.ts; printf '\n--- migration schema names ---\n'; rg -n "create table|error_journal|skill_notes|ai_log|mastery|attempts|questions" supabase/migrations/20260710000000_initial_schema.sql`
    
- ✅ `sed -n '1,320p' lib/mastery/dashboard.ts; printf '\n--- useMissLoop ---\n'; sed -n '1,280p' components/session/useMissLoop.ts; printf '\n--- mastery update ---\n'; sed -n '1,260p' lib/mastery/index.ts`
    
- ✅ `nl -ba "00 SYSTEM/AI Review and Audits/REVIEW - Enhance and Study Roadmap.md" | sed -n '1,180p'; printf '\n--- personalized lines ---\n'; nl -ba "00 SYSTEM/AI Review and Audits/REVIEW - PRD Personalized Study Mode.md" | sed -n '1,220p'`
    
- ✅ `nl -ba package.json | sed -n '1,80p'; printf '\n'; nl -ba app/api/miss-loop/route.ts | sed -n '1,190p'; printf '\n'; nl -ba lib/ai/index.ts | sed -n '1,170p'; printf '\n'; nl -ba lib/constants.ts | sed -n '1,60p'`
    
- ✅ `nl -ba app/'(student)'/page.tsx | sed -n '1,240p'; printf '\n'; nl -ba app/'(student)'/mastery/page.tsx | sed -n '1,380p'; printf '\n'; nl -ba app/'(student)'/session/page.tsx | sed -n '1,120p'`
    
- ✅ `nl -ba lib/db/index.ts | sed -n '80,180p;300,460p;520,620p'; printf '\n'; nl -ba lib/mastery/dashboard.ts | sed -n '65,190p'; printf '\n'; nl -ba components/session/useMissLoop.ts | sed -n '1,120p'`
    
- ✅ `nl -ba lib/mastery/dashboard.ts | sed -n '190,285p'; printf '\n'; nl -ba supabase/migrations/20260710000000_initial_schema.sql | sed -n '83,132p'`