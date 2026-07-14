---
title: Miss Loop — Tiered Hints, Explanation, Variant
type: wiki
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-11
updated: 2026-07-11
source_of_truth: false
related: ["PRD v1-2.md", "CLAUDE.md", "DEV/MASTERY_ENGINE.md", "DEV/SESSION_ASSEMBLER.md", "DEV/DIAGNOSTIC.md"]
---

# Miss Loop — Tiered Hints, Explanation, Variant

Explains PRD F3's full state machine, built this session. Canonical spec is
`00 SYSTEM/docs/PRD v1-2.md` F3 — this page explains, it doesn't redefine.

## What it's for

Phase 1 shipped a static-text placeholder (3 hardcoded hint strings, no
explanation, no variant, no cross-classification). This session replaced it
with the real F3 flow: AI-generated tiered hints, a full written explanation
that names the trap and ends with a generalizable rule, a structural variant
pulled from the question bank, and a Haiku cross-classification of the
error type against the student's self-tag.

## State machine

`components/session/MissLoop.tsx` owns a `phase` state machine:

```
TAG -> HINT -> RETRY -> [correct] -> CONFIRM (optional, skippable) -> resolved
                      -> [wrong]   -> EXPLANATION -> VARIANT -> resolved
```

- **TAG** — one-tap self-tag (concept/calculation/misread/careless/timing/guess), unchanged from Phase 1.
- **HINT** — up to 3 tiered hints, student-requested one at a time, each a real Sonnet call via `/api/miss-loop` (`action: 'hint'`) using `prompts/hint.ts`.
- **RETRY** — student re-answers. This is where MissLoop starts owning `attempts` logging itself (see "Attempt logging" below) and fires the Haiku cross-classify call.
- **CONFIRM** (retry correct only) — one optional harder question in the same skill, fetched client-side, "never blocks; skippable" per PRD F3.2.
- **EXPLANATION** (retry wrong only) — full written explanation via `/api/miss-loop` (`action: 'explanation'`) using `prompts/tutor.ts`, tightened this session to enforce the PRD's locked requirements (≤150 words, must name the specific trap, must end with the generalizable rule in one sentence).
- **VARIANT** (retry wrong only) — same skill + `trap_type`, not already served to this user, pulled from the existing validated question bank.

Exit Session (PRD F3.6) is available at every phase via the `onExit` prop, unchanged from Phase 1.

## File map

| File | Role |
|---|---|
| `components/session/MissLoop.tsx` | The state machine and all phase UI. Owns attempt logging for every question it produces. |
| `components/session/useMissLoop.ts` | Unchanged this session — still the `logAttemptRow` hook (attempts insert + mastery update), now called directly by `MissLoop` instead of only by `SessionRunner`/`DiagnosticRunner`. |
| `app/api/miss-loop/route.ts` | Single action-discriminated server route (`hint` \| `explanation` \| `classify`) — the only place `ANTHROPIC_API_KEY` is touched for this flow. See "Architecture decision" below. |
| `lib/ai/classifier.ts` | Rewritten this session from a keyword-heuristic stub to a real Haiku call + Zod-validated parse, defaulting to `'concept'` on any failure. |
| `prompts/hint.ts`, `prompts/tutor.ts`, `prompts/classifier.ts` | Prompt templates. `hint.ts`/`classifier.ts` used as-authored; `tutor.ts` tightened this session (see below). |
| `lib/db/index.ts` | New functions: `fetchQuestionById`, `fetchAttemptedQuestionIdsForSkill`, `fetchVariantQuestion`, `fetchLatestCoachMemory`, `insertErrorJournalEntry`. |
| `lib/constants.ts` | New — the single-student static `VARK_PROFILE` string, shared by the hint and explanation prompts. |

## Architecture decision: one route, not four

`ANTHROPIC_API_KEY` is server-only (locked invariant), but `MissLoop.tsx`
runs client-side, so every Anthropic-calling step needs a server hop. Rather
than four separate route files (one per PRD call_type), this session built
**one** action-discriminated route (`app/api/miss-loop/route.ts`) handling
`hint`, `explanation`, and `classify` — they share the same session-auth +
question-fetch boilerplate, so splitting them would only duplicate code.

**`variant` deliberately has no server action.** Serving a structural
variant in Phase 2 is a read against the shared, RLS-readable `questions`
table (`fetchVariantQuestion` in `lib/db`) — no Anthropic call. Live
AI-generated variants (with blind-solve validation) are PRD F9's admin
generation pipeline, explicitly Phase 4 scope; building that into the
real-time miss loop now would be scope creep into a later phase, so it
wasn't done. If the question bank has no matching variant (same skill +
`trap_type`, not already served) for a given skill yet, the miss loop skips
that step gracefully — same "never blocks" pattern as the AI ceiling.

## Prompt tightening: `prompts/tutor.ts`

The written explanation step (F3.3) has three locked requirements: ≤150
words, must name the specific trap in the student's chosen answer, must end
with the generalizable rule in one sentence. The prompt as originally
written said "150-200 words" and didn't require trap-naming or a
rule-ending format explicitly. This session tightened the system prompt to
state those three requirements verbatim, and extended `TutorPromptInput`
with optional `trapType`/`chosenDistractorNote` fields so the model is
grounded in the question's own authored `trap_type`/`distractor_notes`
data rather than inventing a trap description.

## Classifier fallback — field-naming note

PRD v1.2's prose gives an illustrative Zod schema of
`z.object({ error_type: z.enum([...]) })`. The actual `prompts/classifier.ts`
template (written in an earlier session, not authored this session) returns
`classified_error_type` plus a `disagreement_rationale` field. This session's
`lib/ai/classifier.ts` schema matches the real prompt output
(`classified_error_type`/`disagreement_rationale`) rather than the PRD's
illustrative field name, since that's what's actually wired into the Haiku
call. The degrade-never-block behavior is unchanged: any parse failure
(malformed JSON, API error, out-of-taxonomy value) defaults to `'concept'`
and proceeds — visible in `ai_log` as a `call_type='classify'` row whose
result was discarded, no new tracking table needed.

## Attempt logging — ownership moved into MissLoop

Phase 1's `MissLoop` returned a single `{ finalCorrect, hintsUsed, errorType,
retryAnswer }` result, and the parent (`SessionRunner`/`DiagnosticRunner`)
logged the one retry attempt itself. The full F3 flow can produce **up to
three** attempts per miss (retry, optional confirm question, variant), so
this session moved attempt logging into `MissLoop` itself via a `logAttempt`
prop (the same `logAttemptRow` from `useMissLoop`, just threaded down
instead of called by the parent). `onResolved` now only carries
`{ finalCorrect, errorType }` — "the loop is done, advance the queue" — not
attempt data. Both `SessionRunner.tsx` and `DiagnosticRunner.tsx` were
updated to pass `sessionId`, `originalAnswer`, `originalConfidence`, and
`logAttempt` down, and no longer log a retry attempt themselves.

## error_journal — always written, mostly free

PRD F3.5 requires an `error_journal` row on every resolved miss, regardless
of whether the student taps to view the distractor breakdown. To avoid
burning an extra Anthropic call for the common "recovered on retry" path,
`error_journal.ai_observation` is synthesized from the question's own
`rationale`/`distractor_notes` (already in hand, no API call) when the
student retries correctly; when the retry is wrong, the already-generated
explanation text is reused as the observation. Either way, if the Haiku
cross-classification disagreed with the student's self-tag, a short note
is appended — this is what "log disagreements" resolves to concretely,
on top of the implicit `ai_log` row every classify call already produces.

## Known Phase-2 limits (not bugs)

- **Variant availability depends on bank density.** If a skill+trap_type
  combination has only one validated question, the variant step will find
  nothing to serve and skip gracefully. Expanding the bank (F9, Phase 4)
  is what actually fixes this — it isn't something the miss loop itself
  can solve without crossing into F9's scope.
- **Coach memory is always empty right now.** `fetchLatestCoachMemory` is
  wired into the explanation prompt today (the AI integration rules require
  it on every tutoring prompt), but F6 (the weekly Sonnet-authored refresh
  that actually populates `coach_memory`) is Phase 3 — so every explanation
  currently gets "No prior coaching history yet" until Phase 3 ships.
- **The confirm-question and variant steps don't get their own self-tag /
  cross-classify pass.** Only the original miss is diagnosed; a wrong
  answer on the optional confirm question or on the variant is logged
  (feeding mastery) but doesn't re-open a nested miss loop — PRD F3.2
  explicitly calls the confirm step "never blocks."
