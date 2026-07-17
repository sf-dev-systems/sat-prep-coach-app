# Phase 4: Entry Points & Dashboard Integration
(`01 DOCS/05_phase4-integration.md`)

_Wire Study Mode into existing pages. No new API routes. Modify dashboard, mastery, and scoring._

**Always read alongside:** `01_sys-context.md` (invariants, VARK, folder layout).
**Phase 3 must be complete first** — `/study/[skillId]` must exist before linking to it.

---

## Current code state (what exists to build on)

- `lib/mastery/dashboard.ts` — computes `FocusSkill[]`; currently `FocusSkill` does **not** include `skillId`.
- `app/(student)/page.tsx` — renders dashboard with focus skills; no Study CTA card.
- `app/(student)/mastery/page.tsx` — has "Drill This Skill" button; no "Study This Skill" button. Note save errors are logged to console only.
- `lib/mastery/dashboard.ts` — confidence interval displayed without clamping to SAT bounds (400–1600).
- Dashboard empty state is a single `hasData: boolean` based on `masteryMap.size === 0`.

---

## 1. Add `skillId` to `FocusSkill`

File: `lib/mastery/dashboard.ts`

`FocusSkill` must include the skill's UUID so pages can link to `/study/[skillId]` and `/session?skill=[skillId]`.

Current shape (approximately):
```typescript
interface FocusSkill {
  name: string
  // ...other fields
}
```

Required change:
```typescript
interface FocusSkill {
  skillId: string   // uuid — add this
  name: string
  // ...existing fields unchanged
}
```

Propagate `skillId` through wherever `FocusSkill` is constructed in `dashboard.ts`.

---

## 2. Dashboard "Study Today's Top Skill" CTA card

File: `app/(student)/page.tsx`

Add a card below (or alongside) the existing focus skills section:

- **When `focusSkills.length > 0`:** Render a card: "Study Today's Top Skill — [skill name]" with a button linking to `/study/${focusSkills[0].skillId}`.
- **When `focusSkills.length === 0`:** Do not render the card (or render a disabled/muted state pointing to the diagnostic).

Keep the existing "Drill" entry point. Study and Drill are parallel CTAs, not replacements.

---

## 3. Mastery page "Study This Skill" button

File: `app/(student)/mastery/page.tsx`

Near the existing "Drill This Skill" button (which links to `/session?skill=[skillId]`), add:

```
[Study This Skill]  [Drill This Skill]
```

"Study This Skill" links to `/study/${selectedSkill.id}`.

Button hierarchy: treat them as equal-weight sibling actions (not primary/secondary). Both visible at all times when a skill is selected.

---

## 4. Confidence interval clamping (ENG-7)

File: `lib/mastery/dashboard.ts`

The predicted score confidence band must be clamped before display:
- Total composite: clamp to `[400, 1600]`
- Section scores (if displayed individually): clamp to `[200, 800]`

Find where the confidence band is computed and add:
```typescript
const low = Math.max(400, Math.min(1600, rawLow))
const high = Math.max(400, Math.min(1600, rawHigh))
```

---

## 5. Dashboard setup state (ENG-8)

File: `lib/mastery/dashboard.ts` + `app/(student)/page.tsx`

Replace the binary `hasData: boolean` with a `StudentSetupState` union so the dashboard renders meaningful CTAs at each stage:

```typescript
type StudentSetupState =
  | 'no_diagnostic'         // masteryMap.size === 0, no diagnostic session started
  | 'diagnostic_incomplete' // diagnostic session exists but ended_at is null or questions_served < threshold
  | 'ready'                 // mastery data present; normal dashboard
```

In `page.tsx`, branch on `setupState`:
- `no_diagnostic` → "Start your diagnostic to begin" CTA
- `diagnostic_incomplete` → "Resume your diagnostic" CTA
- `ready` → normal dashboard including Study CTA

---

## 6. Note save error UX (ENG-9)

Files: `app/(student)/mastery/page.tsx` + `components/study/StudyMode.tsx`

Current mastery page: note saves errors go to `console.error` only.

Required: add a visible `errorMsg` state variable. On save failure, set it to a user-readable message ("Couldn't save your note — tap to retry"). Clear it on success. The message should appear inline near the save button, not as a disruptive modal.

Apply the same pattern in `StudyMode.tsx` teach-back save (should already be there from Phase 3 — verify).

---

## 7. File Task List

### MODIFY `lib/mastery/dashboard.ts`
1. Add `skillId: string` to `FocusSkill`.
2. Propagate `skillId` through `FocusSkill` construction.
3. Add confidence interval clamping (Section 4).
4. Replace `hasData` with `StudentSetupState` (Section 5); add helper to detect `diagnostic_incomplete`.

### MODIFY `app/(student)/page.tsx`
1. Add "Study Today's Top Skill" CTA card (Section 2).
2. Update empty/incomplete state rendering to use `StudentSetupState`.

### MODIFY `app/(student)/mastery/page.tsx`
1. Add "Study This Skill" button alongside "Drill This Skill" (Section 3).
2. Add visible `errorMsg` state for note save failure (Section 6).

---

## 8. Acceptance Criteria

- [ ] `FocusSkill` includes `skillId`; dashboard "Study" CTA links to `/study/${focusSkills[0].skillId}`
- [ ] Mastery page shows "Study This Skill" and "Drill This Skill" as equal sibling buttons
- [ ] Predicted score confidence band never displays outside [400, 1600]
- [ ] Dashboard renders a meaningful CTA at each `StudentSetupState` (no_diagnostic / diagnostic_incomplete / ready)
- [ ] Note save failure shows a visible inline error message in both mastery page and StudyMode
- [ ] `npx tsc --noEmit` passes with no new errors
