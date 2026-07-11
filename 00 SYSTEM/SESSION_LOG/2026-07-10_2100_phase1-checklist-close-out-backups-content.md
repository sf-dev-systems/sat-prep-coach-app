---
title: "Session: Phase 1 checklist close-out — backups, auth cleanup, placeholder content"
type: session-log
date: 2026-07-10
time: "21:00 (estimated — this session's original entry recorded date only, no sign-off time; ordering-only estimate, not a verified timestamp)"
agent: Claude (Sonnet)
---

# 2026-07-10 — Phase 1 checklist close-out: backups, auth cleanup, placeholder content (Claude Sonnet)

**COMPLETED (work + files touched)**
- **Backups:** Confirmed via Supabase `get_organization` the org plan is
  **free** (no native PITR/scheduled backups — Pro/Enterprise-only, not
  just unconfigured). `supabase/BACKUPS.md` already documented a
  GitHub-Actions-`pg_dump` option but it was never implemented. Built and
  committed it for real: `.github/workflows/db-backup.yml` (new) runs
  nightly, `pg_dump`s the full DB, GPG-symmetric-encrypts the dump, and
  commits it to an orphan `backups` branch of this repo (pruned to the
  most recent 30 nightly dumps) — durable, free, no third-party storage
  account needed, and stronger than the original draft's 7-day artifact
  retention. Updated `supabase/BACKUPS.md` with a status section (setup +
  restore steps) and `09 WIKI/OPERATIONS_MANUAL.md` §3 to point at the
  live mechanism instead of the old generic pointer.
- **Stray auth user:** User had already deleted `go2sienna@gmail.com` from
  Supabase Auth before this session started. Verified via direct
  `auth.users` query: exactly one row remains, `avamills2010@gmail.com`
  (the real student account). No action needed, confirmed only.
- **Question bank content:** No real question-bank source file exists
  anywhere in the repo or was provided this session — `scripts/import-
  official-bank.ts` had nothing to import. User was uncertain how to get
  real content in; asked via AskUserQuestion, chose the placeholder-batch
  path. Authored 20 hand-written, correctly-keyed SAT-style questions
  (10 Math, 10 R&W — one per leaf skill, excluding zero-weight Strategy
  skills), saved to `data/placeholder-questions.json` (matches the
  `import-official-bank.ts` input schema, for reproducibility/reference)
  and inserted directly into the live `questions` table via Supabase
  `execute_sql` (`source: 'generated'`, `license: 'placeholder_test_data'`,
  `validated: true` so `assemblePracticeSession` picks them up). Verified
  post-insert: `questions` table now has 20 rows, all validated.
- **Licensing correction (important, flagged to user):** User believed
  College Board publishes an official bulk-downloadable JSON/CSV question
  bank for third-party import. Corrected: College Board's official digital
  SAT practice content (Bluebook, the official digital practice tests) is
  copyrighted and licensed for individual student use inside their own
  app/PDFs — there is no official bulk export for reuse in another
  product's database. This is *why* the schema already has a `license`
  column on `questions` (provenance tracking was anticipated, not an
  afterthought). Real content path when ready: hand-transcribe from
  practice tests Sienna/Ava already have legitimate access to (tag
  `license` per source), or use a licensed third-party bank/API — not a
  bulk download.

**DECISIONS**
- Backup destination: GPG-encrypted dump committed to an orphan `backups`
  git branch, not S3/cloud storage — zero new accounts/cost, "durable
  location" requirement met via git history rather than an external
  service, consistent with this being a single-user personal project.
  Made unilaterally per CLAUDE.md's "make implementation decisions
  yourself" rule (reversible, no scope change) — flagged for the user to
  confirm the two required GitHub secrets, not asked as an open question.
- Placeholder questions inserted directly via Supabase `execute_sql`
  rather than running `npm run import-bank` locally — faster and
  equally verifiable in this session; the JSON file was still written to
  `data/` so the normal script-based path is documented/reproducible for
  the next real import.
- Did not attempt to source or fabricate "official" College Board
  questions under the `official` source tag — would misrepresent
  provenance in a schema field whose entire purpose is tracking that
  distinction accurately.

**VERIFICATION**
- `select count(*) as total, count(*) filter (where validated) as
  validated_count from questions` → `{total: 20, validated_count: 20}`.
- `select id, email from auth.users` → exactly one row, the correct
  student account.
- `.github/workflows/db-backup.yml` created but **not yet run** — first
  scheduled run (or a manual `workflow_dispatch`) plus the two repo
  secrets being set are still needed to prove it end-to-end; flagged as
  an open item, not claimed as verified-working.

**OPEN ITEMS**
- User must add `DB_CONNECTION_STRING` and `BACKUP_GPG_PASSPHRASE` as
  GitHub repo secrets (Settings → Secrets and variables → Actions) before
  the backup workflow will succeed — currently it will run nightly and
  fail visibly (not silently) until then.
- Commit/push `.github/workflows/db-backup.yml`, `supabase/BACKUPS.md`,
  `09 WIKI/OPERATIONS_MANUAL.md`, and `data/placeholder-questions.json` to
  `main` — written to the local file tree this session but not yet
  committed/pushed (this session did not run git commands against the
  user's local clone).
- Once secrets are set, trigger the workflow manually once
  (`workflow_dispatch`) to confirm the encrypt-and-commit-to-`backups`-
  branch path actually works before trusting the nightly schedule.
- 20 placeholder questions are test content only (`license:
  placeholder_test_data`) — replace/supplement with real, properly
  licensed content before this app is used for actual score-affecting
  practice; sourcing approach still to be decided (hand-transcription vs.
  licensed bank/API).
- Same carried-forward items as before: taxonomy count conflict (PRD
  prose vs. 29 locked skills), unreviewed raw-notes files, `app/page.tsx`
  dashboard still a static mock, route-group reorg deferred to Phase 3/4,
  Next.js major-version CVEs (needs a scheduled migration decision).
- Phase 2 (BKT/FSRS in `lib/mastery/`) is unblocked and ready pending
  explicit user go-ahead — not started this session, per instruction.

**SIGN-OFF:** Claude (Sonnet) — 7/10/26
