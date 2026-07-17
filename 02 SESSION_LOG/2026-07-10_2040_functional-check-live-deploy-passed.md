---
title: "Session: Functional check on live deploy PASSED; student-account gap discovered and fixed"
type: session-log
date: 2026-07-10
time: "20:40 (estimated — original SESSION_LOG.md recorded no sign-off time for this entry; ordering-only estimate, not a verified timestamp)"
agent: Claude (Sonnet)
---

# 2026-07-10 — Functional check on live deploy: PASSED; student-account gap discovered and fixed (Claude Sonnet)

**What changed**
- User ran the functional check on the live Vercel URL (`sat-prep-coach-app-wheat.vercel.app`). First attempt: `/login` rendered correctly, but sign-in failed with "Invalid login credentials."
- Diagnosed via direct Supabase MCP query (`execute_sql` against project `ckuhtjrnnqjnrgpuurlr`): `auth.users` had **zero rows**. The PRD's "student account created manually in the Supabase dashboard" step had never actually been done in any prior session — the login failure was a missing account, not a wrong password (Supabase returns the same generic error for both, by design).
- Walked user through Supabase dashboard → Authentication → Users → Add user. Two accounts got created in the process (`avamills2010@gmail.com`, `go2sienna@gmail.com`) before establishing which one was correct.
- **Resolved a naming/identity confusion:** the account owner in this repo (`go2sienna@gmail.com`, "Sienna") is the **parent**, not the student — her daughter **Ava Mills** (`avamills2010@gmail.com`) is the actual student the app is built for. `go2sienna@gmail.com` should not exist in `auth.users` at all per the PRD (v1 has one student account, zero parent accounts — `/parent` is PIN-gated via `PARENT_PIN`, no Supabase Auth login, and isn't built yet). Flagged for cleanup (delete the stray account), not yet done.
- Saved this to persistent memory (`memory/sat_prep_coach_people.md`) so future sessions don't repeat the confusion.
- User signed in as `avamills2010@gmail.com` → landed on `/` (dashboard, still the static mock — expected, unrelated to auth). Clicked "Start Practice Session" → `/session` rendered "No questions available yet" instead of a question list or an error.
- Verified via direct Supabase query that this is correct behavior, not a bug: `questions` table has 0 rows (`select count(*) ... from questions` → `total: 0, validated_count: 0`). `assemblePracticeSession` ran successfully against live data, found nothing, and the empty-state UI built into `app/session/page.tsx` handled it gracefully — exactly the designed fallback path, not a crash.

**DECISIONS**
- Declared Phase 1 gap-closure **fully verified and closed** — auth, `/session` routing, and graceful empty-state handling all confirmed working against the live Vercel deployment and live Supabase data, not just a clean local build.
- Did not unilaterally insert sample/placeholder questions into the live database to force a fuller test — offered it to the user as a real choice (test data now vs. wait for a real question bank import) rather than deciding for them, since it touches production data.
- Left the stray `go2sienna@gmail.com` auth account in place (flagged, not deleted) — cleanup, not urgent, doesn't break anything since RLS scopes by `user_id` regardless of how many accounts exist.

**VERIFICATION**
- Live functional test on `sat-prep-coach-app-wheat.vercel.app`: logged-out → `/login` redirect ✓; sign-in as `avamills2010@gmail.com` ✓; landed on `/` with session persisted (email + Sign out shown in header) ✓; `/session` → real server-side call to `assemblePracticeSession` against live Supabase, correct empty-state handling ✓.
- Confirmed via direct Supabase `execute_sql` queries (not just app-level behavior): `auth.users` now has the correct student account; `questions` table is genuinely empty (0 rows), so the empty-state response is accurate, not a hidden bug.

**OPEN ITEMS**
- Delete the stray `go2sienna@gmail.com` Supabase Auth user (should not exist per PRD — parent has no account).
- `questions` table is empty — need either a real question bank import (`npm run import-bank` / `scripts/import-official-bank.ts`, already exists from Phase 1) or, if desired, a small placeholder batch for manual testing purposes (offered to user, not yet actioned).
- Same PRD-conflict and deferred items as before: taxonomy count conflict, unreviewed raw-notes files, Supabase backups live-verification, `app/page.tsx` dashboard still a static mock, route-group reorg, Next.js major-version CVEs (needs a scheduled migration decision).
- Phase 2 (BKT/FSRS, real F3 miss loop with AI hints/classification) is unblocked and ready to start whenever the user gives the go-ahead — content import can happen in parallel or first, user's call.

**SIGN-OFF:** Claude (Sonnet) — 7/10/26
