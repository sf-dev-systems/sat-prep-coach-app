---
title: v1 Completion Plan — full-repo review + Ava's PSAT baseline
type: analysis
status: proposed (awaiting Sienna's go-ahead on Steps 0–1 and the Phase 3 gate)
owner: Sienna (Oni Technologies LLC)
created: 2026-07-14
source_of_truth: false
related: ["PRD v1-2.md", "Project Charter", "AVA PSAT Results (uploaded 2026-07-14)"]
---

# v1 Completion Plan — 2026-07-14

## 1. Where the build actually stands (verified this session)

**Phase 1 — complete.** Schema deployed (all 15 tables incl. Charter stubs), RLS on,
43 skills seeded (29 leaf, weights per SYSTEM_ARCHITECTURE), import tool, `lib/ai`
chokepoint + ceiling, backups protocol, auth + middleware live on Vercel.

**Phase 2 — code-complete, verification pending.** All four flows exist on disk and
match the PRD: F1 diagnostic (`lib/sessions/diagnostic.ts`), F2 assembler with
time-budget/composition/confidence-builder, F3 full miss loop (tiered hints → retry →
explanation → variant → confirm, Exit Session, error-journal writes), F4 BKT/FSRS +
nightly behavior-signals cron with forgetting decay.

**Phase 3 & 4 — not started** (correctly gated). No `/mastery`, `/tests`, `/parent`,
`/admin`, no goal-tree view, no score-prediction display, no coach-memory refresh (F6
has a read-only accessor only), no weekly report (F8), no PWA manifest/service worker
(`public/` is empty — the app is not installable yet), no route groups
`(student)/(parent)/(admin)` from PRD v1.2.

**Live database state (queried directly):**

| Metric | Value | Meaning |
|---|---|---|
| skills / leaf | 43 / 29 | ✅ taxonomy correct |
| questions | 74 (54 official, 74 validated) | 🔴 critical blocker |
| — math | 64 (Alg 22, AdvM 19, PSDA 13, Geo 10) | Test 4 import only |
| — rw | 10 placeholders | 🔴 effectively empty |
| — strategy | 0 | expected (weight 0) |
| mastery rows | 0 | diagnostic never taken |
| ai_log rows | 0 | 🟡 AI path never exercised live |
| attempts / sessions | 26 / 3 | smoke-test traffic only |
| auth users | 1 | ✅ Ava's account |

**Issues found in review:**
1. **Sandbox infra (standing issue, new data):** the Linux mount serves *truncated*
   copies of repo files — sandbox `tsc` reports spurious syntax errors, sandbox `git`
   reports a corrupt index, and `AGENT_HANDOFF.md` even listed as 0 bytes despite
   being a complete 135-line file via direct read. Consequence: build/typecheck/git
   verification is only valid on the local Windows machine; trust Read, not bash.
2. **F3 miss-loop work may be uncommitted** — last verifiable commit is `9a9ce5f`
   (cron middleware fix); the 07-11 04:00 session explicitly handed `git add/commit/push`
   to the local machine. Verify with `git status` locally.
3. **`ai_log` = 0** means hints/explanations/classifier have never run against the
   real API — the ceiling, fallback, and Zod classifier paths are untested in vivo.
4. **Carried-over items from the 07-11 handoff, still open:** GitHub secrets for the
   DB-backup workflow never set (workflow has never run); Next.js CVE migration
   (`next@16.2.10`, breaks 3 files via async `cookies()`/`headers()`); git cleanup of
   ~59MB College Board PDFs/screenshots; PRD taxonomy prose ("~18/~18/~8") vs. the
   actual 10/10/9 seed; two unreviewed files in `raw notes sf.md`. Folded into Step 0
   and the backlog below — none block the critical path except backup secrets (5 min,
   protects Ava's data before real use begins).

## 2. What Ava's PSAT says (baseline: 1110 — M 500 / RW 610)

Target 1500 (PRD goal tree: Math 760 / RW 740) → **+390 total: +260 Math, +130 RW.**
Math is two-thirds of the gap, confirming Sienna's read.

| Domain | Her band | % of section | Leverage |
|---|---|---|---|
| **Advanced Math** | **370–410 (lowest)** | 32.5% | 🔴 #1 priority — biggest single lever on the whole test |
| Algebra | 470–540 | 35% | 🔴 #2 — largest share of section |
| Problem-Solving & Data | 470–540 | 20% | 🟡 #3 |
| Geometry & Trig | 550–600 (highest) | 12.5% | 🟢 maintain only |
| Standard English Conv. | 550–600 (RW lowest) | 26% | 🟡 #4 — cheapest RW points (rule-based, drillable) |
| Other RW domains | 610–670 | 74% | 🟢 polish later |

**Implications for the app (mostly content, not code):**
- The engine already does the right thing: F2's `p_mastery × weight` priority with
  PRD weights (Algebra .35, Advanced Math .35) will naturally live in her gap — *if*
  the bank has questions to serve. No algorithm change needed.
- **Content import order must follow her profile:** Advanced Math + Algebra depth
  first, then full RW (SEC especially), then PSDA; Geo/Trig last.
- **Seed `practice_tests` with this PSAT** (taken_at, 1110/610/500 + domain
  breakdown jsonb) the moment Phase 3's `/tests` + prediction exist — the prediction
  curve gets a real anchor from day 1 instead of waiting a month for the first
  Bluebook entry.
- **Study reality check:** +390 is a large but achievable gain for a motivated
  student with ~6+ months of consistent work. The Charter's v1 success criterion
  (4+ days/week × 60+ days) is the right cadence: ~40-min adaptive sessions 5–6
  days/week (the app's 20-question/25-minute daily minimum), one official Bluebook
  test per month for recalibration. Roughly 70% of session time will initially land
  in Math by weight — correct for her.
- **Open question for Sienna (affects pacing, not architecture):** what is the
  target SAT date? Aug/Oct 2026 vs. spring 2027 changes intensity, not the plan.

## 3. Ordered plan to a working v1

**Step 0 — Stabilize (local machine, ~1 hour, no new code).**
On the Windows machine (sandbox can't do this — see issue #1):
`npx tsc --noEmit` + `npm run build`; `git status` → commit/push F3 work if pending;
then one live smoke test: answer a question wrong on purpose, walk the full miss
loop, confirm `ai_log` rows appear and hints/explanation are real Sonnet output.
This closes Phase 2 for real.

**Step 1 — Content supply (critical path, 1–2 working sessions).**
The bank (74 questions) cannot support a 40-question diagnostic, let alone daily
sessions. Reuse the proven Test-4 pipeline (Haiku structuring → QC → import):
- SAT Tests 5 & 6: Math sections (Advanced Math + Algebra emphasis) **and full RW** —
  RW goes from 10 placeholders to ~118 real questions.
- SAT Tests 10 & 11: math next, RW as time allows.
- Target: **~350–450 official questions**, min ~8–10 per leaf skill, before Ava's
  diagnostic. This is Charter Risk #1 (content supply) and it blocks everything.

**Step 2 — Phase 3 "Visibility" (needs explicit go-ahead — this is the phase gate).**
Build order *within* the phase chosen for Ava's situation:
1. `/tests` entry + score prediction + recalibration → immediately seed her PSAT row.
2. `/mastery` map + goal-tree view (1500 → M760/RW740 → domains → skills).
3. Readiness panel on dashboard; error-journal view; coach-memory F6 weekly refresh.
4. Route groups `(student)/(parent)/(admin)` (v1.2 layout — cheap while adding pages).

**Step 3 — Phase 4 "Polish" (needs go-ahead after Phase 3).**
Weekly report cron (F8) → parent dashboard `/parent` (F10) → PWA manifest + service
worker + icons (installability is a v1 acceptance criterion) → motivation events/
streak (F12) → TTS toggle → `/admin` generation pipeline (F9) pointed at **Advanced
Math variants first** — generation is also the long-term fix for content supply.

**Step 4 — Launch protocol for Ava (v1 "working" in practice).**
Day 1: 40-question diagnostic → mastery initialized, baseline prediction, goal tree
seeded. Daily: one assembled session (20 q / 25 min minimum). Monthly: official
Bluebook test → `/tests` entry → recalibration. Exit gate per Charter: 30 days of
use + one recalibration cycle.

## 4. Definition of "working v1" (PRD acceptance criteria vs. today)

| Criterion | Today | After step |
|---|---|---|
| Diagnostic populates mastery; baseline prediction + goal tree | code built; unusable without bank | 1→2 |
| Sessions serve due-review/low-mastery first, respect fatigue cap | ✅ built (verify in Step 0) | 0 |
| Every miss: hints → retry → explanation → variant; mastery moves | ✅ built (verify in Step 0) | 0 |
| Tutoring references coach memory | partial (read-only accessor; no F6 refresh) | 2 |
| Prediction updates + recalibrates on test entry | not built | 2 |
| Weekly report on both dashboards | not built | 3 |
| Parent reaches dashboard by PIN from a phone | not built | 3 |
| Installed on phone home screen (PWA) | not built (`public/` empty) | 3 |
| Over-ceiling degrades to static rationales | code built; never exercised | 0 |
| `events` rows for session/report/parent/milestone | helpers exist; writers incomplete | 2–3 |

**Bottom line:** the intelligence layer is done; what stands between here and a
working v1 is (a) an hour of local verification, (b) question supply matched to
Ava's actual weaknesses, then (c) the two UI phases already defined in the PRD.
No re-architecture is needed or proposed.
