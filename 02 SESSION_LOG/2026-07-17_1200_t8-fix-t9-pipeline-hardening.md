---
title: T8 Answer Key Fix + T9 RW Import + Pipeline Hardening
date: 2026-07-17
agent: Claude Sonnet 4.6
phase: Content Import (ongoing)
commit: 57e323a
---

## COMPLETED

### T8 Answer Key Bug — Found and Fixed
- **Root cause**: SAT scoring guides contain TWO complete answer key pages — one per Module 2 difficulty track (easier vs harder). The `recon_rw.py` auto-parser blindly grabbed the first page's keys; T8 needed the second page.
- **Impact**: 52 of 66 T8 questions had wrong `correct_answer` values in the DB.
- **Diagnosis**: Semantic check on T8-RW-M2-Q01 — question asks "colors seem to be more ___ viewers" and stored answer was C "corrected by" (nonsense); correct answer is B "attractive to". Confirmed by inspecting scoring guide page 4 which had M1-Q1=B "important" ✓, M2-Q1=B "attractive to" ✓.
- **Fix**: Extracted page-4 keys, patched `scripts/test8_rw_questions.json` (52 updates), deleted all 132 duplicate T8 rows from DB, re-imported 66 questions cleanly.

### Pipeline Hardening — recon_rw.py
- Replaced flat-text regex key parser with **page-by-page fitz parser** (`parse_scoring_pages`). Reads each scoring guide PDF page independently, finds complete 33-answer A-D blocks, never conflates pages.
- **Multi-track detection**: If >1 complete answer key pages found, reports all options with their Q1 answers, defaults to the LAST page (College Board convention), warns the user to verify.
- **`--track N` flag**: `python scripts/recon_rw.py 9 --track 0` — forces a specific track index without rewriting the whole config.
- Config now includes `scoring_track_options` array (all variants with page + Q1 values) and `scoring_track_index` (which was selected).

### Pipeline Hardening — pipeline_rw.py
- **`qnum_line_overrides`** config field: `{"m1": {"25": 635}}` — forces a question number to a specific line, overriding auto-detection. Needed when table numeric values (e.g., "25" = maple tree height in feet) are falsely detected as question numbers, corrupting block boundaries.
- **`choices_overrides`** config field: `{"T9-RW-M1-Q02": ["A) ...", "B) ...", "C) ...", "D) ..."]}` — supplies full 4-choice array when PDF column order places choices before the stem (multi-column page layout). Step 1 no longer exits early for questions covered by this override.
- **Import script**: Changed `.insert()` → `.upsert({onConflict: 'external_id'})` so re-runs never create duplicate rows.
- **Migration**: Added `UNIQUE` constraint on `questions.external_id` to back the upsert.

### T9 RW Import — 66 Questions
- Multi-track scoring guide detected (both tracks have same Q1 values — no difference for this test).
- Layout quirks:
  - M2-Q1 and Q2: `. 1 ,` / `. 2 ,` decorative format — not matched by bare-digit regex. Fixed via `missing_qnum_injections` in config.
  - M2-Q3: Before module header (line 855, before header at 871) — fixed by setting `m2_line_start: 855`.
  - M1-Q25: Table value "25" (Japanese maple height) falsely detected at line 296; real Q25 at line 635. Fixed via `qnum_line_overrides`.
  - M1-Q2 choices: Multi-column page puts choices (lines 54–57) before stem (lines 80–87). Fixed via `choices_overrides`.
- 1 chart: M1-Q15 (Percentage of Nonhexagonal Cells in Honeybee Hives) — extracted and uploaded.
- Final: 66 questions, 0 SEVERE. Bank: **525 questions total**.

## DECISIONS

| Decision | Reason |
|---|---|
| Default to LAST scoring guide page for multi-track | College Board convention puts primary/harder track last; can always override with --track |
| `qnum_line_overrides` replaces injection (forces line even if already detected) | Injections only ADD missing Q#s; overrides are needed to CORRECT a wrong detection |
| `choices_overrides` bypasses step-1 exit | Some PDFs physically print choices before stems due to column layout; no way to fix this in extraction |
| UNIQUE constraint on `external_id` | Required for upsert; should have been there from the start |

## FILES TOUCHED
- `scripts/pipeline_rw.py` — qnum_line_overrides, choices_overrides, upsert, step-1 override-aware check
- `scripts/recon_rw.py` — page-by-page key parser, multi-track detection, --track flag
- `scripts/import-official-bank.ts` — INSERT → upsert
- `scripts/test8_rw_questions.json` — 52 correct_answer values fixed
- `scripts/test8_rw_config.json` — committed
- `scripts/test9_rw_config.json` — new, with all overrides
- `scripts/test9_rw_questions.json` — new, 66 questions
- `supabase/migrations/20260717100000_add_external_id_unique_constraint.sql` — new

## SIGN-OFF
Sonnet 4.6 — 7/17/26 12:00 PM
