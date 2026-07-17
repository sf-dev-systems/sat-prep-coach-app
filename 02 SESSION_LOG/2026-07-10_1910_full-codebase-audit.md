---
title: "Session: Full codebase audit against PRD/Charter"
type: session-log
date: 2026-07-10
time: "19:10 (estimated — original SESSION_LOG.md recorded no sign-off time for this entry; ordering-only estimate, not a verified timestamp)"
agent: Claude (Sonnet)
---

# 2026-07-10 — Full codebase audit against PRD/Charter (Claude Sonnet)

**What changed**
- Read every file in the code tree (`app/`, `lib/`, `prompts/`, `components/`, `supabase/migrations/`, `scripts/`) plus PRD v1.1, Charter, `AGENT_HANDOFF.md`, `SESSION_LOG.md`. Ran `npx tsc --noEmit` (clean, 0 errors) to verify compile claims.
- Wrote full findings to `00 SYSTEM/AI OUTPUTS/2026-07-10_codebase-audit.md`.
- Added a "File locations" section to `09 WIKI/00_INDEX.md` pointing to the CLAUDE.md rule that AI deliverables live in `00 SYSTEM/AI OUTPUTS/` and code stays in the lowercase tree — per user request to make that discoverable without opening CLAUDE.md.
- Applied strikethrough + correction notes to `AGENT_HANDOFF.md`'s "100% complete" status and "Phase 2 next action" — did not delete or rewrite, per doc policy.

**FINDINGS (see audit file for full detail)**
- Solid and verified: full 15-table schema + RLS + composite PKs live; `lib/ai` chokepoint (ceiling `profiles→env→150`, `ai_log`, degrade-never-block) correct; `lib/db` is the only Supabase-touching file; taxonomy seeded and hierarchy-verified (3 sections / 11 domains / 29 leaf skills); `prompts/tutor.ts` + `hint.ts` + `generator.ts` are real, well-built templates.
- Overstated by prior session: "Mathematical Engine fully implemented" refers only to the score-prediction weighting formula (`lib/scoring/predictive-score.ts`) — there is no `lib/mastery/` (BKT/FSRS) at all. "Phase 1 100% complete" is not accurate — there is no `/session` route (assembler exists but is never called from `app/`), no auth flow (`/login` missing, nothing bootstraps a client session), and `app/page.tsx` is a static mock with hardcoded numbers, not real data.
- `components/session/MissLoop.tsx` / `useMissLoop.ts` are UI/DB scaffolds, not PRD F3: no tiered hints wired up (prompt exists, never called), no explanation/variant sequence, `classifyFailure()` is a string-match heuristic (not the Haiku cross-classify call F3.4 requires), and the attempts insert hardcodes `error_type` to only 2 of 6 valid values while never setting `confidence`/`hints_used`/`was_retry`/`skill_id`.
- Unreconciled deviation: seeded taxonomy is 29 leaf skills (10 RW / 10 Math / 9 Strategy) vs. PRD's "~18 RW / ~18 Math / ~8 Strategy" language; this was declared a locked invariant in `CLAUDE.md` without the PRD archive/strikethrough amendment the doc-revision policy requires.

**DECISIONS**
- Did not modify code — this was a review/audit session only, per user request ("review... ensure what's coded is complete").
- Left the 29-skill-vs-PRD-language conflict as an open item for the user to resolve (amend PRD properly, or accept 29 as final and archive the old language) rather than unilaterally picking one.

**OPEN ITEMS**
- Resolve taxonomy count conflict (PRD language vs. `CLAUDE.md` locked invariant).
- Phase 1 gap-closure needed before Phase 2 BKT/FSRS work: auth bootstrap, real `/session` route wiring the existing assembler, fix `useMissLoop.ts` attempt shape.
- `supabase/BACKUPS.md` documents a backup protocol — verify scheduled backups are actually enabled in the Supabase dashboard, not just spec'd.
- `99 ARCHIVE/SF RAW NOTES/seeding pt2.md` and other raw notes files flagged by user as context-only, not reviewed (per instruction, archive folder skipped).

**SIGN-OFF:** Claude (Sonnet) — 7/10/26
