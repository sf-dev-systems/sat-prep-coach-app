# PRD | Ava Study Mode & Master Engineering Roadmap

## Version

**v1.5 — Ultimate Consolidated Master PRD** (Fully integrates Strategic Lock/Stub/Defer, DB Schemas, Miss-Loop Escape Hatches, Study Mode specifications, Mathematical Prediction Formulas, Playground Scenario Verifications, Readiness Dimensions, and Governance)

## Status

**Active — Single Source of Truth**

## Product

**SAT Prep Coach App — Personal Edition for Ava**

## Primary User

Ava — single-student MVP user (designed for a target score of $1500+$).

## Product Owner

Sienna / Ava SAT Prep Coach App (Oni Technologies LLC).

## 1. Executive Summary & Vision

The app is designed to function as Ava's highly personalized private SAT tutor. Unlike standard test prep apps that treat student performance as ephemeral, this product treats the **student model** as the absolute core of the architecture.

### Core Practice Loop

$$\text{Diagnose} \longrightarrow \text{Study} \longrightarrow \text{Practice} \longrightarrow \text{Miss Loop} \longrightarrow \text{Reflect} \longrightarrow \text{Review} \longrightarrow \text{Predict} \longrightarrow \text{Adjust}$$

This document fully merges our strategic, operational, product, and database architectures into a single file so that all other working notes can be archived.

## 2. Learner Profile & VARK Design Focus

Ava's learning profile is highly specific:

- **VARK Scores:** Kinesthetic: $14$, Read/Write: $13$, Aural: $9$, Visual: $7$.
    
- **Instructional Style:** "Do + Write".
    
- **Design Consequences:**
    
    - Explanations are highly structured, written prose—not video-dependent or purely diagram-dependent.
        
    - Every miss must be corrected by _doing_ (retrying or answering structural variants), never by passive reading alone.
        
    - No passive explanation block should exceed one short paragraph before the student is prompted to act.
        
    - TTS (Text-to-Speech) option is supported via the browser's Web Speech API.
        

## 3. Strategic Lock / Stub / Defer Register

To protect future scalability (such as moving from a single-user MVP to a multi-student SaaS platform) without over-engineering now, we adhere to this strict development register:

### Locked in v1 (Permanent Invariants)

- **L1:** `user_id` on all student-state tables; RLS enforced via `user_id = auth.uid()`.
    
- **L2:** Content tables (`skills`, `questions`) are strictly separated from student-state tables (`attempts`, `mastery`).
    
- **L3:** Composite primary keys `(user_id, skill_id)` on `mastery` and `skill_notes`.
    
- **L4:** **No user ID is ever hardcoded in application code.** Identity is always session-derived.
    
- **L5:** Single AI chokepoint (`lib/ai`) with comprehensive `ai_log` recording for token budgeting.
    
- **L6:** Database schema version-controlled strictly through SQL migration files.
    
- **L7:** Portable core engine (`lib/`) must not import framework-specific or UI-specific code.
    

### Stubs in v1 (Cheap Placeholders Added)

- **S1 (Plans/Entitlements):** A `profiles` table to read daily AI usage ceilings.
    
- **S2 (Feature Flags):** A general `config` table for quick remote variables (e.g., daily minimums).
    
- **S3 (Telemetry/Events):** An `events` table logging core milestones (`session_start`, `session_end`, etc.).
    
- **S4 (Parent Function Isolation):** PIN authorization is isolated to `authorizeParentView()`.
    
- **S5 (Question Provenance):** `license` and `external_id` columns in `questions` to filter content rights later.
    
- **S6 (Append-Only Snapshotting):** `coach_memory` is append-only to preserve diagnostic histories.
    

### Deferred (Explicitly Out of Scope for v1)

- **D1:** Self-serve signup/onboarding flows.
    
- **D2:** Parent multi-user logins or magic link platforms.
    
- **D3:** Stripe billing integration.
    
- **D4:** Cohort/classroom organizational models.
    
- **D5:** Offline practice session local caching.
    

## 4. Complete Database Schema

All database migrations live under `supabase/migrations/` and must adhere exactly to this schema.




