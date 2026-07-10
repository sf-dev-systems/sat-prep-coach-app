---
title: PRD v1 — AI SAT Coach (Personal Edition)
type: prd
version: 1.1
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: true
governs: what to build and how (schema, flows, folder layout)
supersedes: "99 ARCHIVE/archived_docs/archive_2026-07-10_PRD v1.md (v1.0)"
related: ["Project Charter", "CLAUDE.md", "raw notes sf.md"]
changelog: "v1.1 — merged Charter §5 deltas; added GPT bucket-A/B enhancements; removed live secrets."
---

# PRD: AI SAT Coach — Personal Edition (v1)

## Environment / secrets

Secrets are **not** stored in this document. All real values live only in
`.env.local` (gitignored) and, on deploy, Vercel env vars. See `.env.example`
for the variable list. The v1.0 draft of this PRD pasted live keys here; they
have been removed and should be rotated (Anthropic console; Supabase → API →
roll `service_role`).

Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AI_DAILY_CEILING` (default 150),
`PARENT_PIN`. The service-role key and Anthropic key are server-side only —
never exposed to the client.

Supabase project: `sat-prep-coach-app` · region `us-east-1` · student auth user
created manually in the Supabase dashboard (no signup flow in v1).

---

## First instructions to the implementing agent

Read this entire PRD **and the Charter**. Then: `git init`, scaffold the project
per the folder layout, and implement **Phase 1 only**. Ask the user for `.env.local`
values before writing code that needs them (or read the existing `.env.local`).
Do not proceed to a later phase without the user's go-ahead.

## Summary

A PWA for one student preparing for the Digital SAT, targeting 1500+. Adaptive
practice driven by a per-skill mastery model (Bayesian Knowledge Tracing + FSRS
spaced review), AI tutoring via the Claude API with persistent coach memory,
per-attempt error taxonomy and confidence tracking, an SAT test-taking strategy
layer, monthly recalibration against official practice tests, AI-written weekly
reports, a long-term goal tree, and a PIN-protected read-only parent dashboard.
Single student in v1; schema is multi-user from day one.

## Learner profile (informs all AI prompts and UX)

VARK: Read/Write 13, Kinesthetic 14, Aural 9, Visual 7. Design consequences:
explanations are written prose, not video/diagram-dependent; every miss is
corrected by DOING (retry + variant), never by passive reading alone; no passive
content block longer than a paragraph before the student must act; optional TTS
toggle; charts exist for progress views but instruction never depends on a visual
alone.

## Stack (fixed — do not substitute)

- Next.js (App Router, TypeScript), Tailwind CSS
- Supabase: Postgres, Auth, RLS
- Anthropic API: `claude-sonnet-*` (tutoring, generation, reports), `claude-haiku-*` (classification)
- Recharts for charts
- PWA via manifest + service worker; deploy target Vercel
- TTS: browser Web Speech API (no external service)

## Folder layout

```
sat-prep-coach-app/
├── app/                 # Next.js routes — thin, UI only: (student), parent, admin, api
├── lib/                 # PORTABLE CORE — no next/react imports
│   ├── mastery/         # BKT updates, FSRS scheduling
│   ├── sessions/        # session assembler, behavior-signal rules
│   ├── scoring/         # prediction, readiness, recalibration
│   ├── ai/              # single Anthropic chokepoint, ceiling, ai_log
│   └── db/              # typed Supabase queries (only file importing the client)
├── prompts/             # tutor.ts, hint.ts, coach.ts, classifier.ts, generator.ts, reporter.ts
├── components/          # React UI components
├── supabase/migrations/ # all schema as migration files
├── scripts/             # seed-skills.ts, import-official-bank.ts
└── public/              # PWA manifest, icons
```

**Enforced boundary rule:** modules under `lib/` must not import from `app/`,
`components/`, `next`, or `react`. Database access only via `lib/db`. All
Anthropic calls only via `lib/ai`.

## Users

- **Student:** Supabase email/password auth, single account (created manually in the Supabase dashboard; no signup flow in v1)
- **Parent:** no account; `/parent` route behind a 4-digit PIN checked server-side against `PARENT_PIN`, isolated in one function `authorizeParentView()`

## SCHEMA INVARIANTS (LOCKED — enforce everywhere)

1. All student-state tables include `user_id uuid not null references auth.users(id)`: `attempts`, `mastery`, `sessions`, `error_journal`, `skill_notes`, `coach_memory`, `weekly_reports`, `behavior_signals`, `practice_tests`, `ai_log`, `events`, `profiles`.
2. `mastery` and `skill_notes` use composite PK `(user_id, skill_id)`.
3. RLS enabled on every owned table: policy `user_id = auth.uid()` for select/insert/update.
4. Content tables (`skills`, `questions`) are shared: authenticated read-only; writes via service role only. Generated variants live in `questions` with `source='generated'`.
5. **No user ID is ever hardcoded in application code.** All queries derive identity from the auth session.
6. All Anthropic calls route through `lib/ai` which logs every call to `ai_log` and enforces the daily ceiling.
7. All timestamps `timestamptz`; `created_at timestamptz default now()` on every table.
8. All schema changes ship as migration files in `supabase/migrations/`.
9. `coach_memory` is **append-only**: never mutated in place; the newest row per user is the active narrative.
10. No PII in structured fields outside `auth.users` / `profiles` (names/emails never land in `attempts`, `events`, `ai_log`).

## Data model

```sql
skills (
  id uuid primary key default gen_random_uuid(),
  section text check (section in ('rw','math','strategy')),
  domain text,
  name text,
  parent_skill_id uuid references skills(id),  -- goal-tree hierarchy (null = top of section)
  weight numeric              -- score-prediction weight; strategy skills = 0
);

