# AGENT HANDOFF

> ⚠️ **Read this before trusting any sandbox file/build error.** The
> sandbox's FUSE mount can silently truncate reads/writes and cause phantom
> `tsc`/build errors on files that are actually fine on disk — confirmed
> across two projects the same day (this one + `FIN-finance-ops`, see
> `03-PROJECTS\FIN-finance-ops\01 DOCS\logs\7-16-2026_CLAUDE_E.md`).
>
> **Workaround:**
> 1. Cross-check any sandbox `cat`/`git show`/`tsc`/build result against
>    the host-side `Read` tool before believing it — they use different
>    code paths, and `Read` wins on disagreement.
> 2. Make edits with `Read`/`Edit`/`Write`, not shell redirection.
> 3. Expect `rm`/`git mv`/`git checkout` to fail on this mount
>    ("Operation not permitted") — overwrite content in place instead of
>    deleting; deletion needs an explicit approval prompt.
> 4. Never run `git add`/`commit`/`push` from the sandbox — hand exact
>    commands to your own machine.
>
> Full detail in "Standing sandbox notes" at the bottom of this file and in
> `02 SESSION_LOG/2026-07-16_2115_local-tree-repair-and-docs-relocation.md`.
> This is also saved as a standing cross-project memory now, so future
> sessions should already know it.

Short current-state snapshot for the next agent/session. Rewritten fully each
session (not append-only) — full history lives in `02 SESSION_LOG/`
(indexed at `02 SESSION_LOG/00_INDEX.md`; canonical docs live in `01 DOCS/`
as of this session — see note below). Keep this file to state + next
action + open decisions — anything resolved or purely historical belongs
in the session log, not here.

---

## Where things stand (2026-07-16 21:15, Sonnet — local crash fix + docs relocation)

**Phase 1: CLOSED. Phase 2: code-complete, still not build-verified or
committed (carried forward from 07-11/07-14).** This session was triggered
by a live runtime crash Sienna hit: `getSupabaseServerClient is not a
function` on `app/layout.tsx`.

**Root cause (two layers):**
1. Sienna's local working tree had drifted from git HEAD — she'd been
   moving folders around locally, leaving broken/partial versions of
   `app/`, `lib/`, `components/`, `prompts/`, `scripts/` on disk.
2. More importantly: **`lib/db/index.ts` appears genuinely corrupted in
   the git commit itself** (`7958d2a`, Phase 3 Visibility) — from partway
   through the file (the `getSupabaseServerClient` doc comment) to EOF,
   the committed text has literal `\n`/`\"` escape sequences instead of
   real newlines/quotes, as if a JSON-escaped string got written to disk
   unparsed. Verified via `git fsck` + independent `git cat-file` reads
   (not just `git show`) — reproducible, not sandbox mount noise, though
   not yet confirmed against GitHub directly (no clone credentials in this
   sandbox). **See the verification section in this session's log file
   for exactly how to spot-check this on your own machine before trusting
   it fully.**

**What was done:** restored the code tree to match git HEAD content
(byte-verified), then ran a one-off unescape fix on the corrupted tail of
`lib/db/index.ts`. `npx tsc --noEmit` is clean project-wide. Sienna
confirmed `localhost:3000` is up and looks active.

**This fix is NOT committed to git.** Per the standing sandbox note below,
git write operations should happen on Sienna's own machine, not from here.