SQL

```

-- 1. Skills Taxonomy Table
create table skills (
  id uuid primary key default gen_random_uuid(),
  section text check (section in ('rw','math','strategy')),
  domain text,
  name text,
  parent_skill_id uuid references skills(id),  -- goal-tree hierarchy (null = top of section)
  weight numeric              -- score-prediction weight; strategy skills = 0
);

-- 2. Question Bank Table
create table questions (
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
  license text default null,      -- provenance/rights (v1 unused)
  external_id text default null,  -- source bank id (v1 unused)
  validated boolean default false,
  created_at timestamptz default now()
);

-- 3. Student Practice Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  started_at timestamptz,
  ended_at timestamptz,
  session_type text check (session_type in ('diagnostic','practice','review','full_test_entry')),
  questions_served int,
  questions_correct int,
  reflection text             -- optional free text
);

-- 4. Question Attempts
create table attempts (
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

-- 5. Student Mastery Levels (BKT + FSRS)
create table mastery (
  user_id uuid not null references auth.users(id),
  skill_id uuid not null references skills(id),
  p_mastery numeric default 0.3,
  stability numeric default 1.0,      -- FSRS memory stability (days)
  attempts_count int default 0,
  last_practiced timestamptz,
  next_review timestamptz,
  primary key (user_id, skill_id)
);

-- 6. Bluebook Practice Tests Entry
create table practice_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  taken_at date,
  total_score int, rw_score int, math_score int,
  domain_breakdown jsonb
);

-- 7. Diagnostic Error Journal
create table error_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  skill_id uuid references skills(id),
  question_id uuid references questions(id),
  ai_observation text,
  student_note text,
  locked_status boolean default false,
  created_at timestamptz default now()
);

-- 8. Customized Skill Notes
create table skill_notes (
  user_id uuid not null references auth.users(id),
  skill_id uuid not null references skills(id),
  content text,
  updated_at timestamptz,
  primary key (user_id, skill_id)
);

-- 9. Append-Only Coach Diagnostic Memory
create table coach_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  narrative text,             -- rolling summary, max ~600 words
  updated_at timestamptz default now()
);

-- 10. Weekly Parent/Student Reports
create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  week_of date,
  content text,
  created_at timestamptz default now()
);

-- 11. Custom Behavior Signals
create table behavior_signals (
  user_id uuid primary key references auth.users(id),
  computed_at timestamptz default now(),
  avg_pace_by_difficulty jsonb,
  fatigue_minute int,            -- session minute where accuracy drops off
  avg_focus_minutes int,         -- typical productive session length before decline
  time_of_day_performance jsonb, -- performance timing buckets
  post_miss_accuracy numeric,    -- accuracy after consecutive misses
  calibration_score numeric      -- confidence vs correctness alignment
);

-- 12. Complete AI Call Telemetry Log
create table ai_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  question_id uuid references questions(id),
  call_type text,             -- hint|explanation|variant|classify|report|coach_update
  action_flag text,           -- baseline tracking flags (e.g., IMMEDIATE_EXPLANATION_REQUEST)
  model text,
  input_tokens int,
  output_tokens int,
  metadata jsonb,
  created_at timestamptz default now()
);

-- 13. Student Configuration & Entitlement Profiles
create table profiles (
  user_id uuid primary key references auth.users(id),
  display_name text,
  plan text default 'founder',
  ai_daily_ceiling int,          -- null = use env default
  created_at timestamptz default now()
);

create table config (
  key text primary key,
  value jsonb
);

-- 14. Immutable Event Log
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  event_type text not null,      -- session_start|session_end|milestone_hit|report_viewed|parent_viewed
  payload jsonb,
  created_at timestamptz default now()
);
```









---

## 5. Folder Layout & Architecture

The application is structured into a portable logic layer (`lib/`) and a lightweight routing layer (`app/`)



