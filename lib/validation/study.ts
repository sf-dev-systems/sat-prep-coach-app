import { z } from 'zod'

export const StudyLessonRequestSchema = z.object({
  skillId: z.string().uuid(),
})

const WorkedExampleSchema = z.object({
  setup: z.string(),
  steps: z.array(z.string()).min(1),
  takeaway: z.string(),
})

export const StudyLessonResponseSchema = z.object({
  skill: z.object({
    id: z.string().uuid(),
    name: z.string(),
    section: z.enum(['math', 'rw', 'strategy']),
    domain: z.string().nullable(),
  }),
  lesson: z.object({
    whyItMatters: z.string(),
    avaRule: z.string(),
    checklist: z.array(z.string()).min(1),
    commonTrap: z.string(),
    workedExample: WorkedExampleSchema,
    doNowPrompt: z.string(),
    retrievalPrompt: z.string(),
    teachBackPrompt: z.string(),
  }),
  context: z.object({
    usedErrorJournal: z.boolean(),
    usedExistingNote: z.boolean(),
    overCeiling: z.boolean(),
    source: z.enum(['ai', 'fallback']),
  }),
})

export type StudyLessonRequest = z.infer<typeof StudyLessonRequestSchema>
export type StudyLessonResponse = z.infer<typeof StudyLessonResponseSchema>
