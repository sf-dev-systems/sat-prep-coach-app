---
title: "Session: Governance rework — AGENT_HANDOFF policy, doc rotation, PRD v1.1 → v1.2 merge"
type: session-log
date: 2026-07-10
time: "19:40 (estimated — original SESSION_LOG.md recorded no sign-off time for this entry; ordering-only estimate, not a verified timestamp)"
agent: Claude (Sonnet)
---

# 2026-07-10 — Governance rework: AGENT_HANDOFF policy, doc rotation, PRD v1.1 → v1.2 merge (Claude Sonnet)

**What changed**
- User flagged that `AGENT_HANDOFF.md`'s "never overwrite, strikethrough-only" rule was fighting its own purpose (a handoff doc needs to stay short and readable) and asked to reconcile PRD v1.1 with `draft_addl_PRD v1_2.md`, which had never been merged.
- **CLAUDE.md governance changes:**
  - `AGENT_HANDOFF.md` policy reversed: now REWRITTEN fully each session (short current-state snapshot: verified-done, single next action, open items). History lives only in `SESSION_LOG.md` going forward.
  - `SESSION_LOG.md` given an explicit rotation policy: when it grows large (quarterly / ~50 entries), archive the older chunk as `archive_YYYY-MM-DD_SESSION_LOG.md` with a pointer left in the live file — file itself stays append-only otherwise.
  - Document revision policy note added: a revision may rename the live file itself to carry its version (this is what happened mid-session to the PRD — see below) rather than always keeping the original filename; frontmatter `version:` is the real source of truth, not the filename.
  - "Source of truth" section's PRD reference updated to point at the current filename and flag that it will keep changing.
- **AGENT_HANDOFF.md rewrite:** archived the old cumulative-format file verbatim to `99 ARCHIVE/archive_2026-07-10_AGENT_HANDOFF.md` (nothing deleted), then wrote a fresh short-format live file reflecting current verified state + single next action + open items.
- **PRD v1.1 → v1.2 merge:** archived the pre-revision PRD content to `99 ARCHIVE/archived_docs/archive_2026-07-10_PRD v1.1.md`, then merged into the live PRD (frontmatter bumped to v1.2):
  - Locked as binding: Zod-schema-validated classifier fallback (malformed/failed Haiku classify output defaults `error_type` to `'concept'`, logged via existing `ai_log`, no new table needed); miss-loop "Exit Session" escape hatch (student can leave hint/retry/explanation flow at any point, session ends normally with partial progress saved, no schema change needed); folder layout reorganized into `(student)/`, `(parent)/`, `(admin)/` Next.js route groups (URLs unchanged).
  - Added as non-binding design notes on Phase 3/4: "Forest" metaphor for student `/mastery` (circles → domain bubbles → goal tree); tabular "Report Card" metaphor + "View as Student" toggle for `/parent`.
  - Did not merge: restated boilerplate in the draft that duplicated v1.1 with no new information.
- **Mid-session file move by user:** while this was in progress, the user manually renamed/moved `00 SYSTEM/docs/PRD v1_1.md` → `00 SYSTEM/docs/PRD v1-2.md` (establishing the filename-carries-version pattern noted above) and moved `00 SYSTEM/docs/draft_addl_PRD v1_2.md` → `99 ARCHIVE/archived_docs/archive_addl_PRD v1_2.md`. Adjusted in-flight: added the "merged" status note to the now-archived draft copy, and repointed all PRD cross-references (`related:`, `changelog:`, inline "Source:" notes) from the old draft path to its new archive path.

**DECISIONS**
- Chose to make AGENT_HANDOFF.md rewritable rather than patch around the bloat with more archiving — user confirmed via AskUserQuestion.
- Locked only the implementation-affecting pieces of the draft PRD (classifier fallback, Exit Session, route groups) as binding; kept the UX metaphor ideas (Forest/Report-Card) as flagged-but-non-binding since no UI beyond the dashboard mock exists yet to force that decision — user confirmed via AskUserQuestion, then approved this split explicitly in chat.
- Did not fight the user's manual file renames/moves — adapted references to match reality rather than reverting, consistent with "trust but verify what's on disk" over what any doc claims.

**OPEN ITEMS**
- Same as prior entry: taxonomy count conflict (PRD prose vs. 29 locked skills), Phase 1 gap-closure (auth, `/session` route, `useMissLoop` attempt shape), verify Supabase backups actually enabled.
- Confirm the user is fine with PRD filename now changing per revision (v1-2.md today) rather than staying fixed — flagged in AGENT_HANDOFF.md and CLAUDE.md, not yet explicitly confirmed by user.

**SIGN-OFF:** Claude (Sonnet) — 7/10/26
