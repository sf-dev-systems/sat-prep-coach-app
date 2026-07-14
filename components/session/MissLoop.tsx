/**
 * MissLoop — PRD F3 full state machine.
 *
 * TAG (self-tag error type)
 *   -> HINT (up to 3 tiered hints, Sonnet via /api/miss-loop, student-requested one at a time)
 *   -> RETRY (student re-answers; logs its own `attempts` row + fires the
 *      Haiku cross-classify call)
 *     -> retry correct: optional CONFIRM (one harder question, same skill,
 *        skippable, never blocks) -> resolved
 *     -> retry wrong: EXPLANATION (Sonnet full written explanation, ≤150
 *        words, names the trap, ends with the generalizable rule) ->
 *        VARIANT (same skill + trap_type, not already served, pulled from
 *        the existing validated bank — no AI call in Phase 2 scope) -> resolved
 *
 * Every resolved miss writes one `error_journal` row (PRD F3.5 — "always
 * written"), regardless of whether the student ever taps to view the
 * distractor breakdown. Exit Session (F3.6) is available at every phase.
 *
 * Architecture: this component owns attempt logging for every question it
 * produces (the original retry, the optional confirm question, the
 * variant) via the `logAttempt` prop threaded down from useMissLoop —
 * SessionRunner no longer double-logs the retry itself. `onResolved` only
 * signals "the loop is done, advance the queue" with the final outcome for
 * the session summary screen.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  type Question,
  getSupabaseBrowserClient,
  fetchQuestionsBySkill,
  fetchAttemptedQuestionIdsForSkill,
  fetchVariantQuestion,
  insertErrorJournalEntry,
} from '@/lib/db';
import { checkCorrect } from '@/lib/sessions';
import type { LogAttemptParams } from './useMissLoop';

export type ErrorType = 'concept' | 'calculation' | 'misread' | 'careless' | 'timing' | 'guess';

const ERROR_TYPE_OPTIONS: { value: ErrorType; label: string }[] = [
  { value: 'concept', label: "Didn't know the concept" },
  { value: 'calculation', label: 'Calculation slip' },
  { value: 'misread', label: 'Misread the question' },
  { value: 'careless', label: 'Careless mistake' },
  { value: 'timing', label: 'Ran out of time' },
  { value: 'guess', label: 'Guessed' },
];

interface ClassifyApiResult {
  errorType: ErrorType;
  disagreementRationale: string | null;
  agreesWithStudent: boolean;
  usedFallback: boolean;
}

export interface MissLoopResult {
  finalCorrect: boolean;
  errorType: ErrorType;
}

interface MissLoopProps {
  question: Question;
  skillName: string;
  sessionId: string;
  /** The student's original (wrong) first-attempt answer/confidence — still
   * held in SessionRunner's state when this mounts, since it only resets
   * after the loop resolves. Used for the Haiku classify call and the
   * explanation prompt's confidence context. */
  originalAnswer: string;
  originalConfidence: 'high' | 'medium' | 'low' | null;
  logAttempt: (params: LogAttemptParams) => Promise<void>;
  onResolved: (result: MissLoopResult) => void;
  onExit: () => void;
}

type Phase = 'TAG' | 'HINT' | 'RETRY' | 'CONFIRM' | 'EXPLANATION' | 'VARIANT';

async function postMissLoop<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch('/api/miss-loop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (err) {
    console.warn('miss-loop API call failed (degrading to static fallback):', err);
    return null;
  }
}