questions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid references skills(id),
  source text check (source in ('official','generated')),
  difficulty int check (difficulty between 1 and 3),
  stem text,
  choices jsonb,              -- null = student-produced response (math grid-in)
  correct_answer text,
  rationale text,
  distractor_notes jsonb,     -- why each wrong choice is tempting
  trap_type text,
  license text default null,      -- provenance/rights (v1 unused; v3 licensing filter)
  external_id text default null,  -- source bank id (v1 unused)
  validated boolean default false,
  created_at timestamptz default now()
);

attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id uuid references questions(id),
  skill_id uuid references skills(id),
  session_id uuid references sessions(id),
  answer text,
  is_correct boolean,
  confidence text check (confidence in ('high','medium','low')),
  error_type text check (error_type in ('concept','calculation','misread','careless','timing','guess')),
  time_spent_seconds int,
  hints_used int default 0,   -- 0..3 tiered hints consumed before answering
  was_retry boolean default false,
  created_at timestamptz default now()
);

sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  started_at timestamptz,
  ended_at timestamptz,
  session_type text check (session_type in ('diagnostic','practice','review','full_test_entry')),
  questions_served int,
  questions_correct int,
  reflection text             -- optional free text, skippable
);

mastery (
  user_id uuid not null references auth.users(id),
  skill_id uuid not null references skills(id),
  p_mastery numeric default 0.3,
  stability numeric default 1.0,      -- FSRS memory stability (days)
  attempts_count int default 0,
  last_practiced timestamptz,
  next_review timestamptz,
  primary key (user_id, skill_id)
);

practice_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  taken_at date,
  total_score int, rw_score int, math_score int,
  domain_breakdown jsonb
);

error_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  skill_id uuid references skills(id),
  ai_observation text,
  student_note text,
  created_at timestamptz default now()
);

skill_notes (
  user_id uuid not null references auth.users(id),
  skill_id uuid not null references skills(id),
  content text,
  updated_at timestamptz,
  primary key (user_id, skill_id)
);

coach_memory (                -- APPEND-ONLY; newest row per user is active
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  narrative text,             -- rolling summary, max ~600 words
  updated_at timestamptz default now()
);

weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  week_of date,
  content text,
  created_at timestamptz default now()
);

behavior_signals (
  user_id uuid primary key references auth.users(id),
  computed_at timestamptz default now(),
  avg_pace_by_difficulty jsonb,
  fatigue_minute int,            -- session minute where accuracy drops off
  avg_focus_minutes int,         -- typical productive session length before decline
  time_of_day_performance jsonb, -- accuracy/pace bucketed by hour → "works best ~8pm"
  post_miss_accuracy numeric,    -- accuracy after 2+ consecutive misses
  calibration_score numeric      -- confidence vs correctness alignment
);

