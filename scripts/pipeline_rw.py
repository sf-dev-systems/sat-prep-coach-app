"""
SAT RW Extraction Pipeline — run after recon_rw.py.

Usage:
  python scripts/pipeline_rw.py 8           # full pipeline
  python scripts/pipeline_rw.py 8 --step 4  # restart from step 4 (chart extraction)

Steps:
  1  Parse questions from practice text
  2  Build final question JSON (uses config answer keys + rationales)
  3  Extract chart PNGs from practice PDF
  4  Upload chart PNGs to Supabase Storage
  5  Import questions via import-official-bank.ts
  6  Run audit:question-bank

Requires:
  scripts/test{N}_rw_config.json  (written by recon_rw.py, answer keys filled in)
  scripts/pipeline_data/test{N}_practice.txt   (written by recon_rw.py)
  scripts/pipeline_data/test{N}_explanations.txt
"""

import fitz, re, sys, json, os, subprocess
sys.stdout.reconfigure(encoding='utf-8')

# ── Args ─────────────────────────────────────────────────────────────────────
if len(sys.argv) < 2:
    print("Usage: python scripts/pipeline_rw.py <test_number> [--step N]")
    sys.exit(1)

TEST_NUM   = int(sys.argv[1])
START_STEP = 1
if '--step' in sys.argv:
    idx = sys.argv.index('--step')
    START_STEP = int(sys.argv[idx + 1])

PDF_DIR    = r"C:\Users\go2si\sat-prep-coach-app\00 SYSTEM\Practice Test Library\SAT_Digital_Tests"
DATA_DIR   = r"C:\Users\go2si\sat-prep-coach-app\scripts\pipeline_data"
SCRIPT_DIR = r"C:\Users\go2si\sat-prep-coach-app\scripts"
SUPABASE_URL = None  # loaded from .env.local
SERVICE_KEY  = None

os.makedirs(DATA_DIR, exist_ok=True)

CONFIG_PATH  = f"{SCRIPT_DIR}\\test{TEST_NUM}_rw_config.json"
PRACTICE_TXT = f"{DATA_DIR}\\test{TEST_NUM}_practice.txt"
EXPLAIN_TXT  = f"{DATA_DIR}\\test{TEST_NUM}_explanations.txt"
PARSED_JSON  = f"{DATA_DIR}\\test{TEST_NUM}_rw_parsed.json"
FINAL_JSON   = f"{SCRIPT_DIR}\\test{TEST_NUM}_rw_questions.json"
PDF_PATH     = f"{PDF_DIR}\\SAT_Test_{TEST_NUM}_PracticeTest.pdf"

# ── Load config ───────────────────────────────────────────────────────────────
if not os.path.exists(CONFIG_PATH):
    print(f"ERROR: Config not found: {CONFIG_PATH}")
    print(f"Run: python scripts/recon_rw.py {TEST_NUM}  first")
    sys.exit(1)

with open(CONFIG_PATH, encoding='utf-8') as f:
    cfg = json.load(f)

# Check for unfilled answers
all_answers = list(cfg['m1_answers'].values()) + list(cfg['m2_answers'].values())
if '?' in all_answers:
    missing_count = all_answers.count('?')
    print(f"ERROR: Config has {missing_count} unfilled '?' answers.")
    print(f"Open {CONFIG_PATH} and fill in the answer keys from the scoring guide PDF.")
    sys.exit(1)

m1_start  = cfg['m1_line_start']
m2_start  = cfg['m2_line_start']
math_start= cfg['math_line_start']
m2_end    = math_start
TEST_ID   = f"T{TEST_NUM}"
LICENSE   = cfg.get('license', '© 2025 College Board. For educational use only.')

print(f"\n=== PIPELINE: SAT Test {TEST_NUM} RW (starting from step {START_STEP}) ===\n")

# ── Load .env.local ───────────────────────────────────────────────────────────
env_path = r"C:\Users\go2si\sat-prep-coach-app\.env.local"
env = {}
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip()
SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL']
SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY']

