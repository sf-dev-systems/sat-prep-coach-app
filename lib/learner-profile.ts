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

  /**
   * Skills where the SAT's inherent modality conflicts with Ava's VARK profile.
   * Visual: 7 is her lowest mode — these skills involve charts, graphs, or diagrams.
   * Each entry is a compensating instruction injected verbatim into the lesson prompt.
   * Keys must match exact skill names in the `skills` table.
   */
  skillModalityOverrides: {
    'Command of Evidence': `MODALITY CONFLICT — Quantitative sub-type: This skill includes questions that pair a passage with a chart, table, or graph (a VISUAL task). Ava's Visual VARK score is 7 — her lowest mode. Compensate throughout the lesson: (1) never say "look at the chart" — instead say "translate the chart into one written sentence first (e.g., 'The table shows X rose from Y to Z between 2010 and 2020')"; (2) the checklist must include "Write what the graphic says in your own words" as Step 1 before any reasoning step; (3) the workedExample must demonstrate the translate-first move explicitly. The Textual sub-type (find a quote that supports a claim) needs no special handling — teach it normally.`,

    'Statistics & Probability': `MODALITY CONFLICT: This skill involves scatter plots, histograms, and bar charts — VISUAL displays. Ava's Visual VARK score is 7. Compensate: (1) the checklist must include "Describe the trend in one sentence before doing any math" as Step 1; (2) the workedExample must show her labeling key data points in words (e.g., "at x=3, y=12") before interpreting the graph; (3) anchor all chart-reading steps in writing, not in visual scanning.`,

    'Area & Volume': `MODALITY CONFLICT: This skill involves 3-D figures and geometric diagrams. Ava's Visual VARK score is 7. Compensate: (1) ground every worked example in a real-world kinesthetic object she can mentally handle (a cardboard box, a soup can, a pizza slice) before introducing the formula; (2) the checklist must include "Label every dimension in words on your scratch paper" before applying any formula; (3) never rely on a diagram alone — pair every figure reference with a written description of what each measurement represents.`,

    'Triangles & Circles': `MODALITY CONFLICT: This skill involves geometric figures. Ava's Visual VARK score is 7. Compensate: (1) the checklist must open with "Write down every labeled measurement as a list on scratch paper before touching the figure"; (2) the workedExample must show her extracting all given values into a written list first, then applying the rule; (3) use kinesthetic language — "trace the triangle," "walk the perimeter" — to make the figure feel tactile rather than purely visual.`,
  },
} as const

export type LearnerProfile = typeof AVA_LEARNER_PROFILE