sat-prep-coach-app/
├── app/                 # Next.js routes
│   ├── (student)/       # Student pages: /, /session, /mastery, /tests, /study, /miss-loop
│   ├── (parent)/        # /parent - Parent Dashboard with PIN gate
│   ├── (admin)/         # /admin - Question banking and audits
│   ├── api/
│   │   ├── cron/        # Cron endpoints for metrics
│   │   ├── miss-loop/   # Miss-loop processing & routing
│   │   └── study/       # Study mode endpoints
│   │       └── lesson/  # Custom Study Lesson generation
│   └── login/           # Auth landing
├── lib/                 # Portable core (TypeScript only)
│   ├── mastery/         # BKT updates, FSRS calculations
│   ├── sessions/        # Selection algorithms & adaptive logic
│   ├── scoring/         # Score predictions & readiness models
│   ├── ai/              # Anthropic chokepoint, ceilings, and logging
│   └── db/              # Central Database Client queries
├── prompts/             # versioned plain tutor templates
├── components/          # Common reusable UI components
├── scripts/             # Data population & seeding scripts
└── supabase/migrations/ # Chronological database files


---























---

## 6. Core Product Flows (F1 - F12)

### F1: Adaptive Diagnostic (First Run)

*   Consists of $\sim 40$ questions divided across sections[cite: 1, 2].
*   The second half of each section scales its difficulty dynamically based on first-half performance[cite: 1, 2].
*   Outputs a complete baseline profile, seeding both the Goal Tree and the score prediction model[cite: 1, 2].

### F2: Daily Practice Session

*   Assembles a targeted $15\text{--}25$ question plan prioritised by:
    1.  Skills past their review date ($next\_review \le now$)[cite: 1, 2].
    2.  Skills with low weighted mastery ($p\_mastery \times weight$)[cite: 1, 2].
    3.  Pacing capped via behavioral analysis (`fatigue_minute` limits)[cite: 1, 2].
*   Requires a confidence tag on every question response[cite: 1, 2].

### F3: Miss Loop State Machine (Completed Baseline Specification)

If a student misses a question, they enter the Miss Loop state machine[cite: 1, 2]:

1.  **Tiered Hints (1-3):** Student can request incremental hints[cite: 1, 2].
2.  **Retry Mechanics:** Correct retries award partial mastery[cite: 1, 2]. Wrong retries trigger a full step-by-step explanation[cite: 1, 2].
3.  **"Show Me How" (Instant Escape Hatch):** A user-triggered escape option bypasses the retry cycle entirely[cite: 1, 2]. It records a max-miss penalty, logs the immediate bypass (`IMMEDIATE_EXPLANATION_REQUEST`) to the `ai_log`, registers the item in the error journal, and immediately delivers the comprehensive AI step-by-step explanation[cite: 1, 2].
4.  **"Exit Session" (Universal Escape Hatch):** Students can exit the miss loop at any point[cite: 1, 2]. The session saves all partial progress and logs standard variables safely before returning the user to the dashboard[cite: 1, 2].
5.  **Self-Tagging & Classification:** Students self-tag their error type[cite: 1, 2]. An LLM checks this tag to log calibration discrepancies[cite: 1, 2].

### F4: Mastery & Stability Updates

*   **BKT Formulas:**
    *   *Correct response:*
        $$p \longleftarrow p + (1-p) \times \text{learn\_rate}$$[cite: 1, 2]
        (Scaled down if the question was relatively easy for the current level)[cite: 1, 2].
    *   *Incorrect response:*
        $$p \longleftarrow p \times (1 - \text{slip\_penalty})$$[cite: 1, 2]
        (Penalties are mitigated for "careless" or "misread" tags compared to "concept" errors)[cite: 1, 2].
*   **FSRS updates:** Spaced repetition memory stability metrics extend $stability$ on success and contract review intervals on failure[cite: 1, 2].

### F5: Error Journal & Reflections

*   Maintains a chronological record of missed questions, student self-corrections, and AI observations[cite: 1, 2].

### F6: Append-Only Coach Memory

*   Maintains a rolling summary ($\le 600$ words) updated weekly[cite: 1, 2]. It is injected into future prompts to reference student history (e.g., *"Remember not to fall for the same trap as last week's system of equations"*)[cite: 1, 2].

