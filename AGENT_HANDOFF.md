
v51
# AGENT HANDOFF

> ⚠️ **Read this before trusting any sandbox file/build error.** The sandbox's
> FUSE mount can silently truncate reads/writes and cause phantom `tsc`/build
> errors. Cross-check any sandbox result against the host-side `Read` tool.
> Never run `git add`/`commit`/`push` from the sandbox — hand exact commands
> to Sienna's machine.

---

## How to pick up a session (3 files, then ask)

1. Read this file (`AGENT_HANDOFF.md`) — current state, what's next.
2. Read `01 DOCS/01_sys-context.md` — always-on: invariants, VARK, folder layout, secrets rules.
3. Read the **current phase doc** (see "Active phase" below) — locked contracts, task list, acceptance criteria.

Do not load the full v1.5 PRD. The phase docs contain everything needed to execute. The PRD lives at `01 DOCS/v1-5_PRD Ava Study Mode & Master Engineering Roadmap.md` for reference only.

---

## Phase doc index

| Doc | Phase | Status |
|-----|-------|--------|
| `01 DOCS/02_phase1-contracts.md` | Validation, Types & Backend Safety | **COMPLETE** (5a2d81d) |
| `01 DOCS/03_Phase2-scoring-ai.md` | Study Lesson AI Engine | **COMPLETE** (dc12458) |
| `01 DOCS/04_phase3-study-ui.md` | Study Routes & UI | **COMPLETE** (6fda198) |
| `01 DOCS/05_phase4-integration.md` | Entry Points & Dashboard Integration | **COMPLETE** (d81c81b) |
| `01 DOCS/06_phase5-eng-quality.md` | Engineering Quality & Observability | NOT STARTED |

---

## App build status

**Phases 1–4: COMPLETE AND COMMITTED.**

What was built across Phase 1–4 (on top of v1 foundation):
- `lib/validation/` — Zod schemas for miss-loop + study APIs
- `lib/ai/index.ts` — `study_lesson` call type, fallback logging, ceiling enforcement
- `lib/db/index.ts` — 4 study context fetch helpers
- `lib/mastery/dashboard.ts` — `StudentSetupState` union, confidence interval clamping [400,1600], `FocusSkill.id`
- `prompts/study.ts` — VARK-directive study lesson prompt
- `app/api/study/lesson/route.ts` — POST endpoint with parallel fetch, AI call, 3-path fallback
- `app/api/skill-notes/route.ts` — append-only POST
- `app/(student)/study/page.tsx` — landing with top focus skill hero card
- `app/(student)/study/[skillId]/page.tsx` — lesson page (server component)
- `components/study/StudyMode.tsx` — 8-step client component with inline save error
- `app/(student)/page.tsx` — Study CTA card linking to `/study/${focusSkills[0].id}`; `SetupGate` branches on `StudentSetupState`
- `app/(student)/mastery/page.tsx` — Study+Drill sibling buttons; visible `errorMsg` on note save failure

**What's not built:** Engineering quality & observability (Phase 5).

---

## Active phase: Phase 5 — `01 DOCS/06_phase5-eng-quality.md`

Phase 4 is complete and committed. Next session: read `06_phase5-eng-quality.md` and begin.

**First action next session:** No uncommitted changes — read the phase doc directly and begin.

---

## Open items (not blocking Phase 4)

- Tailwind styling regression: cleared `.next` cache in an earlier session. Verify styles are restored at `localhost:3000` after `npm run dev`.
- GitHub secrets for DB backup workflow not set; workflow has never run.
- Next.js major-version CVEs unpatched (`next@16.2.10` — affects `cookies()`/`headers()` in 3 files).
- Untracked junk: `test_write_check.tmp`, `supabase/.temp/test_b64.txt`, `ss ux*.png` — add to `.gitignore` or delete.
- Two orphaned prototype files: `app/components/MissLoopReview.tsx`, `app/miss-loop/page.tsx` — reconcile or delete.
- `raw notes sf.md` has two unreviewed files: `OPUS REVIEW.md`, `prd and what i need _this.md`.
- Study flow not yet manually driven in browser (requires live Supabase auth session).

---

## Standing notes

- **End every session with a next-session prompt** — a fenced code block Sienna can paste directly to start the next session. Include: phase status table, first action (e.g., commit pending changes), and active phase doc filename.
- **Two AI agents have push access:** Gemini (works locally with Sienna) and Claude (works in sandbox). Commits under "AI Coach Build Bot <bot@sf-dev-systems.com>" are Sienna's identity. Check `git log --oneline HEAD..origin/main` early in each session for divergent histories.
- Sandbox cannot delete/rename files (`rm`, `git mv` fail "Operation not permitted") — overwrite content in place.
- `middleware.ts` runs on every route except static assets — new no-session endpoints (crons, webhooks) need their path in `PUBLIC_PATHS`.
- Ava's PSAT baseline: Math 500 / RW 610 (1110 composite). Log at `/tests` to activate real-time predictive scoring.

---

**SIGN-OFF:** Phase 4 complete — Study CTA card, Study+Drill sibling buttons, StudentSetupState, confidence interval clamping, note save error UX. tsc + next build clean. Next: Phase 5 (`06_phase5-eng-quality.md`). — Claude (Sonnet 4.6) 7/17/26
