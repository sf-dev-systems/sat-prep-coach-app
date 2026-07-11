---
title: Diagnostic Flow
type: wiki
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-11
updated: 2026-07-11
source_of_truth: false
related: ["PRD v1-2.md", "CLAUDE.md", "DEV/SESSION_ASSEMBLER.md", "DEV/MASTERY_ENGINE.md"]
---

# Diagnostic Flow

Explains `/diagnostic` — PRD F1's first-run diagnostic. Canonical spec is
`00 SYSTEM/docs/PRD v1-2.md` F1; this page explains the implementation
built in the 2026-07-11 (late) session, it doesn't redefine the spec.

## What it's for

A brand-new student has no `mastery` rows, so `assemblePracticeSession`
(the day-to-day PRD F2 assembler) has nothing to rank against. The
diagnostic is a separate, one-time flow: ~40 questions across every
section, section-adaptive (second half of each section's difficulty
responds to how the student did on that section's first half), that ends
by seeding every `mastery` row so the dashboard and F2 assembler have real
data from that point on.

## Why a separate module (`lib/sessions/diagnostic.ts`)

`assemblePracticeSession` (`lib/sessions/index.ts`) is single-pass: it
assembles the whole session up front from existing mastery data. The
diagnostic can't work that way — a section's second half literally can't
be selected until that section's first half has been answered, because its
difficulty depends on that performance. Rather than bolt a
two-phase/stateful concept onto the practice assembler, diagnostic
assembly lives in its own module with two entry points:

- **`assembleDiagnosticFirstHalves(supabase, userId, totalQuestionCount = 40)`**
  — server-side, called once from `app/diagnostic/page.tsx` (same pattern
  as `app/session/page.tsx`). Creates the `sessions` row and the first half
  of every section.
- **`assembleDiagnosticSecondHalf(supabase, section, count, accuracy, excludeQuestionIds)`**
  — called **client-side** by `DiagnosticRunner` between sections, using
  the browser Supabase client. It only reads the shared `skills`/`questions`
  content tables, which are authenticated-read-only for every user (schema
  invariant #4) — no new API route or Server Action was needed, mirroring
  the existing pattern where `useMissLoop` already performs `attempts`/
  `mastery` writes directly from the client under RLS.

## Section allocation

`totalQuestionCount` (default 40) is split across sections **proportional
to each section's leaf-skill count**, read live via `fetchSkills` — never
hardcoded, so it self-adjusts if the seeded taxonomy changes (see
AGENT_HANDOFF's noted PRD-prose-vs-seed taxonomy count discrepancy). Any
rounding remainder is assigned to the largest section so allocations always
sum to exactly `totalQuestionCount`. Within a section, `firstHalfCount =
ceil(count / 2)`.

## Difficulty selection

- **First half:** always difficulty 2 ("neutral", 1..3 scale) — there's no
  prior data yet to condition on.
- **Second half:** `difficultyForAccuracy(accuracy)` — accuracy computed
  from that section's first-half attempts, entirely client-side (the
  runner already has this from the attempts it just logged, so no extra DB
  round-trip): `>= 0.7 -> 3`, `>= 0.4 -> 2`, else `1`. First-pass heuristic,
  consistent with this project's standing caveat that difficulty<->success
  calibration constants aren't empirically tuned yet.
- Within a section, question selection round-robins across that section's
  leaf skills, picking the closest-available difficulty per skill per pass
  (`selectSectionQuestions`, shared by both halves so they can't drift),
  falling back to any validated question in-section if the bank is sparse.

## Runner state machine (`components/diagnostic/DiagnosticRunner.tsx`)

Reuses `MissLoop`/`useMissLoop` unchanged — same `attempts` row shape, same
BKT/FSRS mastery update path as the practice session. What's diagnostic-
specific is the section/half bookkeeping:

1. Walk the current section's first-half queue.
2. On queue exhaustion: if the section has a planned second half, fetch it
   (`assembleDiagnosticSecondHalf`) using that section's running accuracy,
   append to the queue, keep going.
3. On queue exhaustion with no second half left to fetch: advance to the
   next section (skipping any with a zero allocation), or finish.
4. **Sparse-bank self-heal:** if a section's first half assembles to zero
   items despite a nonzero planned allocation, nothing gets submitted, so
   the normal submit-triggered advance never fires. A `useEffect` watches
   for `current` being `undefined` outside the finished/loading states and
   runs the same exhaustion logic directly, so the runner can't strand
   itself on the loading screen.

## Completion (PRD F1)

On the last item of the last section: `endPracticeSession`, then
`initializeMasteryRows(supabase, user.id, leafSkillIds)` (PRD F1: "On
completion: initialize every mastery row") — identity from the active
client session via `supabase.auth.getUser()`, never hardcoded. The
completion screen links to `/`, which now has real mastery data and shows
a real predicted score + focus skills instead of the "no data yet" state.

**Exiting early** (PRD F3.6's persistent Exit Session control, same as the
practice runner) ends the session as-is but does **not** call
`initializeMasteryRows` — the PRD specifies that step on *completion*, not
on partial progress.

## What this deliberately does not build

- **`/mastery` goal-tree view.** PRD F1 says the diagnostic result screen
  shows "the goal tree seeded from the results" — but the goal-tree view
  itself is explicitly `Phase 3 — Visibility` in the PRD's build-phase
  gate. Building it now would be scope creep into a later phase. The
  diagnostic completion screen links to the existing dashboard (`/`)
  instead, which already surfaces baseline predicted score + top focus
  skills (see below) with real data once mastery rows exist.
- A dedicated "top-5 gap list" view. `lib/mastery/dashboard.ts`'s existing
  "Top Focus Skills" card (used day-to-day for F2 too) had its slice raised
  from top-3 to top-5 to satisfy PRD F1's "top-5 gap list" language,
  rather than forking a diagnostic-only screen.

## Known limitations (by design, not oversight)

- Difficulty band thresholds (`difficultyForAccuracy`) are a first-pass
  heuristic, same caveat as the practice assembler's calibration model.
- No `behavior_signals`-based pacing/fatigue cap during the diagnostic —
  that table/cron still doesn't exist (same standing gap noted in
  `DEV/SESSION_ASSEMBLER.md`).