### F7: Monthly Practice Test Log

*   Accepts official external Bluebook test results to recalibrate the core prediction curve[cite: 1, 2].

### F8: Weekly Progress Report

*   Fires a Sunday cron to generate progress reports accessible on both student and parent dashboards[cite: 1, 2].

### F9: Question Generation & Verification

*   Generates questions using a "blind solve" technique[cite: 1, 2]. Sonnet generates the questions; Haiku solves them[cite: 1, 2]. If answers diverge, the question is discarded to prevent database pollution[cite: 1, 2].

### F10: PIN-Gated Parent View

*   Accessible only via a 4-digit PIN checked on the server side via `authorizeParentView()`[cite: 1, 2].

### F11: Daily AI Usage Ceiling

*   Calculates usage logs before firing provider calls[cite: 1, 2]. Degrades gracefully to static question rationales when the ceiling is reached without blocking student workflows[cite: 1, 2].

### F12: Analytics Event Tracking

*   Logs immutable records to `events` for major session, diagnostic, and portal actions[cite: 1, 2].

---

## 7. Study Mode MVP Requirements

### SM-1: Study Mode Routing

*   Create `/study` to serve recommended focal skills[cite: 1, 2].
*   Create `/study/[skillId]` to launch active lessons[cite: 1, 2].

### SM-2: Study Mode UI

*   Designed explicitly around Ava's Kinesthetic ("Do") and Read/Write ("Write") strengths[cite: 1, 2].
*   Prioritizes short rule summaries, action checklists, worked-out steps, and active typed responses[cite: 1, 2].
*   Avoids video, long passive blocks, or un-interactive lecture notes[cite: 1, 2].

### SM-3: Prompt Builder (`prompts/study.ts`)

*   Injects Ava's VARK parameters, skill parameters, error journal context, and past notes[cite: 1, 2].
*   Instructs Anthropic Sonnet to output strict JSON matching the client contract[cite: 1, 2].

### SM-4: Study Lesson API Endpoint

*   Located at `/api/study/lesson/route.ts`[cite: 1, 2].
*   Fetches dynamic database context server-side, validates client requests via Zod, checks AI daily ceilings, and falls back to static content if provider bounds are reached[cite: 1, 2].

### SM-5: Mastery Map Actions

*   Displays dual CTA buttons for skills: `Study This Skill` ($\rightarrow$ `/study/[skillId]`) and `Drill This Skill` ($\rightarrow$ `/session?skill=[skillId]`)[cite: 1, 2].

### SM-6: Dashboard Recommender Card

*   Extends focus skill structures to display a direct `Study This Skill` CTA card linked to the highest priority skill[cite: 1, 2].

### SM-7: Error Journal Injection

*   Automatically feeds recent journal traps for the target skill into the prompt generator to ground lessons in Ava's actual past mistakes[cite: 1, 2].

### SM-8: Teach-Back Persistence

*   Prompts the student at lesson completion: *"In your own words, write the rule you will use next time."*[cite: 1, 2]
*   Saves this response to the database by appending a timestamped `"Study Mode Teach-Back"` section to `skill_notes.content` to preserve historical user notes[cite: 1, 2].

### SM-9: Targeted Drill Transition

*   Concludes every study block with a direct call-to-action to test the skill immediately: `/session?skill=[skillId]`[cite: 1, 2].

---

## 8. Study Mode Lesson Contract

### Request Payload

```json
{
  "skillId": "string"
}
```[cite: 1, 2]

### Validated Response Payload

```json
{
  "skill": {
    "id": "string",
    "name": "string",
    "section": "math" | "rw" | "strategy",
    "domain": "string" | null
  },
  "lesson": {
    "whyItMatters": "string",
    "avaRule": "string",
    "checklist": ["string"],
    "commonTrap": "string",
    "workedExample": {
      "setup": "string",
      "steps": ["string"],
      "takeaway": "string"
    },
    "doNowPrompt": "string",
    "retrievalPrompt": "string",
    "teachBackPrompt": "string"
  },
  "context": {
    "usedErrorJournal": true,
    "usedExistingNote": true,
    "overCeiling": false,
    "source": "ai" | "fallback"
  }
}
```[cite: 1, 2]

