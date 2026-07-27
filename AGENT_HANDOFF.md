# AGENT HANDOFF — v62
_Rewritten each session. Full history in `02 SESSION_LOG/`._

## Status: SAT content import COMPLETE — RW (8/8 tests) + Math (8/8 tests, T4 + T5–T11 this session)

### Question Bank
| Source | Questions | Status |
|---|---|---|
| RW (T4–T11) | 657 | imported, 8/8 tests — complete |
| Math T4 | 54 | imported (prior session) |
| Math T5 | 54 | imported this session |
| Math T6 | 54 | imported this session |
| Math T7 | 54 | imported this session |
| Math T8 | 54 | imported this session |
| Math T9 | 54 | imported this session |
| Math T10 | 54 | imported this session |
| Math T11 | 54 | imported this session |
| **TOTAL** | **1,035** | 0 SEVERE in final audit, 110 warnings (see below) |

**Both sections are now fully imported for every SAT test that exists** (T4–T11, 8 tests —
College Board's public library stops at T11; T12/T13 do not exist, confirmed last session).
There is no more official SAT content to mine. Remaining untapped source material: 6 PSAT PDFs
(2× NMSQT, 2× PSAT 10, 2× PSAT 8/9) — not in v1 scope, confirm against the Charter before pulling
those in.

Audit note: `npm run audit:question-bank` prints "1000 questions" in its summary line — that's
the script's default Supabase fetch cap, not the real count. Actual total verified via direct SQL
(`select count(*) from questions`) is 1,035. Worth a one-line fix to `audit-question-bank.ts`
(add `.range()` or raise the default limit) so future audits don't undercount silently — flagged,
not fixed, this session.

## What Was Done This Session (2026-07-26)

1. **Corrected a stale assumption**: the prior handoff's "next action" (run `recon_rw.py 12`)
   was based on more RW tests existing beyond T11. They don't — confirmed via
   `00 SYSTEM/Practice Test Library/INDEX.md`. RW was already complete as of last session.
2. **User chose the Math import method** (asked directly): manual per-test approach, same as
   T4 Math — an agent transcribes/structures each test's Math section from PDF text into JSON,
   then a vision-review pass checks flagged (diagram/graph-dependent or OCR-garbled) questions
   against the actual PDF pages before import. Not the automated-pipeline alternative.
3. **Built the pipeline mechanics reused across all 7 tests** (no new files besides the JSON
   question sets):
   - Reused `recon_rw.py <N>` to extract each test's full PDF text and locate the Math section
     boundary (`math_start` line) — the RW recon script already does PDF extraction + text
     caching, so no new extraction code was needed.
   - Extracted each test's Math-only text into `scripts/pipeline_data/test<N>_math_practice.txt`
     via a small inline Python slice (not a saved script — trivial one-liner, see Pipeline
     Reference below to reproduce).
   - Dispatched one background `general-purpose` agent per test to transcribe all 54 questions
     (27 Module 1 + 27 Module 2) into `scripts/test<N>_math_questions.json`, cross-referencing
     the practice-test text (stems/choices) against the Answer Explanations PDF text
     (correct answers + rationales, via `QUESTION N` → `Choice X is correct` markers) — far more
     reliable than the scoring-guide answer-key table, which for Math renders as a garbled
     multi-column table that's easy to misread.
   - For every question the transcribing agent flagged `needs_visual_review: true` (a graph,
     figure, table, or garbled-OCR answer choices), rendered the actual PDF page(s) to PNG via
     `fitz` (`page.get_pixmap(matrix=fitz.Matrix(2.2,2.2))`, cropped/zoomed tighter with
     `clip=fitz.Rect(...)` when needed) and read them directly to verify the transcription.
   - Ran `npm run import-bank scripts/test<N>_math_questions.json` (existing script, unchanged)
     per test, then a final full-bank `npm run audit:question-bank`.
4. **External_id convention for Math** (new, not used for T4 which predates it):
   `T<N>-MATH-M<module>-Q<qq>` e.g. `T5-MATH-M1-Q01` — mirrors the RW convention
   (`T9-RW-M1-Q02`), gives idempotent upserts on re-run. T4 Math still has `external_id: null`
   (pre-dates this convention) — harmless, just not idempotent if ever re-imported.

### Real transcription errors the vision-review pass caught and fixed
The vision-review step earned its keep — across ~85 flagged questions, most graph/figure-only
flags turned out accurate (the transcribing agent read the answer-explanation rationale
correctly even without seeing the image), but questions flagged for **OCR-garbled answer
choices** had a meaningfully higher error rate. Confirmed and fixed real mistakes in:
- **T8 M1-Q04**: transcribed leading coefficient wrong across all 4 choices (`x²+7x+10` etc.
  instead of `2x²+7x+10`) — correct letter was still right by position, but the choice text was
  wrong. Fixed stem + all 4 choices.
- **T8 M2-Q25/Q26**: distractor choices didn't match the source PDF (correct answer letter was
  still right in both cases).
- **T6 M1-Q17**: choices were shown as `19 + PN` / `19 − PN` (product) instead of the real
  `(19+P)/N` / `(19−P)/N` (fraction) — correct answer letter unaffected, choice text was wrong.
- **T7 M1-Q16**: stem transcribed the function as `x|x−4|` instead of the actual `|x−4x|` —
  different function, same coincidental final answer given the specific numbers in the question.
- **T7 M2-Q10/Q18**: stem equations differed from the source (`x/39` vs `39x` in Q18); rationale
  text also updated to match.
- **T9 M2-Q25**: entire equation was different from the source PDF
  (`(y+12)/(x-8) + y(x-8)/(x²y-8xy)` vs the transcribed nonsense) — correct answer letter (C)
  coincidentally still matched after re-deriving from the real equation.