# ────────────────────────────────────────────────────────────────────────────
# HELPERS
# ────────────────────────────────────────────────────────────────────────────

def is_valid_qnum(i, lines):
    if i >= len(lines): return False
    prev     = lines[i-1].strip() if i > 0 else ''
    next_l   = lines[i+1].strip() if i+1 < len(lines) else ''
    two_back = lines[i-2].strip() if i > 1 else ''
    if prev == 'Module': return False
    if prev == 'CONTINUE': return False
    if prev.startswith('Unauthorized copying'): return False
    if (re.match(r'^\d+$', prev) and re.match(r'^\d+$', next_l)
            and len(prev) <= 4 and len(next_l) <= 4
            and two_back != 'Module'):
        return False
    return True

def find_question_lines(start, end, lines, injections=None, overrides=None):
    """Collect first valid occurrence of each Q number 1-33 in range.
    overrides: dict mapping qnum -> forced line (replaces auto-detected or injected value).
    injections: dict of items with qnum/inject_line (adds if not already found).
    """
    result = {}
    for i in range(start, end):
        s = lines[i].strip()
        m = re.match(r'^-?\s*(\d{1,2})\s*$', s)
        if not m: continue
        n = int(m.group(1))
        if n < 1 or n > 33: continue
        if n in result: continue
        if is_valid_qnum(i, lines):
            result[n] = i
    if injections:
        for item in injections.values():
            n = item['qnum']
            if n not in result:
                result[n] = item['inject_line']
    if overrides:
        for n, forced_line in overrides.items():
            result[int(n)] = forced_line
    return result

def extract_blocks(q_lines, all_lines, section_end):
    """Extract text blocks sorted by actual line position."""
    by_line = sorted(q_lines.items(), key=lambda x: x[1])
    blocks = {}
    for i, (qnum, start_idx) in enumerate(by_line):
        end_idx = by_line[i+1][1] if i+1 < len(by_line) else section_end
        blocks[qnum] = '\n'.join(all_lines[start_idx+1:end_idx])
    return blocks