---

## 9. Score Prediction & Pedagogical Weighting Model

### 9.1 Mathematical Taxonomy Tree Structure

The system represents knowledge as a strict three-level hierarchical tree:

$$\text{Section} \longrightarrow \text{Domain} \longrightarrow \text{Skill}$$[cite: 2]

This is represented in the database using the self-referencing foreign key `parent_skill_id` on the `skills` table:
*   **Section Level:** `parent_skill_id` is NULL[cite: 2].
*   **Domain Level:** `parent_skill_id` references the parent Section[cite: 2].
*   **Skill Level (Leaf nodes):** `parent_skill_id` references the parent Domain[cite: 2].

### 9.2 Pedagogical Weighting Assignments

Every leaf skill is assigned a fixed weight representing its statistical prominence on the Digital SAT[cite: 2].

#### Math Section (Content Weight: 1.0)[cite: 2]
*   **Algebra (Domain Weight: 0.35)**[cite: 2]
    *   Linear Equations & Inequalities: Weight = 10[cite: 2]
    *   Systems of Equations: Weight = 10[cite: 2]
*   **Advanced Math (Domain Weight: 0.35)**[cite: 2]
    *   Quadratics & Parabolas: Weight = 12[cite: 2]
    *   Polynomials & Non-linear Functions: Weight = 12[cite: 2]
*   **Problem-Solving & Data Analysis (Domain Weight: 0.15)**[cite: 2]
    *   Ratios, Rates & Proportions: Weight = 8[cite: 2]
    *   Percentages: Weight = 8[cite: 2]
    *   Statistics & Probability: Weight = 10[cite: 2]
*   **Geometry & Trigonometry (Domain Weight: 0.15)**[cite: 2]
    *   Area & Volume: Weight = 7[cite: 2]
    *   Triangles & Circles: Weight = 8[cite: 2]
    *   Trigonometry: Weight = 5[cite: 2]

#### Reading & Writing Section (Content Weight: 1.0)[cite: 2]
*   **Information & Ideas (Domain Weight: 0.26)**[cite: 2]
    *   Central Ideas & Details: Weight = 12[cite: 2]
    *   Command of Evidence: Weight = 15[cite: 2]
    *   Inferences: Weight = 10[cite: 2]
*   **Craft & Structure (Domain Weight: 0.28)**[cite: 2]
    *   Words in Context: Weight = 12[cite: 2]
    *   Text Structure & Purpose: Weight = 10[cite: 2]
    *   Cross-Text Connections: Weight = 8[cite: 2]
*   **Expression of Ideas (Domain Weight: 0.20)**[cite: 2]
    *   Transitions: Weight = 8[cite: 2]
    *   Rhetorical Synthesis: Weight = 7[cite: 2]
*   **Standard English Conventions (Domain Weight: 0.26)**[cite: 2]
    *   Boundaries (Punctuation): Weight = 10[cite: 2]
    *   Form, Structure, & Sense: Weight = 8[cite: 2]

#### Strategy Section (Content Weight: 0.0)[cite: 2]
Tracked in the mastery model but has 0 score predictive weight to ensure content mastery drives score calculations[cite: 2].
*   **Time & Attention Management**[cite: 2]
    *   Module Pacing: Weight = 0.10[cite: 2]
    *   Skip-and-Return Discipline: Weight = 0.08[cite: 2]
    *   End-of-Module Triage: Weight = 0.05[cite: 2]
*   **Interface & Tool Fluency**[cite: 2]
    *   Desmos Proficiency: Weight = 0.12[cite: 2]
    *   Digital Annotation: Weight = 0.05[cite: 2]
    *   Elimination Interface: Weight = 0.05[cite: 2]
*   **Distractor Pattern Recognition**[cite: 2]
    *   Extreme Language Traps: Weight = 0.08[cite: 2]
    *   Half-Right / Half-Wrong Traps: Weight = 0.10[cite: 2]
    *   Scope & Relevance Traps: Weight = 0.07[cite: 2]

