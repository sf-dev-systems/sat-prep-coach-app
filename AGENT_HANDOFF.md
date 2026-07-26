# AGENT HANDOFF — v60
_Rewritten each session. Full history in `02 SESSION_LOG/`._

## Status: Content Import — Tests 4–11 RW Complete

### Question Bank
| Source | Questions | Status |
|---|---|---|
| T4 Math | 54 | imported |
| T4 RW | 66 | imported |
| T5 RW | 66 | imported |
| T6 RW | 66 | imported |
| T7 RW | 66 | imported |
| T8 RW | 66 | imported (52 answers corrected 2026-07-17) |
| T9 RW | 66 | imported |
| T10 RW | 66 | imported (this session) |
| T11 RW | 66 | imported (this session) |
| **TOTAL** | **657** | 0 SEVERE in audit, 22 warnings |

### What Was Fixed This Session (2026-07-26)
- **Working-tree recovery**: found the repo working tree had drifted from the last commit
  (802ab9c) with no new commit in between — 42 session-log files deleted on disk, 2 docs
  deleted, one doc moved to the wrong location (`00 SYSTEM/` instead of `01 DOCS/`), an orphaned
  handoff-archive file. Confirmed with the user this was unintentional and restored everything
  from git. See `02 SESSION_LOG/2026-07-26_1950_t10-t11-rw-import-footer-bug-fix.md` for full
  detail.
- **T10 RW**: straightforward import, 3 `choices_overrides` needed (table/column layout, same
  pattern as prior tests).
- **T11 RW — new PDF source variant discovered**: T11's PDF is a "paper practice" format
  (`6XSL01`) rather than the digital format (`6WSLxx`) used by T4–T10. Two new bugs surfaced:
  1. Auto-detected module boundaries (`m1_line_start`/`m2_line_start`/`math_line_start`) were
     badly wrong because this layout has extra page-footer noise between page breaks and module
     headers that `recon_rw.py`'s heuristic doesn't expect. Fixed by hand for T11's config.
  2. **Root-cause bug, now fixed generally**: a lone digit line that is the PDF's printed page
     number, immediately preceded by the "Unauthorized copying..." footer boilerplate, was being
     accepted by `is_valid_qnum()` as a real question-number marker whenever the page number
     happened to equal an actual question number in range. This silently mis-bound 9 questions
     (M1-Q3, M2-Q17–26) to the wrong source line — 2 of them didn't even throw a pipeline error,
     because `clean_block()`'s existing noise-stripping happened to still find the real content
     downstream. Fixed in both `pipeline_rw.py` and `recon_rw.py`:
     `if prev.startswith('Unauthorized copying'): return False` added to `is_valid_qnum()`.
     Verified this one-line fix alone resolves all 9 collisions without needing manual overrides.

## Single Next Action
**Run T12 RW extraction:**
```
python scripts/recon_rw.py 12
```
Watch for:
1. Which PDF variant T12 is — check the header text near the top of
   `scripts/pipeline_data/test12_practice.txt` for `6WSLxx` (digital format, standard boundary
   detection works) vs `6XSLxx` (paper format like T11, boundaries likely need manual
   recomputation — see Pipeline Reference below).
2. Multi-track scoring: compare `scoring_track_options`, verify against practice.txt semantically
   if the two tracks disagree.
3. Missing Q#s / no-choices warnings from `pipeline_rw.py --step 1`.

Then run:
```
python scripts/pipeline_rw.py 12
```

After T12: T13 (if it exists — confirm how many official tests are in the Practice Test Library
before assuming), then Math sections (T5–T11 Math still not imported — only T4 Math exists in
the bank so far).

## Open Decisions
- **Module-boundary auto-detection for paper-format PDFs (`6XSLxx`) not generalized.** Only one
  data point (T11) so far. If T12+ turns out to also be paper-format, recompute
  `m1_line_start`/`m2_line_start`/`math_line_start` by hand the same way (locate each section's
  `DIRECTIONS` line, use 0-indexed position in `open(file).read().split('\n')`) — see Pipeline
  Reference below for the exact method. If a 2nd or 3rd paper-format test turns up, worth
  generalizing the recon heuristic properly instead of hand-fixing each time.
