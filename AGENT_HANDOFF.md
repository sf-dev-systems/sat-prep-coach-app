# AGENT HANDOFF

Short current-state snapshot for the next agent/session. Rewritten fully each
session (not append-only) — full history lives in `SESSION_LOG.md`.

---

## Where things actually stand (2026-07-10, end of session)

**Newly built this session (Phase 1 gap-closure):**
- Auth: `middleware.ts` (session refresh + redirect), `app/login/page.tsx`,
  sign-out via `components/SignOutButton.tsx`, `lib/db` gained
  `getSupabaseBrowserClient()` / `getSupabaseServerClient(cookies)` (both
  cookie-based via `@supabase/ssr`, so server components/middleware and the
  browser share one session).
- `/session` route: `app/session/page.tsx` (server) wires
  `assemblePracticeSession` into `components/session/SessionRunner.tsx`
  (client) — real question rendering, mandatory confidence pick per submit,
  Exit Session escape hatch.
- `useMissLoop.ts` / `MissLoop.tsx` rewritten: logs the full `attempts` row
  shape (all 6 `error_type` values via a real student self-tag, confidence,
  hints_used, was_retry, skill_id) instead of the old 2-of-6-values hardcode.
  Retry = a second `attempts` row, not a mutation. Hints are still static
  placeholders — AI-generated tiered hints are Phase 2, intentionally not
  wired.

**NOT verified — read before trusting anything compiles:** `npx tsc --noEmit`
could not be run successfully this session. The sandbox's mounted view of
this repo was serving stale/truncated file copies (confirmed via byte-count
checks against the authoritative file-tool `Read`, which showed the real
files complete and well-formed). This looks like an environment artifact,
not a code defect, but **it is not confirmed compiling.** Full detail:
`SESSION_LOG.md`, entry "Phase 1 gap-closure executed."

**Still solid from before:** full schema + RLS + composite PKs live in
Supabase; `lib/ai` chokepoint (ceiling `profiles→env→150`, `ai_log`,
degrade-never-block); `lib/db` isolation; taxonomy seeded (3 sections / 11
domains / 29 leaf skills, hierarchy-verified); `prompts/tutor.ts` + `hint.ts`
+ `generator.ts` are real, usable templates.

**Still not done:** `lib/mastery/` (BKT/FSRS) doesn't exist — Phase 2's core
math item. `app/page.tsx` dashboard is still a static mock (hardcoded
predicted score/streak), not wired to real data — was out of scope for this
session's 3-item gap-closure list. Route-group reorg
(`(student)/(parent)/(admin)`, PRD v1.2 folder layout) not done — deliberately
deferred to Phase 3/4. AI-driven tiered hints and Haiku cross-classification
(with Zod fallback) not wired into the miss loop — Phase 2 per PRD's own
phase gate.

## Next action (single)

1. Run `npx tsc --noEmit` (and ideally `npm run build`) for real and fix
   whatever it actually reports — this session's changes were never
   confirmed compiling due to a sandbox mount issue (see above).
2. Only after that's clean: Phase 2 can start — `lib/mastery/` (BKT + FSRS),
   adaptive session assembler upgrade per PRD priority rules, real F3 miss
   loop (AI tiered hints from `prompts/hint.ts` via `lib/ai`, Haiku
   cross-classification with Zod-validated fallback per PRD v1.2).

## Open items

- Taxonomy count conflict: PRD prose still says "~18 RW / ~18 Math / ~8
  Strategy"; seeded/locked taxonomy is 10/10/9 = 29. Not reconciled — user
  to decide whether to amend the PRD prose to match 29, or expand seeding.
- `raw notes sf.md` has two files beside it not yet reviewed for
  un-captured intent: `OPUS REVIEW.md`, `prd and what i need _this.md`.
- Verify Supabase scheduled backups are actually enabled in the dashboard
  (currently only documented in `supabase/BACKUPS.md`, not confirmed live).
- `app/page.tsx` dashboard still needs wiring to real data (predicted score,
  streak, readiness panel, focus skills) — not scheduled to a phase item
  explicitly yet; likely folds into Phase 3 (Visibility).
- Route-group reorg (`(student)/(parent)/(admin)`) deferred — do it when
  Phase 3/4 UI work starts, not before.

---

**SIGN-OFF:** Claude (Sonnet) — 7/10/26
