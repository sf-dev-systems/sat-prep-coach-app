
v54
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
| `01 DOCS/06_phase5-eng-quality.md` | Engineering Quality & Observability | **COMPLETE** (bfe85c9) |

---

## App build status

**All 5 phases COMPLETE AND COMMITTED.**

### What was built in Phase 5 (bfe85c9)
- `package.json` — `typecheck`, `test`, `test:watch`, `audit:question-bank` scripts
- `vitest.config.ts` — Vitest node environment config
- `lib/learner-profile.ts` — `AVA_LEARNER_PROFILE` typed const (VARK, lesson constraints, instructional style)
- `lib/constants.ts` — now re-exports `AVA_LEARNER_PROFILE`; raw VARK string removed
- `prompts/study.ts` — VARK directive derived from `AVA_LEARNER_PROFILE`
- `app/api/miss-loop/route.ts` — VARK string derived from `AVA_LEARNER_PROFILE`
- `scripts/audit-question-bank.ts` — severity-graded DB audit (exit 1 on SEVERE)
- `__tests__/validation/miss-loop.test.ts` (4 tests)
- `__tests__/validation/study.test.ts` (5 tests)
- `__tests__/mastery/dashboard.test.ts` (3 tests)
- `__tests__/scoring/predictive-score.test.ts` (10 tests, incl. PRD §10 Scenario 1)

**Acceptance criteria:**
- [x] `npm run typecheck` → 0 errors
- [x] `npm test` → 22/22 passing
- [x] `npm run audit:question-bank` → runs without crashing (needs live DB)
- [x] `lib/learner-profile.ts` exports `AVA_LEARNER_PROFILE`
- [x] `prompts/study.ts` imports from `lib/learner-profile.ts`
- [x] No `(body as any)` in `app/api/`

---

## Active phase: COMPLETE — all 5 phases done. Content ingestion pipeline next.

No active phase doc.

### Built this session
- `app/(student)/page.tsx` — Study CTA → 2-card grid: Study (indigo) + Review (amber → `/miss-loop`).
- `lib/learner-profile.ts` — `skillModalityOverrides` map: 4 skills (Command of Evidence, Statistics & Probability, Area & Volume, Triangles & Circles) carry VARK-compensating instructions for Ava's low Visual score (7).
- `prompts/study.ts` — `modalityNote?: string` added to `StudyPromptContext`; injected as `MODALITY OVERRIDE` block in system prompt.
- `app/api/study/lesson/route.ts` — looks up `skill.name` in overrides, passes `modalityNote` to prompt.
- `typecheck` → 0 errors on all changes.

### Decided (not yet built) — DO THESE FIRST NEXT SESSION
1. **DB migration**: `ALTER TABLE questions ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT NULL;`
2. **Supabase Storage**: Create public bucket `question-assets` (Supabase dashboard → Storage → New bucket).
3. **Extraction script**: AI reads `00 SYSTEM/Practice Test Library/SAT_Digital_Tests/SAT_Test_4_*.pdf` → structured JSON → QC vs Scoring Guide → `npm run import-bank`.
   - Priority: Test 4 RW (54 questions, zero RW in DB today).
   - For chart questions: extract image, upload to `question-assets`, store URL in `media_urls`.

---

## Open items (carry-forward)

- Tailwind styling regression: verify at `localhost:3000` after signing in.
- GitHub secrets for DB backup workflow not set; never run.
- `next@14.2.35` CVEs — upgrade to latest 14.x or 15.x.
- Untracked junk: `test_write_check.tmp`, `supabase/.temp/test_b64.txt`, `ss ux.png`, `ss ux_1.png`.
- Full end-to-end study flow never manually tested in browser (needs live auth).
- Study/miss-loop UIs need `<Image/>` component for `media_urls` (do after first import confirms image pipeline works).

---

## Standing notes

- **End every session with a next-session prompt** — a fenced code block Sienna can paste directly.
- **Two AI agents have push access:** Gemini (local) and Claude (sandbox). Commits under "AI Coach Build Bot <bot@sf-dev-systems.com>" are Sienna's identity. Check `git log --oneline HEAD..origin/main` early each session.
- Sandbox cannot delete/rename files — overwrite in place.
- `middleware.ts` — new no-session endpoints need their path in `PUBLIC_PATHS`.
- Ava's PSAT baseline: Math 500 / RW 610 (1110). Log at `/tests` to activate predictive scoring.

---

**SIGN-OFF:** VARK modality overrides built; image ingestion architecture decided; question bank gap noted. — Claude (Sonnet 4.6) 7/17/26