export default function MissLoop({
  question,
  skillName,
  sessionId,
  originalAnswer,
  originalConfidence,
  logAttempt,
  onResolved,
  onExit,
}: MissLoopProps) {
  const [phase, setPhase] = useState<Phase>('TAG');
  const [errorType, setErrorType] = useState<ErrorType | null>(null);

  const [hintsUsed, setHintsUsed] = useState(0);
  const [hints, setHints] = useState<string[]>([]);
  const [hintLoading, setHintLoading] = useState(false);

  const [retryAnswer, setRetryAnswer] = useState('');
  const [retrySubmitting, setRetrySubmitting] = useState(false);

  const [explanation, setExplanation] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [confirmQuestion, setConfirmQuestion] = useState<Question | null>(null);
  const [confirmAnswer, setConfirmAnswer] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  const [variantQuestion, setVariantQuestion] = useState<Question | null>(null);
  const [variantAnswer, setVariantAnswer] = useState('');
  const [variantSubmitting, setVariantSubmitting] = useState(false);
  const [variantUnavailable, setVariantUnavailable] = useState(false);

  // Wall-clock timing per phase — reset whenever the phase changes so each
  // logged attempt's time_spent_seconds reflects just that step.
  const phaseStartRef = useRef<number>(Date.now());
  useEffect(() => {
    phaseStartRef.current = Date.now();
  }, [phase]);
  const elapsedSeconds = () => Math.round((Date.now() - phaseStartRef.current) / 1000);

  const writeErrorJournal = async (aiObservation: string) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await insertErrorJournalEntry(supabase, {
        user_id: user.id,
        skill_id: question.skill_id,
        ai_observation: aiObservation,
      });
    } catch (err) {
      // PRD F3.5 says this should "always" happen, but a failed write here
      // must never block the student's flow (same degrade-never-block
      // spirit as the AI ceiling) — log and move on.
      console.error('Failed to write error_journal entry (non-blocking):', err);
    }
  };

  const classifyAgainstSelfTag = async (chosenAnswer: string, tag: ErrorType): Promise<ClassifyApiResult | null> =>
    postMissLoop<ClassifyApiResult>({
      action: 'classify',
      questionId: question.id,
      studentAnswer: chosenAnswer,
      studentErrorTag: tag,
    });

  const disagreementNote = (classification: ClassifyApiResult | null): string => {
    if (!classification || classification.agreesWithStudent) return '';
    return `\n\nAI cross-classification: this pattern looks more like a "${classification.errorType}" error than the self-tagged "${errorType}"${
      classification.disagreementRationale ? ` — ${classification.disagreementRationale}` : ''
    }.`;
  };

  const tryFetchConfirmQuestion = async (): Promise<Question | null> => {
    const skillId = question.skill_id;
    if (!skillId) return null;
    try {
      const supabase = getSupabaseBrowserClient();
      const pool = await fetchQuestionsBySkill(supabase, skillId, 10);
      const harder = pool
        .filter((q) => q.validated && q.id !== question.id && q.difficulty > question.difficulty)
        .sort((a, b) => a.difficulty - b.difficulty);
      return harder[0] ?? null;
    } catch (err) {
      console.warn('Confirm-question lookup failed (skippable, non-blocking):', err);
      return null;
    }
  };

  const finalizeCorrectPath = async (classification: ClassifyApiResult | null) => {
    const chosenNote = question.distractor_notes?.[originalAnswer];
    const base =
      `Recovered on retry after ${hintsUsed} hint(s). Original miss chose "${originalAnswer}". ` +
      (chosenNote || question.rationale || 'No authored distractor note for this choice.');
    await writeErrorJournal(base + disagreementNote(classification));

    const confirm = await tryFetchConfirmQuestion();
    if (confirm) {
      setConfirmQuestion(confirm);
      setPhase('CONFIRM');
    } else {
      onResolved({ finalCorrect: true, errorType: errorType as ErrorType });
    }
  };

  const runExplanation = async (classification: ClassifyApiResult | null) => {
    setPhase('EXPLANATION');
    setExplanationLoading(true);

    const data = await postMissLoop<{ explanation: string }>({
      action: 'explanation',
      questionId: question.id,
      studentAnswer: retryAnswer,
      confidence: originalConfidence ?? undefined,
    });

    const text =
      data?.explanation ||
      question.rationale ||
      'No explanation available right now — review the choices again before continuing.';

    setExplanation(text);
    setExplanationLoading(false);
    await writeErrorJournal(text + disagreementNote(classification));
  };

  const submitRetry = async () => {
    if (!errorType || !retryAnswer || retrySubmitting) return;
    setRetrySubmitting(true);
    try {
      const correct = checkCorrect(question, retryAnswer);

      await logAttempt({
        sessionId,
        questionId: question.id,
        skillId: question.skill_id,
        difficulty: question.difficulty,
        answer: retryAnswer,
        isCorrect: correct,
        confidence: null,
        errorType,
        hintsUsed,
        wasRetry: true,
        timeSpentSeconds: elapsedSeconds(),
      });

      const classification = await classifyAgainstSelfTag(retryAnswer, errorType);

      if (correct) {
        await finalizeCorrectPath(classification);
      } else {
        await runExplanation(classification);
      }
    } finally {
      setRetrySubmitting(false);
    }
  };

  const proceedToVariant = async () => {
    const skillId = question.skill_id;
    if (!skillId) {
      setVariantUnavailable(true);
      onResolved({ finalCorrect: false, errorType: errorType as ErrorType });
      return;
    }
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const attemptedIds = user ? await fetchAttemptedQuestionIdsForSkill(supabase, user.id, skillId) : [];
      const exclude = Array.from(new Set([...attemptedIds, question.id]));
      const variant = await fetchVariantQuestion(supabase, skillId, question.trap_type, exclude);

      if (variant) {
        setVariantQuestion(variant);
        setPhase('VARIANT');
      } else {
        setVariantUnavailable(true);
        onResolved({ finalCorrect: false, errorType: errorType as ErrorType });
      }
    } catch (err) {
      console.warn('Variant lookup failed (skippable, non-blocking):', err);
      setVariantUnavailable(true);
      onResolved({ finalCorrect: false, errorType: errorType as ErrorType });
    }
  };

  const submitConfirm = async () => {
    if (!confirmQuestion || !confirmAnswer || confirmSubmitting) return;
    setConfirmSubmitting(true);
    try {
      const correct = checkCorrect(confirmQuestion, confirmAnswer);
      await logAttempt({
        sessionId,
        questionId: confirmQuestion.id,
        skillId: confirmQuestion.skill_id,
        difficulty: confirmQuestion.difficulty,
        answer: confirmAnswer,
        isCorrect: correct,
        confidence: null,
        errorType: correct ? null : errorType,
        hintsUsed: 0,
        wasRetry: true,
        timeSpentSeconds: elapsedSeconds(),
      });
    } finally {
      setConfirmSubmitting(false);
      // The confirm question is an optional check on an already-successful
      // retry (PRD F3.2: "never blocks; skippable") — its own result feeds
      // mastery via the attempt logged above, but doesn't change whether
      // the original retry counted as a recovery.
      onResolved({ finalCorrect: true, errorType: errorType as ErrorType });
    }
  };

  const skipConfirm = () => {
    onResolved({ finalCorrect: true, errorType: errorType as ErrorType });
  };

  const submitVariant = async () => {
    if (!variantQuestion || !variantAnswer || variantSubmitting) return;
    setVariantSubmitting(true);
    try {
      const correct = checkCorrect(variantQuestion, variantAnswer);
      await logAttempt({
        sessionId,
        questionId: variantQuestion.id,
        skillId: variantQuestion.skill_id,
        difficulty: variantQuestion.difficulty,
        answer: variantAnswer,
        isCorrect: correct,
        confidence: null,
        errorType: correct ? null : errorType,
        hintsUsed: 0,
        wasRetry: true,
        timeSpentSeconds: elapsedSeconds(),
      });
      onResolved({ finalCorrect: correct, errorType: errorType as ErrorType });
    } finally {
      setVariantSubmitting(false);
    }
  };

  const requestHint = async () => {
    if (hintsUsed >= 3 || hintLoading) return;
    setHintLoading(true);
    const hintNumber = (hintsUsed + 1) as 1 | 2 | 3;
    const data = await postMissLoop<{ hint: string }>({ action: 'hint', questionId: question.id, hintNumber });
    const text =
      data?.hint ||
      (question.rationale
        ? `AI hint unavailable — here's the question rationale instead: ${question.rationale}`
        : 'No hint available right now.');
    setHints((prev) => [...prev, text]);
    setHintsUsed(hintNumber);
    setHintLoading(false);
  };

  const renderAnswerControls = (
    q: Question,
    value: string,
    onChange: (v: string) => void,
    disabled: boolean
  ) => (
    <>
      {q.choices ? (
        <div className="grid grid-cols-1 gap-2">
          {q.choices.map((choice, i) => {
            const letter = String.fromCharCode(65 + i);
            return (
              <button
                key={letter}
                disabled={disabled}
                onClick={() => onChange(letter)}
                className={`text-left text-sm px-3 py-2 rounded-lg border disabled:opacity-60 ${
                  value === letter ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200'
                }`}
              >
                {letter}) {choice}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:opacity-60"
        />
      )}
    </>
  );

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
          {hints.map((hintText, i) => (
            <p key={i} className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3">
              <span className="font-semibold text-gray-500">Hint {i + 1}: </span>
              {hintText}
            </p>
          ))}
          <div className="flex gap-2">
            {hintsUsed < 3 && (
              <button
                onClick={requestHint}
                disabled={hintLoading}
                className="text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg px-3 py-2 disabled:opacity-50"
              >
                {hintLoading ? 'Thinking…' : `Get Hint ${hintsUsed + 1}`}
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
          {renderAnswerControls(question, retryAnswer, setRetryAnswer, retrySubmitting)}
          <button
            disabled={!retryAnswer || retrySubmitting}
            onClick={submitRetry}
            className="w-full bg-indigo-900 text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-40"
          >
            {retrySubmitting ? 'Checking…' : 'Submit Retry'}
          </button>
        </div>
      )}

      {phase === 'CONFIRM' && confirmQuestion && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Nice — want to confirm you&apos;ve got it with one harder question? Totally optional.
          </p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg p-3">
            {confirmQuestion.stem}
          </p>
          {renderAnswerControls(confirmQuestion, confirmAnswer, setConfirmAnswer, confirmSubmitting)}
          <div className="flex gap-2">
            <button
              onClick={skipConfirm}
              className="text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-2"
            >
              Skip
            </button>
            <button
              disabled={!confirmAnswer || confirmSubmitting}
              onClick={submitConfirm}
              className="flex-1 bg-indigo-900 text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-40"
            >
              {confirmSubmitting ? 'Checking…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {phase === 'EXPLANATION' && (
        <div className="space-y-3">
          {explanationLoading ? (
            <p className="text-sm text-gray-500">Writing your explanation…</p>
          ) : (
            <>
              <p className="text-sm text-gray-800 whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-lg p-3">
                {explanation}
              </p>
              {question.distractor_notes && (
                <div>
                  <button
                    onClick={() => setShowBreakdown((v) => !v)}
                    className="text-xs font-semibold text-indigo-600"
                  >
                    {showBreakdown ? 'Hide' : 'View'} full answer-choice breakdown
                  </button>
                  {showBreakdown && (
                    <div className="mt-2 space-y-1.5">
                      {Object.entries(question.distractor_notes).map(([letter, note]) => (
                        <p key={letter} className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-2">
                          <span className="font-semibold">{letter}) </span>
                          {note}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={proceedToVariant}
                className="w-full bg-indigo-900 text-white font-semibold rounded-lg py-2 text-sm"
              >
                Continue to practice question
              </button>
            </>
          )}
        </div>
      )}

      {phase === 'VARIANT' && variantQuestion && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Same pattern, new question — let&apos;s confirm it clicked.</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 border border-gray-100 rounded-lg p-3">
            {variantQuestion.stem}
          </p>
          {renderAnswerControls(variantQuestion, variantAnswer, setVariantAnswer, variantSubmitting)}
          <button
            disabled={!variantAnswer || variantSubmitting}
            onClick={submitVariant}
            className="w-full bg-indigo-900 text-white font-semibold rounded-lg py-2 text-sm disabled:opacity-40"
          >
            {variantSubmitting ? 'Checking…' : 'Submit'}
          </button>
        </div>
      )}

      {phase === 'VARIANT' && !variantQuestion && variantUnavailable && (
        <p className="text-xs text-gray-400">No fresh practice question available for this pattern yet — moving on.</p>
      )}
    </div>
  );
}
