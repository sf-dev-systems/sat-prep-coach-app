---
title: Project Instructions
type: instructions
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
note: "Operational mirror of CLAUDE.md (repo root), which is canonical for agent rules."
related: ["CLAUDE.md", "PRD v1", "Project Charter"]
---

## What this project is
Building a PWA SAT tutor for one student (my daughter) targeting 1500+.
Next.js (App Router, TypeScript) + Tailwind + Supabase (Postgres/Auth/RLS)
+ Anthropic API + Recharts. Deployed to Vercel. Local path:
C:\Users\go2si\SIENNA_CRM\03-PROJECTS\sat-prep-coach-app

## Source of truth
Two documents in project knowledge:
1. PRD — governs WHAT to build and HOW (schema, flows, folder layout)
2. Charter — governs WHEN (version gates, LOCK/STUB/DEFER register)
If anything conflicts, PRD wins for implementation detail, Charter wins
for scope. If a request conflicts with either, flag it before building.

## Phase discipline (hard rule)
Build in phases per the PRD. Never start a later phase without my
explicit go-ahead. Never pull v2/v3 features into v1 — if I ask for
something that belongs to a later version, say so and add it to the
DEFER register instead of building it.

## Locked invariants (never violate, never "simplify away")
- user_id on all student-state tables; RLS user_id = auth.uid()
- Composite PKs (user_id, skill_id) on mastery and skill_notes
- No hardcoded user ID anywhere; identity from auth session only
- All Anthropic calls through lib/ai only; every call logged to ai_log;
  ceiling enforced with static-rationale fallback (degrade, never block)
- lib/ modules import nothing from app/, components/, next, or react;
  DB access only via lib/db
- Schema changes ship ONLY as migration files in supabase/migrations/
- Secrets in .env.local (gitignored) and Vercel env only; service-role
  key and Anthropic key server-side only
- coach_memory is append-only; timestamptz everywhere

## Working rules
- Lead with the answer or the code. No preamble, no filler.
- Make implementation decisions yourself as the domain expert; only ask
  me when a decision is genuinely irreversible or changes scope.
- When something breaks, state cause and fix — no apology loops.
- Verify against the PRD before inventing structure; don't re-ask things
  the PRD already answers.
- After completing meaningful work, state: what was built, what phase
  we're in, and the single next action.
- Keep a running SESSION_LOG.md at repo root: date, what changed,
  decisions made, open items. Update it at the end of every session.



ALWAYS UPDATE:
1) AGENT HANDOFF OF PROPOSED WORK, 
2) COMPLETED WORK, FILES TOUCHED, AND SIGN OFF AS (NAME OF AI: SONNET, OPUS, FABLE, GEMINI PRO, ETC  AND  DATE AND TIME)  EX:  Sonnet 7/10/26 3:27 PM 
3) BE PROACTIVE. IF THERE IS A BETTER WAY , SUGGEST IT. BUT do not make suggestions just for the sake off.  
4) All AI outputs go to : C:\Users\go2si\sat-prep-coach-app\00 SYSTEM\AI OUTPUTS. 



- 09 WIKI\ holds documentation only: DEV/ (engineering how-tos,
  replication guide), USER/ (student + parent manuals), GLOSSARY.md,
  TAXONOMY.md, OPERATIONS_MANUAL.md.
- The wiki NEVER owns rules or definitions that live in the PRD,
  Charter, or CLAUDE.md — it links to them and adds explanation only.
  One-directional: canonical sources → wiki, never the reverse.
- Wiki pages are updated as part of completing each build phase,
  written against the actual code, per the wiki schedule in 00_INDEX.md.





