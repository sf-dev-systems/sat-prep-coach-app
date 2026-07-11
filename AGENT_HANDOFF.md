# AGENT HANDOFF

Short current-state snapshot for the next agent/session. Rewritten fully each
session (not append-only) — full history lives in `00 SYSTEM/SESSION_LOG/`
(indexed at `00 SYSTEM/SESSION_LOG/00_INDEX.md`). Keep this file to state +
next action + open decisions — anything resolved or purely historical
belongs in the session log, not here.

---

## Where things stand (2026-07-11 ~2:30 AM, Sonnet — Phase 2 nearly done)

**Phase 1: CLOSED.** **Phase 2:** F1 (diagnostic), F2 (daily practice), and
now **F4 (nightly behavior_signals cron)** are all built. F1/F2 are
independently build-verified (`npm run build` clean on the user's own
machine) and pushed to `origin/main` (commits `a5bbd1f`, `671b880`). F4's
code (this session) is **not yet build-verified** — see "Next action."
Detail: `00 SYSTEM/SESSION_LOG/2026-07-11_0230_behavior-signals-cron.md`,
`09 WIKI/DEV/BEHAVIOR_SIGNALS.md`.

**What Phase 2 still needs:**
- **F3's tiered-hints upgrade** — still Phase-1 static hints, not yet
  upgraded to Haiku-generated hints/explanation/variant. This is now the
  **only** remaining item before Phase 2's acceptance criteria are fully met.

**This session's F4 build, in one paragraph:** `app/api/cron/behavior-signals/route.ts`
(CRON_SECRET-authenticated, service-role client) calls
`lib/scoring/nightly.ts`'s orchestrator, which finds active users, computes
all six `behavior_signals` fields via the pure `lib/scoring/behavior-signals.ts`,
upserts them, and calls `lib/mastery/index.ts`'s new `refreshMasteryDecayForUser`
(FSRS-style forgetting decay for overdue reviews — the actual mechanism
behind PRD F4's "refresh next_review across all skills" clause).
`vercel.json` schedules it nightly at `0 7 * * *`. The 3 previously-flagged
provisional stand-ins were swapped: `lib/mastery/dashboard.ts`'s readiness
panel and `lib/sessions/index.ts`'s `estimateSessionBudget` now read real
`behavior_signals` first, falling back to their original live-computed
proxy only when no signal row exists yet (new student, or nightly job
hasn't run since first activity). `lib/sessions/diagnostic.ts` was
deliberately left un-wired — documented why in-file (diagnostic is always a
first session, so a signal row can never exist yet at that point).

## Next action

**Run `npm run build` on your own machine to verify this session's code**,
then `git add`/`commit`/`push` (this sandbox's git is still not to be
trusted — see below). Once verified: set `CRON_SECRET` in both
`.env.local` and Vercel project env vars (route returns 401 without it).
After that: **F3's tiered-hints upgrade** is the last item before Phase 2 closes.

## Open decisions carried forward

- Diagnostic difficulty<->success calibration (`difficultyForAccuracy`),
  the practice assembler's BKT/FSRS constants, and this session's new
  `behavior_signals` thresholds (fatigue drop %, min sample counts,
  overdue-decay grace window) are all first-pass heuristics, not
  empirically tuned — no attempt history yet to tune against.
- Route-group reorg (`(student)/(parent)/(admin)`) deferred to Phase 3/4.

## Standing sandbox notes (mitigation only — don't re-investigate)

- Treat this sandbox's `bash` as untrustworthy for verifying file content;
  Read/Write/Edit are source of truth. Re-read a file after writing it to
  confirm the change actually landed before moving on. (No new mismatch
  symptoms this session — every touched/created file was re-read and
  confirmed correct.)
- Never run `git add`/`commit`/`push` from this sandbox's bash — hand
  exact commands to the user to run on their own machine.
- Hand `npm run build` to the user's own machine for real verification —
  sandbox build attempts have hung/timed out before.

## Carried-over open items (not blocking)

- GitHub secrets for the DB backup workflow not yet set; workflow has
  never run.
- Next.js major-version CVEs unpatched (`next@16.2.10` migration needed;
  breaks 3 files via async `cookies()`/`headers()`).
- Taxonomy count conflict: PRD prose says "~18 RW / ~18 Math / ~8
  Strategy"; seeded taxonomy is actually 10/10/9 = 29 leaf skills. Prose
  should be corrected to match the seed.
- Git cleanup (untrack ~59MB of College Board PDFs + stray screenshots
  from `.gitignore`) — last confirmed still outstanding as of the 01:30
  session; not re-checked this session.
- `raw notes sf.md` has two unreviewed files: `OPUS REVIEW.md`,
  `prd and what i need _this.md`.

---

**SIGN-OFF:** Claude (Sonnet) — 7/11/26 ~2:30 AM
