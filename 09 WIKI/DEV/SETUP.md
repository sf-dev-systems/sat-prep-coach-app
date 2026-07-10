---
title: Dev Setup & Replication
type: wiki
version: 1.0
status: draft
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["README.md", "OPERATIONS_MANUAL.md"]
---

# Dev Setup & Replication

Step-by-step to stand the project up from scratch. Written against real
code once Phase 1 scaffolds. Placeholder outline:

1. Clone repo / open folder.
2. `cp .env.example .env.local` and fill real values.
3. `npm install`.
4. Apply Supabase migrations.
5. Seed skills: run `scripts/seed-skills.ts`.
6. `npm run dev`.
