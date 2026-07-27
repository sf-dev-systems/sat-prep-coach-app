import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getSupabaseServerClient,
  fetchSkillById,
  fetchErrorJournalForSkill,
  fetchSkillNoteForSkill,
  fetchValidatedQuestionsBySkill,
  type Skill,
} from '@/lib/db';
import { callAnthropicWithCeiling } from '@/lib/ai';
import { StudyLessonRequestSchema, StudyLessonResponseSchema, type StudyLessonResponse } from '@/lib/validation/study';
import { getStudyLessonPrompt, type StudyPromptContext } from '@/prompts/study';
import { AVA_LEARNER_PROFILE } from '@/lib/learner-profile';

export const dynamic = 'force-dynamic';

function buildStaticFallback(
  skill: Pick<Skill, 'id' | 'name' | 'section' | 'domain'>,
  overCeiling: boolean
): StudyLessonResponse {
  return {
    skill: {
      id: skill.id,
      name: skill.name,
      section: skill.section,
      domain: skill.domain,
    },
    lesson: {
      whyItMatters: `${skill.name} appears regularly on the SAT. Getting it right reliably adds points.`,
      avaRule: `Write down the core rule for ${skill.name} in one sentence before you attempt any question.`,
      checklist: [
        'Read the question stem completely before looking at choices.',
        'Identify the skill being tested.',
        'Apply your written rule.',
        'Eliminate wrong choices before committing.',
      ],
      commonTrap: 'Rushing to an answer that looks right but does not match the specific skill being tested.',
      workedExample: {
        setup: `A typical ${skill.name} question will ask you to identify or apply a specific pattern.`,
        steps: [
          'Read the stem and identify exactly what is being asked.',
          'Apply the rule you wrote down.',
          'Check your answer against the rule, not just your intuition.',
        ],
        takeaway: 'The rule always comes first. Apply it before you look at the choices.',
      },
      doNowPrompt: `In your own words, write the rule for ${skill.name}.`,
      retrievalPrompt: `Without looking at your notes, what is the one thing to remember about ${skill.name}?`,
      teachBackPrompt: `Explain ${skill.name} as if you were teaching it to someone who has never seen it.`,
    },
    context: {
      usedErrorJournal: false,
      usedExistingNote: false,
      overCeiling,
      source: 'fallback',
    },
  };
}

export async function POST(req: NextRequest) {
  // 1. Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = StudyLessonRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { skillId } = parsed.data;

  // 2. Authenticate
  const cookieStore = cookies();
  const supabase = getSupabaseServerClient({ getAll: () => cookieStore.getAll() });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  // 3. Fetch skill — 404 early before expensive parallel fetches
  const skill = await fetchSkillById(supabase, skillId);
  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  // 4. Fetch remaining study context in parallel
  const [errorJournal, skillNote, sampleQuestions, masteryResult] = await Promise.all([
    fetchErrorJournalForSkill(supabase, userId, skillId, 5),
    fetchSkillNoteForSkill(supabase, userId, skillId),
    fetchValidatedQuestionsBySkill(supabase, skillId, 1),
    supabase
      .from('mastery')
      .select('p_mastery,attempts_count,last_practiced')
      .eq('user_id', userId)
      .eq('skill_id', skillId)
      .maybeSingle(),
  ]);

  const masteryRow = masteryResult.data ?? null;
  const sampleQ = sampleQuestions[0] ?? null;

  // 5. Build prompt context
  const overrides = AVA_LEARNER_PROFILE.skillModalityOverrides as Record<string, string>;
  const promptContext: StudyPromptContext = {
    skill: {
      id: skill.id,
      name: skill.name,
      section: skill.section,
      domain: skill.domain,
    },
    masterySnapshot: masteryRow
      ? {
          p_mastery: masteryRow.p_mastery,
          attempts_count: masteryRow.attempts_count,
          last_practiced: masteryRow.last_practiced,
        }
      : null,
    recentErrors: errorJournal.map((e) => ({
      ai_observation: e.ai_observation,
      student_note: e.student_note ?? null,
      created_at: e.created_at,
    })),
    existingNote: skillNote?.content ?? null,
    sampleQuestion: sampleQ
      ? {
          stem: sampleQ.stem,
          correct_answer: sampleQ.correct_answer,
          rationale: sampleQ.rationale ?? '',
        }
      : null,
    modalityNote: overrides[skill.name],
  };

  // 6. Build prompts
  const { system, user: userMessage } = getStudyLessonPrompt(promptContext);

  // 7. Call AI (degrade, never block)
  const aiResult = await callAnthropicWithCeiling(supabase, {
    userId,
    callType: 'study_lesson',
    systemPrompt: system,
    userMessage,
    fallbackRationale: JSON.stringify(buildStaticFallback(skill, false)),
    temperature: 0.3,
    maxTokens: 1200,
  });

  // 8. If over ceiling, return static fallback
  if (aiResult.overCeiling) {
    return NextResponse.json(buildStaticFallback(skill, true));
  }

  // 8b. callAnthropicWithCeiling degrades to fallbackRationale on a hard API
  // error too (not just over-ceiling) — model is stamped 'fallback-error' in
  // that case. Without this check, aiResult.content is our own fallback JSON
  // parroted back through the schema validation below and stamped
  // source: 'ai' in step 10, which would misreport a failed AI call as a
  // genuine one and suppress the "AI is resting" notice client-side.
  if (aiResult.model === 'fallback-error') {
    return NextResponse.json(buildStaticFallback(skill, false));
  }

  // 9. Parse and validate AI response
  let lessonJson: unknown;
  try {
    lessonJson = JSON.parse(aiResult.content);
  } catch {
    console.error('study/lesson: AI returned non-JSON, falling back');
    return NextResponse.json(buildStaticFallback(skill, false));
  }

  const validated = StudyLessonResponseSchema.safeParse(lessonJson);
  if (!validated.success) {
    console.error('study/lesson: AI JSON failed schema validation, falling back', validated.error.flatten());
    return NextResponse.json(buildStaticFallback(skill, false));
  }

  // 10. Return validated lesson — stamp source/context flags and overwrite
  // `skill` with the trusted DB row rather than the AI's echoed copy. The
  // prompt's user message never actually tells the model the real skill.id
  // (only name/section/domain), so an AI-authored id is a guess, not data —
  // same reasoning as why context flags below are always server-stamped.
  const lesson: StudyLessonResponse = {
    ...validated.data,
    skill: {
      id: skill.id,
      name: skill.name,
      section: skill.section,
      domain: skill.domain,
    },
    context: {
      ...validated.data.context,
      usedErrorJournal: errorJournal.length > 0,
      usedExistingNote: skillNote !== null,
      overCeiling: false,
      source: 'ai',
    },
  };

  return NextResponse.json(lesson);
}
