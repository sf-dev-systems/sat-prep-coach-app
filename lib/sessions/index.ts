import { SupabaseClient } from '@supabase/supabase-js';
import { Question, startPracticeSession, fetchSkills, fetchQuestionsBySkill } from '../db';

export interface PlannedSessionItem {
  question: Question;
  skillName: string;
}

export interface PracticeSessionPlan {
  sessionId: string;
  items: PlannedSessionItem[];
}

/**
 * Basic practice session assembler for Phase 1 (Simple Selection).
 * Selects questions for a practice session of a given type.
 * In Phase 1, we do a basic selection by fetching available questions from active skills.
 */
export async function assemblePracticeSession(
  supabase: SupabaseClient,
  userId: string,
  sessionType: 'diagnostic' | 'practice' | 'review' | 'full_test_entry' = 'practice',
  targetQuestionCount = 15
): Promise<PracticeSessionPlan> {
  // 1. Create a session row in the database
  const session = await startPracticeSession(supabase, userId, sessionType);

  // 2. Fetch skills
  const skills = await fetchSkills(supabase);
  if (skills.length === 0) {
    throw new Error('No skills seeded in the database. Please run seed-skills script first.');
  }

  // Filter skills to actual testable skills (leaf nodes that have section/domain and weight > 0)
  const testableSkills = skills.filter(s => s.parent_skill_id !== null && s.weight !== 0);
  const activeSkills = testableSkills.length > 0 ? testableSkills : skills;

  // 3. Simple Selection: Pick questions from skills
  // In Phase 1, we iterate through active skills and pull available validated questions
  const selectedQuestions: PlannedSessionItem[] = [];
  const skillIdMap = new Map(skills.map(s => [s.id, s.name]));

  // Pull questions across different skills
  for (const skill of activeSkills) {
    if (selectedQuestions.length >= targetQuestionCount) break;

    const questions = await fetchQuestionsBySkill(supabase, skill.id, 5);
    const validatedQuestions = questions.filter(q => q.validated);

    for (const q of validatedQuestions) {
      if (selectedQuestions.length >= targetQuestionCount) break;
      
      // Avoid duplicates
      if (!selectedQuestions.some(item => item.question.id === q.id)) {
        selectedQuestions.push({
          question: q,
          skillName: skillIdMap.get(q.skill_id || '') || 'Unknown Skill',
        });
      }
    }
  }

  // If we don't have enough questions from weighted skills, pull any validated questions from the entire bank
  if (selectedQuestions.length < targetQuestionCount) {
    const { data: anyQuestions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('validated', true)
      .limit(targetQuestionCount - selectedQuestions.length + 10);

    if (!error && anyQuestions) {
      for (const q of anyQuestions as Question[]) {
        if (selectedQuestions.length >= targetQuestionCount) break;
        if (!selectedQuestions.some(item => item.question.id === q.id)) {
          const skillName = skillIdMap.get(q.skill_id || '') || 'Unknown Skill';
          selectedQuestions.push({
            question: q,
            skillName,
          });
        }
      }
    }
  }

  return {
    sessionId: session.id,
    items: selectedQuestions,
  };
}
