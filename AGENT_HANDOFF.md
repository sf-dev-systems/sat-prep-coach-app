# AGENT HANDOFF

Proposed / remaining work for the next agent or session. Overwrite each session.

---

## Status: planning complete — Phase 1 NOT started

The foundation (file tree, docs, PRD/Charter, secrets) is now clean and
internally consistent. Nothing in the code tree exists yet — that's Phase 1.

## Next action (single)
Kick off **Phase 1 — Foundation** per `00 SYSTEM/docs/PRD v1.md`:
`git init` → Next.js scaffold (lowercase `app/ lib/ prompts/ components/
supabase/ scripts/ public/`) → Supabase client → full schema as migrations
+ RLS (**including `profiles`, `config`, `events`**) → skill seed (with
`parent_skill_id`) → official-bank import tool → basic practice loop →
`lib/ai` (ai_log + ceiling profiles→env→150 + fallback) → enable Supabase
scheduled backups. Stop at end of Phase 1 for review.


## Open questions / watch-items
- `raw notes sf.md` now has two extra files beside it that appeared this
  session (`OPUS REVIEW.md`, `prd and what i need _this.md`) — not yet
  reviewed; check if they hold intent not captured in the PRD.
- Goal-tree depth: PRD uses `skills.parent_skill_id` (section→domain→skill).
  Confirm that's the tree granularity you want on `/mastery`.

## Done this session
See SESSION_LOG.md (2026-07-10 entry).
