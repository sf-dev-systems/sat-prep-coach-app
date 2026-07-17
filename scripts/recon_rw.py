"""
SAT RW PDF Recon — run this BEFORE pipeline_rw.py.

Inspects a practice test's PDF structure and outputs:
  1. A human-readable report of layout quirks
  2. A config template JSON ready to fill in (or auto-filled if answer key parses cleanly)

Usage:
  python scripts/recon_rw.py 8

Output:
  scripts/pipeline_data/test8_practice.txt   (extracted PDF text, reused by pipeline)
  scripts/pipeline_data/test8_explanations.txt
  scripts/pipeline_data/test8_scoring.txt
  scripts/test8_rw_config.json               (template — fill answer keys if not auto-parsed)
"""

import fitz, re, sys, json, os

sys.stdout.reconfigure(encoding='utf-8')

# ── Args ─────────────────────────────────────────────────────────────────────
if len(sys.argv) < 2:
    print("Usage: python scripts/recon_rw.py <test_number>")
    sys.exit(1)

TEST_NUM = int(sys.argv[1])
# Optional --track N to force a specific scoring guide track (0-indexed)
FORCE_TRACK = None
if '--track' in sys.argv:
    ti = sys.argv.index('--track')
    FORCE_TRACK = int(sys.argv[ti + 1])

PDF_DIR  = r"C:\Users\go2si\sat-prep-coach-app\00 SYSTEM\Practice Test Library\SAT_Digital_Tests"
DATA_DIR = r"C:\Users\go2si\sat-prep-coach-app\scripts\pipeline_data"
os.makedirs(DATA_DIR, exist_ok=True)

PDFS = {
    "practice":     (f"{PDF_DIR}\\SAT_Test_{TEST_NUM}_PracticeTest.pdf",
                     f"{DATA_DIR}\\test{TEST_NUM}_practice.txt"),
    "explanations": (f"{PDF_DIR}\\SAT_Test_{TEST_NUM}_AnswerExplanations.pdf",
                     f"{DATA_DIR}\\test{TEST_NUM}_explanations.txt"),
    "scoring":      (f"{PDF_DIR}\\SAT_Test_{TEST_NUM}_ScoringGuide.pdf",
                     f"{DATA_DIR}\\test{TEST_NUM}_scoring.txt"),
}

# ── Step 1: Extract PDFs (skip if cached) ────────────────────────────────────
print(f"\n=== RECON: SAT Test {TEST_NUM} ===\n")
print("Step 1: Extracting PDF text...")
for key, (pdf_path, txt_path) in PDFS.items():
    if os.path.exists(txt_path):
        print(f"  {key}: cached ({txt_path})")
        continue
    doc = fitz.open(pdf_path)
    pages = [f"--- PAGE {i+1} ---\n{page.get_text('text')}" for i, page in enumerate(doc)]
    doc.close()
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(pages))
    print(f"  {key}: {len(pages)} pages → {txt_path}")

with open(PDFS["practice"][1], encoding='utf-8') as f:
    practice_lines = f.read().split('\n')
with open(PDFS["scoring"][1], encoding='utf-8') as f:
    scoring_text = f.read()

# ── Step 2: Detect Math section boundary ─────────────────────────────────────
print("\nStep 2: Finding section boundaries...")

math_start = len(practice_lines)
for i, line in enumerate(practice_lines):
    if line.strip() == 'Module':
        following = '\n'.join(practice_lines[i:i+6])
        if 'Math' in following and 'Reading' not in following:
            math_start = i
            break

print(f"  Math section starts at line {math_start}")

# ── Step 3: Find all valid Q1 positions ──────────────────────────────────────
def is_valid_qnum(i, lines):
    if i >= len(lines): return False
    prev     = lines[i-1].strip() if i > 0 else ''
    next_l   = lines[i+1].strip() if i+1 < len(lines) else ''
    two_back = lines[i-2].strip() if i > 1 else ''
    if prev == 'Module': return False
    if prev == 'CONTINUE': return False
    if (re.match(r'^\d+$', prev) and re.match(r'^\d+$', next_l)
            and len(prev) <= 4 and len(next_l) <= 4
            and two_back != 'Module'):
        return False
    return True

