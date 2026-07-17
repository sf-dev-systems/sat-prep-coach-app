System Blueprint & Context
(`docs/01_sys-context.md`)

_This is the "always-on" guardrail file. 

FROM: [[v1-5_PRD Ava Study Mode & Master Engineering Roadmap]]
    - Section 2: VARK Design Focus (so it writes UI for Ava).
    - Section 3: Strategic Lock / Stub / Defer Register (the permanent invariants, especially RLS).
    - Section 5: Folder Layout & Architecture (so it knows where to put files).
    - Section 11: Operational Guidelines & Secrets.

---
## 1. Learner Profile & VARK Design Focus

Ava's learning profile is highly specific:

- **VARK Scores:** Kinesthetic: 14, Read/Write: 13, Aural: 9, Visual: 7.
    
- **Instructional Style:** "Do + Write".
    
- **Design Consequences:**
    
    - Explanations are highly structured, written prose—not video-dependent or purely diagram-dependent.
        
    - Every miss must be corrected by doing (retrying or answering structural variants), never by passive reading alone.
        
    - No passive explanation block should exceed one short paragraph before the student is prompted to act.
        
    - TTS (Text-to-Speech) option is supported via the browser's Web Speech API.
        

## 2. Strategic Lock / Stub / Defer Register

To protect future scalability without over-engineering now, we adhere to this strict development register:

### Locked in v1 (Permanent Invariants)

- **L1:** `user_id` on all student-state tables; RLS enforced via `user_id = auth.uid()`.
    
- **L2:** Content tables (`skills`, `questions`) are strictly separated from student-state tables (`attempts`, `mastery`).
    
- **L3:** Composite primary keys `(user_id, skill_id)` on `mastery` and `skill_notes`.
    
- **L4:** No user ID is ever hardcoded in application code. Identity is always session-derived.
    
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
    

## 3. Folder Layout & Architecture

The application is structured into a portable logic layer (`lib/`) and a lightweight routing layer (`app/`).

Plaintext

```
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
```

## 4. Operational Guidelines, Secrets, & Backups

- **Secrets Configuration:** All keys live in `.env.local` or Vercel Environment variables. No raw secret keys should ever exist in code.
    
- **Database Backup Configuration:**
    
    - GitHub Action workflows reference the database connection secret using the variable `${{ secrets.SUPABASE_DB_URL }}`.
        
    - Performs regular `pg_dump` backups.
        
- **SAT Question Ingestion:** Diagnostic and official test question data (such as SAT Tests 5 & 6) are loaded into the database from `C:\Users\go2si\sat-prep-coach-app` using the `scripts/import-official-bank.ts` script.