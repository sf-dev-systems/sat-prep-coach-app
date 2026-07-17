
v50
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
| `01 DOCS/04_phase3-study-ui.md` | Study Routes & UI | **COMPLETE** (uncommitted) |
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

**What's not built:** Entry points & dashboard integration (Phase 4), engineering hardening (Phase 5).

**Phase 3 additions (uncommitted):**
- `lib/mastery/dashboard.ts` — `FocusSkill.id` added
- `app/(student)/study/page.tsx` — landing page (auth-gated server component)
- `app/(student)/study/[skillId]/page.tsx` — lesson page (server component)
- `components/study/StudyMode.tsx` — 8-step client component
- `app/api/skill-notes/route.ts` — POST, append-only skill notes

---

## Active phase: Phase 4 — `01 DOCS/05_phase4-integration.md`

Phase 3 is complete. Next session: read `05_phase4-integration.md` and begin.

**First action next session:** commit Phase 3 changes:
```
git add lib/mastery/dashboard.ts "app/(student)/study/" components/study/ app/api/skill-notes/ "02 SESSION_LOG/" AGENT_HANDOFF.md .claude/launch.json
git commit -m "feat: Phase 3 — Study Routes & UI (landing page, lesson page, StudyMode component, skill-notes route)"
```

Also recommended before Phase 4: manually walk through the 8-step study flow at `localhost:3000` — tsc + build clean but live UI drive required Supabase auth session not available in this environment.

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

- **End every session with a next-session prompt** — a fenced code block Sienna can paste directly to start the next session. Include: phase status table, first action (e.g., commit pending changes), and active phase doc filename.
- **Two AI agents have push access:** Gemini (works locally with Sienna) and Claude (works in sandbox). Commits under "AI Coach Build Bot <bot@sf-dev-systems.com>" are Sienna's identity. Check `git log --oneline HEAD..origin/main` early in each session for divergent histories.
- Sandbox cannot delete/rename files (`rm`, `git mv` fail "Operation not permitted") — overwrite content in place.
- `middleware.ts` runs on every route except static assets — new no-session endpoints (crons, webhooks) need their path in `PUBLIC_PATHS`.
- Ava's PSAT baseline: Math 500 / RW 610 (1110 composite). Log at `/tests` to activate real-time predictive scoring.

---

**SIGN-OFF:** Phase 3 complete — /study landing, /study/[skillId] lesson page, StudyMode 8-step component, /api/skill-notes route. tsc + next build clean. Next: Phase 4 (`05_phase4-integration.md`). — Claude (Sonnet 4.6) 7/17/26
