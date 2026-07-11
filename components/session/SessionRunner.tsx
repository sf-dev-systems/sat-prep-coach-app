'use client';

import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient, endPracticeSession, type Attempt } from '@/lib/db';
import type { PlannedSessionItem } from '@/lib/sessions';
import MissLoop, { type MissLoopResult } from './MissLoop';
import { useMissLoop } from './useMissLoop';

type Confidence = NonNullable<Attempt['confidence']>;

const CONFIDENCE_OPTIONS: Confidence[] = ['high', 'medium', 'low'];

interface SessionRunnerProps {
  sessionId: string;
  items: PlannedSessionItem[];
}

function checkCorrect(item: PlannedSessionItem, response: string): boolean {
  const { question } = item;
  return question.choices
    ? response.trim().toUpperCase() === question.correct_answer.trim().toUpperCase()
    : response.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
}

export default function SessionRunner({ sessionId, items }: SessionRunnerProps) {
  const { logAttemptRow, isSaving } = useMissLoop();

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [showMissLoop, setShowMissLoop] = useState(false);
  const [questionsServed, setQuestionsServed] = useState(0);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = items[index];

  // Wall-clock timing for attempts.time_spent_seconds — reset whenever a
  // fresh question is shown, and again when the miss loop's retry step
  // starts, so the retry's timer only covers the retry, not the hints.
  const questionStartRef = useRef<number>(Date.now());
  const retryStartRef = useRef<number>(Date.now());

  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [index]);

  useEffect(() => {
    if (showMissLoop) retryStartRef.current = Date.now();
  }, [showMissLoop]);

  const elapsedSeconds = (start: number) => Math.round((Date.now() - start) / 1000);

  const goToNext = async (servedCount: number, correctCount: number) => {
    setAnswer('');
    setConfidence(null);
    setShowMissLoop(false);

    if (index + 1 >= items.length) {
      const supabase = getSupabaseBrowserClient();
      await endPracticeSession(supabase, sessionId, servedCount, correctCount);
      setFinished(true);
    } else {
      setIndex(index + 1);
    }
  };

  const handleSubmit = async () => {
    if (!answer || !confidence) return;

    const correct = checkCorrect(current, answer);

    await logAttemptRow({
      sessionId,
      questionId: current.question.id,
      skillId: current.question.skill_id,
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
      await goToNext(served, correctTotal);
    } else {
      setShowMissLoop(true);
    }
  };

  const handleMissLoopResolved = async (result: MissLoopResult) => {
    await logAttemptRow({
      sessionId,
      questionId: current.question.id,
      skillId: current.question.skill_id,
      answer: result.retryAnswer,
      isCorrect: result.finalCorrect,
      confidence: null,
      errorType: result.errorType,
      hintsUsed: result.hintsUsed,
      wasRetry: true,
      timeSpentSeconds: elapsedSeconds(retryStartRef.current),
    });

    // Retry success moves mastery credit (Phase 2 / lib/mastery) — Phase 1
    // just reflects it in the session's running correct count.
    const correctTotal = questionsCorrect + (result.finalCorrect ? 1 : 0);
    setQuestionsCorrect(correctTotal);
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
    return (
      <div className="text-center py-24 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Session complete</h1>
        <p className="text-sm text-gray-500">
          {questionsCorrect} / {questionsServed} correct
        </p>
        <a
          href="/"
          className="inline-block bg-indigo-900 text-white font-semibold rounded-lg px-5 py-2.5 text-sm"
        >
          Back to dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          Question {index + 1} of {items.length} · {current.skillName}
        </span>
        <button onClick={handleExitSession} className="font-semibold text-gray-400 hover:text-gray-600">
          Exit Session
        </button>
      </div>

      {!showMissLoop && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
          <p className="text-base text-gray-900 whitespace-pre-wrap">{current.question.stem}</p>

          {current.question.choices ? (
            <div className="grid grid-cols-1 gap-2">
              {current.question.choices.map((choice, i) => {
                const letter = String.fromCharCode(65 + i);
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
          ) : (
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          )}

          <div className="space-y-2">
            <span className="text-xs font-semibold text-gray-500">How confident are you?</span>
            <div className="flex gap-2">
              {CONFIDENCE_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setConfidence(c)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border capitalize ${
                    confidence === c ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500'
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
        </div>
      )}

      {showMissLoop && <MissLoop question={current.question} onResolved={handleMissLoopResolved} onExit={handleExitSession} />}
    </div>
  );
}