### 9.3 Score Prediction Mathematical Model

Let $P_i \in [0, 1]$ be the student's current BKT mastery probability (`p_mastery`) for leaf skill $i$, and $W_i$ be the weight of leaf skill $i$[cite: 2].

#### Raw Section Score (Math or RW)
The raw weighted mastery index $M_{\text{section}}$ is calculated as:

$$M_{\text{section}} = \frac{\sum (P_i \times W_i)}{\sum W_i}$$[cite: 2]

The estimated baseline Section Score $S_{\text{section}}$ is mapped to the SAT scale (200 to 800):

$$S_{\text{section}} = 200 + (600 \times M_{\text{section}})$$[cite: 2]

#### Recalibration and Correction Factor (F7 Alignment)
Using Bluebook official practice tests as anchors, where $A_{\text{section}}$ is the actual score achieved and $M_{\text{section, actual}}$ is the mastery index at the time of the test:

$$C_{\text{section}} = \frac{A_{\text{section}} - 200}{600 \times M_{\text{section, actual}}}$$[cite: 2]

The real-time recalibrated score is:

$$S_{\text{section, recalibrated}} = 200 + (600 \times M_{\text{section}} \times C_{\text{section}})$$[cite: 2]

#### Strategy Multiplier Adjustment
Let $M_{\text{strat}} \in [0, 1]$ be the student's aggregate mastery across all strategy skills:

$$M_{\text{strat}} = \frac{\sum (P_j \times W_j)}{\sum W_j}$$[cite: 2]

The Strategy Multiplier acts as a modifier:

$$\mu_{\text{strategy}} = 0.90 + 0.15 \times M_{\text{strat}}$$[cite: 2]

The final predicted section score combines Base Mastery ($M_b$) with this Strategy Multiplier, clamped strictly between 200 and 800:

$$S_{\text{section, adjusted}} = \max\left(200, \min\left(800, 200 + \left(600 \times M_b \times \mu_{\text{strategy}}\right)\right)\right)$$[cite: 2]

### 9.4 Readiness Panel Metric Dimensions

The student model projects total readiness over four structural dimensions:
1.  **Content Mastery:** The weighted average of all core skill points[cite: 1].
2.  **Timing:** Pacing metrics mapped against digital SAT time restrictions[cite: 1].
3.  **Consistency:** Weekly study habits, streaks, and practice regularity[cite: 1].
4.  **Calibration:** Statistical match between confidence markers and correct responses[cite: 1].

---

## 10. Score Prediction Simulation Scenarios & Verification

Below are the verified playground validation scenarios for Ava (PSAT 1110 Baseline $\rightarrow$ SAT 1500+ Goal)[cite: 2]:

### Scenario 1: Starting Baseline (PSAT 1110 Entered)
*   Math Base Content Mastery ($M_b$): 0.287[cite: 2]
*   R&W Base Content Mastery ($M_b$): 0.377[cite: 2]
*   Strategy Base Mastery: 0.300[cite: 2]
*   Strategy Multiplier ($\mu_{\text{strategy}}$): 0.945 (Acts as a dampener)[cite: 2]
*   Entering PSAT Scores: Math: 500, RW: 610 (Total: 1110)[cite: 2]
*   Resulting Correction Factors ($C_{\text{section}}$): 1.500 for both Math and RW[cite: 2]
*   Predicted Scaled Scores: Math: 440 (Calibrated to 500) | RW: 520 (Calibrated to 610)[cite: 2]

### Scenario 2: Content Growth (Math Gaps Closed to ~0.55, RW to ~0.50)
*   New Math Base Content Mastery ($M_b$): 0.524 (was 0.287)[cite: 2]
*   New R&W Base Content Mastery ($M_b$): 0.496 (was 0.377)[cite: 2]
*   Resulting Predicted Scores: Math: 650 (+150 points) | RW: 620 (+10 points) | Composite: 1270 (+160 points)[cite: 2]

