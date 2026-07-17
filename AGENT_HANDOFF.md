# AGENT HANDOFF

> ⚠️ **Read this before trusting any sandbox file/build error.** The
> sandbox's FUSE mount can silently truncate reads/writes and cause phantom
> `tsc`/build errors on files that are actually fine on disk. Cross-check any
> sandbox `cat`/`git show`/`tsc`/build result against the host-side `Read`
> tool before believing it. Never run `git add`/`commit`/`push` from the
> sandbox — hand exact commands to your own machine.

Short current-state snapshot for the next agent/session. Rewritten fully each
session — full history lives in `02 SESSION_LOG/` (indexed at
`02 SESSION_LOG/00_INDEX.md`; canonical docs live in `01 DOCS/`).

---

## Where things stand (2026-07-17, merged Sonnet + Gemini sessions)

**Phase 1: CLOSED. Phase 2: CODE-COMPLETE, BUILD-VERIFIED** (clean `tsc
--noEmit` and `next build` confirmed this session).

**Phase 3 (Visibility): CODE-COMPLETE, PUSHED, EXPLICITLY AUTHORIZED BY
SIENNA** — built by the Gemini agent (7/16 5:09 PM), confirmed authorized
directly by Sienna (7/17). Delivered: route groups
((student)/(parent)/(admin)), predictive score calibration
(`lib/scoring/predictive-score.ts`), `/tests` practice test journal with
mastery-snapshotting, `/mastery` hierarchical goal tree with drill-in and
skill notes.

**This session's work:** two independent sessions (Sonnet in sandbox, Gemini
locally) found and fixed the *same* corruption in `lib/db/index.ts` —
literal `\n`/`\"` escape sequences baked into the committed text of
Gemini's own Phase 3 commit (`7958d2a`), which is what caused the
`getSupabaseServerClient is not a function` crash Sienna hit. Both fixes
were functionally identical (diff was cosmetic comment-formatting only).
Histories had diverged (2 local commits vs. 3 origin commits); reconciled
via merge — kept Gemini's `lib/db/index.ts` content, combined both
AGENT_HANDOFF narratives here, merged the session-log index table
(chronological order). **Also cleaned up an unfinished merge**: conflict
markers were still physically present in `AGENT_HANDOFF.md` and (one
trailing line) in `02 SESSION_LOG/00_INDEX.md` on disk — the earlier
in-session merge steps had stalled before the final commit. Fixed directly
via file edit this session.

Canonical docs relocated to `01 DOCS/` and `02 SESSION_LOG/` (copied
content, old `00 SYSTEM/docs/`/`00 SYSTEM/SESSION_LOG/` left in place as
untouched legacy copies, nothing deleted). `CLAUDE.md` already updated to
match.

**Live but unstyled:** localhost:3000 renders real data (Predicted Score,
Readiness Dashboard, Goal Progress, Top Focus Skills) but with zero
Tailwind styling applied — plain unstyled HTML. Checked this session:
`tailwind.config.ts` content globs, `postcss.config.js`, `app/globals.css`
(`@tailwind` directives present), and `package.json` (`tailwindcss` +
`autoprefixer` + `postcss` all present in devDependencies) all look
correct — no obvious config bug found. Prime suspect is a stale `.next`
build cache / dev server that hasn't picked up the post-merge file state
cleanly, not a real misconfiguration. **Not yet fixed or confirmed.**

## Next action (single most important thing for the next session)

1. Finish git hygiene first — on your machine:
   ```powershell
   git add "AGENT_HANDOFF.md" "02 SESSION_LOG\00_INDEX.md"
   git status   # confirm nothing still shows as unmerged
   git commit -m "merge: finish reconciling docs relocation + Gemini Phase 3 push"
   git push
   ```
2. Fix the styling regression:
   ```powershell
   # stop npm run dev (Ctrl+C) first, then:
   Remove-Item -Recurse -Force .next
   npm run dev
   ```
   Reload `localhost:3000`. If still unstyled, next session should check
   the browser console/network tab for a failed CSS request, and check
   `npm list tailwindcss postcss autoprefixer` actually resolves (not just
   listed in package.json — confirm installed in `node_modules`).
3. Once styling is fixed: log Ava's PSAT baseline (1110 composite: Math
   500 / RW 610) at `http://localhost:3000/tests` to activate real-time
   predictive scoring.

## Open decisions

1. Phase 4 scope (parent `/parent` dashboard w/ PIN, weekly Sunday AI
   summary cron, text-to-speech widgets, PWA installer bindings) — proposed
   by Gemini, not yet approved by Sienna. Ask before starting.
2. Go-ahead for content import (Test-4 Haiku pipeline: Tests 5/6 math + full
   RW) — pre-gate work, no phase crossed either way.
3. Ava's target SAT date — drives pacing (5-6x40min/week), not architecture.
4. Carried forward: BKT/FSRS/behavior-signal constants are untuned
   first-pass heuristics; variant-bank density will make the variant step
   skip often until the bank grows; coach memory reads empty until F6 ships.

## Carried-over open items (not blocking)

- GitHub secrets for the DB backup workflow not yet set; workflow has never
  run.
- Next.js major-version CVEs unpatched (`next@16.2.10` migration; breaks 3
  files via async `cookies()`/`headers()`).
- Taxonomy count prose in PRD ("~18/~18/~8") vs. actual seed (10/10/9 = 29
  leaves) — prose correction pending.
- Git cleanup (untrack ~59MB CB PDFs + stray screenshots) — still
  unconfirmed. Also several stray untracked files surfaced this session
  (`test_write_check.tmp`, `supabase/.temp/test_b64.txt`, `ss ux*.png`)
  worth cleaning up or adding to `.gitignore`.
- `raw notes sf.md` has two unreviewed files: `OPUS REVIEW.md`,
  `prd and what i need _this.md`.
- Two orphaned prototype files not yet reconciled: `app/components/MissLoopReview.tsx`, `app/miss-loop/page.tsx`.

## Standing sandbox notes (mitigation only)

- Sandbox mount cannot delete/unlink files (`rm`, `git checkout`, `git mv`
  fail `Operation not permitted`) — overwrite content in place instead.
- Never run `git add`/`commit`/`push` from the sandbox.
- Hand `npm run build` to the real machine for full verification; `npx tsc
  --noEmit` is a lighter in-sandbox substitute.
- Watch for Vercel Deployment Protection blocking external test calls.
- `middleware.ts` runs on every route except static assets — any future
  no-session endpoint (crons, webhooks) needs its path in `PUBLIC_PATHS`.
- **A second AI agent ("Gemini") also has authorized push access to this
  repo, working directly with Sienna in parallel sessions.** Commits
  authored as "AI Coach Build Bot <bot@sf-dev-systems.com>" are Sienna's own
  identity, not third-party automation. Expect occasional divergent
  histories between sessions — check `git log --oneline HEAD..origin/main`
  early when picking up a session.

---

**SIGN-OFF:** Merged reconciliation of Claude (Sonnet, 7/16/26 9:15 PM) and
Gemini Agent (7/16/26 5:09 PM) sessions, completed by Claude (Sonnet) —
7/17/26.
