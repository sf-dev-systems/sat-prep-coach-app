/**
 * Hook: useMissLoop
 * Logs a full `attempts` row to Supabase — used for both the initial
 * submission on every question (PRD F2) and the retry submission inside
 * the miss loop (PRD F3.2). Each submission is its own row (`was_retry`
 * distinguishes them); nothing here mutates a prior row.
 *
 * Phase 2: every logged attempt also drives a `mastery` update (PRD F4)
 * via lib/mastery — BKT on `p_mastery`, FSRS-style on `stability`/
 * `next_review`. Skipped (not an error) when a question has no `skill_id`.
 */
import { useState } from 'react';
import { getSupabaseBrowserClient, logAttempt, type Attempt } from '@/lib/db';
import { updateMasteryOnAttempt } from '@/lib/mastery';

export interface LogAttemptParams {
  sessionId: string;
  questionId: string;
  skillId: string | null;
  difficulty: number;
  answer: string;
  isCorrect: boolean;
  confidence: Attempt['confidence'];
  errorType: Attempt['error_type'];
  hintsUsed: number;
  wasRetry: boolean;
  timeSpentSeconds: number | null;
}

export function useMissLoop() {
  const [isSaving, setIsSaving] = useState(false);

  const logAttemptRow = async (params: LogAttemptParams) => {
    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();

      // Fetch the authenticated user to satisfy the non-null user_id foreign
      // key constraint — identity always derives from the active session,
      // never hardcoded (invariant #5).
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error(authError?.message || 'No active authenticated user session found.');
      }

      await logAttempt(supabase, {
        user_id: user.id,
        session_id: params.sessionId,
        question_id: params.questionId,
        skill_id: params.skillId,
        answer: params.answer,
        is_correct: params.isCorrect,
        confidence: params.confidence,
        error_type: params.errorType,
        hints_used: params.hintsUsed,
        was_retry: params.wasRetry,
        time_spent_seconds: params.timeSpentSeconds,
      });

      // Strategy-section attempts and any question missing a skill_id have
      // nothing to update in `mastery` (skill_id is a required FK there).
      if (params.skillId) {
        await updateMasteryOnAttempt(supabase, user.id, {
          skillId: params.skillId,
          isCorrect: params.isCorrect,
          difficulty: params.difficulty,
          errorType: params.errorType,
          wasRetry: params.wasRetry,
          hintsUsed: params.hintsUsed,
        });
      }
    } catch (err) {
      console.error('Failed to persist attempt:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return { logAttemptRow, isSaving };
}
