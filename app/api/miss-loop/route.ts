import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseServerClient, fetchQuestionById, fetchLatestCoachMemory, type Question } from '@/lib/db';
import { callAnthropicWithCeiling } from '@/lib/ai';
import { classifyAttemptError } from '@/lib/ai/classifier';
import { getHintPrompt } from '@/prompts/hint';
import { getTutorPrompt } from '@/prompts/tutor';
import { VARK_PROFILE } from '@/lib/constants';
import { MissLoopRequestSchema } from '@/lib/validation/miss-loop';

/**
 * app/api/miss-loop/route.ts
 *
 * Architecture decision (flagged per AGENT_HANDOFF.md's open item, not
 * silently picked): a single action-discriminated route, not four separate
 * route files. `ANTHROPIC_API_KEY` is server-only (locked invariant), but
 * `MissLoop.tsx` runs client-side, so every Anthropic-calling step of PRD
 * F3 needs a server hop. The three call types that actually reach Sonnet/
 * Haiku here are `hint`, `explanation`, and `classify` — sharing one route
 * avoids re-deriving the same session-auth + question-fetch boilerplate
 * three times. `variant` (F3.3's structural-variant step) deliberately has
 * NO action here: it's a read against the shared, RLS-readable `questions`
 * table with no Anthropic call in Phase 2 scope (live AI-generated variants
 * are PRD F9's admin pipeline, Phase 4, which also needs blind-solve
 * validation this route doesn't do) — MissLoop.tsx calls
 * `fetchVariantQuestion` from `lib/db` directly from the browser client.
 *
 * Identity: derived from the request's session cookies via
 * getSupabaseServerClient, same as every other authenticated route/page in
 * this app (schema invariant #5 — no hardcoded user ID). Every Anthropic
 * call still routes through lib/ai's single chokepoint, which logs to
 * ai_log and enforces the daily ceiling with a static-rationale fallback —
 * this route does not duplicate that logic, only supplies the prompt.
 */
export const dynamic = 'force-dynamic';

function questionRationaleFallback(question: Question): string {
  return question.rationale || 'Review the question rationale and try again — no AI guidance available right now.';
}

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = getSupabaseServerClient({ getAll: () => cookieStore.getAll() });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = MissLoopRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;

  const question = await fetchQuestionById(supabase, body.questionId);
  if (!question) {
    return NextResponse.json({ error: 'Question not found' }, { status: 404 });
  }

  try {
    if (body.action === 'hint') {
      const { systemPrompt, userMessage } = getHintPrompt({
        stem: question.stem,
        choices: question.choices,
        correctAnswer: question.correct_answer,
        hintNumber: body.hintNumber as 1 | 2 | 3,
        varkProfile: VARK_PROFILE,
      });

      const result = await callAnthropicWithCeiling(supabase, {
        userId: user.id,
        callType: 'hint',
        systemPrompt,
        userMessage,
        fallbackRationale: questionRationaleFallback(question),
        temperature: 0.3,
        maxTokens: 300,
      });

      return NextResponse.json({ hint: result.content, overCeiling: result.overCeiling });
    }

    if (body.action === 'explanation') {
      const coachMemory = await fetchLatestCoachMemory(supabase, user.id);
      const chosenDistractorNote =
        question.distractor_notes && body.studentAnswer
          ? question.distractor_notes[body.studentAnswer] ?? null
          : null;

      const { systemPrompt, userMessage } = getTutorPrompt({
        stem: question.stem,
        choices: question.choices,
        studentAnswer: body.studentAnswer,
        correctAnswer: question.correct_answer,
        rationale: question.rationale,
        confidence: body.confidence,
        coachMemory: coachMemory || "No prior coaching history yet — this is early in the student's practice.",
        varkProfile: VARK_PROFILE,
        trapType: question.trap_type,
        chosenDistractorNote,
      });

      const result = await callAnthropicWithCeiling(supabase, {
        userId: user.id,
        callType: 'explanation',
        systemPrompt,
        userMessage,
        fallbackRationale: questionRationaleFallback(question),
        temperature: 0.3,
        maxTokens: 400,
      });

      return NextResponse.json({ explanation: result.content, overCeiling: result.overCeiling });
    }

    if (body.action === 'classify') {
      const classification = await classifyAttemptError(supabase, user.id, {
        stem: question.stem,
        choices: question.choices,
        correctAnswer: question.correct_answer,
        studentAnswer: body.studentAnswer,
        rationale: question.rationale,
        studentErrorTag: body.studentErrorTag,
      });

      return NextResponse.json(classification);
    }

    // body.action === 'EXPLAIN_NOW' — Phase 2 scope
    return NextResponse.json({ error: 'EXPLAIN_NOW not yet implemented' }, { status: 501 });
  } catch (err: any) {
    console.error(`miss-loop route failed (action=${body.action}):`, err);
    // Degrade, never block: the client-side caller falls back to static
    // question.rationale / skips classification on a non-200 here.
    return NextResponse.json({ error: 'AI call failed', fallback: questionRationaleFallback(question) }, { status: 502 });
  }
}
