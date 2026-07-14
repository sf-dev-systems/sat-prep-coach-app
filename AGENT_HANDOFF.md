# AGENT HANDOFF

Short current-state snapshot for the next agent/session. Rewritten fully each
session (not append-only) — full history lives in `00 SYSTEM/SESSION_LOG/`
(indexed at `00 SYSTEM/SESSION_LOG/00_INDEX.md`). Keep this file to state +
next action + open decisions — anything resolved or purely historical
belongs in the session log, not here.

---

## Where things stand (2026-07-14 01:10, Fable — full review + v1 plan, no code written)

**Phase 1: CLOSED. Phase 2: code-complete; F3 still not build-verified or
committed (unchanged since 07-11).** This session was a review-and-plan pass
triggered by Ava's PSAT results landing: verified the whole repo against
PRD v1.2/Charter and queried the live Supabase DB directly.

**Verified DB state:** 43 skills / 29 leaf ✅; **74 questions** (64 math from
Test 4, 10 RW placeholders, 0 strategy) — the critical blocker; 0 mastery
rows (diagnostic never taken); **0 `ai_log` rows** (hint/explanation/classify
have never hit the real API); 26 attempts / 3 sessions; 1 auth user;
1 behavior_signals row.

**PSAT baseline (entered into planning, NOT yet into `practice_tests` —
that's Phase 3's `/tests`):** 1110 total, Math 500 / RW 610. Advanced Math
370–410 = weakest (32.5% of math section) → #1 leverage; then Algebra
(470–540, 35%), RW Standard English Conventions (550–600), PSDA; Geo/Trig
(550–600) is her strength. Target 1500 → +260 Math / +130 RW.

**The deliverable:** `00 SYSTEM/AI OUTPUTS/2026-07-14_v1-completion-plan.md` —
verified build state, PSAT gap analysis, ordered Steps 0–4 to a working v1,
acceptance-criteria checklist. Bottom line: intelligence layer is done;
what's left is local verification (Step 0), content supply matched to her
weaknesses (Step 1, ~350–450 official questions, AdvMath+Algebra+RW first),
then Phases 3–4 as already defined. No re-architecture proposed.

## Next action

**Sienna: approve/edit the plan, then run Step 0 on your own machine** (the
sandbox cannot — see standing notes): `npm install && npx tsc --noEmit &&
npm run build`; `git status` → commit/push pending F3 work (exact commands in
the 07-11 handoff, preserved in `00 SYSTEM/SESSION_LOG/2026-07-11_0400_...md`);
then one live miss-loop smoke test (wrong answer → 3 hints → retry wrong →
explanation → variant) and confirm `ai_log` + `error_journal` rows landed.

## Open decisions

1. Go-ahead for Step 1 (content import via the proven Test-4 Haiku pipeline:
   Tests 5/6 math + full RW first) — pre-gate work, no phase crossed.
2. **Phase 3 gate** — explicit approval required per CLAUDE.md. Proposed
   internal order: `/tests` + prediction first (so the PSAT anchors the curve
   from day 1), then `/mastery` + goal tree, then readiness/journal/coach-
   memory F6, then route groups.
3. Ava's target SAT date — drives study pacing (5–6×40min/week either way),
   not architecture.
4. Carried forward from 07-11 (unchanged): BKT/FSRS/behavior-signal constants
   are untuned first-pass heuristics; variant-bank density will make the
   variant step skip often until the bank grows; coach memory reads empty
   until F6 ships.

## Carried-over open items (not blocking)

- GitHub secrets for the DB backup workflow not yet set; workflow has never
  run. (Cheap; do before Ava starts real daily use.)
- Next.js major-version CVEs unpatched (`next@16.2.10` migration; breaks 3
  files via async `cookies()`/`headers()`).
- Taxonomy count prose in PRD ("~18/~18/~8") vs. actual seed (10/10/9 = 29
  leaves) — prose correction pending.
- Git cleanup (untrack ~59MB CB PDFs + stray screenshots) — still unconfirmed.
- `raw notes sf.md` has two unreviewed files: `OPUS REVIEW.md`,
  `prd and what i need _this.md`.

## Standing sandbox notes (mitigation only — don't re-investigate)

- **The sandbox Linux mount serves truncated/stale views of repo files**
  (new confirmation 2026-07-14: sandbox `tsc` emitted spurious syntax errors
  across ~15 files, sandbox `git` reported a corrupt index, and
  `AGENT_HANDOFF.md` showed as 0 bytes — all files verified complete via
  direct Read). Read/Write/Edit are the source of truth; never trust sandbox
  bash for file content, builds, or git.
- Never run `git add`/`commit`/`push` from the sandbox — hand exact commands
  to the user's own machine.
- Hand `npm run build` to the user's own machine for real verification.
- Watch for Vercel Deployment Protection blocking external test calls
  (redirects to `vercel.com/login`) — Settings → Deployment Protection.
- `middleware.ts` runs on every route except static assets — any future
  no-session endpoint (crons, webhooks) needs its path in `PUBLIC_PATHS`.

---

**SIGN-OFF:** Claude (Fable) — 7/14/26 1:10 AM
