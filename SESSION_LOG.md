# SESSION LOG

Running log of what changed each working session: date, what changed,
decisions made, files touched open items.  Must be detailed. 
Update at the end of every session. 
NEVER REWRITE, DELETE, OVERWRITE. USE STRIKETRHOUGH IF NEEDED. 

---

## 2026-07-10 — Planning review & repo hygiene (Opus)

**What changed**
- Renamed `CLAUDE.MD.md` -> `CLAUDE.md`.
- Created `.gitignore` (Next.js + env + Obsidian workspace state).
- Created `.env.example` (safe template) and `.env.local` (real secrets, gitignored).

**Decisions made**
- Folder is BOTH the code repo and the docs/planning vault.
- Real app code will live in lowercase folders (`app/`, `lib/`, etc.);
  the numbered `01`–`07` folders were empty code-mirrors and are slated
  for deletion (pending user confirm) to avoid colliding with the scaffold.

**Open items**
- Confirm deletion of empty numbered code-mirror folders (`01 APP` ... `07 PUBLIC`)
  and empty `99 ARCHIVE/archived_*`.
- Reconcile PRD v1 with raw notes + Charter deltas (append-only coach_memory,
  profiles/config/events tables). Decide on 3 GPT-enhancement reductions.
- Old empty stubs `env local.md` / `gitignore.md` need deletion (bash can't;
  needs user/delete-tool).

---

## 2026-07-10 — Foundation cleanup executed (Opus)

**COMPLETED (files touched)**
- Deleted empty code-mirror folders: `01 APP`, `02 LIB`, `03 PROMPTS`,
  `04 COMPONENTS`, `05 SUPABASE`, `06 SCRIPTS`, `07 PUBLIC`; all empty
  `99 ARCHIVE/archived_*`; dead stubs `env local.md`, `gitignore.md`,
  stray `.gitignore_test`.
- Renamed `AGENT HANDOFF.md` -> `AGENT_HANDOFF.md`;
  `Project Instructions_DRAFT.md` -> `Project Instructions.md`.
- Scaffolded `09 WIKI/`: `00_INDEX.md`, `GLOSSARY.md`, `TAXONOMY.md`,
  `OPERATIONS_MANUAL.md`, `DEV/SETUP.md`, `USER/STUDENT_MANUAL.md`,
  `USER/PARENT_MANUAL.md` — all with YAML front-matter.
- Added YAML front-matter to `Project Charter…md`, `Project Instructions.md`.
- Populated `README.md` (project, folder map, source-of-truth hierarchy,
  secrets rules, session routine, phases).
- Revised `PRD v1.md` -> **v1.1**: archived v1.0 to
  `99 ARCHIVE/archived_docs/archive_2026-07-10_PRD v1.md`. Merged Charter §5
  deltas (`profiles`/`config`/`events`, append-only `coach_memory`,
  `license`/`external_id`, ceiling order, `authorizeParentView`, backups,
  no-PII). Added GPT bucket-A/B: goal tree (`parent_skill_id` + `/mastery`
  view), tiered hints (up to 3), harder-question-after-success, focus length
  + time-of-day in `behavior_signals`. Kept bucket-C cut.
- Secrets: created `.env.local` (gitignored) as the sole home; redacted all
  live keys/password from `PRD v1.md`, `raw notes sf.md`, the PRD archive,
  and user file `OPUS REVIEW.md`. Verified only `.env.local` holds them.
- Updated `CLAUDE.md`: end-of-session routine now = AGENT_HANDOFF +
  SESSION_LOG + affected WIKI pages + sign-off; file-location + source-of-
  truth sections corrected for the combined repo/vault layout.

**DECISIONS**
- Code folders = lowercase, no numbers/spaces (Next.js requirement); doc
  folders keep numbers. They coexist in one repo.
- SESSION_LOG.md + AGENT_HANDOFF.md live at repo root (matches README +
  Project Instructions); AI OUTPUTS is for other deliverables.
- PRD faithfully reflects raw notes; the only substantive changes were the
  owner-approved GPT additions (bucket A + cheap B) and the FABLE-argued cuts
  (bucket C) left in place.

**OPEN ITEMS**
- Review the two new files in SF RAW NOTES (`OPUS REVIEW.md`,
  `prd and what i need _this.md`) for un-captured intent.
- Phase 1 not started — see AGENT_HANDOFF.md.

**SIGN-OFF:** Opus — 7/10/26 4:23 PM

---

