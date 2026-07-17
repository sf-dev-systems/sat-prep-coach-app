---
title: Project Charter & Proposal — AI SAT Coach
type: charter
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: true
governs: scope, version gates, LOCK/STUB/DEFER register
related: ["PRD v1", "CLAUDE.md", "raw notes sf.md"]
---

## PROJECT CHARTER & PROPOSAL: AI SAT COACH

**Working name:** sat-prep-coach-app · **Owner:** Sienna (Oni Technologies LLC) · **Date:** July 2026

---

### 1. CHARTER

**Mission.** Build an AI tutor that models a student's knowledge, memory, behavior, confidence, and test-taking strategy over time, and uses that model to drive every practice session — starting as a personal tool for one student targeting 1500+, architected to become a pilotable, sellable product without rework.

**Vision statement.** Private SAT tutoring works because a human holds a persistent model of the student and adapts every session to it. Every scaled competitor (Khan, UWorld, Bluebook) discards that model. This product makes the persistent student model the architectural center and lets AI do what previously required $150/hr of human attention.

**Success criteria by version:**

- **v1:** One student uses it 4+ days/week for 60+ days; parent monitors without asking the student; predicted score tracks within ~40 points of monthly official practice tests; measurable score improvement.
- **v2:** 5–20 pilot users onboard without founder hand-holding; per-user AI cost known to the penny; retention and outcome data collected.
- **v3:** Paying subscribers; unit economics proven (subscription price > AI + infra cost per user with margin).

**Guiding principles (apply to every version):**

1. The student model is the product. Practice is the input stream; everything reads from the model.
2. Decisions expensive to change after data exists get locked now; additive decisions get deferred.
3. Degrade, never block — cost ceilings, API failures, and missing data reduce quality, not access.
4. Evidence-based pedagogy only: retrieval practice, spaced repetition, immediate correction-by-doing, calibration training.
5. The database is code — every schema change is a migration file, forever.

**Out of scope permanently (this product):** ACT/GRE/other tests (future fork, not feature creep), essay scoring, live human tutoring marketplace, content marketplace.

**Ecosystem position.** Sits under Oni Technologies LLC. The `lib/` portable core (mastery engine, FSRS scheduler, session assembler, scoring) is designed as a liftable module for Oni_Cognitive_OS. GetItSorted content channels are a future distribution path for v3 (education audience overlap), not a dependency.

---

### 2. VERSION ROADMAP

**v1 — Personal Edition (now).** One student, one parent view. Full adaptive engine, coach memory, error taxonomy, strategy layer, weekly reports, PWA. Gate to exit v1: student completes 30 days of use and one monthly test recalibration cycle.

**v1.5 — Hardening (before any second user).** Offline session cache, error monitoring (Sentry), backup/export of student data, prompt-quality pass driven by 60 days of real error-journal data, accessibility pass.

**v2 — Pilot Edition (5–20 users, free).** Signup + onboarding flow, parent access model (decided with real parents — likely magic-link share), per-user AI budgets, admin/founder console (usage, cost, progress across users), feedback capture in-app, cohort tagging for analysis. Gate to exit: retention + outcome data supports a price point.

**v3 — Product Edition (paid).** Stripe subscriptions, plan tiers (likely: AI-call volume + parent features as the tier levers), marketing site, onboarding funnel from GetItSorted content, school/tutor B2B exploration (a tutor managing 10 students is the same schema with a `managed_by` relationship — cheap because of decisions below).

**vNext candidates (parking lot, no commitments):** ACT fork, vocabulary/flashcard module, peer leaderboards (motivation research is mixed — needs pilot evidence), voice-interactive tutoring sessions, Oni_Cognitive_OS integration.

---

### 3. THE LOCK / STUB / DEFER REGISTER

This is the heart of the document — every future capability classified by what v1 must do about it. **LOCK** = built correctly now. **STUB** = a cheap placeholder or column exists now so the future feature is additive. **DEFER** = genuinely nothing now; adding later costs the same as adding now.

