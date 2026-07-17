---
date: 2026-07-17
slug: miss-loop-dashboard-integration
phase: post-phase-5 cleanup
---

## COMPLETED

- **`app/(student)/page.tsx`** — replaced single indigo Study CTA card with a 2-card grid:
  - Left: Study card (indigo, links to `/study/:skillId`) — unchanged behavior, conditional on `focusSkills.length > 0`
  - Right: Review card (amber, links to `/miss-loop`) — always visible; spans 2 columns when Study card is hidden
  - Added `RotateCcw` icon import from `lucide-react`
- `app/components/MissLoopReview.tsx` and `app/miss-loop/page.tsx` — status changed from orphaned to wired
- `typecheck` → 0 errors

## DECISIONS

- **Amber color for Review card**: distinguishes it from the indigo Study card without clashing. Amber evokes urgency/action ("fix your gaps") without danger-red.
- **Review card always visible** (not gated on focusSkills): spaced repetition review is always available regardless of mastery state.
- **No count badge on Review card** (how many questions are due): kept simple; a live count would require an extra Supabase query on every dashboard load. Can add later as a minor enhancement.

## SIGN-OFF

Claude (Sonnet 4.6) — 7/17/26
