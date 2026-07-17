import { z } from 'zod'

const HintAction = z.object({
  action: z.literal('hint'),
  questionId: z.string().uuid(),
  hintNumber: z.number().int().min(1).max(3),
  sessionId: z.string().uuid().optional(),
})

const ExplanationAction = z.object({
  action: z.literal('explanation'),
  questionId: z.string().uuid(),
  studentAnswer: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  studentErrorTag: z.enum(['concept','calculation','misread','careless','timing','guess']).optional(),
  sessionId: z.string().uuid().optional(),
})

const ClassifyAction = z.object({
  action: z.literal('classify'),
  questionId: z.string().uuid(),
  studentAnswer: z.string().min(1),
  studentErrorTag: z.enum(['concept','calculation','misread','careless','timing','guess']),
  sessionId: z.string().uuid().optional(),
})

const ExplainNowAction = z.object({
  action: z.literal('EXPLAIN_NOW'),
  questionId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
})

export const MissLoopRequestSchema = z.discriminatedUnion('action', [
  HintAction,
  ExplanationAction,
  ClassifyAction,
  ExplainNowAction,
])

export type MissLoopRequest = z.infer<typeof MissLoopRequestSchema>
