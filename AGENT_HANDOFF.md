# AGENT HANDOFF — v59
_Rewritten each session. Full history in `02 SESSION_LOG/`._

## Status: Content Import — Tests 4–9 RW Complete

### Question Bank
| Source | Questions | Status |
|---|---|---|
| T4 Math | 54 | imported |
| T4 RW | 66 | imported |
| T5 RW | 66 | imported |
| T6 RW | 66 | imported |
| T7 RW | 66 | imported |
| T8 RW | 66 | imported (52 answers corrected this session) |
| T9 RW | 66 | imported (this session) |
| **TOTAL** | **525** | 0 SEVERE in audit |

### What Was Fixed This Session
- **T8 answer key bug**: SAT scoring guides have 2 complete answer key pages (one per Module 2 difficulty track). The parser was always grabbing page 1. T8 needed page 2 — 52/66 answers were wrong. Fixed and re-imported.
- **Pipeline**: `recon_rw.py` now parses keys page-by-page (not flat text), detects multi-track tests, reports both options with Q1 values, supports `--track N` override flag.
- **Pipeline**: `pipeline_rw.py` has two new config fields: `qnum_line_overrides` (force a Q# to a specific line when table values cause false detections) and `choices_overrides` (supply all 4 choices when PDF column order puts them before the stem).
- **Import script**: Changed INSERT to upsert on `external_id`. Added UNIQUE constraint on `questions.external_id` via migration `20260717100000`.
- **T9 quirks handled**: M2-Q1/Q2 decorative format (`. 1 ,`), M2-Q3 before module header, M1-Q25 false detection from table value "25", M1-Q2 choices preceding stem.

## Single Next Action
**Run T10 RW extraction:**
```
python scripts/recon_rw.py 10
```
Inspect the recon output for:
1. Multi-track: compare `scoring_track_options` — pick the track whose M1-Q1 answer matches the actual question in practice.txt semantically
2. Missing Q#s: check if any are in the `q1_before_header` or decorative-format pattern
3. Chart pages: only flag RW section pages (before Math line start)

Then run:
```
python scripts/pipeline_rw.py 10
```

After T10: T11, then Math sections (T5–T11).

## Open Decisions
- **T8 rationales stale**: 52 questions have `[Answer corrected to X. Rationale needs regeneration.]` prefix in rationale field. Correct answer is stored; rationale text explains the wrong answer. Use `scripts/patch-rw-rationales.ts` to regenerate when API budget allows (low priority — app falls back to static rationales).
- **GitHub secrets for DB backup workflow** not set (non-blocking).
- **next@14.2.35 CVEs** — upgrade when convenient.
- **Full end-to-end study flow** never manually tested in browser.

## Pipeline Reference (for next agent)

### Standard run (new test):
```
python scripts/recon_rw.py <N>          # generates scripts/testN_rw_config.json
# inspect output, fix config if needed (see below)
python scripts/pipeline_rw.py <N>       # steps 1-6: parse > JSON > charts > upload > import > audit
python scripts/pipeline_rw.py <N> --step 3  # restart from step 3 if needed
```

### Config fields that often need manual editing:
```
m2_line_start: 855           -- set LOWER if M2 Q1/Q2/Q3 are before the module header
scoring_track_index: 1       -- 0 or 1, check scoring_track_options to verify which Q1 is semantically correct
missing_qnum_injections:     -- when Q# uses decorative format ('. 1 ,') or is before module header
  m2_q1: {qnum:1, module:m2, inject_line:880}
qnum_line_overrides:         -- force Q# to correct line when table values cause false detection
  m1: {"25": 635}
choices_overrides:           -- supply all 4 choices when PDF columns put them before the stem
  T9-RW-M1-Q02: ["A) ...", "B) ...", "C) ...", "D) ..."]
```

### Multi-track scoring guide verification:
- recon reports: `Track 0 (page 2): M1-Q1=A` / `Track 1 (page 4): M1-Q1=B`
- Find M1-Q1 stem in practice.txt (line ~34). Read the question. Pick the track whose answer letter makes grammatical sense for that question.
- If both tracks have same Q1 (like T9) — keep default (Track 1, last page).
- To override: `python scripts/recon_rw.py <N> --track 0`

### Known PDF layout patterns:
| Pattern | Tests | Config fix |
|---|---|---|
| Standard (Q1 after module header) | T4, T5, T6 | none |
| Q1/Q2 before module header | T7, T8 | m2_line_start = Q3s line |
| Q1/Q2/Q3 before header + decorative format | T9 | m2_line_start = Q3s line + injections for Q1/Q2 |
| Table value collides with Q# | T9 (Q25) | qnum_line_overrides |
| Choices before stem (column layout) | T9 (Q2) | choices_overrides |

## Commit
57e323a -- feat: T8 answer key fix, T9 RW import, pipeline hardening