#### LOCKED in v1 (already in the PRD — restated as commitments)

|#|Decision|Future version it protects|
|---|---|---|
|L1|`user_id` on all student-state tables; RLS `user_id = auth.uid()`|v2 multi-user|
|L2|Content vs. student-state table split|v2 shared question bank decision|
|L3|Composite PKs `(user_id, skill_id)` on mastery/notes|v2|
|L4|No hardcoded user ID anywhere|v2|
|L5|Single AI chokepoint (`lib/ai`) with `ai_log` per call|v2 budgets, v3 pricing|
|L6|Schema changes only via migration files|every version|
|L7|`lib/` portable core, no framework imports|Oni_Cognitive_OS, any UI rewrite|
|L8|Prompt templates as versioned files in `prompts/`|v1.5 prompt tuning, v2 A/B|
|L9|`timestamptz` everywhere|behavioral analytics at any scale|

#### STUB in v1 (new commitments — small additions to the PRD)

**S1 — Plans/entitlements stub.** Add a `profiles` table now: `(user_id pk, display_name, plan text default 'founder', ai_daily_ceiling int null, created_at)`. In v1 it holds one row. But `lib/ai` reads the ceiling from `profiles` first, env-var fallback second. This means v2 per-user budgets and v3 plan tiers are a column update, not a refactor of the AI chokepoint. Cost now: ~20 minutes.

**S2 — Feature flags stub.** A single `config` table `(key text pk, value jsonb)` read by a `lib/config` helper with in-code defaults. v1 uses it for maybe two things (daily minimum, session cap). v2/v3 use it for gradual rollouts without redeploys. Cost: ~15 minutes.

**S3 — Events table.** `events (id, user_id, event_type text, payload jsonb, created_at)`. v1 writes a handful of types (session_start, session_end, milestone_hit, report_viewed, parent_viewed). This is the retention/engagement dataset v2's pilot analysis and v3's pricing decisions depend on — and like `ai_log`, you cannot backfill events you never recorded. Cost: ~30 minutes, and it doubles as the source for streaks/motivation logic so it's nearly free.

**S4 — Parent access as a function boundary.** v1's PIN check lives in one server function: `authorizeParentView(request) → user_id | null`. All parent-dashboard queries take the returned `user_id` as a parameter. When v2 replaces PIN with magic links or parent accounts, one function changes and the entire dashboard comes along. Cost: zero — it's just how it should be written anyway.

**S5 — Question provenance + rights fields.** Add to `questions`: `license text default null`, `external_id text default null`. v1 ignores them. v3 _selling access_ to a bank containing College Board's educator questions is a licensing question you'll need to answer — these columns let you filter/segment the bank by rights status the day that matters, instead of auditing 3,000 rows by hand. Cost: 5 minutes. (Flag for v3 diligence: official questions are fine for personal/educational use; commercial redistribution terms need review before charging money.)

**S6 — Report/coach output stored, never regenerated.** Weekly reports and coach-memory snapshots are stored rows (already true in the PRD) — restated here as a rule: v2's "show a pilot parent their kid's history" and v3's "report archive" features are free because nothing is ephemeral. Also add `coach_memory` as append-only snapshots rather than a single mutated row: `(id, user_id, narrative, updated_at)` with the newest row active. History of how the AI's model of the student evolved = future product feature AND debugging tool. Cost: trivial — it's an insert instead of an update.

**S7 — Anonymized telemetry readiness.** No dashboards, no tooling — just the discipline that `attempts`, `events`, and `ai_log` never contain free-text PII in structured fields (names/emails live only in `auth.users` and `profiles`). Makes v2 cross-user analysis and any future "learning-science dataset" possible without a scrubbing project.

#### DEFERRED (explicitly zero work now — resist the urge)

