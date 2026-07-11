/**
 * MissLoop (Phase 1 scope): self-tag error type -> up to 3 static hints ->
 * retry. Full PRD F3 (Haiku tiered-hint generation via prompts/hint.ts,
 * written explanation on a second miss, structural variant, Haiku
 * cross-classification with Zod fallback) is Phase 2 — the AI plumbing for
 * hints (lib/ai + prompts/hint.ts) and classification (lib/ai/classifier.ts)
 * is intentionally not wired here yet.
 *
 * Exit Session (PRD F3.6) is available at every phase.
 */
import React, { useState } from 'react';
import type { Question } from '@/lib/db';

export type ErrorType = 'concept' | 'calculation' | 'misread' | 'careless' | 'timing' | 'guess';

const ERROR_TYPE_OPTIONS: { value: ErrorType; label: string }[] = [
  { value: 'concept', label: "Didn't know the concept" },
  { value: 'calculation', label: 'Calculation slip' },
  { value: 'misread', label: 'Misread the question' },
  { value: 'careless', label: 'Careless mistake' },
  { value: 'timing', label: 'Ran out of time' },
  { value: 'guess', label: 'Guessed' },
];

const STATIC_HINTS = [
  'Hint 1: Re-read the question stem — what is it actually asking for?',
  'Hint 2: Identify the specific rule or formula this question is testing.',
  'Hint 3: Work through the method step by step before choosing your answer.',
];

export interface MissLoopResult {
  finalCorrect: boolean;
  hintsUsed: number;
  errorType: ErrorType;
  retryAnswer: string;
}

interface MissLoopProps {
  question: Question;
  onResolved: (result: MissLoopResult) => void;
  onExit: () => void;
}

export default function MissLoop({ question, onResolved, onExit }: MissLoopProps) {
  const [phase, setPhase] = useState<'TAG' | 'HINT' | 'RETRY'>('TAG');
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [retryAnswer, setRetryAnswer] = useState('');

  const requestHint = () => {
    if (hintsUsed < 3) setHintsUsed(hintsUsed + 1);
  };

  const submitRetry = () => {
    if (!errorType || !retryAnswer) return;
    const finalCorrect = question.choices
      ? retryAnswer.trim().toUpperCase() === question.correct_answer.trim().toUpperCase()
      : retryAnswer.trim().toLowerCase() === question.correct_answer.trim().toLowerCase();
    onResolved({ finalCorrect, hintsUsed, errorType, retryAnswer });
  };

  return (
    <div className="miss-loop-container p-6 border border-gray-100 rounded-2xl shadow-sm space-y-4 bg-white">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Not quite — let&apos;s dig in</h3>
        <button onClick={onExit} className="text-xs font-semibold text-gray-400 hover:text-gray-600">
          Exit Session
        </button>
      </div>

      {phase === 'TAG' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">What do you think went wrong?</p>
          <div className="grid grid-cols-2 gap-2">
            {ERROR_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setErrorType(opt.value)}
                className={`text-xs font-medium px-3 py-2 rounded-lg border text-left ${
                  errorType === opt.value
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            disabled={!errorType}
            onClick={() => setPhase('HINT')}
            className="w-full bg-indigo-900 text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      )}

      {phase === 'HINT' && (
        <div className="space-y-3">
          {Array.from({ length: hintsUsed }).map((_, i) => (
            <p key={i} className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3">
              {STATIC_HINTS[i]}
            </p>
          ))}
          <div className="flex gap-2">
            {hintsUsed < 3 && (
              <button
                onClick={requestHint}
                className="text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg px-3 py-2"
              >
                Get Hint {hintsUsed + 1}
              </button>
            )}
            <button
              onClick={() => setPhase('RETRY')}
              className="text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg px-3 py-2"
            >
              I&apos;m ready to retry
            </button>
          </div>
        </div>
      )}

      {phase === 'RETRY' && (
        <div className="space-y-3">
          {question.choices ? (
            <div className="grid grid-cols-1 gap-2">
              {question.choices.map((choice, i) => {
                const letter = String.fromCharCode(65 + i);
                return (
                  <button
                    key={letter}
                    onClick={() => setRetryAnswer(letter)}
                    className={`text-left text-sm px-3 py-2 rounded-lg border ${
                      retryAnswer === letter ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                    }`}
                  >
                    {letter}) {choice}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              value={retryAnswer}
              onChange={(e) => setRetryAnswer(e.target.value)}
              placeholder="Your answer"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          )}
          <button
            disabled={!retryAnswer}
            onClick={submitRetry}
            className="w-full bg-indigo-900 text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-40"
          >
            Submit Retry
          </button>
        </div>
      )}
    </div>
  );
}
