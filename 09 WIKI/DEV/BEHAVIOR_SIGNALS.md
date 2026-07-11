---
title: Behavior Signals — Nightly Cron
type: wiki
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-11
updated: 2026-07-11
source_of_truth: false
related: ["PRD v1-2.md", "CLAUDE.md", "DEV/MASTERY_ENGINE.md", "DEV/SESSION_ASSEMBLER.md"]
---

# Behavior Signals — Nightly Cron

Explains PRD F4's nightly job: `app/api/cron/behavior-signals/route.ts` ->
`lib/scoring/nightly.ts` -> `lib/scoring/behavior-signals.ts` +
`lib/mastery`'s `refreshMasteryDecayForUser`. Canonical spec is
`00 SYSTEM/docs/PRD v1-2.md` F4 — this page explains, it doesn't redefine.

## What it's for

Three places in the app previously read a live-computed proxy in place of
the real `behavior_signals` table (schema shipped in Phase 1, never
populated until this session): the dashboard's readiness panel, the
session assembler's time budget, and — deliberately not — the diagnostic.
This job is what actually populates that table, nightly, for every user
with recent activity.

## File map

| File | Role |
|---|---|
| `app/api/cron/behavior-signals/route.ts` | Thin Vercel Cron target. Authenticates via `CRON_SECRET`, calls the orchestrator, returns its result JSON. No business logic lives here. |
| `lib/scoring/nightly.ts` | Orchestrator: finds active users, fetches their attempts/sessions via `lib/db`, calls the pure computation, upserts `behavior_signals`, calls `refreshMasteryDecayForUser`. Degrades per-user (one failure doesn't abort the run). |
| `lib/scoring/behavior-signals.ts` | Pure math: the six `behavior_signals` fields, computed from attempts+sessions arrays. No I/O — mirrors `lib/mastery`'s `bkt.ts`/`fsrs.ts` split. |
| `lib/mastery/fsrs.ts`'s `applyForgettingDecay` | Pure math: FSRS-style retrievability decay for skills overdue on review. |
| `lib/mastery/index.ts`'s `refreshMasteryDecayForUser` | Orchestration: applies the above to every mastery row for one user. |

## Authentication (why this route is different)

Every other route in this app derives identity from the Supabase auth
session (schema invariant #5: "no hardcoded user ID anywhere"). This route
can't — Vercel Cron hits it unattended, with no logged-in student behind
the request — so it's the **one deliberate exception**: it checks a
`CRON_SECRET` bearer token instead, and uses `getSupabaseServiceRoleClient()`
to read/write across every user by design. `vercel.json`'s `crons` array
schedules it at `0 7 * * *` (7am UTC nightly); Vercel auto-attaches
`Authorization: Bearer $CRON_SECRET` to its own invocations once that env
var exists on the project.

## The six signals (`lib/scoring/behavior-signals.ts`)

All six read attempts/sessions from a 30-day lookback window
(`LOOKBACK_DAYS` in `nightly.ts`) — wide enough for real sample sizes
without unbounded query growth. Below a per-signal minimum sample count,
the signal reports `null` rather than a noisy number (readers already treat
`null` as "not enough data yet," same as before the cron existed).

- **`avg_pace_by_difficulty`** — mean `time_spent_seconds` per question
  difficulty (1/2/3), from attempts joined with their question's
  difficulty (`lib/db`'s `fetchAttemptsSince`).
- **`avg_focus_minutes`** — mean duration of completed sessions in the
  window.
- **`fatigue_minute`** — first session-minute where accuracy drops >=20
  points below the first-5-minutes baseline (needs >=3 samples in that
  minute bucket, and >=5 samples in the baseline window, or it's `null`).
  Computed together with `avg_focus_minutes` in `computeFocusAndFatigue`
  since both need the same per-session minute-of-session bucketing.
- **`time_of_day_performance`** — accuracy + pace bucketed by local hour
  (0-23), each hour requiring >=3 samples.
- **`post_miss_accuracy`** — accuracy on attempts following >=2 consecutive
  misses within the same session (mirrors the miss loop's own
  confidence-builder threshold), needs >=5 qualifying samples.
- **`calibration_score`** — fraction of confidence-tagged attempts where
  confidence lines up with correctness (same rule the dashboard used
  provisionally, now the canonical source), needs >=5 tagged attempts.

## Forgetting decay — "refresh next_review across all skills"

PRD F4's nightly clause is more than a no-op: `updateMasteryOnAttempt`
(the per-attempt path) only ever runs when the student actually answers
something, so it has no way to represent memory decay from the passage of
time when a scheduled review is simply skipped. `applyForgettingDecay`
fills that gap — for any mastery row overdue by more than 1 day, it applies
a standard FSRS retrievability formula (`R = (1 + t/(9*S))^-1`, t = days
since last practiced, S = current stability), blends `p_mastery` toward a
lower value by the lost retrievability (not a straight multiply — a full
retrievability loss shouldn't erase confidence in one missed night), shrinks
`stability` by the same factor, and reschedules `next_review` from **now**
(not the missed date), so a skipped review doesn't compound into
ever-further overdue drift. Rows that are still on schedule are left
untouched entirely.

## Where the three provisional stand-ins landed

- **`lib/mastery/dashboard.ts`** (readiness panel) — Timing & Pace and
  Calibration now read `fetchBehaviorSignals` first; falls back to the
  original live `attempts`-based computation when no row exists yet.
  Consistency has no `behavior_signals` field and is always live.
- **`lib/sessions/index.ts`**'s `estimateSessionBudget` — reads
  `avg_pace_by_difficulty` + `min(avg_focus_minutes, fatigue_minute)` first;
  falls back to the original live proxy otherwise. `SessionBudget.isProvisional`
  now varies (`false` when backed by a real signal row) instead of always `true`.
- **`lib/sessions/diagnostic.ts`** — deliberately **not** wired to
  `behavior_signals`. The diagnostic is a student's first-ever session by
  definition; the nightly job only produces a signal row for users with
  prior `sessions` activity, so at diagnostic time it cannot exist yet.
  Flagged in a doc comment rather than silently left alone.

## Known limitations (by design, not oversight)

- Fatigue/calibration/post-miss thresholds (20-point drop, 2-miss streak,
  minimum sample counts) are first-pass heuristics, same standing caveat as
  the BKT/FSRS constants — no real attempt history yet to tune against.
- The route always returns `200` with a per-user error list rather than
  `500` on partial failure, since the job already degrades per-user
  internally — a route-level `500` would misleadingly read as total failure
  to Vercel's cron monitoring.
- `CRON_SECRET` must be set in both `.env.local` and Vercel project env
  vars for the route to ever return anything but `401`.
