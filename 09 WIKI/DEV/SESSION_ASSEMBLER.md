---
title: Adaptive Session Assembler
type: wiki
version: 1.1
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-11
updated: 2026-07-11
source_of_truth: false
related: ["PRD v1-2.md", "CLAUDE.md", "DEV/MASTERY_ENGINE.md"]
---

# Adaptive Session Assembler

Explains what `lib/sessions/index.ts`'s `assemblePracticeSession` does and
why, written against the actual code introduced in the 2026-07-11 session.
Canonical spec lives in `00 SYSTEM/docs/PRD v1-2.md` F2 — this page
explains, it doesn't redefine.

## What it's for

When a student starts a practice session, something has to decide *which*
questions to serve, in what order. Phase 1 did this with simple round-robin
selection across skills. Phase 2 replaces that with PRD F2's three-tier
priority, now that real `mastery` rows exist to read (via
`DEV/MASTERY_ENGINE.md`'s `fetchMasteryMap`).

## Selection priority (PRD F2)

1. **Spaced repetition due** — skills where `mastery.next_review <= now`
   sort before skills that aren't due yet.
2. **Vulnerability gap** — within each due/not-due bucket, skills sort by
   `p_mastery × weight` ascending (lowest first) — the PRD's own
   point-leverage formula, so the weakest, highest-value skills surface
   first.
3. **Calibration sweet spot** — within a skill, the question whose
   difficulty is closest to producing a ~75% expected success rate is
   picked first, via a small model consistent with `lib/mastery/bkt.ts`'s
   difficulty normalization: at "neutral" difficulty (2 of 3), expected
   success equals `p_mastery` directly; easier/harder questions shift it
   up/down from there.

The assembler walks the priority-ordered skill list in passes — one
best-match question per skill per pass — until the target question count
is filled or every skill's question pool is exhausted. If the weighted
selection still can't fill the session (e.g. a sparse question bank for
this skill mix), it tops up from any validated question via `lib/db`'s
`fetchValidatedQuestions`.

## Cold-start fallback

A skill with no `mastery` row yet (student has never attempted it) is
treated as `p_mastery = 0.15` and `next_review = new Date(0)` (the Unix
epoch) — always "due", so brand-new skills surface early rather than being
starved by skills that already have practice history. This mirrors the
PRD's explicit cold-start rule.

## Invariants respected

- Mastery data is read exclusively through `lib/mastery`'s
  `fetchMasteryMap` — `lib/sessions` never queries the `mastery` table
  directly.
- All other question/skill reads go through `lib/db` (`fetchSkills`,
  `fetchQuestionsBySkill`, `fetchValidatedQuestions`) — no raw
  `supabase.from(...)` calls live in `lib/sessions` anymore (the Phase 1
  version had one, for the fallback pool; that's now `fetchValidatedQuestions`
  in `lib/db`).
- `lib/sessions/index.ts` still imports nothing from `app/`, `next`, or
  `react`.

## Time-budgeted planning (added 2026-07-11, second session)

`assemblePracticeSession`'s question count is no longer a flat default —
`estimateSessionBudget` (also in `lib/sessions/index.ts`) supplies it when
the caller doesn't pass one explicitly:

- **`avgSecondsPerQuestion`** — mean `time_spent_seconds` across the
  student's recent `attempts` (default 90s with no history, matching
  `dashboard.ts`'s "On Track" pace threshold).
- **`plannedMinutes`** — mean duration of recent completed `sessions`,
  clamped 20–60 min, defaulting to PRD F2's own "~40 min" example with no
  history yet.
- **`targetQuestionCount`** — `plannedMinutes * 60 / avgSecondsPerQuestion`,
  clamped to PRD F2's stated 15–25 range.

This is a **provisional stand-in** for `behavior_signals.avg_focus_minutes`
/ `fatigue_minute` — that table and its nightly cron don't exist yet (see
`AGENT_HANDOFF.md`). Same pattern `lib/mastery/dashboard.ts` already uses
for its readiness panel: compute live from `lib/db` reads, mark it
provisional in a doc comment, swap for a real `behavior_signals` read once
the cron ships. `plannedMinutes` only proxies the "typical session length"
half of that pair — there's no per-minute accuracy curve yet to locate a
real `fatigue_minute` drop-off point, so this isn't fatigue *detection*,
just a length proxy.

## Session composition (added 2026-07-11, second session)

Each selected item now carries a `category`: `'review'` (skill was due),
`'priority'` (top half of the remaining non-due skills by vulnerability
gap), or `'mixed'` (the rest). This reuses the exact ranking already
computed for selection — no separate budgeting pass — so composition can
never drift from what was actually picked. `PracticeSessionPlan` returns
`plannedMinutes` and a `composition: CompositionBucket[]` breakdown (each
bucket has a human label and count) that `SessionRunner` renders as a
"Today's plan" banner on question 1.

**Interpretation note:** PRD F2's illustrative "~40 min: 15 review / 12
functions / 8 inference / 5 mixed" names specific skill domains
("functions", "inference") from one example session, not a generic
category set the seeded taxonomy actually has (10 Math / 10 RW / 9
Strategy leaf skills, different domain names). The three structural
categories above reproduce the PRD's intent — a labeled, time-budgeted
breakdown — using real domain/skill names for the `priority` bucket's
label instead of inventing a fixed four-category taxonomy the schema
doesn't support. See the 2026-07-11 00:44 session log for the full
decision note.

## Confidence-builder after 2 consecutive misses (added 2026-07-11, second session)

`assemblePracticeSession` also returns a `confidenceBuilderPool`: up to 2
questions from the student's highest-mastery skills (`p_mastery >= 0.75`),
easiest validated question per skill, held out of `items`. This is
computed once at assembly time (same DB pass as everything else), but
*when* one gets used is a runtime decision — `SessionRunner.tsx` tracks
consecutive misses (an initial wrong answer, i.e. the miss loop
triggering) via a ref; on the 2nd consecutive miss it splices the next
pooled question into its local `queue` state right after the current
index, then resets the counter. A brand-new student with no mastery
history yet simply has an empty pool — no confidence-builder fires, which
is the correct degrade, not a bug.

## Known limitations (by design, not oversight)

- The difficulty <-> expected-success model (`DIFFICULTY_SPREAD = 0.6`) is
  a first-pass heuristic consistent with the BKT model's assumptions, not
  empirically calibrated — there's no attempt history yet to tune against.
- `plannedMinutes`/`targetQuestionCount` are a provisional proxy, not a
  real `behavior_signals` read — see "Time-budgeted planning" above.
  Nightly `behavior_signals` cron is still not built.
- Diagnostic flow (F1) doesn't call `assemblePracticeSession` yet — only
  `'practice'` sessions are wired through `/session`.
