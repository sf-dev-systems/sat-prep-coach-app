---
title: Working-Tree Recovery + T10/T11 RW Import + Footer-Collision Bug Fix
date: 2026-07-26
agent: Claude Sonnet 5
phase: Content Import (ongoing)
commit: a31cfef
---

## COMPLETED

### Working-Tree Recovery (session start)
Found the local working tree did not match the last commit (802ab9c, 2026-07-17) despite no
new commits in between — a 9-day gap with unexplained uncommitted deletions:
- Entire `02 SESSION_LOG/` folder (42 files) deleted on disk.
- `01 DOCS/PRD action plan.md` deleted.
- `01 DOCS/Project Instructions_v1-1.md` deleted, with an identical untracked copy sitting at
  `00 SYSTEM/Project Instructions_v1-1.md` (violates the CLAUDE.md rule that canonical docs live
  in `01 DOCS/`).
- Two screenshots (`ss ux.png`, `ss ux_1.png`) deleted.
- An orphaned `archive_AGENT_HANDOFF_v59.md` at repo root (identical to the live
  `AGENT_HANDOFF.md` — looks like an archive-before-rewrite step that was started and abandoned).
- Confirmed with the user this was unintentional; restored all of the above via `git restore`
  and deleted the orphaned duplicates. `scripts/pipeline_data/` (untracked intermediate pipeline
  files from the T8/T9 session) was left alone — legitimate scratch output, gitignored.

### T10 RW Import — 66 Questions
- Both scoring-guide tracks agreed (M1-Q1=A, M2-Q1=A on both) — no verification needed, same as T9.
- 3 questions needed `choices_overrides` (table/column-layout PDF quirk, same pattern as prior
  tests): M1-Q30, M2-Q12, M2-Q13.
- 2 chart questions (M2-Q11, M2-Q13) extracted and uploaded automatically.
- Final: 66 questions, 0 SEVERE. Bank: 591 questions.

### T11 RW Import — 66 Questions, New PDF Layout Discovered
T11's source PDF is a different variant ("paper practice test formatted for nondigital use",
filename code `6XSL01`) than T4–T10 (`6WSLxx`, digital-format). This broke the pipeline in two
new ways:

1. **Module-boundary auto-detection failed.** `recon_rw.py`'s heuristic for `m1_line_start` /
   `m2_line_start` / `math_line_start` assumed no page-footer noise sits directly between a page
   break and the module header. T11's layout inserts extra footer lines (a stray page-number
   digit, "Unauthorized copying...", another digit, "CONTINUE") before every module header,
   which confused the boundary scan so badly that `math_line_start` came out as 3600 — nearly
   the whole rest of the document, swallowing the entire Math section into what the pipeline
   thought was RW Module 2. Recomputed all three boundaries by hand by locating the real
   `DIRECTIONS` markers for each of the 4 sections (RW M1, RW M2, Math M1, Math M2) and using
   their 0-indexed line position directly (config fields are raw indices into
   `open(file).read().split('\n')`, NOT the 1-indexed line numbers a text viewer shows).

2. **Footer page-numbers silently colliding with real question numbers.** Root cause: a bare
   digit line reading `"Unauthorized copying or reuse of any part of this page is illegal."`
   immediately followed by the printed PDF page number (e.g. page 19 → a lone `"17"`) was
   accepted by `is_valid_qnum()` as a legitimate question-number marker whenever that page number
   happened to equal a real question number in this test (M1-Q3, M2-Q17 through Q26 all
   collided this way). Because `find_question_lines()` keeps the *first* valid match and ignores
   later ones, this silently rebound 9 questions' content to the wrong source line. Two of the
   nine (M1-Q3, M2-Q25, M2-Q26 before the general fix — see below) didn't even surface as pipeline
   errors, because the leftover footer noise before the real stem gets stripped by
   `clean_block()`'s existing junk filters, so the parse "succeeded" on a technicality despite
   starting from the wrong line. Caught this only by explicitly auditing every resolved question
   line for a preceding "Unauthorized copying" signature, not just trusting the absence of a
   step-1 error.
   - **General fix applied** (not just a per-test override): added
     `if prev.startswith('Unauthorized copying'): return False` to `is_valid_qnum()` in both
     `pipeline_rw.py` and `recon_rw.py` (previously only guarded against `'Module'` and
     `'CONTINUE'` as the preceding line). Verified this single change resolves all 9 collisions
     without needing any of the manual `qnum_line_overrides` — the overrides were left in the T11
     config anyway since they're harmless and now redundant.
- 4 chart questions (M1-Q15, M2-Q11, M2-Q12, M2-Q13) extracted and uploaded.
- Final: 66 questions, 0 SEVERE. Bank: **657 questions total**.

## DECISIONS

| Decision | Reason |
|---|---|
| Restore all uncommitted deletions from git rather than accept them | User confirmed the session-log/doc deletions were unintentional, not a deliberate reorg |
| Fix `is_valid_qnum()` at the root cause instead of only adding `qnum_line_overrides` for T11 | The footer-collision pattern is systemic to this PDF layout, not test-specific — likely to recur on future tests sharing the `6XSL` paper-format source |
| Left T11's manual `qnum_line_overrides` in the config despite being redundant post-fix | Harmless, and documents exactly which questions were affected for anyone auditing later |
| Did not generalize the module-boundary (`m1_line_start`/`m2_line_start`/`math_line_start`) auto-detection for the paper-format layout | Only one data point (T11) so far; unclear if more paper-format tests are coming. Flagged in AGENT_HANDOFF for the next agent to watch for. |

## FILES TOUCHED
- `scripts/pipeline_rw.py` — `is_valid_qnum()`: added footer-boilerplate guard
- `scripts/recon_rw.py` — same guard, kept in sync
- `scripts/test10_rw_config.json` — new, `choices_overrides` for M1-Q30/M2-Q12/M2-Q13
- `scripts/test10_rw_questions.json` — new, 66 questions
- `scripts/test11_rw_config.json` — new, corrected line boundaries + `qnum_line_overrides`
- `scripts/test11_rw_questions.json` — new, 66 questions
- `02 SESSION_LOG/` — restored (42 files) + this new file
- `01 DOCS/Project Instructions_v1-1.md`, `01 DOCS/PRD action plan.md`, `ss ux.png`, `ss ux_1.png` — restored

## SIGN-OFF
Sonnet 5 — 7/26/26 7:50 PM
