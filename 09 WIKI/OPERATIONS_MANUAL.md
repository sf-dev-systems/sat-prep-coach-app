---
title: Operations Manual
type: wiki
version: 1.1
status: active
owner: Sienna (Oni Technologies LLC)
created: 2026-07-10
updated: 2026-07-10
source_of_truth: false
related: ["README.md", "CLAUDE.md", "DEV/SETUP.md"]
---

# Operations Manual

Procedures for running, deploying, maintaining, and backing up the **AI SAT Prep Coach (Personal Edition v1)**.

---

## 1. Secrets & Credentials Management

- Real values live only in `.env.local` (gitignored) and, on deploy, Vercel env vars. Never in files that are committed.
- **Leaked Key Protocol:**
  1. Revoke and rotate immediately in the respective provider's console (Anthropic Console, Supabase Dashboard → Settings → API → roll `service_role`).
  2. Update local `.env.local` and Vercel project configurations.
  3. Log the incident in the current session's file under `00 SYSTEM/SESSION_LOG/`.

---

## 2. Local Database Operations

- **Applying Migrations:** Apply SQL scripts located under `supabase/migrations/` sequentially.
- **Seeding Skill Taxonomy:** To seed or refresh skills, run:
  ```bash
  npm run seed-skills
  ```
- **Importing Bank Questions:** To import questions, run:
  ```bash
  npm run import-bank <path-to-json-file>
  ```

---

## 3. Database Backups & Recovery

Live mechanism (as of 2026-07-10): `.github/workflows/db-backup.yml` runs a
nightly `pg_dump`, GPG-encrypts it, and commits it to the repo's `backups`
branch — chosen because the Supabase org is on the **free** plan, which has
no native scheduled-backup/PITR feature. Requires two GitHub repo secrets
(`DB_CONNECTION_STRING`, `BACKUP_GPG_PASSPHRASE`) to be set by the repo
owner before it will actually produce backups — see `supabase/BACKUPS.md`
for setup and restore steps.
- **Backup Guide:** `supabase/BACKUPS.md`

### To manually perform a database dump via CLI:
```bash
$env:DB_URL="postgresql://postgres:[YOUR-DB-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
pg_dump $env:DB_URL -F p -b -v -f ./supabase/backups/sat_coach_manual_backup.sql
```

---

## 4. Deploying to Production (Vercel)

The deployment target for the Next.js application is **Vercel**.
1. Connect your GitHub repository to Vercel.
2. In the Vercel dashboard, navigate to **Settings** → **Environment Variables** and add all variables defined in `.env.example`.
3. Vercel automatically deploys commits pushed to the `main` branch.