### Scenario 3: Strategy Fluency Amplification ($M_{\text{strat}} \rightarrow 0.80$)
*   Strategy Mastery: 0.800[cite: 2]
*   New Strategy Multiplier ($\mu_{\text{strategy}}$): 1.020 (grows from dampener to amplifier)[cite: 2]
*   Resulting Calibrated Predicted Scores: Math: 680 (+30 points strategy gain) | RW: 660 (+40 points strategy gain) | Composite: 1340[cite: 2]

### Scenario 4: Practice Test #2 Recalibration (Scores 1380)
*   Ava logs Bluebook Practice Test #1: Math: 670, RW: 710 (Total: 1380)[cite: 2]
*   New Math Correction Factor ($C_{\text{math}}$): 1.466 (was 1.500)[cite: 2]
*   New R&W Correction Factor ($C_{\text{rw}}$): 1.500 (was 1.500)[cite: 2]
*   Recalibrated Real-time Predictions: Math: 670 | RW: 660 | Composite: 1330[cite: 2]

### Scenario 5: Confidence Band Width Decay over Elapsed Time
*   On test day (0 days elapsed): [1360 - 1400] (Width: 40 points)[cite: 2]
*   After 3 days of learning: [1360 - 1400] (Width: 48 points)[cite: 2]
*   After 14 days of no testing: [1340 - 1420] (Width: 75 points)[cite: 2]
*   After 30 days of high decay: [1320 - 1440] (Width: 115 points)[cite: 2]

---

## 11. Operational Guidelines, Secrets, & Backups

*   **Secrets Configuration:** All keys live in `.env.local` or Vercel Environment variables. No raw secret keys should ever exist in code[cite: 1, 2].
*   **Database Backup Configuration:**
    *   GitHub Action workflows reference the database connection secret using the variable `${{ secrets.SUPABASE_DB_URL }}`[cite: 1, 2].
    *   Performs regular `pg_dump` backups[cite: 1, 2].
*   **SAT Question Ingestion:** Diagnostic and official test question data (such as SAT Tests 5 & 6) are loaded into the database from `C:\Users\go2si\sat-prep-coach-app` using the `scripts/import-official-bank.ts` script[cite: 1, 2].

---


  
  
  
  
  ## 12. Engineering Hardening Requirements

- **ENG-1: Miss-Loop Zod Schema Validation:** Enforces runtime validations on the `/api/miss-loop` payload. Uses a strict Zod discriminated union based on `action` (`hint` | `explanation` | `classify` | `EXPLAIN_NOW`).
    
- **ENG-2: Study API Request/Response Validation:** Validates both inbound calls and generated LLM payloads prior to rendering.
    
- **ENG-3: AI Fallback Logging:** Any over-ceiling or connection-error fallback logs an explicit tag (`fallback-static` or `fallback-error`) in the `ai_log` table.
    
- **ENG-4: TypeScript Static Analysis:** Add `"typecheck": "tsc --noEmit"` to `package.json`.
    
- **ENG-5: Automated Unit Testing:** Configures Vitest to run basic pure logic checks (such as FSRS scaling or scoring formulas) using the script `"test": "vitest run"`.
    
- **ENG-6: Question Bank Audits:** Runs `"audit:question-bank": "tsx scripts/audit-question-bank.ts"` to scan the local question payload for corrupt choices, null keys, or orphaned skills.
    
- **ENG-7: Clamping Confidence Ranges:** Forces predictions to stay within the SAT limits of [400, 1600] total points and [200, 800] section points.
    
- **ENG-8: Granular Setup States:** Exposes detailed student lifecycle variables (`needs_diagnostic` | `diagnostic_incomplete` | `ready`) on the dashboard instead of a binary boolean check.
    
- **ENG-9: Graceful State-Save Failures:** Presents UI-friendly warnings on save failures (e.g., during connection drops when updating notes) instead of throwing silent console exceptions.
    

## 13. Gap Analysis

