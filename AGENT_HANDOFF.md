# AGENT HANDOFF

Short current-state snapshot for the next agent/session. Rewritten fully each
session (not append-only) — full history lives in `00 SYSTEM/SESSION_LOG/`
(indexed at `00 SYSTEM/SESSION_LOG/00_INDEX.md`).

---

## Where things actually stand (2026-07-11 1:30 AM, Sonnet — Phase 2 in progress)

**Phase 1: CLOSED.** **Phase 2 (Intelligence): PRD F1 and F2 are both now
built.** This session closed the diagnostic flow (F1), the last major gap:

- **`lib/sessions/diagnostic.ts`** — new, two-phase assembler.
  `assembleDiagnosticFirstHalves` (server-side) creates the diagnostic
  `sessions` row and every section's first half (~40 questions total by
  default, split proportional to each section's live leaf-skill count,
  always neutral difficulty). `assembleDiagnosticSecondHalf` (called
  **client-side**, no new API route needed — see "Open decisions" below)
  fetches a section's second half once first-half accuracy is known,
  conditioning difficulty on it (`>=0.7 -> 3`, `>=0.4 -> 2`, else `1`).
- **`app/diagnostic/page.tsx` + `components/diagnostic/DiagnosticRunner.tsx`**
  — same auth/empty-state pattern as `/session`; runner reuses
  `MissLoop`/`useMissLoop` unchanged, adds section/half state-machine
  bookkeeping plus a self-heal effect for the sparse-bank edge case (a
  section's first half assembling to zero items despite a nonzero
  allocation, which would otherwise strand the runner with nothing to
  submit and nothing to trigger the next step).
- **Completion:** `endPracticeSession` → `initializeMasteryRows` (identity
  from the active client session) → links to `/`, which now has real
  mastery data. `app/page.tsx`'s "no data yet" empty state now links to
  `/diagnostic` instead of `/session`, since a first-run student should
  diagnose before practicing.
- **Small supporting changes:** extracted `checkCorrect` into
  `lib/sessions/index.ts` (was duplicated privately in `SessionRunner.tsx`)
  so both runners can't diverge on scoring; `lib/mastery/dashboard.ts`'s
  `focusSkills` raised from top-3 to top-5 to match PRD F1's "top-5 gap
  list" language (same card is reused for both flows — see decisions).
- Full detail + the design decisions (with reasoning) in
  `00 SYSTEM/SESSION_LOG/2026-07-11_0130_diagnostic-flow-f1.md` and
  `09 WIKI/DEV/DIAGNOSTIC.md`.

**What Phase 2 still needs:**
- Nightly `behavior_signals` cron (F4's other half). Both the dashboard's
  readiness panel and both session assemblers' pacing are still
  provisional live-computed stands-in for this.
- F3's tiered-hints miss loop (`MissLoop.tsx`/`useMissLoop.ts`) is still
  Phase-1-scope static hints, not yet upgraded to Haiku-generated tiered
  hints + full explanation/variant flow — unchanged this session.

With F1 and F2 both built, Phase 2's acceptance criteria are close —
what's left is specifically the nightly cron and the AI-generated (vs.
static) hint content in F3.

## Next action

1. **Get this session's code build-verified on your own machine** —
   `npm run build` (sandbox attempt hung this session; see "Verification"
   below). This is the actual next action, ahead of new feature work.
2. **Confirm (or execute) the still-pending git cleanup** — `.gitignore`
   still has no entry for `00 SYSTEM/SAT_Practice_Tests_CollegeBoard/` or
   `Pasted image*.png`, and no follow-up untracking commit exists. This has
   now been carried over across 2 sessions unconfirmed. Either re-hand the
   Gemini CLI prompt or do it directly.