rw_header_lines = []
for i, line in enumerate(practice_lines):
    if line.strip() == 'Module' and i < math_start:
        following = '\n'.join(practice_lines[i:i+6])
        if 'Reading and Writing' in following:
            rw_header_lines.append(i)

valid_q1s = []
for i in range(0, math_start):
    s = practice_lines[i].strip()
    if re.match(r'^1$', s) and is_valid_qnum(i, practice_lines):
        valid_q1s.append(i)

print(f"\n  RW module header lines: {rw_header_lines}")
print(f"  Valid Q1 positions (not after Module/CONTINUE): {valid_q1s}")

# ── Step 4: Determine layout type ────────────────────────────────────────────
print("\nStep 4: Detecting PDF layout...")

if len(valid_q1s) < 2:
    print(f"  ERROR: expected 2 Q1 positions, got {valid_q1s}")
    print("  → Cannot auto-detect boundaries. Manual inspection required.")
    layout = "unknown"
    m1_start = rw_header_lines[0] if rw_header_lines else 0
    m2_start = rw_header_lines[1] if len(rw_header_lines) > 1 else math_start // 2
elif len(rw_header_lines) >= 2 and valid_q1s[0] > rw_header_lines[0]:
    # T6 style: Q1 appears AFTER the module header
    layout = "standard"
    m1_start = valid_q1s[0]
    m2_start = valid_q1s[1]
    print(f"  Layout: STANDARD (T6-style) — Q1 appears after module header")
else:
    # T7 style: Q1 appears BEFORE the module header
    layout = "q1_before_header"
    m1_start = valid_q1s[0]
    m2_start = valid_q1s[1]
    print(f"  Layout: Q1-BEFORE-HEADER (T7-style) — Q1/Q2 precede the Module header page")

m2_end = math_start
print(f"  M1 range: lines {m1_start}–{m2_start}")
print(f"  M2 range: lines {m2_start}–{m2_end}")

# ── Step 5: Scan question numbers in each module ─────────────────────────────
print("\nStep 5: Scanning question numbers...")

def find_all_qnums(start, end, lines):
    found = {}
    for i in range(start, end):
        s = lines[i].strip()
        m = re.match(r'^-?\s*(\d{1,2})\s*$', s)
        if not m: continue
        n = int(m.group(1))
        if n < 1 or n > 33: continue
        if n in found: continue
        if is_valid_qnum(i, lines):
            found[n] = i
    return found

m1_found = find_all_qnums(m1_start, m2_start, practice_lines)
m2_found = find_all_qnums(m2_start, m2_end, practice_lines)

m1_missing = [n for n in range(1, 34) if n not in m1_found]
m2_missing = [n for n in range(1, 34) if n not in m2_found]

print(f"  M1: found {len(m1_found)}/33 questions | missing: {m1_missing or 'none'}")
print(f"  M2: found {len(m2_found)}/33 questions | missing: {m2_missing or 'none'}")

# For missing questions, try to locate the block by bracketing neighbors
missing_injections = {}
for mod, missing, found in [("m1", m1_missing, m1_found), ("m2", m2_missing, m2_found)]:
    for n in missing:
        prev_n = n - 1
        next_n = n + 1
        if prev_n in found and next_n in found:
            # Block starts one line after prev's line
            inject_line = found[prev_n] + 1
            # Skip forward past the previous question's content to the actual block
            # (find first non-blank content line after prev_n's question number)
            missing_injections[f"{mod}_q{n}"] = {
                "qnum": n, "module": mod,
                "between_lines": [found[prev_n], found[next_n]],
                "suggested_inject": inject_line,
                "note": f"Number absent from PDF text — inject manually after verifying block"
            }
            print(f"  → {mod.upper()}-Q{n} missing but bracketed by Q{prev_n}(line {found[prev_n]}) and Q{next_n}(line {found[next_n]})")
            # Print a few lines of context
            ctx_start = found[prev_n] + 1
            ctx_end = found[next_n]
            ctx_lines = practice_lines[ctx_start:ctx_start+6]
            print(f"     Context: {repr(chr(10).join(ctx_lines))[:200]}")

