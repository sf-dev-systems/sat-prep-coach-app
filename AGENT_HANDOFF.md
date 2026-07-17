v58
# AGENT HANDOFF

> The sandbox Write tool has a FUSE mount issue — use PowerShell to write this file.

---

## How to pick up a session (3 files, then ask)

1. Read this file (`AGENT_HANDOFF.md`) — current state, what's next.
2. Read `01 DOCS/01_sys-context.md` — always-on: invariants, VARK, folder layout, secrets rules.
3. Read the current phase doc (see Phase doc index below).

---

## Phase doc index

| Doc | Phase | Status |
|-----|-------|--------|
| `01 DOCS/02_phase1-contracts.md` | Validation, Types & Backend Safety | COMPLETE (5a2d81d) |
| `01 DOCS/03_Phase2-scoring-ai.md` | Study Lesson AI Engine | COMPLETE (dc12458) |
| `01 DOCS/04_phase3-study-ui.md` | Study Routes & UI | COMPLETE (6fda198) |
| `01 DOCS/05_phase4-integration.md` | Entry Points & Dashboard Integration | COMPLETE (d81c81b) |
| `01 DOCS/06_phase5-eng-quality.md` | Engineering Quality & Observability | COMPLETE (bfe85c9) |

All 5 phases COMPLETE AND COMMITTED.

---

## Active phase: Content Ingestion Pipeline (post-Phase-5)

### Question bank status (as of 2026-07-17)

| Source | Section | Questions | Status |
|---|---|---|---|
| SAT Test 4 | Math | ~129 | Imported |
| SAT Test 4 | Reading & Writing | 66 | Imported (rationales + 2 chart images) |
| SAT Test 5 | Reading & Writing | 66 | Imported (rationales + 2 chart images) |
| SAT Test 6 | Reading & Writing | 66 | Imported (rationales + 3 chart images) |
| SAT Test 7 | Reading & Writing | 66 | Imported this session (rationales + 3 chart images) |
| SAT Tests 1-3, 8-11 | All | 0 | Not yet extracted |
| PSAT Tests | All | 0 | Not yet extracted |

Total DB: **393 questions** (0 SEVERE, 22 WARN = pre-existing PLACEHOLDERs).

### Completed this session
- T7-RW: 66 questions extracted from `SAT_Test_7_PracticeTest.pdf` via PyMuPDF
  - **PDF quirk discovered:** T7 places Q1-Q2 for each module BEFORE the module header page.
    Fixed with new boundary-detection algorithm using valid Q1 line positions.
  - **M2-Q23:** number missing from PDF text; injected manually at correct line.
  - **Right-column chart:** M1-Q12 chart is in RIGHT column (unlike T4-T6 left-column pattern).
    Extractor updated with `left_col=False` support.
- T7-RW: 66 rationales (33/33 per module) parsed from explanations PDF
- T7-RW: 3 chart images extracted and uploaded to `question-assets/charts/`:
  - M1-Q12: Single-use plastic factors bar chart (right column)
  - M1-Q15: Urban land expansion ULE meta-analysis (left column)
  - M1-Q16: Chinese trade liberalization imports graph (left column)
- T7-RW: imported via `npx tsx scripts/import-official-bank.ts scripts/test7_rw_questions.json`
- `npm run audit:question-bank` → 393 questions, 0 SEVERE, 22 WARN (unchanged)

### Parser fixes / notes to carry forward for T8-T11
1. T7's Q1-Q2 pages come BEFORE the module header — the new boundary algorithm uses valid Q1
   line positions (not header lines). Verify whether T8-T11 share this layout or revert to
   the T6 structure (sequential search from header works if Q3 appears first).
2. `two_back != 'Module'` fix (from T6) is still in the T7 parser — carry forward.
3. Q23 manual injection (M2): check if this recurs in other tests before copying blindly.
4. When chart is in right column instead of left, use `left_col=False` in extractor.

### Single next action
Begin Test 8 RW extraction. PDFs: `SAT_Test_8_PracticeTest.pdf` + Explanations + ScoringGuide.
Start with the new boundary-detection algorithm (Q1 position based), verify module structure.

---

## Open items

- T8+ RW extraction (8, 9, 10, 11): priority — more RW variety for Ava
- Math content: T5-T11 Math not yet extracted
- Tailwind styling regression: verify at localhost:3000 after signing in
- GitHub secrets for DB backup workflow not set
- `next@14.2.35` CVEs — upgrade to 14.x latest or 15.x
- Untracked junk: `test_write_check.tmp`, `supabase/.temp/test_b64.txt`, `ss ux.png`, `ss ux_1.png`
- Full end-to-end study flow never manually tested in browser
- Study/miss-loop UIs need `<Image/>` for `media_urls` after first chart upload
- `scripts/test6_rw_questions.json`, `scripts/test7_rw_questions.json` committed in repo (fine — no secrets)

---

## Standing notes

- End every session with a next-session prompt (fenced code block)
- Two AI agents have push access: Gemini (local) and Claude (sandbox)
- Sandbox cannot delete/rename files — overwrite in place
- `middleware.ts` — new no-session endpoints need path in `PUBLIC_PATHS`
- Ava PSAT baseline: Math 500 / RW 610 (1110). Log at /tests to activate predictive scoring
- Supabase project ID: `ckuhtjrnnqjnrgpuurlr`

---

SIGN-OFF: T7-RW 66q imported (66 rationales, 3 chart PNGs). Bank: 393q, 0 SEVERE. — Claude (Sonnet 4.6) 7/17/26
