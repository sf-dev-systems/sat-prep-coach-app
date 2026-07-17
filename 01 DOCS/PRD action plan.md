As a seasoned developer, systems architect, and PM, I can tell you that dumping a 3,000+ word "master of all things" document directly into an agentic tool like Claude Code is a recipe for **context drift, hallucination, and massive token waste**.

While Claude Code has a massive context window, agentic tools work best when they have a **laser-focused objective** and **tight feedback loops**. If you give it the entire PRD and say "build this," it will attempt to ingest the world, write 40 half-baked files, hit rate limits, and inevitably introduce subtle bugs.

Here is the battle-tested, architect-approved strategy for feeding this PRD to Claude Code.

## 1. Do NOT feed it the whole PRD at once. Use a "Sliver-by-Sliver" approach.

Instead of treating the PRD as one giant task, treat it as your **backlog**. You will feed Claude Code **only** what it needs for the specific sprint/ticket you are running.

This keeps the **agent's workspace clean**, prevents it from rewriting files it shouldn't touch, and keeps its internal reasoning sharp.

## 2. The Ingestion Protocol (Step-by-Step)

### Step 1: The "Architectural Anchor" (Do this once)

Before you ask Claude Code to write a single line of feature code, it needs to understand the system's strict boundaries and guidelines. Give it a highly condensed **System Prompt/Instructions file** (`.claudeprompt` or `instructions.md`).

Create a small file called `.clauderules` or `system-context.md` containing only:

- **Section 3:** Strategic Lock/Stub/Defer Register (specifically the invariants $L1\text{--}L7$ so it never hardcodes a user ID or breaks RLS).
    
- **Section 5:** Folder Layout & Architecture (so it knows where files belong).
    
- **Section 11:** Operational Guidelines & Secrets.
    

> **PM Tip:** Run a quick initialization command:
> 
> `claudecode "Read system-context.md to understand our core architecture limits, RLS requirements, and folder structures. Do not write code yet."`

### Step 2: Phase-by-Phase Execution

Look at **Section 14: Project Implementation Phases**. This is your actual roadmap. You should feed Claude Code exactly one phase (or even one sub-bullet) at a time.

For example, when starting **Phase 1**, your prompt to Claude Code should look like this:

Bash

```
claudecode "We are implementing Phase 1, Step 1: Add Zod schemas for the miss-loop actions and Study Mode lesson payloads. 

Here is the exact contract from Section 8 of our PRD:
[Paste Section 8: Study Mode Lesson Contract JSON here]

And here is the ENG-1 validation rule from Section 12:
[Paste ENG-1 rule here]

Please create the Zod schemas under `lib/validation/` (or matching our layout in Section 5). Do not implement any routing yet."
```

### Step 3: Use Local Files as Context Anchors

Instead of copying and pasting the PRD text constantly, save specific sub-sections of the PRD as markdown files in a temporary `.github/` or `docs/` folder (e.g., `docs/study-mode-specs.md` or `docs/scoring-math.md`).

When you invoke Claude Code, you can target those files directly:

Bash

```
claudecode "Implement the math from docs/scoring-math.md inside lib/mastery/dashboard.ts. Ensure you strictly clamp core ranges per ENG-7."
```

## 3. Recommended "Claude Code" Workflow Rules

- **Rule 1: Keep git commits microscopic.** Let Claude Code finish _one_ specific bullet point (e.g., "Add DB fetch helper for study context"), review the diff, run your tests/typechecks, commit it, and only _then_ move to the next prompt.
    
- **Rule 2: Let it read the DB schema, don't just paste it.** Instead of pasting the SQL schemas, let Claude Code inspect your actual migration files in `supabase/migrations/`. It will understand the live state of your database better than a text file.
    
- **Rule 3: Enforce `typecheck` and `test` early.** In **Phase 1**, immediately have it set up the Vitest and TypeScript configurations (`tsc --noEmit` and `vitest` per **ENG-4** and **ENG-5**). After every subsequent feature prompt, command Claude Code to: `"Run npm run typecheck and npm run test to verify your changes didn't break anything."`
    

By serving this massive PRD to Claude Code as **discrete, atomic tasks grounded by a set of permanent architectural rules**, you will get clean, compile-ready, and highly accurate code without the agent spinning its wheels.


---

## How to use them with Claude Code

When you launch Claude Code for a specific task, your prompt is now incredibly simple:

> **For Phase 1:**
> 
> `"Using the system boundaries in docs/sys-context.md and the data definitions in docs/phase1-contracts.md, let's implement Phase 1. Start by creating the Zod schemas for the study lesson contracts. Run our typecheck afterward to confirm it compiles."`

This keeps Claude's attention entirely on the **current task**, prevents it from breaking your score prediction math while it's just trying to write a Zod schema, and saves you thousands of tokens in rate limits.

Do you want to start by generating the **System Blueprint (Slice 1)** first, or should we go straight to preparing the **Phase 1 Schema & Contracts file (Slice 2)**?