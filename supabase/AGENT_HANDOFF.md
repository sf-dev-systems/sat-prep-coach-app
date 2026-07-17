
v55
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

---

## Active phase: Content Ingestion Pipeline (post-Phase-5)

No phase doc. Work tracked in session logs.

### Question bank status (as of 2026-07-17)

| Source | Section | Questions | Status |
|---|---|---|---|
| SAT Test 4 | Math | ~129 | Imported (prior sessions) |
| SAT Test 4 | Reading & Writing | 66 | **Imported this session** |
| SAT Tests 1–3, 5–8 | All | 0 | Not yet extracted |
| PSAT Tests | All | 0 | Not yet extracted |

Total DB: ~195 questions.

### This session — completed
1. ✅ **DB migration**: `ALTER TABLE questions ADD COLUMN IF NOT EXISTS media_urls JSONB DEFAULT NULL;`
   - Migration file: `supabase/migrations/20260717000000_add_media_urls_to_questions.sql`
2. ✅ **Supabase Storage bucket**: `question-assets` created (public) via MCP SQL
3. ✅ **Test 4 RW import**: 66 questions extracted from 3 PDFs, imported via `npm run import-bank`
   - Verified: 0 SEVERE in `npm run audit:question-bank`
   - 2 chart questions flagged: `T4-RW-M1-Q13`, `T4-RW-M2-Q13` (media_urls = `["PLACEHOLDER_UPLOAD_NEEDED"]`)
4. ✅ **Import script updated**: `scripts/import-official-bank.ts` now passes `media_urls` through
5. ✅ **Skill distribution**: 10 skills covered, 12 Words in Context, 10 Command of Evidence, 10 Boundaries, 8 Rhetorical Synthesis (good spread)

### Single next action

**Add rationales for the 66 RW questions** (batch pass using already-extracted `test4_explanations.txt` in scratchpad — NOTE: scratchpad is session-scoped; re-extract if it's gone). This unlocks full AI coach explanations for wrong answers.

After rationales: extract Test 4 Math rationales (same pipeline), then begin Test 5 or 6 extraction for more content diversity.

---

## Open items (carry-forward)

- **Chart image uploads**: `T4-RW-M1-Q13` (organic farms bar chart) and `T4-RW-M2-Q13` (UK economic policy uncertainty line graph) need PNG/SVG extracted from the PDFs and uploaded to `question-assets` bucket. Then update those rows' `media_urls` with the real URLs.
- **Rationales missing**: All 66 RW questions have `rationale: null`. Low urgency (WARN only), but needed for the miss-loop explanation step.
- Tailwind styling regression: verify at `localhost:3000` after signing in.
- GitHub secrets for DB backup workflow not set; never run.
- `next@14.2.35` CVEs — upgrade to latest 14.x or 15.x.
- Untracked junk: `test_write_check.tmp`, `supabase/.temp/test_b64.txt`, `ss ux.png`, `ss ux_1.png`.
- Full end-to-end study flow never manually tested in browser (needs live auth).
- Study/miss-loop UIs need `<Image/>` component for `media_urls` (do after first chart images uploaded).

---

## Standing notes

- **End every session with a next-session prompt** — a fenced code block Sienna can paste directly.
- **Two AI agents have push access:** Gemini (local) and Claude (sandbox). Commits under "AI Coach Build Bot <bot@sf-dev-systems.com>" are Sienna's identity. Check `git log --oneline HEAD..origin/main` early each session.
- Sandbox cannot delete/rename files — overwrite in place.
- `middleware.ts` — new no-session endpoints need their path in `PUBLIC_PATHS`.
- Ava's PSAT baseline: Math 500 / RW 610 (1110). Log at `/tests` to activate predictive scoring.
- Supabase project ID: `ckuhtjrnnqjnrgpuurlr`

---

**SIGN-OFF:** Test 4 RW (66 questions) extracted and imported; media_urls column + question-assets bucket live. — Claude (Sonnet 4.6) 7/17/26 ~4:47 AM EDT