**Also this session:** relocated canonical docs to `01 DOCS/` and
`02 SESSION_LOG/` (Sienna's preferred local folder names) by copying the
accurate content over from `00 SYSTEM/docs/`/`00 SYSTEM/SESSION_LOG/`
(which were themselves already restored to match git HEAD) and from
`00 SYSTEM/AI OUTPUTS/` → `00 SYSTEM/AI Review and Audits/`. Nothing was
deleted anywhere this session (explicit instruction: "DONT DELETE
ARCHIVE") — old paths left in place as untouched legacy copies.
`CLAUDE.md` updated to point at the new paths.

## Next action

**Sienna, on your own machine (not this sandbox):**
1. Spot-check the corruption claim: `git show HEAD:lib/db/index.ts | sed
   -n '60,66p'` — if you see literal `\n`/`\"` text instead of real line
   breaks, it's real and confirmed.
2. Pull/sync this sandbox's fixed `lib/db/index.ts` onto your machine (or
   just re-apply: the fix removes literal `\n`/`\"` from the doc-comment
   at `getSupabaseServerClient` onward), then `git add -A && git commit &&
   git push` — this is the one commit that actually matters; without it
   the crash comes right back on the next clone/checkout.
3. Once committed: `npm install && npx tsc --noEmit && npm run build` for
   full local confirmation (sandbox build hit an unrelated timeout this
   session, didn't get a full `next build` pass — `tsc --noEmit` clean is
   the strongest signal so far).
4. Decide what to do with the now-legacy `00 SYSTEM/docs/`,
   `00 SYSTEM/SESSION_LOG/`, `00 SYSTEM/AI OUTPUTS/` folders and the two
   orphaned prototype files (`app/components/MissLoopReview.tsx`,
   `app/miss-loop/page.tsx`) — left in place, no rush.

**Then resume where 07-14 left off:** approve/edit
`00 SYSTEM/AI Review and Audits/2026-07-14_v1-completion-plan.md` (also now
at `01 DOCS/`... no — AI outputs live in `00 SYSTEM/AI Review and Audits/`,
not `01 DOCS/`) and run its Step 0 verification, then Step 1 content
import.

## Open decisions

1. Go-ahead for Step 1 (content import via the proven Test-4 Haiku
   pipeline: Tests 5/6 math + full RW first) — pre-gate work, no phase
   crossed.
2. **Phase 3 gate** — explicit approval required per CLAUDE.md. Proposed
   internal order: `/tests` + prediction first (so the PSAT anchors the
   curve from day 1), then `/mastery` + goal tree, then
   readiness/journal/coach-memory F6, then route groups.
3. Ava's target SAT date — drives study pacing (5–6×40min/week either
   way), not architecture.
4. Carried forward from 07-11 (unchanged): BKT/FSRS/behavior-signal
   constants are untuned first-pass heuristics; variant-bank density will
   make the variant step skip often until the bank grows; coach memory
   reads empty until F6 ships.

## Carried-over open items (not blocking)

- GitHub secrets for the DB backup workflow not yet set; workflow has
  never run. (Cheap; do before Ava starts real daily use.)
- Next.js major-version CVEs unpatched (`next@16.2.10` migration; breaks
  3 files via async `cookies()`/`headers()`).
- Taxonomy count prose in PRD ("~18/~18/~8") vs. actual seed (10/10/9 = 29
  leaves) — prose correction pending.
- Git cleanup (untrack ~59MB CB PDFs + stray screenshots) — still
  unconfirmed.
- `raw notes sf.md` has two unreviewed files: `OPUS REVIEW.md`,
  `prd and what i need _this.md`.

## Standing sandbox notes (mitigation only — don't re-investigate lightly)

- The 07-14 session flagged that sandbox bash/git sometimes serves
  truncated/stale file views. This session found what looks like genuine
  committed corruption in `lib/db/index.ts` and cross-checked it two
  independent ways (`git fsck` clean + repeatable `git cat-file` reads)
  before trusting it — see this session's log for the verification
  writeup. Healthy skepticism of sandbox file/git output should continue,
  but don't assume every anomaly is the mount's fault without checking.
- **This mount cannot delete or unlink files** (`rm`, `git checkout`,
  `git mv` all fail `Operation not permitted`) — there's a
  `allow_cowork_file_delete` gate for that, and Sienna declined it this
  session. Default to overwriting content in place, never assume deletion
  is possible.
- Never run `git add`/`commit`/`push` from the sandbox — hand exact
  commands to Sienna's own machine.
- Hand `npm run build` to Sienna's own machine for full verification;
  `npx tsc --noEmit` worked fine in-sandbox this session as a lighter
  substitute.
- Watch for Vercel Deployment Protection blocking external test calls
  (redirects to `vercel.com/login`) — Settings → Deployment Protection.
- `middleware.ts` runs on every route except static assets — any future
  no-session endpoint (crons, webhooks) needs its path in `PUBLIC_PATHS`.

---

**SIGN-OFF:** Claude (Sonnet) — 7/16/26 9:15 PM