ai_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  call_type text,             -- hint|explanation|variant|classify|report|coach_update
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz default now()
);

-- ── Charter §5 stubs (built in Phase 1; mostly unused in v1) ──

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
  event_type text not null,      -- session_start|session_end|milestone_hit|report_viewed|parent_viewed
  payload jsonb,
  created_at timestamptz default now()
);
```

## Skill taxonomy seed (`scripts/seed-skills.ts`)

- **RW section (~18 skills)** across domains with weights: Information and Ideas 0.26, Craft and Structure 0.28, Expression of Ideas 0.20, Standard English Conventions 0.26 — decompose per College Board's published Digital SAT skill descriptors (e.g., central ideas, inferences, command of evidence textual/quantitative, words in context, text structure & purpose, cross-text connections, rhetorical synthesis, transitions, boundaries, form/structure/sense).
- **Math section (~18 skills)** across domains with weights: Algebra 0.35, Advanced Math 0.35, Problem-Solving & Data Analysis 0.15, Geometry & Trigonometry 0.15 — decompose per College Board descriptors (e.g., linear equations one/two variables, linear functions, systems, linear inequalities, nonlinear functions, equivalent expressions, nonlinear equations, ratios/rates/proportions, percentages, one/two-variable data, probability, sample statistics, area/volume, lines/angles/triangles, right triangles & trig, circles).
- **Strategy section (~8 skills, weight 0):** Desmos techniques, RW annotation method, module pacing, skip-and-flag discipline, elimination discipline, distractor pattern recognition, guessing under time pressure, grid-in mechanics. Tracked in mastery/readiness, excluded from content score prediction.
- Seed `parent_skill_id` so skills nest section → domain → skill for the goal tree.

## Core flows

**F1 — Diagnostic (first run).** ~40 questions, section-adaptive: second half of each section's difficulty conditioned on first-half performance. On completion: initialize every `mastery` row, show mastery map + baseline predicted score + top-5 gap list + the goal tree seeded from the results.

**F2 — Daily practice session.** Server assembles 15–25 questions and shows a time-budgeted plan ("~40 min: 15 review / 12 functions / 8 inference / 5 mixed"). Selection priority: (1) skills with `next_review <= now()`, (2) lowest `p_mastery × weight`, (3) difficulty targeted to ~75% expected success. Reads `behavior_signals`: cap planned session length at `avg_focus_minutes`/`fatigue_minute`; after 2 consecutive misses, insert one high-mastery confidence-builder. Question UI: stem, choices, scratchpad canvas (math), tap-to-highlight (RW passages), mandatory one-tap confidence pick (high/med/low) on submit.

**F3 — Miss loop (non-skippable; core mechanic).** On wrong answer:

1. **Tiered hints (up to 3), student-requested one at a time** — Hint 1 (nudge, ≤20 words), Hint 2 (points at the method), Hint 3 (near-walkthrough, still no answer reveal). Each hint increments `hints_used`. Retry after any hint.
2. Retry correct → partial mastery credit, `was_retry=true`. Fewer hints used → more credit. Optionally serve one **harder** question in the same skill to confirm the fix (never blocks; skippable).
3. Retry wrong → full written explanation (≤150 words; must name the specific trap in the student's chosen answer; must end with the generalizable rule in one sentence) → serve a structural variant (same skill, same trap type, new surface content).
4. One-tap error-type self-tag (concept/calculation/misread/careless/timing/guess); Haiku cross-classifies from the pattern; store the student's tag, log disagreements.
5. Full four-choice distractor breakdown available on tap; always written into `error_journal`.
   Careless/misread errors apply a reduced mastery penalty vs. concept errors.

**F4 — Mastery + memory update.** Per attempt: BKT update — correct: `p += (1-p) * learn_rate` scaled down if the question was easy relative to current mastery; incorrect: `p *= (1 - slip_penalty)` scaled by difficulty and error_type. FSRS-style update to `stability` and `next_review` (correct answers extend stability; misses reduce it). Nightly job: recompute `behavior_signals` (pace by difficulty, `fatigue_minute`, `avg_focus_minutes`, `time_of_day_performance`, `post_miss_accuracy`, `calibration_score`); refresh `next_review` across all skills. Implement crons as Vercel Cron hitting protected API routes.

**F5 — Error journal + reflection.** Session end: Haiku writes/updates one pattern-level observation per affected skill ("Misses cluster on answers that are true but don't answer the question asked"). Prompt the student to restate the rule in her own words → `student_note`. One optional skippable free-text reflection → `sessions.reflection`.

**F6 — Coach memory (append-only).** Each refresh inserts a **new** `coach_memory` row (never mutates the old one); newest is active. Rolling ≤600-word summary of trajectory, persistent error patterns, resolved patterns, notable reflections. Refreshed weekly by Sonnet (and after each monthly test). The active narrative is injected into every tutoring prompt so explanations can reference history ("same trap as the purpose-vs-evidence confusion you fixed two weeks ago — you caught it faster this time"). History of prior rows = product feature + debugging tool later.

**F7 — Monthly test entry.** Student takes an official practice test in Bluebook (outside the app), then enters total/section scores + domain breakdown on `/tests`. System updates the score-mapping correction factor and resets the prediction confidence band.

**F8 — Weekly report (Sunday cron).** Sonnet writes a narrative report: hours studied, sessions completed, biggest mastery gains, most common error type, calibration trend, recommended focus for next week. Stored in `weekly_reports`; shown on student dashboard AND parent dashboard. Written register — the student is expected to read it.

**F9 — Question generation (`/admin`).** "Generate N variants for skill X": Sonnet generates question (with `distractor_notes`) → a separate blind Claude call solves it without seeing the intended answer → answers must match → math questions additionally verified numerically where feasible → `validated=true`, else discard. Also on `/admin`: official question bank import tool (CSV/JSON upload mapping to the `questions` schema) and bank stats per skill.

**F10 — Parent dashboard (`/parent`).** PIN gate checked server-side inside `authorizeParentView(request) → user_id | null`; all parent-dashboard queries take the returned `user_id` as a parameter. Read-only aggregates: minutes practiced per day (30-day bar chart), sessions per week, current streak, mastery heatmap by domain, predicted-score trend line with practice-test actuals overlaid, latest weekly report. No question-level detail, no edit capability.

**F11 — AI ceiling + fallback.** `lib/ai` resolves the daily ceiling in order: `profiles.ai_daily_ceiling` → `AI_DAILY_CEILING` env → 150. It counts today's `ai_log` rows for the user before each call. Over the ceiling: practice continues; hints/explanations fall back to the stored `rationale` on the question. Never block a session on the ceiling.

**F12 — Events.** Write an `events` row for: `session_start`, `session_end`, `milestone_hit`, `report_viewed`, `parent_viewed`. Doubles as the source for streak/motivation logic and future retention analysis. No PII in `payload`.

## Score prediction & readiness

- Per section: `predicted = f(Σ p_mastery × weight)` mapped through a curve anchored to practice-test actuals; correction factor updated on each F7 entry. Display as a trend line with a confidence band that widens with days since the last full test.
- **Readiness panel (dashboard):** Content (mastery-weighted %), Timing (pace vs. per-module targets), Consistency (session regularity), Calibration (confidence-vs-correctness alignment from `behavior_signals`).
- **Goal tree (view).** A visible hierarchy — 1500 → Math 760 / RW 740 → domains → skills — rendered from `skills.parent_skill_id` and colored by mastery. Fills in as the student practices; each node shows mastery and point-leverage. This is the long-term-goal visualization.
- Point-leverage shown at skill/domain level only ("Advanced Math: ~30 points available to you"). **Never** show per-session point predictions (false precision erodes trust in the score).

## AI integration rules

- Single chokepoint `lib/ai`; every call logged to `ai_log` with token counts.
- Every tutoring prompt includes: the VARK profile directives, current skill + mastery context, the active coach-memory narrative, and relevant recent error-journal entries.
- Prompt templates as per-function files in `prompts/`: `tutor`, `hint`, `coach`, `classifier`, `generator`, `reporter`. No agent framework — plain templated calls.
- Explanations for CORRECT answers: only on explicit request (token control).
- No streaming in v1.

## Screens

1. `/login` — Supabase auth
2. `/` — dashboard: predicted score + trend, readiness panel, streak, top-3 focus skills, Start Session CTA, latest weekly report
3. `/session` — practice loop (plan → questions → miss loop → session summary → optional reflection)
4. `/mastery` — full skill map (red/yellow/green) with a **goal-tree view** toggle; tap a skill → notes, error-journal entries, "drill this skill" button
5. `/tests` — practice test log + entry form
6. `/parent` — PIN gate → parent dashboard
7. `/admin` — question generation, official bank import, bank stats

## Motivation

Streak + daily minimum (20 questions OR 25 minutes). Learning-event celebrations: weakest-skill-improved, hard-question-solved, calibration-improved, review-milestone, perfect-accuracy-session. Primary visible reward = mastery color movement (red→yellow→green) and goal-tree nodes filling in. Monthly test = "predicted vs. actual" reveal moment. Milestones write an `events` row (`milestone_hit`).

## PWA requirements

Installable (manifest + icons + service worker), responsive down to 375px, session flow fully usable one-handed on a phone. Offline support explicitly OUT of v1.

## Build phases (gate each on user approval)

**Phase 1 — Foundation:** git init; Next.js scaffold per folder layout; Supabase client setup; full schema as migrations + RLS (**including `profiles`, `config`, `events`**); skill seed script (with `parent_skill_id`); official-bank import tool; basic practice loop with simple selection; attempt logging including confidence + error-type capture; `lib/ai` with `ai_log` + ceiling (profiles→env→150) + fallback; **enable Supabase scheduled backups**.

**Phase 2 — Intelligence:** BKT + FSRS mastery updates; adaptive session assembler with time-budgeted plan; full miss loop (**tiered hints** → retry → explanation → variant → optional harder-question); diagnostic flow; nightly behavior-signals cron (incl. focus length + time-of-day).

**Phase 3 — Visibility:** Student dashboard; mastery map; **goal-tree view**; score prediction + monthly recalibration; readiness panel; error journal; coach memory (append-only); test entry.

**Phase 4 — Polish:** Parent dashboard (`authorizeParentView`); weekly report cron; PWA install; motivation events; TTS toggle; admin generation pipeline with blind-solve validation.

## Acceptance criteria (v1 done)

- Diagnostic populates mastery for all skills; dashboard shows baseline prediction and seeds the goal tree
- Sessions verifiably serve due-review and low-mastery skills first and respect the fatigue/focus cap
- Every miss runs tiered hints → retry → explanation → variant; retry success moves mastery; error type + confidence recorded on every attempt
- Tutoring output references coach-memory history
- Prediction updates after sessions; recalibrates after test entry
- Weekly report generates and appears on both dashboards
- Parent reaches the dashboard from a phone with only the PIN
- Same deployment runs installed on a phone home screen and in a desktop browser
- Over-ceiling sessions degrade to static rationales without blocking
- `events` rows are written for session/report/parent/milestone actions

## Non-goals (v1 — do not build)

Multi-student UI, signup/onboarding flows, billing, offline mode, native apps,
essay scoring, in-app timed full-section simulation (Bluebook owns that), parent
logins, cohorts/orgs/roles. **Deliberately not built (per planning notes):**
7-dimension memory model (2 numbers only — data too thin at n=1), per-session
point predictions, interactive-graph/drag-point lessons and video explanations
(prose-first for this learner), and an in-app full-length test generator.

---

## Appendix — v1.1 change log (from v1.0)

Merged from the **Charter §5 deltas:** `profiles`, `config`, `events` tables;
`questions.license` / `questions.external_id`; append-only `coach_memory`;
ceiling resolution `profiles → env → 150`; `authorizeParentView()`; events
writes; Supabase backups in Phase 1; no-PII rule.

Added from **GPT enhancements (bucket A + cheap B):** long-term **goal tree**
(`skills.parent_skill_id` + `/mastery` view); **tiered hints** (up to 3) in the
miss loop; optional **harder-question-after-success**; **focus length** and
**time-of-day performance** in `behavior_signals`.

Kept **cut** (bucket C, per the FABLE response in raw notes): 7-dimension memory
model, per-session point predictions, in-app full-length tests, interactive-graph/
video lessons.
