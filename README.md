# sat-prep-coach-app

> ⚠️ **Sandbox environment note (read before trusting a weird error):** the
> Claude sandbox's Linux shell (`mcp__workspace__bash`) reads/writes this
> repo through a FUSE mount that has proven unreliable — confirmed across
> two separate projects on 2026-07-16 (this one, and `FIN-finance-ops`).
> It can silently truncate file reads/writes and cause phantom `tsc`/build
> errors on files that are actually fine on disk.
>
> **Workaround (what to actually do):**
> 1. Never trust a bare sandbox `cat` / `git show` / `tsc` / build error by
>    itself. Re-check the same file with the host-side `Read` tool (a
>    different code path than the Linux FUSE mount) before concluding the
>    code is actually broken.
> 2. If `Read` and sandbox bash disagree, `Read` (or the file as it looks
>    on your own machine) wins.
> 3. Do all edits with `Read`/`Edit`/`Write` (host-side tools), not shell
>    redirection (`>`, `sed -i`, etc.) — those write through the same
>    unreliable mount.
> 4. This mount also can't delete or rename files (`rm`/`git mv`/
>    `git checkout` all fail with "Operation not permitted") — expect to
>    overwrite file content in place instead of deleting, unless deletion
>    is explicitly approved via the delete-permission prompt.
> 5. Never run `git add`/`commit`/`push` from the sandbox at all — hand
>    the exact commands to your own machine and run them there.
>
> Full writeup: `AGENT_HANDOFF.md` and
> `02 SESSION_LOG/2026-07-16_2115_local-tree-repair-and-docs-relocation.md`.

AI SAT Coach — **Personal Edition (v1)**. A PWA SAT tutor for one student
targeting **1500+**. It models a student's knowledge, memory, behavior,
confidence, and test-taking strategy over time, and drives every practice
session from that model — like a private tutor that remembers.

> This repo is **both** the application code **and** the planning/knowledge
> vault (Obsidian). Code lives in lowercase folders; docs live in the
> numbered folders. They coexist — the build ignores the doc folders.

## Stack
Next.js (App Router, TypeScript) · Tailwind · Supabase (Postgres/Auth/RLS) ·
Anthropic API (Claude Sonnet + Haiku) · Recharts · PWA · Vercel.

## Folder map

```
sat-prep-coach-app/
├── app/               # Next.js routes (thin UI): (student), parent, admin, api
├── lib/               # PORTABLE CORE (no next/react imports): mastery, sessions, scoring, ai, db
├── prompts/           # per-function templates: tutor, hint, coach, classifier, generator, reporter
├── components/        # React UI
├── supabase/migrations/   # schema as migration files (the DB is code)
├── scripts/           # seed-skills, import-official-bank
├── public/            # PWA manifest, icons
│
├── .env.local         # SECRETS — gitignored, never committed
├── .env.example       # safe template
├── .gitignore
├── CLAUDE.md          # canonical agent operating rules
├── SESSION_LOG.md     # pointer only — real log lives in 00 SYSTEM/SESSION_LOG/
├── AGENT_HANDOFF.md   # proposed/remaining work for the next session
│
├── 00 SYSTEM/         # docs/ (PRD, Charter, Instructions) · AI OUTPUTS/
├── 09 WIKI/           # 00_INDEX · DEV/ · USER/ · GLOSSARY · TAXONOMY · OPERATIONS_MANUAL
└── 99 ARCHIVE/        # SF RAW NOTES/ (source planning notes)
```

**Boundary rule (enforced):** modules under `lib/` must not import from
`app/`, `components/`, `next`, or `react`. DB access only via `lib/db`.
All Anthropic calls only via `lib/ai`.

## Source-of-truth hierarchy
1. **PRD** (`00 SYSTEM/docs/PRD v1.md`) — WHAT to build and HOW (schema, flows, layout).
2. **Charter** (`00 SYSTEM/docs/Project Charter…md`) — WHEN (version gates, LOCK/STUB/DEFER).
3. **CLAUDE.md** (root) — how the agent works in this repo.
4. **09 WIKI/** — explanation only; never owns rules. Canonical → wiki, one-directional.

If a request conflicts with the PRD or Charter, flag it before building.
PRD wins on implementation detail; Charter wins on scope.

## Secrets / environment
Real values go in **`.env.local` only** (gitignored) — never in the README,
the PRD, or any committed file. `.env.example` shows which variables exist.
On deploy, paste the same values into Vercel → Settings → Environment Variables.

Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `AI_DAILY_CEILING` (default 150),
`PARENT_PIN`. The service-role and Anthropic keys are server-side only.

## Session routine (every working session)
At the end of every session the agent MUST:
1. Update **AGENT_HANDOFF.md** — proposed/remaining work for the next session.
2. Add a new file to **00 SYSTEM/SESSION_LOG/** (`YYYY-MM-DD_HHMM_slug.md`) —
   completed work, files touched, decisions — and add a row to
   `00 SYSTEM/SESSION_LOG/00_INDEX.md`.
3. Update any affected **09 WIKI/** pages (per the schedule in `09 WIKI/00_INDEX.md`).
4. **Sign off** as `AI NAME · M/D/YY · h:mm AM/PM` (e.g., `Opus · 7/10/26 · 4:12 PM`).

All non-code AI deliverables go in `00 SYSTEM/AI OUTPUTS/`. Code goes only in
the lowercase code tree. Never mix the two.

## Build phases (gate each on owner approval)
1. **Foundation** — scaffold, schema+RLS, seed, import tool, basic loop, `lib/ai`, backups.
2. **Intelligence** — BKT+FSRS, adaptive assembler, full miss loop, diagnostic, nightly signals.
3. **Visibility** — dashboard, mastery map + goal tree, prediction, readiness, journal, coach memory.
4. **Polish** — parent dashboard, weekly report cron, PWA install, motivation, TTS, admin gen pipeline.

Status: **planning complete; Phase 1 not started.**