# ── Step 6: Detect chart pages ────────────────────────────────────────────────
print("\nStep 6: Scanning for chart pages...")

doc = fitz.open(PDFS["practice"][0])
page_starts_txt = [(int(m.group(1)), m.start())
                   for m in re.finditer(r'--- PAGE (\d+) ---', open(PDFS["practice"][1], encoding='utf-8').read())]
practice_text = open(PDFS["practice"][1], encoding='utf-8').read()

chart_pages = []
for i, page in enumerate(doc):
    page_w = page.rect.width
    drawings = page.get_drawings()
    # Substantial left-column drawings (likely chart)
    left = [d for d in drawings if d['rect'].x0 < page_w/2+20
            and d['rect'].height > 5 and d['rect'].y0 > 140 and d['rect'].y1 < 730]
    right = [d for d in drawings if d['rect'].x0 >= page_w/2-20
             and d['rect'].height > 5 and d['rect'].y0 > 140 and d['rect'].y1 < 730]

    if len(left) >= 8 or len(right) >= 8:
        # Find surrounding text context
        pg_txt = page.get_text('text')
        # Remove header noise
        pg_txt_clean = re.sub(r'^.*?(?=\d{1,2}\n)', '', pg_txt, flags=re.DOTALL)[:600]
        col = "left" if len(left) >= len(right) else "right"
        count = max(len(left), len(right))
        chart_pages.append({
            "pdf_page": i + 1,
            "column": col,
            "drawing_count": count,
            "text_snippet": pg_txt_clean[:300].strip()
        })
        print(f"  Page {i+1}: {count} drawings in {col.upper()} column")
        print(f"    Text: {repr(pg_txt_clean[:150])}")

doc.close()

# ── Step 7: Auto-parse answer keys (page-by-page, multi-track aware) ─────────
print("\nStep 7: Parsing answer keys from scoring guide...")

def parse_scoring_pages(pdf_path):
    """
    Read scoring guide PDF page-by-page.
    Each answer key page has 4 QUESTION # blocks in column order.
    The first two complete-33 A-D blocks on a page = RW-M1 and RW-M2.
    Returns a list of (page_num, m1_dict, m2_dict) for every answer-key page found.
    """
    doc = fitz.open(pdf_path)
    results = []
    for page_idx in range(doc.page_count):
        page = doc[page_idx]
        txt = page.get_text()
        segments = re.split(
            r'QUESTION #\nCORRECT\nMARK YOUR \nCORRECT \nANSWERS\n', txt
        )
        complete_blocks = []
        for seg in segments[1:]:
            lines = seg.strip().split('\n')
            answers = {}
            i = 0
            while i < len(lines) - 1:
                try:
                    q = int(lines[i])
                    if 1 <= q <= 33:
                        ans = lines[i+1].strip()
                        if ans in 'ABCD':
                            answers[q] = ans
                        i += 2
                        continue
                except ValueError:
                    pass
                i += 1
            if len(answers) == 33:
                complete_blocks.append(answers)
        if len(complete_blocks) >= 2:
            results.append((page_idx + 1, complete_blocks[0], complete_blocks[1]))
    doc.close()
    return results

scoring_tracks = parse_scoring_pages(PDFS["scoring"][0])
multi_track = len(scoring_tracks) > 1

if not scoring_tracks:
    print("  ✗ Auto-parse failed — no complete answer key pages found")
    m1_answers = {n: "?" for n in range(1, 34)}
    m2_answers = {n: "?" for n in range(1, 34)}
    selected_track_idx = 0
elif multi_track:
    print(f"  ⚠  MULTI-TRACK DETECTED: {len(scoring_tracks)} answer key pages found")
    for ti, (pg, m1, m2) in enumerate(scoring_tracks):
        print(f"     Track {ti} (page {pg}): M1-Q1={m1[1]}, M2-Q1={m2[1]}")
    # Default to last track (College Board tends to put the primary/harder track last)
    # Override with --track N flag
    selected_track_idx = FORCE_TRACK if FORCE_TRACK is not None else len(scoring_tracks) - 1
    _, m1_answers, m2_answers = scoring_tracks[selected_track_idx]
    print(f"  → Defaulting to Track {selected_track_idx} (page {scoring_tracks[selected_track_idx][0]})")
    print(f"    ⚠  Verify M1-Q1 against actual question. If wrong, set scoring_track_index in config.")
