---
title: Operations Manual
type: wiki
version: 1.0
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["README.md", "CLAUDE.md"]
---

# Operations Manual

Run/deploy/maintain procedures. Fill in against real commands as each
phase lands.

## Secrets
- Real values live only in `.env.local` (gitignored) and, later, Vercel
  env vars. Never in docs, README, or git.
- Rotate: Anthropic console → regenerate key; Supabase → Settings → API →
  roll `service_role`. Update `.env.local` + Vercel after rotating.

## Local dev
- `npm install`
- `npm run dev`
- _(commands finalized in Phase 1)_

## Database
- Schema changes ship ONLY as migration files in `supabase/migrations/`.
- Enable Supabase scheduled backups (Phase 1).

## Deploy (Phase 4)
- GitHub repo → Vercel; paste `.env.local` values into Vercel env.

## Incident: leaked key
1. Rotate immediately (above). 2. Update `.env.local` + Vercel.
3. Note in `SESSION_LOG.md`.
