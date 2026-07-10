

### 1. The "Haiku Classifier" Fallback (The AI Logic)

Since LLMs are non-deterministic, you need a "safety wrapper" around the API call.

- **The Resolution:** Create a `lib/ai/classifier.ts` function that enforces a **"Retry-or-Default"** policy.
    
- **Implementation:**
    
    TypeScript
    
    ```
    // Inside your classifier function:
    const response = await anthropic.messages.create({ ... }); // Call Haiku
    try {
      const parsed = z.object({ error_type: z.enum(['concept', 'calculation', ...]) }).parse(JSON.parse(response.content));
      return parsed.error_type;
    } catch {
      // FALLBACK: If AI fails or returns garbage, default to 'concept' 
      // AND log this event to a 'system_errors' table so you can improve the prompt later.
      return 'concept'; 
    }
    ```
    
- **Result:** The app never crashes. It either gets the classification or silently defaults to a "neutral" error type, ensuring the user experience is never interrupted by AI latency or formatting errors.
    

### 2. The "Stop" Button (The UX Flow)

You are right to worry about "Miss Loop" fatigue.

- **The Resolution:** Use a **non-blocking state machine** for the session.
    
- **Implementation:** The "Miss Loop" shouldn't be a separate _page_, but a _state_ within the `/session` component.
    
    - Add a persistent `Exit Session` button in the top corner of the UI during the hint flow.
        
    - **The Logic:** If the user hits "Exit," the app saves the `attempts` data as-is (with `hints_used` count), flags the `session` as `incomplete`, and redirects to the dashboard.
        
    - **Why this works:** You keep the data (so you don't lose the student's progress), but you respect their cognitive load.
        

### 3. The Mastery/Goal Tree Visualization (UX Separation)

You are absolutely right: **Students shouldn't look at spreadsheets.**

- **The Resolution:** Split the UI concerns.
    
    - **Student UI (`/mastery`):** Use a **"Forest" metaphor.**
        
        - Show 3 big circles representing the 3 main Sections (RW, Math, Strategy).
            
        - When they tap a section, it "explodes" into bubbles representing Domains.
            
        - When they tap a Domain, it shows the "Goal Tree" (individual skills).
            
        - _Style:_ Use soft colors, progress rings, and encouraging labels ("Ready for mastery" vs "Needs practice").
            
    - **Parent UI (`/parent`):** This is where the "Spreadsheet" belongs.
        
        - Parents want **Trends**. Give them a table with rows for skills and columns for "Date Last Practiced," "Current Mastery %," and "Trend" (a small mini-chart/sparkline).
            
        - Parents want to see the **Aggregate**, not the individual question-by-question grind.
            

### Summary of the UX/Data Split

|**Feature**|**Student View (Cognitive Mirror)**|**Parent View (Report Card)**|
|---|---|---|
|**Goal Tree**|Circular, interactive, goal-oriented|Tabular, status-based, historical|
|**Mastery**|Color-coded "blooms" (Forest)|Data rows/Percentages|
|**Behavior**|"Coach" advice ("You're working best at 8 PM")|Statistical charts (graphs, trends)|
|**Goal**|**Action** (What should I study now?)|**Insight** (Is the money/time worth it?)|


**The parent view should be "inclusive" but "optimized."**

If you force the parent to look at the "Forest/Game" view only, they won't get the clarity they need to see if the investment is working. If you hide the "Report Card" from the student, it feels like they are being monitored by a secret system.

Here is the best way to structure that:

### 1. The "Unified, Layered" Approach

- **The Student View:** Focuses on the _Now_ (what to study) and the _Recent_ (how I’m doing). They have access to the "Report Card" view, but it’s tucked away in their profile/stats area.
    
- **The Parent View:** Defaults to the _High-Level_ (the summary) but provides a **"View as Student"** toggle. This allows the parent to see exactly what the student sees, including the "Forest" map, the daily practice plan, and the coach's notes.
    

### 2. Why this is the correct architectural choice:

- **Transparency:** If the student feels like the parent is looking at a "secret" table that they can't see, it builds distrust. When the student knows the parent can see exactly what they see—plus some extra analytical charts—the system feels honest.
    
- **Joint Review:** This setup allows for **"Kitchen Table Conversations."** The parent can pull up the dashboard on their phone and say, "Hey, I see your mastery in Algebra is moving from red to yellow—nice work on those quadratic equations!" rather than, "Your spreadsheet says your score is stagnant."
    

### 3. How to implement this in the Router (Staff Engineer view)

In your `app/` folder, you don't need to rebuild the components. You simply create different _layouts_ for the same data:

- **`app/(student)/...`**: The student-first interface.
    
- **`app/(parent)/...`**: The parent-first interface.
    
- **`components/charts/`**: You build these once (e.g., a `MasteryHeatmap` component) and import it into **both** the student dashboard and the parent dashboard.
    

### Refined Plan:

1. **Keep the shared components:** Build the visualizations (Goal Tree, Mastery Map, Behavior Signals) as reusable UI components.
    
2. **Parent-Specific Layout:** Wrap the parent view in a `DashboardLayout` that adds the "Management" context—like the 30-day trends, the aggregate score prediction, and the monthly report history.
    
