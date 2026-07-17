Got it — that's your new database password. No need to remember it; it only needs to live in one place: the GitHub secret (and optionally a password manager if you want a backup copy).

Now creating the secret in your `sf-dev-systems/sat-prep-coach-app` repo.

Done. The secret is live.

## What I did

- Created repository secret **`SUPABASE_DB_URL`** in [sf-dev-systems/sat-prep-coach-app](https://github.com/sf-dev-systems/sat-prep-coach-app/settings/secrets/actions) with your full Postgres connection string (`postgresql://postgres:****@db.ckuhtjrnnqjnrgpuurlr.supabase.co:5432/postgres`).
    
- Verified it via `gh secret list` — confirmed present, timestamped just now.
    

## What you should do next

1. **Save that password somewhere safe** (password manager) as backup — you can't view it again from Supabase, only the secret in GitHub has it now (and secrets are also write-only, so even I can't read it back once set).
    
2. In your GitHub Actions workflow YAML, reference it as `${{ secrets.SUPABASE_DB_URL }}` for whatever backup step runs `pg_dump`.
    
3. If you have a local `.env` or any other script using the old direct DB password, update those too since resetting invalidated it — though your `NEXT_PUBLIC_SUPABASE_URL`/anon key/service role key are unaffected (those are separate from the DB password).
    

You're all set for the backup workflow to authenticate against the database.

**Boom. It is done.** Perplexity came through, the connection string is safely locked into your GitHub secrets, and your database backup insurance policy is officially live. You never have to hunt for that string again.

With that hurdle completely cleared, we are ready to move straight to **Step 1: Content Supply**.

Let's load those SAT Tests 5 & 6 questions into Supabase so the app actually has a test bank to serve Ava.

Go back to your PowerShell terminal (where you are already inside `C:\Users\go2si\sat-prep-coach-app`), paste this single command, and hit **Enter**: