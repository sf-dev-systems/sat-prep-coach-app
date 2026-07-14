---
title: Session Log — Miss Loop Tiered-Hints Upgrade (PRD F3)
type: session-log
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-11
related: ["AGENT_HANDOFF.md", "CLAUDE.md", "00 SYSTEM/docs/PRD v1-2.md", "09 WIKI/DEV/MISS_LOOP.md"]
---

# Session: Miss Loop Tiered-Hints Upgrade (PRD F3)

## COMPLETED

Built PRD F3's full miss-loop state machine — the last item blocking Phase
2's acceptance criteria. Scope was confirmed against the actual files at
session start (not guessed), per the prior session's handoff.

**New files:**
- `app/api/miss-loop/route.ts` — single action-discriminated server route
  (`hint` \| `explanation` \| `classify`), session-cookie authenticated.
  `variant` deliberately has no server action (see architecture decision
  below).
- `lib/constants.ts` — `VARK_PROFILE` static constant (single student, v1).
- `09 WIKI/DEV/MISS_LOOP.md` — full writeup of the state machine,
  architecture decision, prompt tightening, and known Phase-2 limits.

**Rewritten:**
- `lib/ai/classifier.ts` — was a keyword-heuristic stub (`classifyFailure`);
  now a real Haiku call via `callAnthropicWithCeiling` using
  `prompts/classifier.ts`, wrapped in a Zod-schema parse. Defaults to
  `'concept'` on any parse/API failure (degrade, never block), matching the
  PRD's locked classifier-fallback behavior. **Field-naming note:** the
  PRD's prose Zod example uses `error_type`; the actual (already-written)
  `prompts/classifier.ts` template returns `classified_error_type` +
  `disagreement_rationale` — the schema matches the real prompt output, not
  the PRD's illustrative name. Flagged here per the project's "flag before
  building" rule rather than silently diverging.
- `components/session/MissLoop.tsx` — full rewrite. State machine:
  `TAG -> HINT -> RETRY -> [correct: optional CONFIRM | wrong: EXPLANATION -> VARIANT] -> resolved`.
  Now owns attempt logging for every question it produces (retry, optional
  confirm, variant) via a `logAttempt` prop, and writes one `error_journal`
  row per resolved miss (PRD F3.5 — "always written"), synthesized from
  static question data when the retry succeeds (no extra API call) or from
  the generated explanation text when it doesn't.
- `prompts/tutor.ts` — tightened to state the PRD's three locked
  explanation requirements verbatim (≤150 words hard ceiling, must name the
  specific trap, must end with the generalizable rule in one sentence,
  previously "150-200 words" with no trap/rule-format requirement).
  Extended `TutorPromptInput` with optional `trapType`/`chosenDistractorNote`
  so the model is grounded in the question's own authored data.
- `lib/db/index.ts` — added `fetchQuestionById`, `fetchAttemptedQuestionIdsForSkill`,
  `fetchVariantQuestion`, `fetchLatestCoachMemory`, `insertErrorJournalEntry`.
- `components/session/SessionRunner.tsx`, `components/diagnostic/DiagnosticRunner.tsx` —
  both updated to pass `sessionId`/`originalAnswer`/`originalConfidence`/
  `logAttempt` down to `MissLoop` and stop double-logging the retry attempt
  themselves. `DiagnosticRunner.tsx` needed this fix too — it wasn't
  mentioned in the prior handoff's scope note but shares the same
  `MissLoopResult` contract and would have broken (referencing removed
  `result.retryAnswer`/`result.hintsUsed` fields) if left unfixed.
- `package.json` — added `zod` dependency (was not previously installed;
  required for the classifier's schema validation).

## DECISIONS

1. **One server route, not four.** `ANTHROPIC_API_KEY` is server-only but
   `MissLoop.tsx` is client-side. Rather than a route per PRD call_type
   (`hint`/`explanation`/`variant`/`classify`), built one
   action-discriminated route for the three that actually call Anthropic
   (`hint`, `explanation`, `classify`) — they share identical session-auth +
   question-fetch boilerplate. Flagged explicitly per the prior handoff's
   open item rather than picked silently.
2. **`variant` serving has no Anthropic call in Phase 2.** PRD F3.3 says
   "serve a structural variant (same skill, same trap type, new surface
   content)" — it doesn't mandate live generation. Live AI-generated
   variants with blind-solve validation are PRD F9's admin pipeline,
   explicitly Phase 4. Building that into the real-time miss loop now would
   be scope creep into a later phase's acceptance criteria (F9's blind-solve
   + numeric verification), so variant serving in Phase 2 only pulls from
   the existing validated bank via a plain RLS-readable query, called
   directly from the browser client — no server route needed for it. If the
   bank has nothing to serve, the step skips gracefully (never blocks).
3. **Coach memory: added a read-only accessor now, not full F6.** The AI
   integration rules ("every tutoring prompt includes... the active
   coach-memory narrative") apply to F3's explanation calls today, not just
   F6's own build phase (Phase 3). Added `fetchLatestCoachMemory` (a few
   lines, read-only) so the explanation prompt is spec-compliant now,
   without building F6's weekly Sonnet-authored refresh — that stays Phase 3.
4. **Confirm-question and variant answers don't re-open a nested miss
   loop.** PRD F3.2 explicitly calls the optional confirm-question step
   "never blocks; skippable." A wrong answer there (or on the variant) is
   logged as its own attempt (feeding mastery) but doesn't trigger another
   full TAG->HINT->RETRY cycle — avoids unbounded nesting for a step the
   spec itself treats as low-stakes.
5. **error_journal avoids an extra API call on the common path.** When a
   student recovers on retry (no explanation was generated), the
   `ai_observation` is synthesized from the question's own
   `rationale`/`distractor_notes` rather than issuing a fresh Sonnet call
   just to restate what's already on the question row — reduces API burn
   per CLAUDE.md's standing guidance, at no cost to the F3.5 requirement
   itself ("always written").

## Sandbox notes this session

No Read/Write/Edit mismatch symptoms this session — every touched/created
file was re-read in full after writing and confirmed correct, including a
targeted fix (extracting `question.skill_id` to a local `const` before two
async calls, since TypeScript doesn't narrow a nullable object property
across an intervening function call). Bash was not used to verify file
content, only for read-only directory listings/date checks, per the
standing mitigation. `git add`/`commit`/`push` were not run in this
sandbox — see "Next action" in `AGENT_HANDOFF.md` for the exact commands to
run on your own machine. `npm run build` was not run in this sandbox either
(hand to your own machine per standing guidance) — reasoned through the
TypeScript control-flow implications manually instead (documented in
`09 WIKI/DEV/MISS_LOOP.md` isn't necessary; the fix itself is inline in
`MissLoop.tsx`).

## SIGN-OFF

Claude (Sonnet) — 7/11/26 (session continued from the 3:00 AM handoff)
