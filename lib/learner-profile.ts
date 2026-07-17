/**
 * lib/learner-profile.ts
 * Typed learner profile for Ava — the single student in v1.
 * Import from here instead of embedding VARK values directly in prompts.
 * lib/ boundary rule: no React/Next imports.
 */

export const AVA_LEARNER_PROFILE = {
  name: 'Ava',
  vark: {
    kinesthetic: 14,
    readWrite: 13,
    aural: 9,
    visual: 7,
  },
  dominantModes: ['kinesthetic', 'readWrite'] as const,
  avoidances: ['long passive reading blocks', 'video-only explanations', 'diagram-only explanations'],
  lessonConstraints: {
    maxPassiveParagraphs: 1,
    requiresActiveStepBeforeContinuing: true,
    ttsSupported: true,
  },
  instructionalStyle: 'Do + Write',
} as const

export type LearnerProfile = typeof AVA_LEARNER_PROFILE
