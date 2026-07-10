# Supabase Scheduled Backups & Disaster Recovery

As per the AI SAT Coach (Personal Edition v1) PRD, scheduled database backups must be established from Day One to mitigate key platform/infrastructure risks. 

Below are the instructions and scripts to implement and maintain automatic backups.

---

## Option 1: Supabase Built-in Scheduled Backups (Recommended)

Supabase provides automated daily backups on all **Pro** and **Enterprise** projects natively. 
- **Frequency:** Automated daily (runs once every 24 hours).
- **Retention:** 7 days (Pro) or 30 days (Enterprise).
- **Setup:**
  1. Go to the [Supabase Dashboard](https://supabase.com/dashboard).
  2. Navigate to **Project Settings** → **Database** → **Backups**.
  3. Ensure automated daily backups are enabled.
  4. Daily snapshots are automatically created and can be restored with a single click.

---

## Option 2: Automated GitHub Action with `pg_dump` (Free / Hobby Tier Backup)

If the project is running on Supabase's **Free Tier**, automated backups can be implemented using a GitHub Action that executes a nightly `pg_dump` and uploads the encrypted SQL snapshot to a secure storage bucket (like AWS S3 or a private GitHub repository branch).

### 1. Setup GitHub Secrets
In your GitHub Repository, go to **Settings** → **Secrets and variables** → **Actions**, and add the following repository secrets:
- `DB_CONNECTION_STRING`: `postgresql://postgres:[YOUR-DB-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres`
- `AWS_ACCESS_KEY_ID` (Optional - for S3)
- `AWS_SECRET_ACCESS_KEY` (Optional - for S3)

### 2. Add Workflow File (`.github/workflows/db-backup.yml`)
Create a workflow file in your codebase tree to run daily:

```yaml
name: Database Nightly Backup

on:
  schedule:
    - cron: '0 3 * * *' # Runs every night at 3:00 AM UTC
  workflow_dispatch: # Allows manual trigger from GitHub UI

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL Client
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client

      - name: Perform Database Dump
        run: |
          pg_dump "${{ secrets.DB_CONNECTION_STRING }}" -F c -b -v -f sat_coach_backup_$(date +%F_%H%M%S).dump

      - name: Upload Backup Artifact (Temporary Safe Retention)
        uses: actions/upload-artifact@v4
        with:
          name: db-backup
          path: sat_coach_backup_*.dump
          retention-days: 7
```

---

## Option 3: Manual CLI Backup (Local Backup Utility)

To take an immediate local backup snapshot, run the following command in PowerShell/Terminal:

```bash
# Set your Supabase Database URL (obtained from Settings -> Database in Supabase Dashboard)
$env:DB_URL="postgresql://postgres:[YOUR-DB-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Execute pg_dump
pg_dump $env:DB_URL -F p -b -v -f ./supabase/backups/sat_coach_manual_backup.sql
```

This local copy can be checked in to a secure personal storage folder. Never commit actual `.sql` backup dumps containing student records or PII back to this public repository.
