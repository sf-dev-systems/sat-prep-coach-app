import { describe, it, expect } from 'vitest'
import { StudyLessonRequestSchema, StudyLessonResponseSchema } from '../../lib/validation/study'

const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

describe('StudyLessonRequestSchema', () => {
  it('parses a valid request', () => {
    const result = StudyLessonRequestSchema.safeParse({ skillId: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('rejects a non-uuid skillId', () => {
    const result = StudyLessonRequestSchema.safeParse({ skillId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('StudyLessonResponseSchema', () => {
  const validResponse = {
    skill: { id: VALID_UUID, name: 'Linear Equations', section: 'math', domain: 'Algebra' },
    lesson: {
      whyItMatters: 'Linear equations appear on every SAT math section.',
      avaRule: 'Isolate the variable by performing inverse operations on both sides.',
      checklist: ['Identify the variable', 'Apply inverse operations'],
      commonTrap: 'Forgetting to apply the operation to both sides.',
      workedExample: {
        setup: 'Solve 2x + 4 = 10.',
        steps: ['Subtract 4 from both sides: 2x = 6', 'Divide both sides by 2: x = 3'],
        takeaway: 'Always balance both sides.',
      },
      doNowPrompt: 'Solve 3x - 6 = 9.',
      retrievalPrompt: 'What is the first step when solving a linear equation?',
      teachBackPrompt: 'Explain the inverse-operations rule in your own words.',
    },
    context: { usedErrorJournal: false, usedExistingNote: false, overCeiling: false, source: 'ai' },
  }

  it('parses a valid full response', () => {
    const result = StudyLessonResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })

  it('rejects a response missing lesson.checklist', () => {
    const { checklist: _omitted, ...lessonWithoutChecklist } = validResponse.lesson
    const result = StudyLessonResponseSchema.safeParse({
      ...validResponse,
      lesson: lessonWithoutChecklist,
    })
    expect(result.success).toBe(false)
  })
})