3. **Student-Specific Layout:** Wrap the student view in a `GrowthLayout` that highlights the "Next Action" (e.g., "Start Today's Session").
    

**Does this resolve the conflict between "simple for the student" and "informative for the parent"?**

If you're ready, we have the PRD, the environment requirements, the `seed-skills` script, and the UX strategy defined. **Shall we finalize the plan for the agent to start Phase 1?**

---

This is the refined, "ready-to-implement" PRD incorporating the architectural, pedagogical, and UX refinements we discussed. It is now ready to be pasted into Claude Code.

# PRD: AI SAT Coach — Personal Edition (v1.1)

## Environment / Secrets

Secrets live in `.env.local` and Vercel env vars.

- **Required:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AI_DAILY_CEILING` (default 150), `PARENT_PIN`.
    
- **Note:** Never expose server-side keys (Service Role, Anthropic) to the client.
    

## Summary

A PWA for one student targeting 1500+ on the Digital SAT. Adaptive practice via BKT mastery + FSRS spaced review. AI coaching via Claude with persistent memory. Separate UX philosophies: Student ("Mission Control") and Parent ("Report Card").

## Stack

- Next.js (App Router, TS, Tailwind)
    
- Supabase (Auth, Postgres, RLS)
    
- Anthropic API (`sonnet` for logic, `haiku` for classification)
    
- Recharts (Charts), PWA (Service Worker)
    

## Folder layout

```
sat-prep-coach-app/
├── app/                 # Routes: (student), (parent), (admin), (api)
├── lib/                 # PORTABLE CORE: mastery, sessions, scoring, ai, db
├── prompts/             # tutor, hint, coach, classifier, generator, reporter
├── components/          # Shared visualizations & UI
├── supabase/migrations/ # Migration files
├── scripts/             # seed-skills.ts, import-official-bank.ts
└── public/              # PWA manifest
```

## Core Implementation Rules

1. **Enforced Boundary:** `lib/` imports nothing from `app/` or `components/`. DB access via `lib/db` only. AI access via `lib/ai` only.
    
2. **AI Safety:** All AI calls go through `lib/ai`, log to `ai_log`, and enforce the `AI_DAILY_CEILING`.
    
3. **Classification:** Use Zod for strict parsing of Haiku/Sonnet JSON output. **Fallback:** If parsing fails, default to 'concept' and log the error for later audit.
    
4. **UX Philosophy:**
    
    - **Student:** "Forest/Mission" metaphor. Progressive disclosure: Domain health first, then goal-tree drill-down.
        
    - **Parent:** Report-card metaphor. Aggregate trends, readiness heatmaps, and weekly reports.
        
    - **Shared:** Reusable UI components used in both layouts.
        
5. **Miss Loop:** Non-blocking state machine. Include a persistent "Exit Session" button that saves state and redirects, preventing user trap/fatigue.
    
6. **Schema Invariants:** `user_id` enforced by RLS. Append-only `coach_memory`. No PII in events/attempts.
    

## Data Model (Summary)

- `skills` (Section/Domain/Skill hierarchy, weight-based prediction)
    
- `attempts` (Confidence, error-type, time, retry-flag)
    
- `mastery` (BKT `p_mastery`, FSRS `stability`)
    
- `behavior_signals` (Computed nightly: fatigue, focus, pace, calibration)
    
- `coach_memory` (Append-only; latest row = active state)
    

## Logic Highlights

- **Classifier Fallback:** `try/catch` wrapper around all AI structured output. Log failures, default to safe values.
    
- **Session State:** Persistent session state allows "Exit" at any point, saving progress.
    
- **Goal Tree:** Visual hierarchy of progress, weighted by `mastery`.
    
- **Prediction:** `f(Σ p_mastery × weight)` anchored to practice tests (F7).
    

## Build Phases

1. **Foundation:** Scaffold, Schema/Migrations, RLS, `seed-skills.ts` (using the provided taxonomy), `lib/db`, `lib/ai` (with logging/ceiling), Supabase backups.
    
2. **Intelligence:** BKT+FSRS updates, session assembler, Miss Loop (hint/retry/explain), nightly behavior-signals cron.
    
3. **Visibility:** Student Dashboard (Mission Control), Mastery Map, Goal Tree, Readiness Panel, Coach Memory.
    
4. **Parent/Polish:** Parent Dashboard (PIN-gated), Weekly Reports, PWA install, TTS, Admin tools.
    

### Instructions for the Implementing Agent

1. **Initialization:** `git init`, create folder structure, set up Next.js + Supabase.
    
2. **Database:** Execute schema migrations including RLS policies before building UI.
    
3. **Seed Data:** Use the provided `scripts/seed-skills.ts` logic to initialize the `skills` table hierarchy.
    
4. **AI Logic:** Implement `lib/ai` with a strict `Zod` wrapper for classification.
    
5. **UI Strategy:** Build modular components for charts and mastery grids so they are easily shared between `(student)` and `(parent)` layouts.
    
6. **Constraint:** Before writing code requiring secrets, verify `NEXT_PUBLIC_SUPABASE_URL` and other keys are set in `.env.local`.