## 2026-07-10 — Phase 1 Scaffolding and Foundation Implementation (Gemini)

**COMPLETED (work + files touched)**
- **Next.js Scaffold Configuration:** Setup `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js` to build App Router with TypeScript and Tailwind CSS.
- **Root Styles & Global Layout:** Touched `app/globals.css`, `app/layout.tsx`.
- **Student Dashboard Landing Screen:** Touched `app/page.tsx` creating a full visual dashboard.
- **Supabase Client Setup & Typed Core:** Touched `lib/db/index.ts` containing all portable database interface functions.
- **Daily Cost Cap & Anthropic Wrapper:** Touched `lib/ai/index.ts` establishing standard cost control and model gateways.
- **Session Assembler:** Touched `lib/sessions/index.ts` assembling simple 15-25 practice sets.
- **Scoring Prediction Logic:** Created `lib/scoring/predictive-score.ts` to implement the executable mathematical formulas for Base Mastery and Strategy Multipliers.
- **Database Schema Migration & Remote Deployment:** Touched `supabase/migrations/20260710000000_initial_schema.sql` and deployed all tables and RLS rules live to Supabase.
- **Scheduled Backups Specification:** Touched `supabase/BACKUPS.md` outlining daily backup protocols.
- **Seeding, Custom Taxonomy, & Live Verification:** Updated `scripts/seed-skills.ts` with custom SAT taxonomy tree and upsert safety checks; created `scripts/verify-seed.ts` to confirm 3 sections, 11 domains, 29 leaf skills, and perfect parent linking on the remote database. Deployed and verified live!
- **AI Prompt Templates:** Touched `prompts/tutor.ts`, `prompts/hint.ts`, `prompts/coach.ts`, `prompts/classifier.ts`, `prompts/generator.ts`, `prompts/reporter.ts`.
- **System Documentation & Invariants:** Created `00 SYSTEM/docs/SYSTEM_ARCHITECTURE.md` to define the statistical tree weights and prediction formulas; updated `CLAUDE.md` to record the model as a locked invariant.
- **Git Deployment & Handoff:** Deployed the whole Phase 1 Foundation to GitHub on branch `main` at commit `6f942b1`; finalized the `AGENT_HANDOFF.md` with explicit commit references and pushed at commit `793afda`.
- **Vercel Deploy Optimization:** Added `vercel.json` in the project root to explicitly configure Next.js as the deployment framework, committed and pushed at commit `fc35a6d`.

**DECISIONS**
- Database access is strictly isolated inside `lib/db/` and contains absolutely no framework or UI-specific dependencies to guarantee portability.
- Used standard `supabase link` to link local code safely with the remote ref (`ckuhtjrnnqjnrgpuurlr`), solving local DNS routing barriers automatically.
- Deployed a custom verification script `scripts/verify-seed.ts` to perform mathematical tree hierarchy assertions on the remote Supabase database.
- Explicitly defined the framework setting `"framework": "nextjs"` in `vercel.json` to prevent any automated deployment misdetections on Vercel.

**SIGN-OFF:** Gemini — 7/10/26 6:25 PM

---

## 2026-07-10 — Phase 2 Start: Failure Classification & MissLoop Scaffolding (Gemini)

**COMPLETED (work + files touched)**
- **Failure Classification Module:** Created `lib/ai/classifier.ts` as a pure, portable module to distinguish content gaps from strategy gaps.
- **Miss Loop Core Component:** Created `components/session/MissLoop.tsx` to handle the multi-phase pedagogical state machine.
- **Miss Loop React Hook:** Created `components/session/useMissLoop.ts` to connect the UI outcome state directly with the remote Supabase attempts table.
- **Governance Updates:** Updated `CLAUDE.md`'s Document Revision policy to strictly declare `AGENT_HANDOFF.md` as cumulative and non-overwriteable (similar to `SESSION_LOG.md`).
- **Compilation Check:** Verified 100% successful type-safety compilation via `npx tsc --noEmit`.

**DECISIONS**
- Created `lib/ai/classifier.ts` under the portable core (strictly keeping it free of framework imports like React) to resolve the import dependency in the `MissLoop` component.
- Adapted `useMissLoop` to query `getSupabaseClient` (our portable DB helper), dynamically fetch the active `user_id` from the auth session, and map high-level loop modes into valid Postgres `error_type` check constraints (`concept` / `timing`).

**SIGN-OFF:** Gemini — 7/10/26 6:50 PM

---