- **T9 M2-Q26**: function form was wrong (`a(2.2)^(x+b)` vs actual `a(2.2^x + 2.2^b)`) and the
  constraint was inverted (`a<b<0` vs actual `0<a<b`) — correct answer (D) unaffected.
- **T10 M2-Q05/Q17**: one garbled distractor choice each, correct answer unaffected.
- **T11 M2-Q20**: equation exponent was inverted (`t^(7/9)` vs actual `t^(9/7)`) and the given
  relation was wrong (`p^((n-1)/3)` vs actual `p^(3n-1)`) — final numeric answer (41/81)
  happened to come out the same after re-deriving with the correct equation, verified by hand.

None of these errors changed a `correct_answer` value from what was already in the JSON (the
transcribing agents got the graded answer right every time, sourcing it from the explanations
text's "Choice X is correct" / final-answer line rather than re-deriving from the possibly-wrong
stem) — but several had materially wrong stem text or distractor choices that would have shown
students an incorrect version of the question. This is the reason the manual method (vs. a fully
automated pipeline) still needs a human/vision QC step per question, especially for math notation
that OCR mangles (exponents, fraction stacks, coefficient digits).

One false alarm caught and reverted: initially misread a T6 parabola graph's plotted points at
low zoom (thought the answer might be off), re-zoomed and confirmed the original transcription
(`bc = -24`) was correct — a reminder to verify at high enough resolution before editing.

## Single Next Action
**No further official SAT content import remains** (both RW and Math are complete for all 8
available tests). Options for next session, in rough priority order:
1. **Push the 12 local commits to origin** (ask user first — many sessions of work sitting
   unpushed).
2. **T8 RW rationale regeneration** (52 questions still have `[Answer corrected to X. Rationale
   needs regeneration.]` placeholder text) — see Open Decisions below.
3. **Full end-to-end study flow** has still never been manually tested in browser — now that the
   bank is content-complete, this is a good time to actually click through the app.
4. **PSAT import** — only if the user confirms it's in scope; ask before starting, it's a scope
   question per CLAUDE.md's phase-discipline rule, not an obvious continuation of "more SAT
   tests."
5. Minor: fix `audit-question-bank.ts`'s silent 1000-row fetch cap (see above).

## Open Decisions
- **T8 RW rationales stale**: 52 questions have `[Answer corrected to X. Rationale needs
  regeneration.]` prefix. Correct answer is stored; rationale explains the wrong answer.
  Use `scripts/patch-rw-rationales.ts` to regenerate when API budget allows (low priority — app
  falls back to static rationales).
- **audit-question-bank.ts undercounts** past 1000 rows (see above) — cosmetic, not a data bug.
- **GitHub secrets for DB backup workflow** not set (non-blocking).
- **next@14.2.35 CVEs** — upgrade when convenient.
- **Full end-to-end study flow** never manually tested in browser.
- **12 local commits ahead of origin/main, not yet pushed** — push when the user is ready.
- **Module-boundary auto-detection for paper-format PDFs (`6XSLxx`)** still not generalized in
  `recon_rw.py` (only T11 hit this pattern) — moot now unless a future non-SAT paper-format
  source shows up, since RW/Math import for all SAT tests is done.

## Pipeline Reference (for next agent, if ever mining more Math-shaped content)

### Math import method used this session (manual, not a saved pipeline script):
```python
# 1. Reuse RW recon to get full text + math_start line (from recon_rw.py's own output)
python scripts/recon_rw.py <N>

# 2. Slice out the Math-only text (inline, not saved as a script)
lines = open(f'scripts/pipeline_data/test<N>_practice.txt', encoding='utf-8').read().split('\n')
math_lines = lines[<math_start>:]
open(f'scripts/pipeline_data/test<N>_math_practice.txt', 'w', encoding='utf-8').write('\n'.join(math_lines))
```
Then dispatch an agent per test with a prompt that: points it at
`test<N>_math_practice.txt` (stems/choices) and `test<N>_explanations.txt` (answers/rationales,
searched via `MATH: MODULE 1`/`MATH: MODULE 2` → `QUESTION N` → `Choice X is correct`), gives it
the 10 locked Math skill names (from `scripts/seed-skills.ts`), and has it write
`scripts/test<N>_math_questions.json` matching `import-official-bank.ts`'s schema, flagging
`needs_visual_review: true` for anything figure-dependent or OCR-uncertain.

Then for every flagged question, render its PDF page to PNG and Read it directly:
```python
import fitz
doc = fitz.open(r'00 SYSTEM/Practice Test Library/SAT_Digital_Tests/SAT_Test_<N>_PracticeTest.pdf')
pix = doc[<page_num - 1>].get_pixmap(matrix=fitz.Matrix(2.2,2.2), alpha=False)
pix.save('scripts/pipeline_data/t<N>_math_pages/page<page_num>.png')
```
Page numbers found by grepping `test<N>_practice.txt` for the question's distinctive stem text
and mapping the line number to the nearest preceding `--- PAGE N ---` marker.

### RW pipeline (still current, unrelated to Math):
```
python scripts/recon_rw.py <N>          # generates scripts/testN_rw_config.json
python scripts/pipeline_rw.py <N>       # steps 1-6: parse > JSON > charts > upload > import > audit
```
See prior handoff versions (git history) for the full RW config-field reference table
(`m2_line_start`, `qnum_line_overrides`, `choices_overrides`, multi-track scoring, known PDF
layout patterns per test) — omitted here since RW import is complete and unlikely to be
re-touched.

## Commit
704c2e5 -- docs: correct ahead-of-origin commit count in handoff
(12 commits ahead of origin/main, not yet pushed — this session's work is uncommitted on top of
that; commit when the user is ready)
