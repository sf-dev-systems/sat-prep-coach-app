/**
 * lib/constants.ts
 * Small cross-cutting constants shared across lib/ modules and API routes.
 * No framework (React/Next) imports permitted under lib/ (boundary rule).
 */

/**
 * PRD "Learner profile" — single student in v1, so this is a static
 * constant rather than a per-user profile field. Injected into every
 * tutoring/hint prompt per the AI integration rules ("every tutoring
 * prompt includes: the VARK profile directives...").
 */
export const VARK_PROFILE = 'Read/Write 13, Kinesthetic 14, Aural 9, Visual 7';
