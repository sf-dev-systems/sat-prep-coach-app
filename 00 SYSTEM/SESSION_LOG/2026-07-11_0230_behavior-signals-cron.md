---
title: Session Log — 2026-07-11 02:30
type: session-log
owner: Sienna (Oni Technologies LLC)
---

# Session — 2026-07-11 02:30 (Claude, Sonnet)

## COMPLETED

Built PRD F4's nightly `behavior_signals` cron — the last piece of Phase 2
infrastructure with no real implementation, per the prior session's handoff.

**New files:**
- `lib/scoring/behavior-signals.ts` — pure computation for all six
  `behavior_signals` fields (`avg_pace_by_difficulty`, `fatigue_minute`,
  `avg_focus_minutes`, `time_of_day_performance`, `post_miss_accuracy`,
  `calibration_score`) from attempts+sessions arrays. No I/O, mirrors
  `lib/mastery`'s `bkt.ts`/`fsrs.ts` pure-math split.
- `lib/scoring/nightly.ts` — orchestrator: finds active users (`fetchActiveUserIds`),
  fetches their 30-day attempts/sessions, computes signals, upserts
  `behavior_signals`, calls `refreshMasteryDecayForUser`. Degrades per-user
  (one failure logged and skipped, never aborts the run) — same pattern as
  F11's AI ceiling.
- `app/api/cron/behavior-signals/route.ts` — thin Vercel Cron target.
  Authenticates via `CRON_SECRET` bearer token (the one deliberate
  exception to invariant #5's session-derived-identity rule, since a cron
  has no user session), calls the orchestrator via a service-role client,
  always returns 200 with a per-user error list.
- `09 WIKI/DEV/BEHAVIOR_SIGNALS.md` — new wiki page explaining all of the above.

**Modified files:**
- `lib/db/index.ts` — added `BehaviorSignals`/`AttemptWithDifficulty`/`TimeOfDayBucket`
  interfaces and `fetchActiveUserIds`, `fetchAttemptsSince` (joins
  `questions(difficulty)`), `fetchSessionsSince`, `fetchBehaviorSignals`,
  `upsertBehaviorSignals`.
- `lib/mastery/fsrs.ts` — added `applyForgettingDecay`: FSRS-style
  retrievability decay (`R = (1+t/(9*S))^-1`) for any mastery row overdue
  by more than 1 day, blending `p_mastery` down and rescheduling
  `next_review` from *now* rather than the missed date. This is what
  actually fulfills PRD F4's "refresh next_review across all skills"
  clause — `updateMasteryOnAttempt` only ever fires on a real attempt, so
  it had no mechanism to represent decay from the passage of time alone.
- `lib/mastery/index.ts` — added `refreshMasteryDecayForUser`, applying the
  above to every mastery row for one user.
- `lib/mastery/dashboard.ts` — readiness panel's Timing & Pace and
  Calibration now read the real `behavior_signals` row first (via new
  `fetchBehaviorSignals`), falling back to the original live-computed
  proxy only when no row exists yet (degrade-never-block).
- `lib/sessions/index.ts` — `estimateSessionBudget` now reads
  `avg_pace_by_difficulty` and `min(avg_focus_minutes, fatigue_minute)`
  first; `SessionBudget.isProvisional` is `boolean` now (was a `true`
  literal) and reflects whether a real signal backed the estimate.
- `lib/sessions/diagnostic.ts` — added a doc-comment DECISION explaining
  why this module deliberately does *not* read `behavior_signals` (see
  DECISIONS below) — flagged rather than silently skipped, per this
  session's explicit instruction to decide and document it either way.
- `vercel.json` — added `crons` array scheduling the route at `0 7 * * *`.
- `.env.example` — added `CRON_SECRET`.
- `09 WIKI/DEV/SESSION_ASSEMBLER.md`, `09 WIKI/DEV/MASTERY_ENGINE.md`,
  `09 WIKI/00_INDEX.md` — updated stale "cron doesn't exist yet" language,
  cross-referenced the new `DEV/BEHAVIOR_SIGNALS.md` page.

No schema migration was needed — `behavior_signals`'s columns already
matched all six PRD F4 fields exactly (shipped in Phase 1's initial
migration, never populated until now).

## DECISIONS

1. **`lib/scoring/nightly.ts` (not `lib/sessions/`) hosts the orchestrator.**
   Flagged per this session's explicit instruction to flag this placement
   choice. Reasoning: the PRD's own folder-layout comment assigns
   "prediction, readiness, recalibration" to `lib/scoring/` and "session
   assembler, behavior-signal *rules*" to `lib/sessions/` — read as:
   `lib/sessions/index.ts` already *reads* `behavior_signals` into
   session-planning rules, so the cross-cutting nightly *recomputation* job
   belongs alongside `predictive-score.ts` in `lib/scoring/` instead. The
   route handler stays a thin wrapper, mirroring `app/session/page.tsx` /
   `app/diagnostic/page.tsx`'s relationship to `lib/sessions`.
2. **Diagnostic (`lib/sessions/diagnostic.ts`) does not read `behavior_signals`.**
   The diagnostic is a student's first-ever session by definition; the
   nightly job only produces a signal row for users with prior `sessions`
   activity, so at diagnostic time no row can exist yet. Wiring it in would
   always resolve to the fallback branch — no live pacing/fatigue decision
   for it to inform on a first run. Documented in-file rather than silently
   left alone.
3. **Forgetting decay only touches rows overdue by more than 1 day**, and
   reschedules `next_review` from *now* rather than the originally-missed
   date. Rationale: a 1-day grace avoids treating "scheduled for later
   today" as decayed; anchoring the reschedule to *now* prevents a single
   skipped review from compounding into ever-further overdue drift on
   subsequent nightly runs (each run would otherwise see the same stale
   `next_review` and keep re-decaying from it).
4. **Cron route always returns 200**, embedding per-user failures in the
   response body instead of surfacing a route-level 500. The job already
   degrades per-user internally; a 500 here would misleadingly read as
   total failure to Vercel's cron monitoring when most users likely
   succeeded.
5. **30-day lookback window** for both signal computation and the
   active-user query — wide enough to give `post_miss_accuracy` and
   `time_of_day_performance` (both need real volume) a real sample without
   querying unbounded history every night.

## OPEN ITEMS (carried over, unchanged unless noted)

- F3's tiered-hints upgrade (Haiku-generated hints/explanation/variant,
  currently still Phase-1 static hints) is now the **last** item before
  Phase 2's acceptance criteria are fully met.
- All six `behavior_signals` thresholds (20-point fatigue drop, 2-miss
  streak, minimum sample counts of 3/5) are first-pass heuristics, same
  standing caveat as the BKT/FSRS constants — no real attempt history yet
  to tune against.
- Git cleanup (untrack CB PDFs/screenshots) — not re-checked this session;
  last confirmed still outstanding as of the 01:30 session.
- Next.js major-version CVEs unpatched (`next@16.2.10` migration needed).
- Sandbox caveats unchanged from prior sessions (see AGENT_HANDOFF.md) — no
  new symptoms this session; every touched/created file was re-read via
  the Read tool immediately after writing and confirmed correct.
- **`npm run build` verification for this session's code is still
  pending — user needs to run it on their own machine**, per the standing
  instruction not to trust this sandbox's bash for build verification.

## SIGN-OFF

Claude (Sonnet) — 7/11/26 2:30 AM
