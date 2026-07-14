'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient, endPracticeSession, type Attempt } from '@/lib/db';
import { checkCorrect, type CompositionBucket, type PlannedSessionItem } from '@/lib/sessions';
import MissLoop, { type MissLoopResult } from './MissLoop';
import { useMissLoop } from './useMissLoop';

type Confidence = NonNullable<Attempt['confidence']>;

const CONFIDENCE_OPTIONS: Confidence[] = ['high', 'medium', 'low'];

// PRD F2: "after 2 consecutive misses, insert one high-mastery confidence-builder".
const CONSECUTIVE_MISSES_BEFORE_CONFIDENCE_BUILDER = 2;

interface SessionRunnerProps {
  sessionId: string;
  items: PlannedSessionItem[];
  /** Reserve pool built by the assembler; spliced into the running queue on 2 consecutive misses. */
  confidenceBuilderPool?: PlannedSessionItem[];
  /** PRD F2's time-budgeted plan display, e.g. "~40 min: 15 review / 12 priority / 5 mixed". */
  plannedMinutes?: number;
  composition?: CompositionBucket[];
}

export default function SessionRunner({
  sessionId,
  items,
  confidenceBuilderPool = [],
  plannedMinutes,
  composition = [],
}: SessionRunnerProps) {
  const { logAttemptRow, isSaving } = useMissLoop();

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [showMissLoop, setShowMissLoop] = useState(false);
  const [questionsServed, setQuestionsServed] = useState(0);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  // Mutable running queue — starts as the assembler's plan, but grows when a
  // confidence-builder question gets spliced in mid-session (PRD F2). Kept
  // separate from the `items` prop so that splice never mutates the plan
  // the server handed down.
  const [queue, setQueue] = useState<PlannedSessionItem[]>(items);
  const [cbPool, setCbPool] = useState<PlannedSessionItem[]>(confidenceBuilderPool);
  const consecutiveMissesRef = useRef(0);

  const current = queue[index];

  // Wall-clock timing for the initial submission's attempts.time_spent_seconds
  // — reset whenever a fresh question is shown. Miss-loop-internal timing
  // (retry/confirm/variant) is now owned by MissLoop itself, since it also
  // owns logging those attempts (see MissLoop.tsx's phaseStartRef).
  const questionStartRef = useRef<number>(Date.now());

  // Per-question final outcomes, accumulated as the session progresses, so
  // the end-of-session Summary screen can report which skills were touched
  // and how the student did on each — one entry per question, recorded once
  // its final result is known (immediately on a correct first try, or after
  // the miss loop resolves on a retry).
  const skillResultsRef = useRef<{ skillName: string; correct: boolean }[]>([]);

  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [index]);

  const elapsedSeconds = (start: number) => Math.round((Date.now() - start) / 1000);

  const goToNext = async (servedCount: number, correctCount: number) => {
    setAnswer('');
    setConfidence(null);
    setShowMissLoop(false);

    if (index + 1 >= queue.length) {
      const supabase = getSupabaseBrowserClient();
      await endPracticeSession(supabase, sessionId, servedCount, correctCount);
      setFinished(true);
    } else {
      setIndex(index + 1);
    }
  };

  const handleSubmit = async () => {
    if (!answer || !confidence) return;

    const correct = checkCorrect(current.question, answer);

    await logAttemptRow({
      sessionId,
      questionId: current.question.id,
      skillId: current.question.skill_id,
      difficulty: current.question.difficulty,
      answer,
      isCorrect: correct,
      confidence,
      errorType: null,
      hintsUsed: 0,
      wasRetry: false,
      timeSpentSeconds: elapsedSeconds(questionStartRef.current),
    });

    const served = questionsServed + 1;
    const correctTotal = questionsCorrect + (correct ? 1 : 0);
    setQuestionsServed(served);
    setQuestionsCorrect(correctTotal);

    if (correct) {
      consecutiveMissesRef.current = 0;
      skillResultsRef.current.push({ skillName: current.skillName, correct: true });
      await goToNext(served, correctTotal);
    } else {
      consecutiveMissesRef.current += 1;

      // PRD F2: after 2 consecutive misses, insert one high-mastery
      // confidence-builder before continuing normal selection. Splice it
      // right after the question currently being missed, so it's next up
      // once this miss loop resolves.
      if (consecutiveMissesRef.current >= CONSECUTIVE_MISSES_BEFORE_CONFIDENCE_BUILDER && cbPool.length > 0) {
        const [builder, ...restPool] = cbPool;
        setQueue((prev) => {
          const next = [...prev];
          next.splice(index + 1, 0, builder);
          return next;
        });
        setCbPool(restPool);
        consecutiveMissesRef.current = 0;
      }

      setShowMissLoop(true);
    }
  };

  const handleMissLoopResolved = async (result: MissLoopResult) => {
    // MissLoop now owns logging every attempt it produces (retry, optional
    // confirm question, variant) via the logAttempt prop passed below — this
    // just reflects the loop's final outcome in the session's running state.
    const correctTotal = questionsCorrect + (result.finalCorrect ? 1 : 0);
    setQuestionsCorrect(correctTotal);
    skillResultsRef.current.push({ skillName: current.skillName, correct: result.finalCorrect });
    await goToNext(questionsServed, correctTotal);
  };

  // PRD F3.6 — persistent Exit Session escape hatch, available from the
  // question view and every miss-loop phase. Ends the session as-is;
  // questions_served/questions_correct reflect progress up to this point.
  const handleExitSession = async () => {
    const supabase = getSupabaseBrowserClient();
    await endPracticeSession(supabase, sessionId, questionsServed, questionsCorrect);
    window.location.href = '/';
  };

  if (finished) {
    const incorrect = questionsServed - questionsCorrect;
    const accuracy = questionsServed > 0 ? Math.round((questionsCorrect / questionsServed) * 100) : 0;

    // Group the per-question outcomes recorded above into a skills-impacted
    // breakdown — this is what actually halts the flow with real feedback
    // instead of dumping straight back to the dashboard.
    const skillSummary = new Map<string, { correct: number; total: number }>();
    for (const r of skillResultsRef.current) {
      const entry = skillSummary.get(r.skillName) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (r.correct) entry.correct += 1;
      skillSummary.set(r.skillName, entry);
    }

    return (
      <div className="max-w-xl mx-auto py-16 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Session complete</h1>
          <p className="text-sm text-gray-500">Here&apos;s how this session went.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <span className="block text-2xl font-extrabold text-gray-900">{questionsServed}</span>
            <span className="text-xs text-gray-500">Answered</span>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <span className="block text-2xl font-extrabold text-green-600">{questionsCorrect}</span>
            <span className="text-xs text-gray-500">Correct</span>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <span className="block text-2xl font-extrabold text-red-500">{incorrect}</span>
            <span className="text-xs text-gray-500">Incorrect</span>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Session Accuracy</span>
          <span className="text-lg font-bold text-indigo-700">{accuracy}%</span>
        </div>

        {skillSummary.size > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-gray-900">Skills Impacted</h2>
            <div className="space-y-1.5">
              {Array.from(skillSummary.entries()).map(([skillName, s]) => (
                <div
                  key={skillName}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-gray-700">{skillName}</span>
                  <span className="text-xs font-semibold text-gray-500">
                    {s.correct}/{s.total} correct
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <a
          href="/"
          className="block text-center bg-indigo-900 text-white font-semibold rounded-lg px-5 py-2.5 text-sm"
        >
          Back to dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {index === 0 && !showMissLoop && composition.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-800">
          <span className="font-semibold">
            Today&apos;s plan{plannedMinutes ? ` · ~${plannedMinutes} min` : ''}:
          </span>{' '}
          {composition.map((bucket, i) => (
            <span key={bucket.category}>
              {i > 0 && ' · '}
              {bucket.count} {bucket.label.toLowerCase()}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Question {index + 1} of {queue.length} · {current.skillName}
          {current.category === 'confidence_builder' && (
            <span className="ml-2 text-emerald-600 font-semibold">· You&apos;ve got this one</span>
          )}
        </span>
        <button onClick={handleExitSession} className="font-semibold text-gray-400 hover:text-gray-600">
          Exit Session
        </button>
      </div>

      {/*
        Persistent question card — always rendered, in both the initial
        submission phase and every miss-loop phase (tag/hint/retry). Previously
        this whole block was gated on `!showMissLoop`, so the question stem
        (and its choices, for MCQ items) vanished the moment a student got a
        question wrong — leaving them unable to see what they were diagnosing
        or retrying. The stem/choices now always render here; only the
        *interactive* initial-answer controls (clickable choice buttons,
        confidence picker, Submit) are gated on `!showMissLoop`, since once
        the miss loop starts, MissLoop below owns the interactive retry input.
      */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
        <p className="text-base text-gray-900 whitespace-pre-wrap">{current.question.stem}</p>

        {current.question.choices && (
          <div className="grid grid-cols-1 gap-2">
            {current.question.choices.map((choice, i) => {
              const letter = String.fromCharCode(65 + i);
              if (showMissLoop) {
                // Read-only reference during the miss loop — MissLoop's
                // retry phase below owns the interactive retry selection.
                return (
                  <div
                    key={letter}
                    className="text-left text-sm px-3 py-2 rounded-lg border border-gray-100 text-gray-600"
                  >
                    {letter}) {choice}
                  </div>
                );
              }
              return (
                <button
                  key={letter}
                  onClick={() => setAnswer(letter)}
                  className={`text-left text-sm px-3 py-2 rounded-lg border ${
                    answer === letter ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                  }`}
                >
                  {letter}) {choice}
                </button>
              );
            })}
          </div>
        )}

        {!current.question.choices && !showMissLoop && (
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
        )}

        {!showMissLoop && (
          <>
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-500">How confident are you?</span>
              <div className="flex gap-2">
                {CONFIDENCE_OPTIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setConfidence(c)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize ${
                      confidence === c
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-500'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!answer || !confidence || isSaving}
              onClick={handleSubmit}
              className="w-full bg-indigo-900 text-white font-semibold rounded-lg py-2.5 text-sm disabled:opacity-40"
            >
              Submit
            </button>
          </>
        )}
      </div>

      {showMissLoop && (
        <MissLoop
          question={current.question}
          skillName={current.skillName}
          sessionId={sessionId}
          originalAnswer={answer}
          originalConfidence={confidence}
          logAttempt={logAttemptRow}
          onResolved={handleMissLoopResolved}
          onExit={handleExitSession}
        />
      )}
    </div>
  );
}
