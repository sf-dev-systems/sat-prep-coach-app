/**
 * Hook: useMissLoop
 * Manages the state of a remedial study session and persists the outcome 
 * to the Supabase 'attempts' table.
 */
import { useState } from 'react';
import { getSupabaseClient } from '@/lib/db'; // Use existing portable DB client

export function useMissLoop(questionId: string) {
  const [isSaving, setIsSaving] = useState(false);

  const saveOutcome = async (mode: 'CONTENT_GAP' | 'STRATEGY_GAP', success: boolean) => {
    setIsSaving(true);
    try {
      const supabase = getSupabaseClient();
      
      // 1. Fetch the authenticated user to satisfy the non-null user_id foreign key constraint
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error(authError?.message || 'No active authenticated user session found.');
      }

      // 2. Map high-level loop modes to valid Postgres error_type check constraints
      // Table check constraint: (error_type in ('concept','calculation','misread','careless','timing','guess'))
      const errorType = mode === 'STRATEGY_GAP' ? 'timing' : 'concept';

      // 3. Insert the tracked attempt
      const { error } = await supabase.from('attempts').insert({
        user_id: user.id, // Derived dynamically from active auth session (Invariant #5)
        question_id: questionId,
        error_type: errorType,
        is_correct: success,
        created_at: new Date().toISOString()
      });

      if (error) throw error;
      console.log('Successfully recorded miss-loop outcome to database.');
    } catch (err) {
      console.error('Failed to persist miss-loop outcome:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return { saveOutcome, isSaving };
}
