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
| `01 DOCS/04_phase3-study-ui.md` | Study Routes & UI | NOT STARTED |
| `01 DOCS/05_phase4-integration.md` | Entry Points & Dashboard Integration | NOT STARTED |
| `01 DOCS/06_phase5-eng-quality.md` | Engineering Quality & Observability | NOT STARTED |

---

## App build status

**Prior phases (v1 foundation → Phase 3 Visibility): CODE-COMPLETE AND PUSHED.**

**Phase 1 + Phase 2: COMPLETE AND COMMITTED.**

What's now built in addition to the v1 foundation:
- `lib/validation/miss-loop.ts` + `lib/validation/study.ts` — Zod schemas for both APIs
- `lib/ai/index.ts` — `study_lesson` call type; fallback logging on over-ceiling + error paths
- `lib/db/index.ts` — 4 study context fetch helpers
- `app/api/miss-loop/route.ts` — fully Zod-validated, zero `as any` casts
- `prompts/study.ts` — VARK-directive study lesson prompt with full context injection
- `app/api/study/lesson/route.ts` — POST endpoint with parallel fetch, AI call, schema validation, three-path static fallback

**What's not built:** Study Mode UI (SM-1 through SM-13), entry points & dashboard integration, engineering hardening (ENG-1 through ENG-9). Phases 3–5.

---

## Active phase: Phase 3 — `01 DOCS/04_phase3-study-ui.md`

Phase 2 is complete. The next action is to **begin Phase 3** per `01 DOCS/04_phase3-study-ui.md`.

Start next session by reading the 3 orientation files, then `04_phase3-study-ui.md` as the phase doc.

---

## Open items (not blocking Phase 3)

- Tailwind styling regression: cleared `.next` cache this session. Verify styles are restored at `localhost:3000` after `npm run dev`.
- Session log + handoff updated but not yet committed — commit: `git add "02 SESSION_LOG/" AGENT_HANDOFF.md && git commit -m "docs: Phase 2 session log and handoff update"`
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

**SIGN-OFF:** Phases 1 + 2 complete — all backend contracts + AI engine locked, tsc clean. Next: Phase 3 (`04_phase3-study-ui.md`). — Claude (Sonnet 4.6) 7/17/26