|**Requirement ID**|**Name**|**Status**|**Technical Details**|
|---|---|---|---|
|**SM-1**|`/study` Landing & Dynamic Routes|Incomplete|Route files need setup.|
|**SM-2**|Study UI Component|Incomplete|Create `components/study/StudyMode.tsx`.|
|**SM-3**|Study Prompt File|Incomplete|Configure `prompts/study.ts`.|
|**SM-4**|Study API Route|Incomplete|Setup `/api/study/lesson/route.ts` with Zod parsing.|
|**SM-5**|Mastery Page CTA|Incomplete|Update `/mastery/page.tsx` with study action paths.|
|**SM-6**|Dashboard Recommender|Incomplete|Inject prioritised focus skill link into user card.|
|**SM-7**|Error Journal Injection|Incomplete|Bind active journal records to study prompts.|
|**SM-8**|Teach-back Persistence|Incomplete|Append notes directly to `skill_notes` table.|
|**SM-9**|Drill Link Bridge|Incomplete|Route users cleanly from lessons to targeted drills.|
|**ENG-1**|Miss-loop Zod Schemas|Incomplete|Harden inputs in `/api/miss-loop/route.ts`.|
|**ENG-3**|AI Fallback Logs|Incomplete|Update fallback methods in `/lib/ai/index.ts`.|
|**ENG-4**|`typecheck` Script|Incomplete|Append command parameters to `package.json`.|
|**ENG-5**|Vitest Framework|Incomplete|Setup config file and configure workspace execution.|
|**ENG-6**|Question Audit Tooling|Incomplete|Build execution script under `scripts/`.|
|**ENG-7**|Clamp Core Ranges|Incomplete|Add limiters in `/lib/mastery/dashboard.ts`.|
|**ENG-8**|Lifecycle States|Incomplete|Reconfigure state mapping on student dashboard.|

## 14. Project Implementation Phases

### Phase 1: Database & System Contracts

1. Add Zod schemas for both the miss-loop actions and the newly defined Study Mode lesson payloads.
    
2. Configure logging hooks for AI fallbacks inside `lib/ai/index.ts`.
    
3. Add DB fetch helpers to `lib/db/index.ts` to fetch study context (skills, notes, journals) server-side.
    

### Phase 2: Study Mode AI Engine & lesson Endpoint

1. Create `prompts/study.ts` with structured VARK directions.
    
2. Build `/api/study/lesson/route.ts` to process, parse, and enforce daily ceiling fallbacks.
    

### Phase 3: Study Mode UI & Flow Mechanics

1. Build the frontend `/study` pages and `/study/[skillId]` directories.
    
2. Implement the Kinesthetic/Read-Write study client container (`components/study/StudyMode.tsx`).
    
3. Connect the final teach-back save path to the `skill_notes` database schema.
    

### Phase 4: Entry Integration & UI Polish (Next Step Option)

1. Add the "Study This Skill" button directly beside "Drill" on the mastery card views.
    
2. Update the student dashboard to display the recommended focus skill.
    
3. Clamp score tracking boundaries to standard SAT metrics.
    
4. Expand diagnostic lifecycle states on the dashboard landing view.
    
5. Create parent portal dashboard (`app/(parent)/parent`) gated by server-side PIN authentication.
    

### Phase 5: Verification & Auditing Tools

1. Setup Vitest and configure unit tests for core scoring, BKT, and parsing functions.
    
2. Append static analysis checks to the local configurations.
    
3. Build the question validator script to audit content pools.
    

## 15. Risks & Mitigations

- **Risk: AI Lesson Output Is Malformed**
    
    - _Mitigation:_ Use strict JSON rules in prompts, parse defensively inside the backend, and fall back to clean static lesson plans immediately on any error.
        
- **Risk: Overwriting User Notes on Teach-back**
    
    - _Mitigation:_ Appends notes with clear timestamps directly to the existing note content instead of replacing the entire column text.
        
- **Risk: Client-Side Security Exploits**
    
    - _Mitigation:_ All core logic validations, calculations, and context gatherings are routed entirely through secure, session-verified server-side APIs.
        

## 16. Governance

- **Zero Scope Creep:** No deferred features (e.g., magic link logins or Stripe billing) may be built during this cycle.
    
- **Verification:** The implementation is complete only when static type checks, Vitest validations, and question audits run cleanly without throwing system errors.
