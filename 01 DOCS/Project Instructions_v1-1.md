---
title: Project Instructions
type: instructions
version: 1.1
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-17
source_of_truth: false
note: "Operational mirror of CLAUDE.md (repo root), which is canonical for agent rules."
related: ["CLAUDE.md", "PRD Ava Study Mode and MVP Engineering Roadmap.md", "Project Charter"]
---

## What this project is
Building a PWA SAT tutor for one student (Ava) targeting 1500+[cite: 1, 2].
Next.js (App Router, TypeScript) + Tailwind + Supabase (Postgres/Auth/RLS)[cite: 2]
+ Anthropic API + Recharts[cite: 2]. Deployed to Vercel[cite: 2]. Local path:
C:\Users\go2si\sat-prep-coach-app[cite: 4]

## Source of truth
Two documents in project knowledge:
1. PRD — "PRD Ava Study Mode and MVP Engineering Roadmap.md" (Governs WHAT to build and HOW)[cite: 1]
2. Charter — "Project Charter and Proposal_AI SAT COACH.md" (Governs WHEN: version gates, LOCK/STUB/DEFER register)[cite: 3]
If anything conflicts, PRD wins for implementation detail, Charter wins for scope[cite: 3]. If a request conflicts with either, flag it before building[cite: 3].

## Phase discipline (hard rule)
Build in phases per the PRD[cite: 1, 2]. Never start a later phase without my explicit go-ahead[cite: 2]. Never pull v2/v3 features into v1 — if I ask for something that belongs to a later version, say so and add it to the DEFER register instead of building it[cite: 3].

## Locked invariants (never violate, never "simplify away")
- user_id on all student-state tables; RLS user_id = auth.uid()[cite: 2]
- Composite PKs (user_id, skill_id) on mastery and skill_notes[cite: 2]
- No hardcoded user ID anywhere; identity from auth session only[cite: 1, 2]
- All Anthropic calls through lib/ai only; every call logged to ai_log; ceiling enforced with static-rationale fallback (degrade, never block)[cite: 2]
- lib/ modules import nothing from app/, components/, next, or react; DB access only via lib/db[cite: 2]
- Schema changes ship ONLY as migration files in supabase/migrations/[cite: 2]
- Secrets in .env.local (gitignored) and Vercel env only; service-role key and Anthropic key server-side only[cite: 2]
- coach_memory is append-only; timestamptz everywhere[cite: 2]

## Working rules
- Lead with the answer or the code. No preamble, no filler.
- Make implementation decisions yourself as the domain expert; only ask me when a decision is genuinely irreversible or changes scope.
- When something breaks, state cause and fix — no apology loops.
- Verify against the PRD before inventing structure; don't re-ask things the PRD already answers[cite: 1].
- After completing meaningful work, state: what was built, what phase we're in, and the single next action[cite: 1].
- Session history lives as one file per session under `00 SYSTEM/SESSION_LOG/` (indexed at `00 SYSTEM/SESSION_LOG/00_INDEX.md`) — see `CLAUDE.md`'s "End-of-session routine."
- All AI outputs go to: `C:\Users\go2si\sat-prep-coach-app\00 SYSTEM\AI OUTPUTS`.

## Always Update & Sign-off Routine
For every interaction, always include:
1. **Agent Handoff of Proposed Work:** A direct outline of the next physical steps.
2. **Completed Work, Files Touched, and Sign-off:** Sign off using your AI name, current date, and time. (e.g., *Gemini 7/17/26 2:10 AM*).
3. **Be Proactive:** If there is a measurably better, safer, or cleaner way to write an algorithm, implement a database helper, or structure prompt validation, suggest it. Do not suggest changes just for the sake of talking.

## Wiki & Documentation structure
- `09 WIKI\` holds documentation only: `DEV/` (engineering how-tos, replication guide), `USER/` (student + parent manuals), `GLOSSARY.md`, `TAXONOMY.md`, `OPERATIONS_MANUAL.md`.
- The wiki NEVER owns rules or definitions that live in the PRD, Charter, or CLAUDE.md — it links to them and adds explanation only. One-directional: canonical sources → wiki, never the reverse.
- Wiki pages are updated as part of completing each build phase, written against the actual code, per the wiki schedule in `00_INDEX.md`.