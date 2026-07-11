# AGENT HANDOFF

Short current-state snapshot for the next agent/session. Rewritten fully each
session (not append-only) — full history lives in `00 SYSTEM/SESSION_LOG/`
(indexed at `00 SYSTEM/SESSION_LOG/00_INDEX.md`).

---

## Where things actually stand (2026-07-10 10:45 PM, Sonnet — Phase 2 in progress)

**Phase 1: CLOSED** (54 official Test 4 Math questions live, auth/session/miss-loop
working, backups + ceiling/fallback built — see the 2026-07-10 22:35 session log
for full close-out detail).

**Phase 2 (Intelligence): started this session.** Built and wired:

1. **`lib/mastery/`** — BKT (`bkt.ts`) + FSRS-style (`fsrs.ts`) mastery math,
   orchestrated by `index.ts`'s `updateMasteryOnAttempt` (per-attempt hook),
   `initializeMasteryRows` (exported for the future diagnostic flow, not yet
   called anywhere), and `fetchMasteryMap`. All raw `mastery`/`sessions`/
   `attempts` table access lives in `lib/db` (new functions:
   `fetchMasteryRow(s)`, `upsertMasteryRow(s...)`, `fetchRecentSessions`,
   `fetchRecentAttempts`) — `lib/mastery` itself has no direct `.from(...)` calls.
2. **Every attempt now updates mastery.** `components/session/useMissLoop.ts`
   calls `updateMasteryOnAttempt` right after `logAttempt`, for both the
   initial submission and the miss-loop retry. `SessionRunner.tsx` passes
   `question.difficulty` through so the math has what it needs.
3. **`app/page.tsx` is now a real Server Component**, reading
   `lib/mastery/dashboard.ts`'s `computeDashboardData()` instead of the
   Phase 1 hardcoded mock — predicted score, confidence band, readiness
   panel, top-3 focus skills, streak/daily-goal figures, all from live
   Supabase state. Shows an empty state until a student has logged attempts.
   Greeting now reads `profiles.display_name` (was hardcoded to the parent's
   name, "Sienna" — the authenticated account here is the student's).

**What Phase 2 still needs (not built yet):**
- Diagnostic flow (F1) — route + UI. `initializeMasteryRows` is ready for it.
- Adaptive session assembler upgrade — `lib/sessions/index.ts` still does
  Phase 1's simple selection; it should now use `mastery.next_review` /
  `p_mastery` for priority ordering (real mastery rows exist to read).
- Nightly `behavior_signals` cron. The dashboard's Timing/Consistency/
  Calibration readiness figures are currently computed live from
  `attempts`/`sessions` as a **provisional stand-in** — swap to a
  `behavior_signals` read once the cron exists.
- Tiered-hint miss loop is functionally in place (`MissLoop.tsx`/
  `useMissLoop.ts` from a prior session) but hasn't been re-audited against
  the full F3 spec this session — worth a pass before calling F3 done for Phase 2.

## Next action (single)

**Upgrade `lib/sessions/index.ts`'s `assemblePracticeSession`** to select by
`(1) next_review <= now, (2) lowest p_mastery × weight, (3) difficulty
targeted to ~75% expected success`, per PRD F2 — real mastery data now
exists for it to read via `lib/mastery`'s `fetchMasteryMap`. This is the
natural next Phase 2 piece now that mastery updates flow correctly.

## Open decisions

None new this session. BKT/FSRS constants (learn rate, slip penalty,
retry-credit table, stability growth/decay) are first-pass defaults grounded
in the PRD's qualitative rules, not empirically tuned — there's no attempt
history yet to tune against. Revisit once real data accumulates.

## Verification caveat (important — read before assuming Phase 2 code is build-clean)

This session's sandbox had a **stale bash mount** — `stat` showed file
mtimes running ~5 hours behind the wall clock, and `tsc`/`wc -l` run through
bash reflected pre-edit file contents even seconds after edits were saved.
Every file change this session was manually verified correct via the
file-read tool (authoritative, not mount-dependent) — JSX balance and
brace/paren structure were checked by re-reading full file contents. But
**a real `npm run build` / `tsc --noEmit` has not actually run successfully
against this session's changes** — do that first in the next session, on a
freshly-synced checkout, before building further on top.

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
- `raw notes sf.md` has two unreviewed files: `OPUS REVIEW.md`,
  `prd and what i need _this.md`.
- Route-group reorg (`(student)/(parent)/(admin)`) deferred to Phase 3/4.

---

**SIGN-OFF:** Claude (Sonnet) — 7/10/26 10:45 PM
