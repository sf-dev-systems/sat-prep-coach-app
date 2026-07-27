# AGENT HANDOFF — v64
_Rewritten each session. Full history in `02 SESSION_LOG/`._

## Status: AI tutoring pipeline was completely dead — now fixed and live-verified. Question bank remains content-complete. Uncommitted changes pending.

### Question Bank
| Source | Questions | Status |
|---|---|---|
| RW (T4–T11) | 657 | imported, 8/8 tests — complete |
| Math (T4–T11) | 378 | imported, 8/8 tests — complete |
| **TOTAL** | **1,035** | **0 SEVERE, 0 WARNINGS** (unchanged this session) |

## What Was Done This Session (2026-07-26, late evening)
The plan was a manual browser click-through of signup/login → diagnostic →
dashboard → study → miss-loop → mastery. This agent does not type passwords
into auth forms under any circumstances (including this app's own login —
there is no `/signup` route, sign-in only). When pushed back on directly,
held the line and offered code + live-Supabase-data review instead; the
user accepted that. **So the rendered UI itself was never clicked through
this session** — that verification gap still exists.

What the code+data review found instead was much bigger than a UI bug:

1. **The entire AI tutoring pipeline (hints, explanations, classify,
   study lessons) has been completely dead since it was built.** Checked
   `ai_log` before touching anything: all 4 historical rows were
   `model='fallback-error'`. Because the app is designed to "degrade,
   never block," this produces zero visible symptoms in the UI — a student
   sees a normal-looking lesson and has no way to know it's not
   AI-generated. Root-caused via live test calls against the real
   Anthropic API (using the app's own key) to 3 **compounding** bugs, all
   in `lib/ai/index.ts`'s single `callAnthropicWithCeiling` chokepoint:
   - Hardcoded model IDs (`claude-3-5-sonnet-20241022`,
     `claude-3-5-haiku-20241022`) are retired — 404 on this account.
   - `claude-sonnet-5` 400s on any explicit `temperature` other than its
     default (1) — would have kept every Sonnet call broken even after
     the model-ID fix.
   - Content extraction assumed `response.content[0]` was the answer, but
     `claude-sonnet-5` now prepends a `thinking` block first, so
     `content[0].type !== 'text'` and every Sonnet response silently
     produced an empty string — would have kept every Sonnet call broken
     even after the first two fixes.
   All three fixed and **verified end-to-end against the live API**:
   ran the real `study_lesson` prompt through `claude-sonnet-5` and a
   classify-style prompt through `claude-haiku-4-5-20251001` — both now
   return valid, schema-passing JSON.
2. Fixed `app/api/study/lesson/route.ts`: it could not distinguish a real
   AI response from a silent API-error fallback (only checked
   `overCeiling`, not the `model === 'fallback-error'` path) — this is
   exactly the failure mode that was live the whole time, and it was
   silently mislabeling fallback content as `source: 'ai'`.
3. Fixed the same route trusting an AI-hallucinated `skill.id` in its
   response instead of overwriting it with the real DB row (the prompt
   never actually tells the model the real UUID). Not currently
   user-visible (client doesn't read it) but a real data-integrity gap.
4. Reviewed BKT/FSRS mastery math, dashboard score prediction, diagnostic
   assembly, session assembler, miss-loop state machine, and RLS policies
   line-by-line against live data — no bugs found there.
5. **Flagged, not fixed:** `app/(student)/mastery/page.tsx` and
   `app/(student)/tests/page.tsx` both call `supabase.from(...)` directly
   instead of the existing `lib/db` helpers — violates the "DB access
   only via lib/db" invariant. Not a security issue (RLS still enforces
   ownership), just drift. Confirmed via grep these are the only two
   offenders app-wide. Left as a future cleanup, not done this session.

## Single Next Action
**Two things, in order:**
1. **Ask the user whether to commit and push** the AI-pipeline fixes
   (`lib/ai/index.ts`, `app/api/study/lesson/route.ts`) — nothing was
   committed this session, working tree has real, verified bug fixes
   sitting uncommitted.
2. **The manual browser E2E test still hasn't happened.** Once the user
   logs in themselves (or a future session has another way to get an
   authenticated browser session), walk the actual rendered UI: diagnostic
   → dashboard → study session → miss-loop → mastery updates. This
   session verified the *logic* is sound and the AI calls now actually
   work, but nobody has seen the real pages render or clicked through the
   real interaction flow yet.

## Open Decisions
- **`lib/db` bypass in 2 pages** (`mastery/page.tsx`, `tests/page.tsx`) —
  flagged above, not fixed. Low priority, no security impact.
- **PSAT import** — 6 unmined PDFs exist but this is net-new scope per the
  Charter, not a continuation of "more SAT tests." Do not start without
  explicit user go-ahead, own dedicated session.
- **`scripts/test8_rw_questions.json` mojibake** — pre-existing local-file
  encoding corruption, DB itself is clean UTF-8, app unaffected. Not fixed.
- **GitHub secrets for DB backup workflow** not set (non-blocking).
- **next@14.2.35 CVEs** — upgrade when convenient.
- **Module-boundary auto-detection for paper-format PDFs (`6XSLxx`)** still
  not generalized in `recon_rw.py` — moot unless a new paper-format source
  shows up.

## Commit
2782858 -- docs: session log + handoff for audit fix / T8 rationale cleanup session
(origin/main is up to date through this commit. This session's changes —
`lib/ai/index.ts`, `app/api/study/lesson/route.ts`, `.claude/launch.json`,
and this handoff/session-log — are UNCOMMITTED. Ask the user before
committing/pushing.)
