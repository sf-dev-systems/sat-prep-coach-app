---
title: Codebase Audit — Phase 1/2 Reality Check
type: audit
date: 2026-07-10
owner: Sienna (Oni Technologies LLC)
author: Claude (Sonnet)
status: final
---

# Codebase Audit — 2026-07-10

Full review of `sat-prep-coach-app` (code tree + PRD v1.1 + Charter), excluding `99 ARCHIVE`. Goal: verify Gemini's Phase 1/2 claims in `AGENT_HANDOFF.md` against actual code, and identify true next action.

## Verified true

- `npx tsc --noEmit` compiles with zero errors.
- Migration `20260710000000_initial_schema.sql` implements all 15 tables from the PRD (including the Charter §5 stubs: `profiles`, `config`, `events`, `questions.license`/`external_id`), RLS enabled on every table, composite PK on `mastery` and `skill_notes`, `coach_memory` append-only shape (insert-only pattern, no update path in code).
- `lib/ai/index.ts` — single chokepoint, resolves ceiling `profiles → env → 150`, logs every call to `ai_log`, falls back to static rationale on over-ceiling **and** on hard API error (`callAnthropicWithCeiling`). Correctly degrades, never blocks.
- `lib/db/index.ts` — only file touching the Supabase client; no `app/`/`react`/`next` imports in `lib/`. Boundary rule holds.
- `scripts/seed-skills.ts` + `verify-seed.ts` — taxonomy is live and internally consistent: 3 sections / 11 domains / 29 leaf skills, hierarchy verified.
- `prompts/tutor.ts`, `hint.ts`, `generator.ts` — real, well-constructed templates matching PRD tone/format rules (hint word limits, VARK injection, JSON-only generator output). Did not find `prompts/coach.ts`, `classifier.ts`, `reporter.ts` reviewed in depth but they exist on disk.
- No hardcoded user IDs found; `useMissLoop.ts` correctly derives `user_id` from `supabase.auth.getUser()`.

## Overstated in AGENT_HANDOFF.md — corrected here

**"Mathematical Engine: fully implemented"** — `lib/scoring/predictive-score.ts` only implements the score-prediction weighting formula (`Σ mastery×weight` + strategy multiplier). It is **not** the BKT/FSRS mastery engine the PRD calls for in F4. There is no `lib/mastery/` directory at all — no `p_mastery` update logic (learn-rate/slip-penalty), no `stability`/`next_review` (FSRS) scheduling. This is the actual next build item, not a completed one.

**"Phase 2 in progress" claims re: MissLoop** — `components/session/MissLoop.tsx` and `useMissLoop.ts` are UI/DB scaffolds, not the F3 miss loop:
- No tiered hints (1/2/3) — `prompts/hint.ts` exists but is never called from `MissLoop.tsx`.
- No retry-then-explanation-then-variant sequence — the component has 3 static phases (`ANALYSIS → HINT → RETRY`) with hardcoded copy, no AI calls.
- `classifyFailure()` in `lib/ai/classifier.ts` is a plain string-match heuristic (checks if `question.section === 'strategy'` or response text is `"timing"`/`"guess"`), not an AI call — PRD F3.4 calls for Haiku cross-classification, which doesn't exist yet.
- `useMissLoop.ts` writes an `attempts` row with `error_type` hardcoded to only `'concept'` or `'timing'` — 4 of the 6 valid error types (`calculation`, `misread`, `careless`, `guess`) are unreachable. `confidence`, `hints_used`, `was_retry`, `skill_id` are never set on the insert.
- Not wired to any route — there is no `/session` page, so none of this is reachable by the student today.

**"Basic practice loop" (Phase 1 acceptance)** — `lib/sessions/index.ts` (`assemblePracticeSession`) is a real, working assembler, but nothing in `app/` calls it. `app/` contains exactly three files: `layout.tsx`, `globals.css`, and a static `page.tsx` dashboard with hardcoded placeholder numbers (predicted score 1420, streak 5 days, etc. — not read from the DB). There is no `app/api/` at all. **There is no way for Sienna to actually take a practice session, log in, or see real data today** — the dashboard is a visual mock.

**No auth flow.** No `/login` route, no Supabase Auth UI/session bootstrap, no `middleware.ts`. `useMissLoop.ts` assumes `supabase.auth.getUser()` already resolves, but nothing in the app establishes that session. This blocks everything else, including the "basic practice loop" claim.

## Deviation from PRD not yet reconciled