else:
    selected_track_idx = FORCE_TRACK if FORCE_TRACK is not None else 0
    _, m1_answers, m2_answers = scoring_tracks[selected_track_idx]

if m1_answers.get(1) != "?":
    print(f"  ✓ RW M1 answers: Q1={m1_answers[1]} Q2={m1_answers[2]} Q33={m1_answers[33]}")
    print(f"  ✓ RW M2 answers: Q1={m2_answers[1]} Q2={m2_answers[2]} Q33={m2_answers[33]}")

# ── Step 8: Write config template ────────────────────────────────────────────
config_path = f"C:\\Users\\go2si\\sat-prep-coach-app\\scripts\\test{TEST_NUM}_rw_config.json"

config = {
    "_instructions": (
        f"Config for SAT Test {TEST_NUM} RW pipeline. "
        "Fill in any '?' answers from the scoring guide. "
        "stem_overrides and choice_overrides are keyed by external_id (e.g. 'T8-RW-M1-Q14'). "
        "missing_qnum_injections: set inject_line to the correct line number from recon output. "
        "If multi-track, change scoring_track_index (0-based) and re-run recon to swap keys."
    ),
    "test_num": TEST_NUM,
    "layout": layout,
    "m1_line_start": m1_start,
    "m2_line_start": m2_start,
    "math_line_start": math_start,
    "scoring_track_index": selected_track_idx,
    "scoring_track_options": [
        {"page": pg, "m1_q1": m1[1], "m2_q1": m2[1]}
        for pg, m1, m2 in scoring_tracks
    ] if scoring_tracks else [],
    "m1_answers": {str(k): v for k, v in m1_answers.items()},
    "m2_answers": {str(k): v for k, v in m2_answers.items()},
    "missing_qnum_injections": missing_injections,
    "chart_pages": chart_pages,
    "stem_overrides": {},
    "choice_d_overrides": {},
    "license": f"© 2025 College Board. For educational use only."
}

with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print(f"Config written: {config_path}")
print(f"{'='*60}")
print(f"\nSUMMARY:")
print(f"  Layout:        {layout}")
print(f"  M1 range:      lines {m1_start}–{m2_start} ({m2_start - m1_start} lines)")
print(f"  M2 range:      lines {m2_start}–{m2_end} ({m2_end - m2_start} lines)")
print(f"  M1 missing Q#: {m1_missing or 'none'}")
print(f"  M2 missing Q#: {m2_missing or 'none'}")
print(f"  Chart pages:   {len(chart_pages)} (see config for column and text context)")
has_unknowns = '?' in m1_answers.values() or '?' in m2_answers.values()
print(f"  Answer keys:   {'AUTO-PARSED ✓' if not has_unknowns else 'NEEDS MANUAL ENTRY ✗'}")
if multi_track:
    print(f"  Multi-track:   YES — {len(scoring_tracks)} answer key variants found")
    print(f"                 Verify M1-Q1 answer in the practice PDF before running pipeline.")

if has_unknowns:
    print(f"\n⚠  Open config and fill in '?' answers from the scoring guide PDF")
    print(f"   then run: python scripts/pipeline_rw.py {TEST_NUM}")
elif multi_track:
    print(f"\n⚠  MULTI-TRACK: Confirm scoring_track_index={selected_track_idx} is correct for this PDF.")
    for ti, (pg, m1, m2) in enumerate(scoring_tracks):
        marker = " ← selected" if ti == selected_track_idx else ""
        print(f"   Track {ti} (scoring guide page {pg}): M1-Q1={m1[1]}, M2-Q1={m2[1]}{marker}")
    print(f"   If wrong: edit scoring_track_index in config, re-run recon to regenerate keys.")
    print(f"\n   Then run: python scripts/pipeline_rw.py {TEST_NUM}")
else:
    print(f"\n✓  Ready to run: python scripts/pipeline_rw.py {TEST_NUM}")
