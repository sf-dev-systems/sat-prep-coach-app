# AGENT HANDOFF

Short current-state snapshot for the next agent/session. Rewritten fully each
session (not append-only) — full history lives in `00 SYSTEM/SESSION_LOG/`
(indexed at `00 SYSTEM/SESSION_LOG/00_INDEX.md`).

---

## Where things actually stand (2026-07-11 12:44 AM, Sonnet — Phase 2 in progress)

**Phase 1: CLOSED.** **Phase 2 (Intelligence): in progress.** This session
completed PRD F2 (Daily practice session) end to end, building the two
clauses last session left open:

1. **Time-budgeted session length.** New `estimateSessionBudget`
   (`lib/sessions/index.ts`) is a provisional stand-in for
   `behavior_signals.avg_focus_minutes`/`fatigue_minute` (that table/cron
   still doesn't exist) — computes `avgSecondsPerQuestion` from recent
   `attempts` and a `plannedMinutes` proxy from recent completed
   `sessions`' durations, clamped 20–60 min. `targetQuestionCount` derives
   from both, clamped to PRD F2's stated 15–25. `assemblePracticeSession`'s
   count param is now optional and defaults to this.
2. **Time-budgeted composition.** Every selected item now carries a
   `category` (`review`/`priority`/`mixed`) computed from the same
   due/vulnerability ranking already used for selection — no parallel
   logic, so it can't drift. `PracticeSessionPlan` returns `plannedMinutes`
   + a `composition` breakdown; `SessionRunner` shows it as a "Today's
   plan" banner. Note: PRD F2's "15 review / 12 functions / 8 inference /
   5 mixed" example uses specific skill-domain names, not a category set
   the taxonomy actually has — generalized to real domain names within
   3 structural buckets instead of inventing a 4-category taxonomy. Full
   reasoning in the 00:44 session log and `09 WIKI/DEV/SESSION_ASSEMBLER.md`.
3. **Confidence-builder after 2 consecutive misses.** Assembler also
   returns a `confidenceBuilderPool` (high-mastery ≥0.75 skills, easiest
   question each). `SessionRunner.tsx` tracks consecutive misses (initial
   wrong answer = a miss) and splices the next pooled question in right
   after the 2nd consecutive miss. Empty pool for brand-new students is
   the correct degrade, not a bug.

**PRD F2 is now fully built.** What Phase 2 still needs:
- Diagnostic flow (F1) — route + UI. `initializeMasteryRows` is ready for
  it; `assemblePracticeSession` isn't wired for `'diagnostic'` sessions yet
  (only `'practice'` is called from `/session`).
- Nightly `behavior_signals` cron (F4's other half). Both the dashboard's
  readiness panel and the session assembler's time budget are still
  provisional live-computed stands-in for this — they'd both read real
  `behavior_signals` rows once it exists.
- F3's tiered-hints miss loop is scaffolded (`MissLoop.tsx`/`useMissLoop.ts`)
  but hasn't been re-verified against this session's changes beyond type
  compatibility (no logic in it changed this session).

## Next action (single)

**Build F1's diagnostic flow** — a `/diagnostic` (or similar) route that
runs `assemblePracticeSession(supabase, userId, 'diagnostic', ~40)`,
handles the section-adaptive difficulty split PRD F1 describes (second
half of each section conditioned on first-half performance — not yet
built anywhere), and on completion calls `initializeMasteryRows` +
routes into the normal dashboard/goal-tree view. This is the last major
gap before Phase 2's acceptance criteria ("Diagnostic populates mastery
for all skills...") can be called met.

## Open decisions

None new this session requiring your input beyond the composition-label
interpretation already flagged above (built, not blocked — flagging for
visibility, not asking permission retroactively). Same standing caveat as
prior sessions: the difficulty <-> expected-success calibration model and
BKT/FSRS constants are first-pass heuristics, not empirically tuned.

## Verification — build CONFIRMED PASSING (user-run, not sandbox)

**Sandbox `bash` vs. file-tool mismatch was a 3rd consecutive session in a
row** (confirmed again: `md5sum` on `AGENT_HANDOFF.md` returned the
empty-file hash while the file-read tool read its real 109-line content in
the same turn — `app/layout.tsx` hashed fine, so it's inconsistent, not
universal). Per the standing "flag it on a 3rd occurrence" instruction,
this was surfaced to the user directly rather than patched around again;
the user chose to have Claude proceed via the file tools and run
verification themselves rather than trust sandbox bash.

**Result: user ran `npm run build` on their own machine and it passed
clean** — `Compiled successfully`, `Linting and checking validity of
types` passed, all 4 routes (`/`, `/_not-found`, `/login`, `/session`)
generated. This session's code (`lib/sessions/index.ts`,
`SessionRunner.tsx`, `app/session/page.tsx`) is confirmed to compile and
type-check correctly.

**Follow-up, same session:** that first build had one pre-existing
warning ("A Node.js API is used (process.version...) which is not
supported in the Edge Runtime", traced through `lib/db/index.ts`) —
predated this session, unrelated to what was touched. User asked if it
was fixable; it was: `middleware.ts` (Edge Runtime, Next 14's only
middleware runtime) imported `getSupabaseServerClient` from the full
`lib/db/index.ts`, which also imports `@supabase/supabase-js` for
Node-only helpers middleware never calls — that package touches
`process.version` at import time, so the whole module got Edge-bundled.
Fixed with a new `lib/db/edge.ts` (Edge-safe re-implementation, only
imports `@supabase/ssr`, `SupabaseClient` as a type-only import so no
supabase-js runtime code bundles); `middleware.ts` now points at it
instead. **User re-ran `npm run build`: confirmed clean, warning gone,
same 4 routes.** Full writeup in the 00:44 session log's addendum.

The sandbox bash/file-tool mount issue itself is still unresolved and
worth raising with whoever provisions this environment if a 4th session
hits it — see carried-over items below — but it's no longer blocking this
handoff; all code from this session is independently confirmed compiling
on the user's own machine, twice.

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
- Sandbox bash/file-tool filesystem mismatch — confirmed 3 sessions in a
  row (identical symptom: bash reads stale/empty content for a file the
  file-read tool reads correctly; selective, not universal — not
  correlated with which tool last wrote the file). This is an
  infrastructure-layer bug outside any agent's tool access — it cannot be
  fixed by re-diagnosing it again. **Next session: don't re-investigate
  it.** If it recurs, skip straight to the established mitigation (treat
  bash as untrustworthy for file content, Read/Write/Edit as source of
  truth, user runs `npm run build` for real verification) and tell the
  user it's the same known issue rather than re-running the md5sum/Read
  comparison from scratch. It needs a human to report it through
  product feedback — no amount of in-session workaround resolves it.
  **New evidence, same session:** `git status` via bash showed phantom
  deletions of files that demonstrably exist and work (`tailwind.config.ts`,
  `tsconfig.json`, `vercel.json`, the schema migration), and `git` itself
  threw `error: cache entry has null sha1` plus an unremovable stale
  `.git/index.lock`. **Never run `git add`/`commit`/`push` from this
  sandbox's bash tool** — always hand exact commands to the user to run on
  their own machine instead, where the real (correct) file state lives.

---

**SIGN-OFF:** Claude (Sonnet) — 7/11/26 12:44 AM
