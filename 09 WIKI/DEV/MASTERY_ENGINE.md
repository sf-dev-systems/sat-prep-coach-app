---
title: Mastery Engine (BKT + FSRS)
type: wiki
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["PRD v1-2.md", "CLAUDE.md", "00 SYSTEM/SESSION_LOG/2026-07-10_2245_phase2-mastery-engine-dashboard-wiring.md", "DEV/SESSION_ASSEMBLER.md"]
---

# Mastery Engine (BKT + FSRS)

Explains what `lib/mastery/` does and why, written against the actual code
introduced in the 2026-07-10 22:45 session (commit `759e9a1`). Canonical
spec lives in `00 SYSTEM/docs/PRD v1-2.md` F4 — this page explains, it
doesn't redefine.

## What it's for

Every time the student answers a question (initial submission or a
miss-loop retry), two numbers on her `mastery` row need to move:

- **`p_mastery`** (0..1) — how well she knows this skill right now.
- **`stability`** (days) — how long that knowledge is expected to hold
  before it needs review, which drives `next_review`.

`lib/mastery/` is the one place that math happens.

## File map

| File | Role |
|---|---|
| `lib/mastery/bkt.ts` | Pure function: updates `p_mastery` from one attempt outcome. No I/O. |
| `lib/mastery/fsrs.ts` | Pure function: updates `stability`/`next_review` from one attempt outcome. No I/O. |
| `lib/mastery/index.ts` | Orchestration: `updateMasteryOnAttempt` reads the current row (via `lib/db`), runs the math, upserts the result. Also `initializeMasteryRows` (bulk-init, for the future diagnostic flow) and `fetchMasteryMap`. |
| `lib/mastery/dashboard.ts` | Reads mastery + skills + sessions + attempts and turns them into the dashboard's predicted score, readiness panel, and focus-skill list. |

`lib/mastery` never queries Supabase directly — all raw `mastery`/
`sessions`/`attempts` reads and writes go through `lib/db` (`fetchMasteryRow`,
`upsertMasteryRow`, `fetchRecentSessions`, `fetchRecentAttempts`, etc.),
per the "DB access only via lib/db" invariant in `CLAUDE.md`.

## How the BKT update works (`bkt.ts`)

- **Correct answer:** `p_mastery += (1 - p_mastery) * learn_rate`. The
  learn rate scales *down* when the question was easy relative to her
  current mastery (getting an easy question right proves less than
  getting a hard one right), and scales down further on a retry based on
  how many hints she used — fewer hints, more credit, per PRD F3.2.
- **Wrong answer:** `p_mastery *= (1 - slip_penalty)`. The penalty scales
  *down* for harder questions (missing a hard question is less surprising
  than missing an easy one) and down further for careless/misread errors
  vs. concept errors, per PRD F3.5.
- Result is clamped to `[0.02, 0.98]` so mastery never fully saturates or
  floors — there's always room to move either direction.

## How the FSRS-style update works (`fsrs.ts`)

Explicitly *FSRS-style*, not a full FSRS port (the PRD's own wording) —
correct answers extend `stability` (more for harder questions, with
diminishing returns as stability grows so it doesn't run away on long
streaks); misses shrink it (less for harder questions). `next_review` is
just `now + stability days`.

## Where it's called from

`components/session/useMissLoop.ts`'s `logAttemptRow` calls
`updateMasteryOnAttempt` right after writing the `attempts` row — for
both the initial question submission and the miss-loop retry
(`SessionRunner.tsx` passes `question.difficulty` through for this).
Skipped only when a question has no `skill_id`.

## What still reads from it

`app/page.tsx` (student dashboard) via `lib/mastery/dashboard.ts`'s
`computeDashboardData` — predicted score, readiness panel's "Content
Mastery" figure, and the top-3 focus-skill gap list.

`lib/sessions/index.ts`'s adaptive session assembler now reads this map
too (via `fetchMasteryMap`) to select and order questions per PRD F2 —
see `DEV/SESSION_ASSEMBLER.md` for how.

## Known limitations (by design, not oversight)

- BKT/FSRS constants (learn rate, slip penalty, retry-credit table,
  error-type multipliers, stability growth/decay) are first-pass defaults
  grounded in the PRD's qualitative rules — not empirically tuned. There's
  no attempt history yet to tune against at n=1.
- The dashboard's readiness panel computes Timing/Consistency/Calibration
  live from `attempts`/`sessions` as a stand-in for the nightly
  `behavior_signals` cron (also PRD F4), which doesn't exist yet.
- Predicted score is a plain linear 400-1600 map with no correction
  factor — F7's monthly-test recalibration against `practice_tests`
  doesn't exist until a later phase.
