---
title: Wiki Index
type: wiki
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["PRD v1", "Project Charter", "CLAUDE.md"]
---

# 09 WIKI — Index

Documentation only. The wiki **explains**; it never **owns** rules or
definitions. Canonical sources are the PRD, Charter, and CLAUDE.md — the
wiki links to them and adds explanation. Flow is one-directional:
canonical sources → wiki, never the reverse.

## Contents

- **DEV/** — engineering how-tos, setup & replication guide, architecture notes.
- **USER/** — student manual, parent manual.
- **GLOSSARY.md** — plain-language definitions of app/domain terms.
- **TAXONOMY.md** — the SAT skill taxonomy (RW / Math / Strategy) as implemented.
- **OPERATIONS_MANUAL.md** — run/deploy/backup/rotate-keys procedures.

## File locations (where things live)

- **Code** — lowercase tree only: `app/`, `lib/`, `prompts/`, `components/`,
  `supabase/`, `scripts/`, `public/`. Never place documents here.
- **AI-generated deliverables** (reports, analyses, one-off plans, audits) —
  `00 SYSTEM/AI OUTPUTS/`, always. Never place code here.
- **Canonical docs** (PRD, Charter, this instructions file) — `00 SYSTEM/docs/`.
- **Explanatory docs** (this wiki) — `09 WIKI/`.
- Rule source: `CLAUDE.md` → "File locations (hard boundaries)". This index
  entry exists only so the rule is discoverable without opening CLAUDE.md.

## Wiki update schedule (routine)

Wiki pages are updated **as part of completing each build phase**, written
against the actual code — not ahead of it. Every session that changes
behavior updates the affected page(s) here, alongside `AGENT_HANDOFF.md`
and the new session file in `00 SYSTEM/SESSION_LOG/`.

| Phase | Pages to write / update |
|-------|-------------------------|
| Phase 1 (Foundation) | DEV/SETUP, OPERATIONS_MANUAL, GLOSSARY, TAXONOMY |
| Phase 2 (Intelligence) | DEV/MASTERY_ENGINE, DEV/SESSION_ASSEMBLER, DEV/DIAGNOSTIC, DEV/BEHAVIOR_SIGNALS, DEV/MISS_LOOP |
| Phase 3 (Visibility) | USER/STUDENT_MANUAL, DEV/SCORING |
| Phase 4 (Polish) | USER/PARENT_MANUAL, DEV/DEPLOY, OPERATIONS_MANUAL |