- **T8 rationales stale**: 52 questions have `[Answer corrected to X. Rationale needs
  regeneration.]` prefix in rationale field. Correct answer is stored; rationale text explains
  the wrong answer. Use `scripts/patch-rw-rationales.ts` to regenerate when API budget allows (low
  priority — app falls back to static rationales).
- **GitHub secrets for DB backup workflow** not set (non-blocking).
- **next@14.2.35 CVEs** — upgrade when convenient.
- **Full end-to-end study flow** never manually tested in browser.
- **2 local commits ahead of origin/main, not yet pushed** (including this session's work once
  committed) — push when the user is ready.

## Pipeline Reference (for next agent)

### Standard run (new test):
```
python scripts/recon_rw.py <N>          # generates scripts/testN_rw_config.json
# inspect output, fix config if needed (see below)
python scripts/pipeline_rw.py <N>       # steps 1-6: parse > JSON > charts > upload > import > audit
python scripts/pipeline_rw.py <N> --step 3  # restart from step 3 if needed
```

### IMPORTANT: config line-number fields are 0-indexed array positions, NOT the 1-indexed line
numbers a text viewer/editor shows you. If you read `test<N>_practice.txt` with a line-numbered
viewer and see e.g. line 26 = `"DIRECTIONS"`, the value to put in the config is **25** (viewer
line − 1), because `pipeline_rw.py` does `lines = open(file).read().split('\n')` (0-indexed) and
uses the config value directly as an index into that array. Getting this off by one silently
shifts every boundary and is easy to miss — always verify with a quick python snippet like:
```python
lines = open('scripts/pipeline_data/test<N>_practice.txt', encoding='utf-8').read().split('\n')
print(lines[<candidate_index>])   # should print the exact line you expect
```

### Config fields that often need manual editing:
```
m2_line_start: 855           -- set LOWER if M2 Q1/Q2/Q3 are before the module header
scoring_track_index: 1       -- 0 or 1, check scoring_track_options to verify which Q1 is semantically correct
missing_qnum_injections:     -- when Q# uses decorative format ('. 1 ,') or is before module header
  m2_q1: {qnum:1, module:m2, inject_line:880}
qnum_line_overrides:         -- force Q# to correct line when table values / footer page-numbers cause false detection
  m1: {"25": 635}
choices_overrides:           -- supply all 4 choices when PDF column order puts them before the stem
  T9-RW-M1-Q02: ["A) ...", "B) ...", "C) ...", "D) ..."]
```

### Multi-track scoring guide verification:
- recon reports: `Track 0 (page 2): M1-Q1=A` / `Track 1 (page 4): M1-Q1=B`
- Find M1-Q1 stem in practice.txt (line ~34). Read the question. Pick the track whose answer letter makes grammatical sense for that question.
- If both tracks have same Q1 (like T9, T10) — keep default (Track 1, last page).
- To override: `python scripts/recon_rw.py <N> --track 0`

### Known PDF layout patterns:
| Pattern | Tests | Config fix |
|---|---|---|
| Standard (Q1 after module header, `6WSLxx` digital format) | T4, T5, T6, T10 | none |
| Q1/Q2 before module header | T7, T8 | m2_line_start = Q3s line |
| Q1/Q2/Q3 before header + decorative format | T9 | m2_line_start = Q3s line + injections for Q1/Q2 |
| Table value collides with Q# | T9 (Q25) | qnum_line_overrides |
| Choices before stem (column layout) | T9 (Q2), T10 (M1-Q30, M2-Q12/13) | choices_overrides |
| **Paper-format PDF (`6XSLxx`)**: extra footer noise before every module header breaks auto-boundary-detection | T11 | recompute m1/m2/math_line_start by hand — locate each `DIRECTIONS` line, use 0-indexed position |
| **Footer page-number collides with real Q#** | T11 (M1-Q3, M2-Q17–26) | Fixed at the root in `is_valid_qnum()` — should no longer occur on new tests, but verify with the "no `Unauthorized copying` prev-line" audit shown in the 2026-07-26 session log if something looks off |

## Commit
Pending — this session's changes (docs + T10/T11 import + pipeline fix) not yet committed.
Last committed work: 802ab9c