def clean_block(text):
    out = []
    for line in text.split('\n'):
        s = line.strip()
        if re.match(r'^(Module|Reading and Writing|\d+ QUESTIONS|DIRECTIONS|'
                    r'The questions in this section|All questions in this section|'
                    r'Unauthorized copying|CONTINUE|-\s*[-~]+).*$', s, re.IGNORECASE):
            continue
        if re.match(r'^\d{1,2}$', s): continue
        # Normalize bullet characters to standard •
        line = re.sub(r'^(\s*)[·∙▪▸►]', r'\1•', line)
        out.append(line)
    text = '\n'.join(out)
    text = re.sub(r'\bblank\s*\n\s*', '_______\n', text)
    text = re.sub(r'\bblank\b', '_______', text)
    text = re.sub(r'Start referenced Content:\s*', '', text)
    text = re.sub(r'\s*End referenced Content\.?\s*', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def parse_block(raw, qnum):
    text = clean_block(raw)

    # Format 1: A) / B) / C) / D) style (T4–T7)
    m = (re.search(r'\nA\)\s*(.*?)\nB\)\s*(.*?)\nC\)\s*(.*?)\nD\)\s*(.*?)(?=\n\.|$|\Z)', text, re.DOTALL)
         or re.search(r'\nA\)\s*(.*?)\nB\)\s*(.*?)\nC\)\s*(.*?)\nD\)\s*(.*)', text, re.DOTALL))
    if m:
        stem_raw = text[:m.start()].strip()
        choices  = [f"A) {m.group(1).strip()}", f"B) {m.group(2).strip()}",
                    f"C) {m.group(3).strip()}", f"D) {m.group(4).strip()}"]
    else:
        # Format 2: bullet • style (T8+)
        mb = re.search(r'\n[•·]\s*(.*?)\n[•·]\s*(.*?)\n[•·]\s*(.*?)\n[•·]\s*(.*?)(?:\n|$)',
                       text, re.DOTALL)
        if mb:
            stem_raw = text[:mb.start()].strip()
            choices  = [f"A) {mb.group(1).strip()}", f"B) {mb.group(2).strip()}",
                        f"C) {mb.group(3).strip()}", f"D) {mb.group(4).strip()}"]
        else:
            return text, [], False

    lone_nums = sum(1 for l in stem_raw.split('\n') if re.match(r'^\s*\d{1,3}\s*$', l.strip()))
    has_noise = bool(re.search(r"[j\\~\|']{2,}", stem_raw))
    has_chart = lone_nums >= 4 or has_noise
    if has_chart:
        stem_lines = [l for l in stem_raw.split('\n')
                      if not (re.match(r'^[\-\~\.\s\|\\\/j\']+$', l.strip()) and len(l.strip()) > 2)
                      and not re.match(r'^\s*\d{1,3}\s*$', l.strip())]
        stem_raw = re.sub(r'\n{3,}', '\n\n', '\n'.join(stem_lines)).strip()
    return stem_raw, choices, has_chart

def fix_has_chart(stem, has_chart_from_parser):
    stem_flat = re.sub(r'\s+', ' ', stem).lower()
    for phrase in ['uses data from the graph', 'data from the graph',
                   'the graph shows', 'according to the graph', 'as shown in the graph']:
        if phrase in stem_flat:
            return True
    if 'uses data from the table' in stem_flat:
        return False
    return has_chart_from_parser

def parse_rationales(filepath):
    with open(filepath, encoding='utf-8') as f:
        text = f.read()
    text = re.sub(r'--- PAGE \d+ ---\n', '', text)
    text = re.sub(r'SAT\s+(?:PRACTICE TEST #\d+\s+)?ANSWER EXPLANATIONS[^\n]*\n', '', text)
    text = re.sub(r'\d+ SAT PRACTICE TEST[^\n]*\n', '', text)
    text = re.sub(r'\bnn\b\n?', '', text)
    m1 = re.search(r'Reading and Writing\s*\nModule 1\s*\n\(33 questions\)', text)
    m2 = re.search(r'Reading and Writing\s*\nModule 2\s*\n\(33 questions\)', text)
    if not m1 or not m2:
        print("  WARNING: Could not find RW module headers in explanations. 0 rationales.")
        return {}, {}
    math_m = re.search(r'Math\s*\nModule 1', text[m2.end():])
    m2_end_pos = m2.end() + math_m.start() if math_m else len(text)
    def split_qs(mod_text):
        parts = re.split(r'\nQUESTION (\d+)\n', mod_text)
        qs = {}
        i = 1
        while i + 1 < len(parts):
            try: qs[int(parts[i])] = parts[i+1].strip()
            except: pass
            i += 2
        return qs
    m1_qs = split_qs(text[m1.end():m2.start()])
    m2_qs = split_qs(text[m2.end():m2_end_pos])
    return m1_qs, m2_qs

# Standard skill maps (same across all tests per SAT domain ordering)
M1_SKILLS = {
    1:"Words in Context",  2:"Words in Context",  3:"Words in Context",  4:"Words in Context",
    5:"Words in Context",  6:"Text Structure & Purpose", 7:"Text Structure & Purpose",
    8:"Text Structure & Purpose", 9:"Text Structure & Purpose", 10:"Text Structure & Purpose",
    11:"Central Ideas & Details", 12:"Central Ideas & Details",
    13:"Command of Evidence", 14:"Command of Evidence", 15:"Command of Evidence",
    16:"Command of Evidence", 17:"Inferences", 18:"Inferences",
    19:"Boundaries (Punctuation)", 20:"Form, Structure, & Sense",
    21:"Boundaries (Punctuation)", 22:"Boundaries (Punctuation)", 23:"Boundaries (Punctuation)",
    24:"Form, Structure, & Sense", 25:"Boundaries (Punctuation)",
    26:"Transitions", 27:"Transitions", 28:"Transitions", 29:"Transitions",
    30:"Rhetorical Synthesis", 31:"Rhetorical Synthesis", 32:"Rhetorical Synthesis",
    33:"Rhetorical Synthesis"
}
M2_SKILLS = {
    1:"Words in Context",  2:"Words in Context",  3:"Words in Context",  4:"Words in Context",
    5:"Words in Context",  6:"Words in Context",  7:"Words in Context",  8:"Words in Context",
    9:"Text Structure & Purpose", 10:"Central Ideas & Details", 11:"Central Ideas & Details",
    12:"Command of Evidence", 13:"Command of Evidence", 14:"Command of Evidence",
    15:"Command of Evidence", 16:"Inferences", 17:"Inferences", 18:"Inferences",
    19:"Boundaries (Punctuation)", 20:"Boundaries (Punctuation)",
    21:"Form, Structure, & Sense", 22:"Boundaries (Punctuation)",
    23:"Boundaries (Punctuation)", 24:"Form, Structure, & Sense", 25:"Form, Structure, & Sense",
    26:"Boundaries (Punctuation)", 27:"Transitions", 28:"Transitions",
    29:"Rhetorical Synthesis", 30:"Rhetorical Synthesis", 31:"Rhetorical Synthesis",
    32:"Rhetorical Synthesis", 33:"Rhetorical Synthesis"
}

def difficulty(n):
    return 1 if n <= 11 else 2 if n <= 22 else 3

# ────────────────────────────────────────────────────────────────────────────
# STEP 1: Parse questions
# ────────────────────────────────────────────────────────────────────────────
if START_STEP <= 1:
    print("Step 1: Parsing questions...")
    with open(PRACTICE_TXT, encoding='utf-8') as f:
        lines = f.read().split('\n')

    m1_injections = {k: v for k, v in cfg.get('missing_qnum_injections', {}).items() if v.get('module') == 'm1'}
    m2_injections = {k: v for k, v in cfg.get('missing_qnum_injections', {}).items() if v.get('module') == 'm2'}
    m1_overrides  = cfg.get('qnum_line_overrides', {}).get('m1', {})
    m2_overrides  = cfg.get('qnum_line_overrides', {}).get('m2', {})

    m1_q = find_question_lines(m1_start, m2_start, lines, m1_injections, m1_overrides)
    m2_q = find_question_lines(m2_start, m2_end, lines, m2_injections, m2_overrides)

    print(f"  M1: {len(m1_q)}/33 | M2: {len(m2_q)}/33")
    m1_missing = [n for n in range(1,34) if n not in m1_q]
    m2_missing = [n for n in range(1,34) if n not in m2_q]
    if m1_missing: print(f"  ⚠ M1 still missing: {m1_missing}")
    if m2_missing: print(f"  ⚠ M2 still missing: {m2_missing}")
    if m1_missing or m2_missing:
        print("  Add inject_line values to missing_qnum_injections in config and re-run --step 1")
        sys.exit(1)

    m1_blocks = extract_blocks(m1_q, lines, m2_start)
    m2_blocks = extract_blocks(m2_q, lines, m2_end)
    m1_parsed = {n: dict(zip(['stem','choices','has_chart'], parse_block(b, n))) for n,b in m1_blocks.items()}
    m2_parsed = {n: dict(zip(['stem','choices','has_chart'], parse_block(b, n))) for n,b in m2_blocks.items()}

    choices_ov_step1 = cfg.get('choices_overrides', {})
    no_choices = [f"M1-Q{n}" for n,q in m1_parsed.items()
                  if not q['choices'] and f"{TEST_ID}-RW-M1-Q{n:02d}" not in choices_ov_step1] + \
                 [f"M2-Q{n}" for n,q in m2_parsed.items()
                  if not q['choices'] and f"{TEST_ID}-RW-M2-Q{n:02d}" not in choices_ov_step1]
    if no_choices:
        print(f"  ⚠ Questions with NO choices detected: {no_choices}")
        print("  Add choices_overrides/stem_overrides to config and re-run --step 1")
        sys.exit(1)
    covered = [f"M1-Q{n}" for n,q in m1_parsed.items()
               if not q['choices'] and f"{TEST_ID}-RW-M1-Q{n:02d}" in choices_ov_step1] + \
              [f"M2-Q{n}" for n,q in m2_parsed.items()
               if not q['choices'] and f"{TEST_ID}-RW-M2-Q{n:02d}" in choices_ov_step1]
    if covered:
        print(f"  ✓ Missing choices covered by choices_overrides: {covered}")

    with open(PARSED_JSON, 'w', encoding='utf-8') as f:
        json.dump({"m1": {str(k):v for k,v in m1_parsed.items()},
                   "m2": {str(k):v for k,v in m2_parsed.items()}}, f, indent=2, ensure_ascii=False)
    print(f"  Saved: {PARSED_JSON}")

# ────────────────────────────────────────────────────────────────────────────
# STEP 2: Build final JSON
# ────────────────────────────────────────────────────────────────────────────
if START_STEP <= 2:
    print("\nStep 2: Building final question JSON...")
    with open(PARSED_JSON, encoding='utf-8') as f:
        parsed = json.load(f)

    m1_rationales, m2_rationales = parse_rationales(EXPLAIN_TXT)
    print(f"  Rationales: M1={len(m1_rationales)}, M2={len(m2_rationales)}")

    m1_ans = {int(k): v for k,v in cfg['m1_answers'].items()}
    m2_ans = {int(k): v for k,v in cfg['m2_answers'].items()}
    stem_ov     = cfg.get('stem_overrides', {})
    choice_ov   = cfg.get('choice_d_overrides', {})
    choices_ov  = cfg.get('choices_overrides', {})

    questions = []
    chart_ids = []
    issues    = []

    for mod in [1, 2]:
        mk      = 'm1' if mod == 1 else 'm2'
        answers = m1_ans if mod == 1 else m2_ans
        skills  = M1_SKILLS if mod == 1 else M2_SKILLS
        rats    = m1_rationales if mod == 1 else m2_rationales

        for qnum in range(1, 34):
            ext_id = f"{TEST_ID}-RW-M{mod}-Q{qnum:02d}"
            q_data = parsed[mk].get(str(qnum))
            if q_data is None:
                issues.append(f"MISSING: {ext_id}")
                continue

            stem    = stem_ov.get(ext_id, q_data['stem'])
            choices = choices_ov.get(ext_id, list(q_data['choices']) if q_data['choices'] else [])
            if ext_id in choice_ov and choices:
                choices[3] = choice_ov[ext_id]
            has_chart = fix_has_chart(stem, q_data['has_chart'])

            rec = {
                "skill_name":     skills.get(qnum, "Words in Context"),
                "difficulty":     difficulty(qnum),
                "stem":           stem,
                "choices":        choices or None,
                "correct_answer": answers[qnum],
                "rationale":      rats.get(qnum),
                "license":        LICENSE,
                "external_id":    ext_id,
                "media_urls":     None,
            }
            if has_chart:
                chart_ids.append(ext_id)
                pub_url = f"{SUPABASE_URL}/storage/v1/object/public/question-assets/charts/{ext_id}.png"
                rec["media_urls"] = [pub_url]

            questions.append(rec)

    print(f"  Total: {len(questions)} questions | Charts: {len(chart_ids)} {chart_ids}")

    # Sanity checks
    bad = [q['external_id'] for q in questions if q['choices'] and
           q['correct_answer'] not in {c[0] for c in q['choices']}]
    if bad:
        print(f"  ⚠ BAD ANSWERS (letter not in choices): {bad}")
        print("  Check answer keys in config and re-run --step 2")
        sys.exit(1)

    missing_rat = [q['external_id'] for q in questions if not q['rationale']]
    if missing_rat:
        print(f"  ⚠ Missing rationales ({len(missing_rat)}): {missing_rat[:5]}...")

    with open(FINAL_JSON, 'w', encoding='utf-8') as f:
        json.dump(questions, f, indent=2, ensure_ascii=False)
    print(f"  Saved: {FINAL_JSON}")

    if issues:
        print(f"  ⚠ Issues: {issues}")
        sys.exit(1)

# ────────────────────────────────────────────────────────────────────────────
# STEP 3: Extract chart PNGs
# ────────────────────────────────────────────────────────────────────────────
if START_STEP <= 3:
    # Reload questions list
    with open(FINAL_JSON, encoding='utf-8') as f:
        questions = json.load(f)
    chart_questions = [q for q in questions if q['media_urls']]

    if not chart_questions:
        print("\nStep 3: No chart questions — skipping extraction.")
    else:
        print(f"\nStep 3: Extracting {len(chart_questions)} chart PNGs...")

        with open(PRACTICE_TXT, encoding='utf-8') as f:
            practice_text = f.read()
        page_starts = [(int(m.group(1)), m.start())
                       for m in re.finditer(r'--- PAGE (\d+) ---', practice_text)]

        def find_page_for_text(search_text):
            idx = practice_text.find(search_text)
            if idx == -1: return None
            pg = 1
            for p, pos in page_starts:
                if pos <= idx: pg = p
                else: break
            return pg - 1  # 0-based

        DPI, SCALE, MARGIN = 200, 200/72, 10

        def extract_chart(page, col, y_min=140, y_max=730):
            page_w = page.rect.width
            drawings = page.get_drawings()
            boxes = []
            for d in drawings:
                r = d['rect']
                if col == 'left':
                    in_col = r.x0 < page_w/2 + 20
                else:
                    in_col = r.x0 >= page_w/2 - 20
                if not in_col: continue
                if r.width <= 2 or r.height <= 2: continue
                if r.y0 <= y_min or r.y1 > y_max: continue
                boxes.append(r)
            if not boxes: return None
            x0 = min(b.x0 for b in boxes) - MARGIN
            y0 = min(b.y0 for b in boxes) - MARGIN
            x1 = max(b.x1 for b in boxes) + MARGIN
            y1 = max(b.y1 for b in boxes) + MARGIN
            clip = fitz.Rect(max(0,x0), max(0,y0), min(page.rect.width,x1), min(page.rect.height,y1))
            return page.get_pixmap(matrix=fitz.Matrix(SCALE, SCALE), clip=clip, alpha=False)

        doc = fitz.open(PDF_PATH)

        for q in chart_questions:
            ext_id  = q['external_id']
            out_png = f"{DATA_DIR}\\{ext_id}.png"

            # Check if chart page info is in config
            chart_cfg = next((cp for cp in cfg.get('chart_pages', [])
                              if ext_id in cp.get('text_snippet', '')), None)

            # Build a set of search strings from the stem (first 120 chars, various substrings)
            stem_words = q['stem'].split()
            search_candidates = []
            # Try increasingly shorter prefixes from the stem
            for length in [120, 80, 50, 30]:
                candidate = ' '.join(stem_words)[:length].strip()
                if candidate:
                    search_candidates.append(candidate)
            # Also try the first full sentence
            first_sentence = re.split(r'[.\n]', q['stem'])[0].strip()
            if first_sentence:
                search_candidates.append(first_sentence[:80])

            pg_idx = None
            for candidate in search_candidates:
                pg_idx = find_page_for_text(candidate)
                if pg_idx is not None:
                    break
                # Remove spaces (handle cross-line joins in PDF text)
                for word_count in [4, 3, 2]:
                    short = ' '.join(stem_words[1:1+word_count])
                    pg_idx = find_page_for_text(short)
                    if pg_idx is not None:
                        break
                if pg_idx is not None:
                    break

            if pg_idx is None:
                print(f"  ⚠ {ext_id}: Could not locate page. Add search text to config manually.")
                continue

            # Auto-detect column
            page = doc[pg_idx]
            page_w = page.rect.width
            drawings = page.get_drawings()
            left_count  = sum(1 for d in drawings if d['rect'].x0 < page_w/2+20
                              and d['rect'].height > 5 and 140 < d['rect'].y0 < 730)
            right_count = sum(1 for d in drawings if d['rect'].x0 >= page_w/2-20
                              and d['rect'].height > 5 and 140 < d['rect'].y0 < 730)
            col = 'left' if left_count >= right_count else 'right'

            pix = extract_chart(page, col)
            if pix is None and pg_idx > 0:
                # Try previous page
                pix = extract_chart(doc[pg_idx - 1], col)
                pg_idx -= 1

            if pix:
                pix.save(out_png)
                size_kb = os.path.getsize(out_png) // 1024
                print(f"  {ext_id}: pg {pg_idx+1}, {col} col, {size_kb} KB → {os.path.basename(out_png)}")
                if size_kb < 5:
                    print(f"    ⚠ Very small ({size_kb} KB) — may be wrong page/column. Verify PNG.")
            else:
                print(f"  ⚠ {ext_id}: No drawings found on page {pg_idx+1} ({col} col). Manual extraction needed.")

        doc.close()

# ────────────────────────────────────────────────────────────────────────────
# STEP 4: Upload charts to Supabase Storage
# ────────────────────────────────────────────────────────────────────────────
if START_STEP <= 4:
    with open(FINAL_JSON, encoding='utf-8') as f:
        questions = json.load(f)
    chart_questions = [q for q in questions if q['media_urls']]

    if not chart_questions:
        print("\nStep 4: No chart questions — skipping upload.")
    else:
        print(f"\nStep 4: Uploading {len(chart_questions)} chart PNGs to Supabase Storage...")
        from supabase import create_client
        sb = create_client(SUPABASE_URL, SERVICE_KEY)

        upload_ok, upload_skip = 0, 0
        for q in chart_questions:
            ext_id  = q['external_id']
            png_path = f"{DATA_DIR}\\{ext_id}.png"
            if not os.path.exists(png_path):
                print(f"  SKIP {ext_id}: PNG not found at {png_path}")
                upload_skip += 1
                continue
            with open(png_path, 'rb') as f:
                data = f.read()
            sb.storage.from_("question-assets").upload(
                f"charts/{ext_id}.png", data,
                file_options={"content-type": "image/png", "upsert": "true"}
            )
            size_kb = len(data) // 1024
            print(f"  ✓ {ext_id}.png ({size_kb} KB)")
            upload_ok += 1

        print(f"  Uploaded: {upload_ok} | Skipped: {upload_skip}")

# ────────────────────────────────────────────────────────────────────────────
# STEP 5: Import questions to DB
# ────────────────────────────────────────────────────────────────────────────
if START_STEP <= 5:
    print(f"\nStep 5: Importing questions via import-official-bank.ts...")
    result = subprocess.run(
        f'npx tsx scripts/import-official-bank.ts "{FINAL_JSON}"',
        capture_output=True, text=True, shell=True,
        cwd=r"C:\Users\go2si\sat-prep-coach-app"
    )
    print(result.stdout.strip())
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr.strip()}")
        sys.exit(1)

# ────────────────────────────────────────────────────────────────────────────
# STEP 6: Audit
# ────────────────────────────────────────────────────────────────────────────
if START_STEP <= 6:
    print(f"\nStep 6: Running question bank audit...")
    result = subprocess.run(
        'npm run audit:question-bank',
        capture_output=True, text=True, shell=True,
        cwd=r"C:\Users\go2si\sat-prep-coach-app"
    )
    # Print just the summary line
    for line in result.stdout.split('\n'):
        if 'Summary' in line or 'SEVERE' in line or 'questions' in line.lower():
            print(f"  {line.strip()}")

print(f"\n✓ Pipeline complete for Test {TEST_NUM} RW.")
