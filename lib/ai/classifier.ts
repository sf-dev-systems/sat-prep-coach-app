/**
 * lib/ai/classifier.ts
 * PRD F3.4: Haiku cross-classifies the true error source against the
 * student's one-tap self-tag, logging disagreements. Routes through
 * lib/ai's callAnthropicWithCeiling (single chokepoint, ai_log, ceiling)
 * using prompts/classifier.ts's already-written template.
 *
 * Classifier fallback (PRD v1.2, "AI integration rules"): the Haiku
 * response is wrapped in a Zod schema parse. On parse failure — malformed
 * JSON, an API error surfaced as fallback text, or an out-of-taxonomy value
 * — this defaults to 'concept' and proceeds; it never blocks the miss loop.
 * No separate failure-tracking table is needed: every call already lands a
 * row in `ai_log` via callAnthropicWithCeiling regardless of outcome, so a
 * fallback is visible there as a `call_type='classify'` row whose result was
 * discarded — the same degrade-never-block pattern already locked for the
 * AI ceiling (F11), applied here to malformed output instead of over-ceiling.
 *
 * Naming note: the PRD's prose Zod example uses `z.object({ error_type: ... })`,
 * but the actual prompts/classifier.ts template (already written, not
 * authored in this session) returns `classified_error_type` plus a
 * `disagreement_rationale` field — the richer shape is what's actually
 * wired into the Haiku call, so the schema here matches the real prompt
 * output rather than the PRD's illustrative field name. Flagged in the
 * session log rather than silently diverging.
 *
 * No framework (React/Next) imports are permitted under lib/.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { callAnthropicWithCeiling } from './index';
import { getClassifierPrompt, type ClassifierPromptInput } from '../../prompts/classifier';
import type { Attempt } from '../db';

export type ErrorType = NonNullable<Attempt['error_type']>;

const ERROR_TYPE_VALUES = ['concept', 'calculation', 'misread', 'careless', 'timing', 'guess'] as const;

const ClassifierResponseSchema = z.object({
  classified_error_type: z.enum(ERROR_TYPE_VALUES),
  disagreement_rationale: z.string().optional(),
});

export interface ClassificationResult {
  errorType: ErrorType;
  disagreementRationale: string | null;
  /** false when the AI's classification differs from the student's self-tag. */
  agreesWithStudent: boolean;
  /** true if the Zod parse failed (malformed JSON / API error / out-of-taxonomy
   * value) and this result is the 'concept' fallback rather than a real
   * classification — callers should treat this as informational only. */
  usedFallback: boolean;
}

const FALLBACK_ERROR_TYPE: ErrorType = 'concept';

/** Strips a ```json ... ``` fence if the model wrapped its output despite
 * instructions not to — cheap defensive parsing before the Zod validation. */
function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

/**
 * Cross-classifies an incorrect attempt's true error source via Haiku,
 * comparing against the student's own self-tag. Never throws — any failure
 * (ceiling, API error, malformed/out-of-taxonomy JSON) degrades to a
 * 'concept' fallback result per the locked classifier-fallback behavior.
 */
export async function classifyAttemptError(
  supabase: SupabaseClient,
  userId: string,
  input: ClassifierPromptInput
): Promise<ClassificationResult> {
  const { systemPrompt, userMessage } = getClassifierPrompt(input);

  const studentTag = (input.studentErrorTag as ErrorType) ?? FALLBACK_ERROR_TYPE;

  try {
    const result = await callAnthropicWithCeiling(supabase, {
      userId,
      callType: 'classify',
      systemPrompt,
      userMessage,
      // Over-ceiling fallback: static JSON that parses to the same
      // degrade-never-block default as a parse failure would.
      fallbackRationale: JSON.stringify({ classified_error_type: FALLBACK_ERROR_TYPE }),
      temperature: 0,
      maxTokens: 300,
    });

    const parsed = ClassifierResponseSchema.parse(JSON.parse(extractJsonPayload(result.content)));

    return {
      errorType: parsed.classified_error_type,
      disagreementRationale: parsed.disagreement_rationale ?? null,
      agreesWithStudent: parsed.classified_error_type === studentTag,
      usedFallback: result.overCeiling,
    };
  } catch (err) {
    console.warn('Classifier parse/call failed — defaulting to "concept" (degrade, never block):', err);
    return {
      errorType: FALLBACK_ERROR_TYPE,
      disagreementRationale: null,
      agreesWithStudent: studentTag === FALLBACK_ERROR_TYPE,
      usedFallback: true,
    };
  }
}
