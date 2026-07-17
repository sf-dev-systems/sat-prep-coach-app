---
date: 2026-07-17
slug: vark-overrides-image-ingestion-plan
phase: post-phase-5 / content ingestion planning
---

## COMPLETED

- `lib/learner-profile.ts` — `skillModalityOverrides` map added. 4 skills flagged for Ava's Visual: 7 conflict:
  - Command of Evidence (translate chart → words before reasoning)
  - Statistics & Probability (describe trend in one sentence before math)
  - Area & Volume (kinesthetic real-world anchor + label dimensions in words)
  - Triangles & Circles (extract all measurements as written list first)
- `prompts/study.ts` — `modalityNote?: string` in `StudyPromptContext`; injected as `MODALITY OVERRIDE` block (labeled "takes precedence over generic VARK directive") when present.
- `app/api/study/lesson/route.ts` — imports `AVA_LEARNER_PROFILE`, looks up `skill.name` in `skillModalityOverrides`, passes result as `modalityNote`. `typecheck` → 0 errors.

## DECISIONS

- **Question bank gap identified**: 74 Math questions only (Test 4 Math), zero RW. `00 SYSTEM/Practice Test Library/` holds 8 SAT tests + 2 PSAT tests as PDFs — ready to mine.
- **Image ingestion architecture approved**: `media_urls JSONB` (not `image_url TEXT`) to handle rare dual-chart questions. Public Supabase Storage bucket `question-assets`. Extraction script pauses on chart questions, uploads image, stores URL in JSON draft.
- **Priority order for ingestion**: Test 4 RW first (54 questions, CoE immediately playable) → Tests 5–7 Math (Advanced Math, Ava's weakest) → PSAT/NMSQT Test 1 → Tests 5–11 RW.
- **Migration before extraction**: apply `media_urls` migration and create bucket before writing extraction script so script outputs final shape from day one.

## SIGN-OFF

Claude (Sonnet 4.6) — 7/17/26