3. **After that:** Phase 2's remaining item is the nightly `behavior_signals`
   cron (pace-by-difficulty, `fatigue_minute`, `avg_focus_minutes`,
   `time_of_day_performance`, `post_miss_accuracy`, `calibration_score`) —
   implement as a Vercel Cron hitting a protected API route per PRD F4. This
   is the one remaining piece with no provisional stand-in anywhere yet
   despite being read from in 3 places (dashboard readiness, practice
   assembler's time budget, and now implicitly relevant to diagnostic
   pacing too, though the diagnostic doesn't currently read it).

## Open decisions (flagged this session, not asking retroactively)

1. Diagnostic assembly lives in its own module (`lib/sessions/diagnostic.ts`),
   not folded into `assemblePracticeSession` — two-phase by nature
   (second half depends on first-half performance), vs. the practice
   assembler's single-pass design.
2. `assembleDiagnosticSecondHalf` runs client-side (browser Supabase
   client) rather than through a new API route — it only reads
   authenticated-read-only content tables (`skills`, `questions`), so no
   privileged server operation was needed.
3. Diagnostic completion routes to the existing dashboard (`/`), not a new
   goal-tree view — `/mastery` is explicitly Phase 3 scope in the PRD's
   build-phase gate; building it now would be scope creep. `focusSkills`
   was bumped to top-5 on the existing card instead of forking a new view.

Same standing caveat as prior sessions: the difficulty <-> expected-success
calibration model and BKT/FSRS constants (now also `difficultyForAccuracy`
for the diagnostic) are first-pass heuristics, not empirically tuned.

## Verification — NOT YET CONFIRMED this session (sandbox build hung)

Unlike the prior 2 sessions, this session's code has **not** been confirmed
against a real `npm run build`. The sandbox attempt hung/timed out (bash
`resume`/`create` RPC errors) rather than returning a stale-but-readable
result, so there's nothing to report either way yet — **please run
`npm run build` on your own machine before trusting this session's code is
wired correctly**, same as the standing instruction for git.

**Sandbox Edit/Read mismatch — new symptom this session.** Previously
(3 consecutive prior sessions) the mismatch was bash vs. Read/Write/Edit.
This session, a system-reminder diff showed `SessionRunner.tsx` and
`lib/sessions/index.ts` as NOT reflecting an edit immediately after the
Edit tool reported success; re-reading via the Read tool confirmed the
edit genuinely hadn't landed on the first attempt. A second, identical
Edit call was needed before a Read confirmed it had stuck. This happened
on 3 separate edits in this session (SessionRunner.tsx's import line,
its local-function removal, and the SESSION_LOG index row). Per the
standing "don't re-investigate, use the established mitigation" instruction:
every file touched this session was re-read in full after writing/editing
to confirm the actual on-disk state, and all now read back correctly. This
is a new data point for whoever tracks the infra-layer issue (it's not
just bash anymore) — not something to re-diagnose in-session again.

## Git — still pending cleanup, unconfirmed 2 sessions running

Same status as last handoff: `.gitignore` has no entry for the ~59MB of
College Board PDFs (`00 SYSTEM/SAT_Practice_Tests_CollegeBoard/`) or the
two stray `Pasted image *.png` screenshots at repo root, and no
follow-up untracking commit exists in `00 SYSTEM/SESSION_LOG/00_INDEX.md`'s
history. **This session did not attempt to fix it** — sandbox git is still
presumed corrupted per the prior session's findings (not re-verified this
session, per the "don't re-investigate" instruction — if a fresh check is
wanted, that itself would be the re-investigation to avoid; just proceed
straight to the mitigation: hand exact commands to the user).

This session's own code changes (listed above) have **not** been committed
or pushed — same as prior sessions, hand exact `git add`/`commit`/`push`
commands to the user to run on their own machine rather than running them
through this sandbox's bash.

## Carried-over open items (not blocking, still unresolved)

- GitHub secrets for the DB backup workflow (`DB_CONNECTION_STRING`,
  `BACKUP_GPG_PASSPHRASE`) not yet set; workflow has never actually run.
- Next.js major-version CVEs unpatched (`next@16.2.10` migration needed;
  breaks 3 files via async `cookies()`/`headers()`). Needs a deliberate
  scheduled task + user go-ahead.
- `eslint-config-next`'s `glob` CLI advisory — clears via the same Next 16 jump.
- Taxonomy count conflict: PRD prose still says "~18 RW / ~18 Math / ~8
  Strategy"; seeded/locked taxonomy is actually 10 Math / 10 RW / 9
  Strategy = 29 leaf skills. PRD prose should be corrected to match the seed.
  (Diagnostic's section allocation reads the live seed, not the prose
  count, so this doesn't block F1 — just still worth fixing in the doc.)
- `raw notes sf.md` has two unreviewed files: `OPUS REVIEW.md`,
  `prd and what i need _this.md`.
- Route-group reorg (`(student)/(parent)/(admin)`) deferred to Phase 3/4.
- Nightly `behavior_signals` cron — see "Next action" above; this is now
  the most consequential remaining Phase 2 gap.
- F3's tiered-hints (Haiku-generated) miss loop upgrade — still Phase-1
  static hints.
- Sandbox filesystem/tooling reliability — see "Verification" above for
  this session's new symptom. Standing mitigation unchanged: treat
  Read/Write/Edit as source of truth, re-read after writing to confirm,
  hand off real build/git verification to the user's own machine. Never
  run `git add`/`commit`/`push` from this sandbox's bash tool.

---

**SIGN-OFF:** Claude (Sonnet) — 7/11/26 1:30 AM
