# SESSION LOG

Running log of what changed each working session: date, what changed,
decisions made, open items. Update at the end of every session.

---

## 2026-07-10 — Planning review & repo hygiene (Opus)

**What changed**
- Renamed `CLAUDE.MD.md` -> `CLAUDE.md`.
- Created `.gitignore` (Next.js + env + Obsidian workspace state).
- Created `.env.example` (safe template) and `.env.local` (real secrets, gitignored).

**Decisions made**
- Folder is BOTH the code repo and the docs/planning vault.
- Real app code will live in lowercase folders (`app/`, `lib/`, etc.);
  the numbered `01`–`07` folders were empty code-mirrors and are slated
  for deletion (pending user confirm) to avoid colliding with the scaffold.

**Open items**
- Confirm deletion of empty numbered code-mirror folders (`01 APP` ... `07 PUBLIC`)
  and empty `99 ARCHIVE/archived_*`.
- Reconcile PRD v1 with raw notes + Charter deltas (append-only coach_memory,
  profiles/config/events tables). Decide on 3 GPT-enhancement reductions.
- Old empty stubs `env local.md` / `gitignore.md` need deletion (bash can't;
  needs user/delete-tool).

---

## 2026-07-10 — Foundation cleanup executed (Opus)

**COMPLETED (files touched)**
- Deleted empty code-mirror folders: `01 APP`, `02 LIB`, `03 PROMPTS`,
  `04 COMPONENTS`, `05 SUPABASE`, `06 SCRIPTS`, `07 PUBLIC`; all empty
  `99 ARCHIVE/archived_*`; dead stubs `env local.md`, `gitignore.md`,
  stray `.gitignore_test`.
- Renamed `AGENT HANDOFF.md` -> `AGENT_HANDOFF.md`;
  `Project Instructions_DRAFT.md` -> `Project Instructions.md`.
- Scaffolded `09 WIKI/`: `00_INDEX.md`, `GLOSSARY.md`, `TAXONOMY.md`,
  `OPERATIONS_MANUAL.md`, `DEV/SETUP.md`, `USER/STUDENT_MANUAL.md`,
  `USER/PARENT_MANUAL.md` — all with YAML front-matter.
- Added YAML front-matter to `Project Charter…md`, `Project Instructions.md`.
- Populated `README.md` (project, folder map, source-of-truth hierarchy,
  secrets rules, session routine, phases).
- Revised `PRD v1.md` -> **v1.1**: archived v1.0 to
  `99 ARCHIVE/archived_docs/archive_2026-07-10_PRD v1.md`. Merged Charter §5
  deltas (`profiles`/`config`/`events`, append-only `coach_memory`,
  `license`/`external_id`, ceiling order, `authorizeParentView`, backups,
  no-PII). Added GPT bucket-A/B: goal tree (`parent_skill_id` + `/mastery`
  view), tiered hints (up to 3), harder-question-after-success, focus length
  + time-of-day in `behavior_signals`. Kept bucket-C cut.
- Secrets: created `.env.local` (gitignored) as the sole home; redacted all
  live keys/password from `PRD v1.md`, `raw notes sf.md`, the PRD archive,
  and user file `OPUS REVIEW.md`. Verified only `.env.local` holds them.
- Updated `CLAUDE.md`: end-of-session routine now = AGENT_HANDOFF +
  SESSION_LOG + affected WIKI pages + sign-off; file-location + source-of-
  truth sections corrected for the combined repo/vault layout.

**DECISIONS**
- Code folders = lowercase, no numbers/spaces (Next.js requirement); doc
  folders keep numbers. They coexist in one repo.
- SESSION_LOG.md + AGENT_HANDOFF.md live at repo root (matches README +
  Project Instructions); AI OUTPUTS is for other deliverables.
- PRD faithfully reflects raw notes; the only substantive changes were the
  owner-approved GPT additions (bucket A + cheap B) and the FABLE-argued cuts
  (bucket C) left in place.

**OPEN ITEMS**
- Review the two new files in SF RAW NOTES (`OPUS REVIEW.md`,
  `prd and what i need _this.md`) for un-captured intent.
- Phase 1 not started — see AGENT_HANDOFF.md.

**SIGN-OFF:** Opus — 7/10/26 4:23 PM

---
