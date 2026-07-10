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

## Wiki update schedule (routine)

Wiki pages are updated **as part of completing each build phase**, written
against the actual code — not ahead of it. Every session that changes
behavior updates the affected page(s) here, alongside `AGENT_HANDOFF.md`
and `SESSION_LOG.md`.

| Phase | Pages to write / update |
|-------|-------------------------|
| Phase 1 (Foundation) | DEV/SETUP, OPERATIONS_MANUAL, GLOSSARY, TAXONOMY |
| Phase 2 (Intelligence) | DEV/MASTERY_ENGINE, DEV/SESSION_ASSEMBLER |
| Phase 3 (Visibility) | USER/STUDENT_MANUAL, DEV/SCORING |
| Phase 4 (Polish) | USER/PARENT_MANUAL, DEV/DEPLOY, OPERATIONS_MANUAL |
