import { describe, it, expect } from 'vitest'
import { MissLoopRequestSchema } from '../../lib/validation/miss-loop'

describe('MissLoopRequestSchema', () => {
  it('parses a valid hint payload', () => {
    const result = MissLoopRequestSchema.safeParse({
      action: 'hint',
      questionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      hintNumber: 1,
    })
    expect(result.success).toBe(true)
  })

  it('rejects hint missing questionId', () => {
    const result = MissLoopRequestSchema.safeParse({
      action: 'hint',
      hintNumber: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid action value', () => {
    const result = MissLoopRequestSchema.safeParse({
      action: 'unknown_action',
      questionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    })
    expect(result.success).toBe(false)
  })

  it('parses EXPLAIN_NOW with no extra fields', () => {
    const result = MissLoopRequestSchema.safeParse({
      action: 'EXPLAIN_NOW',
      questionId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    })
    expect(result.success).toBe(true)
  })
})
