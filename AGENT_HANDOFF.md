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
| `01 DOCS/02_phase1-contracts.md` | Validation, Types & Backend Safety | **COMPLETE** |
| `01 DOCS/03_Phase2-scoring-ai.md` | Study Lesson AI Engine | NOT STARTED |
| `01 DOCS/04_phase3-study-ui.md` | Study Routes & UI | NOT STARTED |
| `01 DOCS/05_phase4-integration.md` | Entry Points & Dashboard Integration | NOT STARTED |
| `01 DOCS/06_phase5-eng-quality.md` | Engineering Quality & Observability | NOT STARTED |

---

## App build status

**Prior phases (v1 foundation → Phase 3 Visibility): CODE-COMPLETE AND PUSHED.**

What's built: Supabase schema + RLS, skill seed, diagnostic flow, practice session loop, miss-loop with tiered hints, BKT + FSRS mastery updates, behavior signals, score prediction, `/mastery` goal tree, `/tests` practice test journal, route groups `(student)/(parent)/(admin)`.

**Phase 1 (contracts): COMPLETE.** `lib/validation/miss-loop.ts`, `lib/validation/study.ts` created. `lib/ai/index.ts` and `lib/db/index.ts` updated with `study_lesson` call type and fallback logging. `app/api/miss-loop/route.ts` fully Zod-validated. `tsc --noEmit` passes clean.

**What's not built:** Study Mode (SM-1 through SM-13), engineering hardening (ENG-1 through ENG-9), structured learner profile (ARCH-1). Phases 2–5.

---

## Active phase: Phase 2 — `01 DOCS/03_Phase2-scoring-ai.md`

Phase 1 is complete. The next action is to **begin Phase 2** per `01 DOCS/03_Phase2-scoring-ai.md`.

Start next session by reading the 3 orientation files, then `03_Phase2-scoring-ai.md` as the phase doc.

---

## Open items (not blocking Phase 2)

- Git: Phase 1 files are untracked/modified. Commit: `git add lib/validation/ lib/ai/index.ts lib/db/index.ts app/api/miss-loop/route.ts 02\ SESSION_LOG/ AGENT_HANDOFF.md && git commit -m "feat: Phase 1 — Zod validation contracts, study_lesson type, fallback logging"`
- Tailwind styling regression: cleared `.next` cache this session. Verify styles are restored at `localhost:3000` after `npm run dev`.
- GitHub secrets for DB backup workflow not set; workflow has never run.
- Next.js major-version CVEs unpatched (`next@16.2.10` — affects `cookies()`/`headers()` in 3 files).
- Untracked junk: `test_write_check.tmp`, `supabase/.temp/test_b64.txt`, `ss ux*.png` — add to `.gitignore` or delete.
- Two orphaned prototype files: `app/components/MissLoopReview.tsx`, `app/miss-loop/page.tsx` — reconcile or delete.
- `raw notes sf.md` has two unreviewed files: `OPUS REVIEW.md`, `prd and what i need _this.md`.

---

## Standing notes

- **Two AI agents have push access:** Gemini (works locally with Sienna) and Claude (works in sandbox). Commits under "AI Coach Build Bot <bot@sf-dev-systems.com>" are Sienna's identity. Check `git log --oneline HEAD..origin/main` early in each session for divergent histories.
- Sandbox cannot delete/rename files (`rm`, `git mv` fail "Operation not permitted") — overwrite content in place.
- `middleware.ts` runs on every route except static assets — new no-session endpoints (crons, webhooks) need their path in `PUBLIC_PATHS`.
- Ava's PSAT baseline: Math 500 / RW 610 (1110 composite). Log at `/tests` to activate real-time predictive scoring.

---

**SIGN-OFF:** Phase 1 complete — all 5 backend contracts locked, tsc clean. Next: Phase 2 (`03_Phase2-scoring-ai.md`). — Claude (Sonnet 4.6) 7/17/26
