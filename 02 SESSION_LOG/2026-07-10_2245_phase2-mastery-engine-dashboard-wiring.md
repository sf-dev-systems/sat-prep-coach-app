---
title: "Session Log — Phase 2 Start: Mastery Engine + Dashboard Wiring"
type: session-log-entry
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["AGENT_HANDOFF.md", "CLAUDE.md", "00 SYSTEM/docs/PRD v1-2.md"]
---

# Session Log — 2026-07-10 22:45

**Agent:** Claude (Sonnet)
**Task:** Start Phase 2 per PRD F4 — scaffold `lib/mastery/` (BKT + FSRS
mastery updates) and wire `app/page.tsx`'s dashboard off the Phase 1
hardcoded mock onto real Supabase data.

## COMPLETED

1. **`lib/mastery/bkt.ts`** — pure BKT update for `mastery.p_mastery`.
   Correct answers: `p += (1-p) * learn_rate`, learn rate scaled down when
   the question is easy relative to current mastery, and scaled further by
   a retry-credit factor (fewer hints used -> more credit, per PRD F3.2).
   Incorrect answers: `p *= (1 - slip_penalty)`, penalty scaled by
   difficulty (missing a hard question penalizes less than missing an easy
   one) and by `error_type` (careless/misread penalized less than concept,
   per PRD F3.5). No I/O — pure functions, unit-testable in isolation.
2. **`lib/mastery/fsrs.ts`** — FSRS-*style* (PRD's own wording, not a full
   FSRS port) update to `stability`/`next_review`. Correct answers extend
   stability (more for harder questions, with diminishing-returns damping
   as stability grows); misses shrink it (less for harder questions).
3. **`lib/mastery/index.ts`** — orchestration layer: `updateMasteryOnAttempt`
   (the per-attempt hook called from the miss loop), `initializeMasteryRows`
   (idempotent bulk-init for the future diagnostic flow, F1 — not wired to
   a route yet, exported for whoever builds F1 next), `fetchMasteryMap`.
   Routes all raw table access through new `lib/db` functions
   (`fetchMasteryRow`, `fetchMasteryRows`, `upsertMasteryRow`,
   `upsertMasteryRowsIgnoringDuplicates`, `fetchRecentSessions`,
   `fetchRecentAttempts`) rather than querying Supabase directly, per the
   "DB access only via lib/db" working convention — kept `lib/mastery`
   itself free of any raw `.from(...)` calls.
4. **Wired attempt logging to mastery** — `components/session/useMissLoop.ts`
   now calls `updateMasteryOnAttempt` right after every `logAttempt` (both
   the initial submission and the miss-loop retry), skipping only when a
   question has no `skill_id`. `SessionRunner.tsx` now passes
   `question.difficulty` through `LogAttemptParams` so the BKT/FSRS math
   has what it needs. This makes every attempt row's mastery consequence
   automatic — no separate cron or batch job needed for this part of F4
   (the nightly `behavior_signals` recompute is a separate, still-unbuilt
   piece of F4, not touched this session).
5. **`lib/mastery/dashboard.ts`** — `computeDashboardData(supabase, userId)`
   replaces the dashboard's hardcoded mock: predicted score from
   `Σ p_mastery × weight` (existing `lib/scoring/predictive-score.ts`
   `calculateBaseMastery`, unchanged) linearly mapped 400-1600 (no
   `practice_tests`-anchored correction factor yet — F7's monthly-test
   recalibration doesn't exist until a later phase, documented inline so
   it isn't silently assumed handled); confidence band that narrows as
   attempts accumulate; top-3 focus skills by point-leverage gap
   (`weight * (1 - p_mastery)`); and a readiness panel whose Timing/
   Consistency/Calibration figures are computed directly from `attempts`/
   `sessions` as a **provisional stand-in** for the not-yet-built nightly
   `behavior_signals` cron (also PRD F4, also not touched this session —
   flagged inline as a follow-up, not hidden).
6. **`app/page.tsx`** converted from a static client component to an async
   Server Component (same pattern as `app/session/page.tsx`): reads the
   authenticated user via `getSupabaseServerClient`, redirects to `/login`
   if absent (belt-and-suspenders behind middleware), calls
   `computeDashboardData`, and renders an empty state ("no mastery data
   yet — go start a session") when the student hasn't attempted anything.
   Also fixed the header to greet `profiles.display_name` (falls back to
   "there") instead of the hardcoded parent name "Sienna" — the
   authenticated account here is the student's, not the parent's.
7. **Environment note for future sessions:** this sandbox's bash mount of
   the repo was observed running several hours stale mid-session (`stat`
   showed file mtimes ~5 hours behind the wall clock, and `tsc`/`wc -l`
   run through bash reflected pre-edit file contents even seconds after
   edits were written). Confirmed via the file-read tool (authoritative,
   not mount-dependent) that every edit this session is correct and
   complete — JSX balance and brace/paren structure were manually verified
   by re-reading full file contents rather than via `tsc --noEmit`/
   `npm run build`, since neither could be trusted to reflect current
   state in this sandbox. **A real `npm run build` / `tsc --noEmit` still
   needs to run once against a fresh, in-sync checkout** before this is
   considered fully build-verified — flagging rather than silently
   claiming a build pass that didn't actually happen.

## DECISIONS

- BKT/FSRS constants (learn rate, slip penalty, retry-credit table,
  error-type multipliers, stability growth/decay) are first-pass
  reasonable defaults grounded in the PRD's qualitative rules, not
  empirically tuned — there's no attempt history yet to tune against at
  n=1. Revisit once real attempt data exists.
- Dashboard's predicted-score curve is a plain linear 400-1600 map with no
  correction factor, since no `practice_tests` rows can exist until F7
  ships. Readiness's Timing/Consistency/Calibration are computed live from
  `attempts`/`sessions` rather than waiting on the `behavior_signals`
  cron — explicitly a provisional stand-in, not a replacement; swap to a
  `behavior_signals` read once that cron exists.
- `initializeMasteryRows` is exported but not called from anywhere yet —
  it belongs to F1 (diagnostic flow), which is still open. Not scope creep
  to build the function now since Phase 2's own scope list includes
  "diagnostic flow"; the route/UI for F1 itself is the next piece, not
  built this session.

## OPEN ITEMS (carried forward, not blocking)

- F1 diagnostic flow (route + UI) — not built.
- Adaptive session assembler upgrade (`lib/sessions`) to actually use
  `mastery.next_review`/`p_mastery` for selection priority — `lib/sessions`
  still does Phase 1's simple selection; now that real mastery rows exist,
  this is the natural next Phase 2 piece.
- Nightly `behavior_signals` cron — not built; dashboard's readiness panel
  is a stand-in per above.
- A real `npm run build`/`tsc --noEmit` pass in a freshly-synced
  environment (see COMPLETED #7).
- Carryovers from the prior session's handoff (GitHub Actions secrets,
  Next.js CVE patch, taxonomy-count PRD-prose correction) remain
  untouched and still open.

## SIGN-OFF

Claude (Sonnet) — 7/10/26 10:45 PM