|#|Capability|Why deferring costs nothing|Decided when|
|---|---|---|---|
|D1|Signup/onboarding flow|Pure UI addition|v2 start|
|D2|Parent login model|Real parents pick between link/PIN/account|v2, with pilot parents|
|D3|Stripe/billing|Entirely additive; S1 gives it the plan hook|v3|
|D4|Cohorts/orgs/roles/tutor-managed accounts|Speculative; S3 events + L1 make any shape cheap|v2 evidence|
|D5|Offline mode|Service worker addition, no schema impact|v1.5|
|D6|Per-user private question banks|Escape hatch = one column on `questions`|v2 evidence|
|D7|Prompt A/B infrastructure|L8 versioned files are the prerequisite; tooling later|v2|
|D8|Admin console across users|Query layer over tables that already exist|v2 start|
|D9|Email (reports, reminders)|Additive; reports already stored (S6)|v1.5/v2|
|D10|ACT fork / Oni integration|L7 boundary is the whole preparation|vNext|

---

### 4. RISK REGISTER

1. **Content supply/quality** (highest). Generated math questions with subtle flaws erode trust fast. Mitigation: official bank as backbone (locked decision), blind-solve validation gate, `validated` flag honored everywhere. v3 licensing review before commercialization (S5).
2. **Prediction credibility.** If predicted score visibly misses actuals, the whole motivational frame collapses. Mitigation: confidence bands, monthly recalibration, never per-session point claims.
3. **Student abandonment.** The real killer for every study app. Mitigation: fatigue-aware sessions, learning-event rewards, S3 events give early-warning signal (declining session frequency) the coach can respond to.
4. **AI cost surprise.** Mitigated: ceiling + fallback + `ai_log` (locked). Residual risk only at pilot scale — S1 handles it.
5. **Solo-builder key/infra risk.** Secrets in `.env.local` + Vercel only; service-role key never client-side; weekly `pg_dump` or Supabase scheduled backup from v1 day one (add to Phase 1).
6. **Scope creep before v1 ships.** This document is the mitigation: everything in DEFER has a named future home, so "later" is a real place, not a rejection.

---

### 5. PRD DELTAS (paste into the Claude Code PRD)

Add to schema:

sql

```sql
profiles (
  user_id uuid primary key references auth.users(id),
  display_name text,
  plan text default 'founder',
  ai_daily_ceiling int,          -- null = use env default
  created_at timestamptz default now()
);

config ( key text primary key, value jsonb );

events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  event_type text not null,
  payload jsonb,
  created_at timestamptz default now()
);
```

Rule additions:

- `questions` gains `license text`, `external_id text` (nullable, unused in v1).
- `coach_memory` is append-only; newest row per user is active.
- `lib/ai` resolves the ceiling: `profiles.ai_daily_ceiling` → `AI_DAILY_CEILING` env → 150.
- Parent authorization isolated in one function `authorizeParentView()`; all parent queries parameterized by its returned `user_id`.
- Write `events` rows for: session_start, session_end, milestone_hit, report_viewed, parent_viewed.
- No PII in structured fields outside `auth.users`/`profiles`.
- Phase 1 addition: enable Supabase scheduled backups.

---

### 6. GOVERNANCE

- **Version gates:** no version starts until the prior version's exit gate is met (§2). No v2 feature enters v1 "because we're in there anyway" — it goes to the DEFER table with a version tag.
- **Change control:** any new idea gets classified LOCK/STUB/DEFER against the same test — _expensive after data exists?_ — before any code.
- **This document + the PRD are the source of truth.** The PRD governs what Claude Code builds; the charter governs what gets built at all and when.

---

Net position: v1 remains exactly the personal app your kid needs, ships on the same timeline, and now carries seven cheap stubs (~90 minutes of total added work) that convert "rebuild for pilot" into "add UI for pilot." The multi-user schema decision you already made was the pattern — this register just applies it across every future feature so nothing else gets discovered the hard way.