**Taxonomy size.** PRD v1.1 specifies "~18 skills" for RW, "~18 skills" for Math, "~8" for Strategy (~44 total, decomposed per full College Board descriptors). The actually-seeded taxonomy (`scripts/seed-skills.ts`) has 10 RW / 10 Math / 9 Strategy = 29 leaf skills — a condensed set. This was then written into `00 SYSTEM/docs/SYSTEM_ARCHITECTURE.md` and declared a "locked invariant" in `CLAUDE.md` ("29 leaf skills") **without following the document revision policy** (no strikethrough/archive of the PRD's "~18 skills" language, no superseded-by note). Right now the PRD and the locked invariant disagree on skill count. Recommend: either amend the PRD properly (archive + strikethrough per `CLAUDE.md` policy) to reflect 29 as the intentional final count, or treat 29 as a Phase 1 placeholder and expand toward full College Board coverage before Phase 3 (score prediction granularity depends on this).

## Not started (correctly — later phases, not a problem)

Diagnostic flow (F1), nightly behavior-signals cron (F4), error journal + reflection (F5), coach-memory refresh (F6), monthly test entry (F7), weekly report cron (F8), question-gen blind-solve validation pipeline (F9 — prompt exists, no pipeline), parent dashboard (F10), PWA manifest/service worker (`public/` doesn't exist yet), Supabase scheduled backups (`supabase/BACKUPS.md` is a spec doc, not a confirmed-enabled backup — should be verified in the Supabase dashboard, not just documented).

## Actual state vs. Charter phase gates

Phase 1 acceptance criteria ("basic practice loop" reachable, attempt logging with confidence + error-type capture) is **not met** — no route wires the assembler to a UI, no auth flow exists, and error-type capture is truncated to 2 of 6 types. Phase 1 should be considered incomplete, not done, despite the schema/seed/AI-chokepoint work (which *is* solid).

## Recommended next action

Before touching Phase 2's BKT/FSRS math, 
close the Phase 1 gap: 
(1) auth bootstrap (`/login` + session handling), 
(2) wire `assemblePracticeSession` + real question rendering into a working `/session` route, 
(3) fix `useMissLoop` to log the full attempt shape (all 6 error types, confidence, hints_used, skill_id, was_retry).

Only then is "Phase 1 done" true, and Phase 2 (BKT/FSRS in a new `lib/mastery/`) can build on a system that's actually exercised end-to-end.

## Addendum (2026-07-10, same session) — proposed implementation plan for the 3 gap items

Reviewed against PRD v1.2 (`00 SYSTEM/docs/PRD v1-2.md`) before drafting. Not yet executed — pending user go-ahead. Recorded here so the plan survives even if `AGENT_HANDOFF.md` is rewritten before execution starts.

**1. Auth bootstrap**
- `middleware.ts` at repo root (outside `lib/`, so it may import `next`) using `@supabase/ssr`'s `createServerClient` with cookie adapters — refreshes the session on every request, redirects unauthenticated requests to `/login` (excluding `/login` and static assets).
- `app/login/page.tsx` — not in a route group, per PRD folder layout (`app/login/` is pre-auth, ungrouped). Client component: email/password form via the existing `getSupabaseClient()` in `lib/db`, calling `supabase.auth.signInWithPassword`, redirect to `/` on success. No signup flow (PRD: student account created manually in the Supabase dashboard).
- Add a logout action (button in layout) calling `supabase.auth.signOut()`.
- Route-group reorg (`(student)/(parent)/(admin)`, PRD v1.2 folder layout) is treated as a separate, later item — not folded into this gap-closure unless the user asks for it now. `app/page.tsx` and the new `app/session/` stay top-level for the moment.

**2. `/session` route**
- `app/session/page.tsx` (server component): reads the authenticated user from the middleware-refreshed session, calls `lib/sessions/assemblePracticeSession`, passes the plan to a client runner.
- `components/session/SessionRunner.tsx` (new client component): renders one question at a time (stem/choices), mandatory one-tap confidence pick on **every** submit (PRD F2 — not just misses), calls `lib/db.logAttempt` for the initial attempt (`is_correct`, `confidence`, `hints_used: 0`, `was_retry: false`, `skill_id`, `session_id`, `question_id`). Wrong answer hands off to `MissLoop`. On completion, calls `endPracticeSession`.
- `MissLoop.tsx`'s current 3-phase scaffold stays as-is — tiered-hint AI calls and the full retry→explanation→variant sequence are explicitly Phase 2 per the PRD's own phase gate (F3), not part of this Phase 1 gap-closure.

**3. Fix `useMissLoop.ts`**
- Redesign the insert around the real `attempts` shape instead of the current 2-value hardcode (`concept`/`timing` only). Decision: retry submissions log a **second** `attempts` row (`was_retry: true`) rather than mutating the first — matches PRD F3.2's "retry correct → partial mastery credit, `was_retry=true`" phrasing, which implies a distinct row per submission, and keeps Phase 2's BKT/FSRS math (which reads per-attempt rows) clean.
- Add the one-tap 6-way error-type self-tag UI to `MissLoop.tsx` (concept/calculation/misread/careless/timing/guess) per F3.4, replacing the current `CONTENT_GAP`/`STRATEGY_GAP`-only heuristic value. `classifyFailure()` stays as the string-heuristic placeholder — Haiku cross-classification + Zod-validated fallback is Phase 2 (F3.4 / AI integration rules v1.2), out of scope here.
- Wire `confidence`, `hints_used`, `skill_id`, `question_id`, `session_id` through so all 6 `error_type` values and every `attempts` column are actually reachable, not just 2 of 6.

Two decisions made unilaterally, flagged here rather than asked, per working-rules ("only ask when genuinely irreversible or changes scope"): (a) route-group reorg deferred to Phase 3/4 UI work rather than bundled now; (b) one `attempts` row per submission (original + each retry) rather than one row mutated in place.

Status: plan proposed to user 2026-07-10, awaiting go-ahead to execute.
