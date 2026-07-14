'use client';

/**
 * DiagnosticRunner — PRD F1. Mirrors components/session/SessionRunner.tsx's
 * question/miss-loop UI (same MissLoop + useMissLoop, same attempt-logging
 * shape) but adds the diagnostic-specific state machine: walk each section's
 * first half, then fetch that section's second half at a difficulty
 * conditioned on first-half accuracy (lib/sessions/diagnostic.ts), then move
 * to the next section. On completion: end the session, initialize every
 * mastery row (PRD F1: "initialize every mastery row"), and route to the
 * dashboard, which now has real mastery data to compute a baseline
 * predicted score + top focus skills from.
 *
 * The goal-tree view referenced in PRD F1 ("...+ the goal tree seeded from
 * the results") is `/mastery`, explicitly scheduled for Phase 3 — not built
 * here; this deliberately does not reach for it (phase discipline, CLAUDE.md).
 */
import { useEffect, useRef, useState } from 'react';
import { getSupabaseBrowserClient, endPracticeSession, type Attempt, type Skill } from '@/lib/db';
import { checkCorrect } from '@/lib/sessions';
import { assembleDiagnosticSecondHalf, type DiagnosticItem, type DiagnosticSectionPlan } from '@/lib/sessions/diagnostic';
import { initializeMasteryRows } from '@/lib/mastery';
import MissLoop, { type MissLoopResult } from '@/components/session/MissLoop';
import { useMissLoop } from '@/components/session/useMissLoop';

type Confidence = NonNullable<Attempt['confidence']>;

const CONFIDENCE_OPTIONS: Confidence[] = ['high', 'medium', 'low'];

const SECTION_LABELS: Record<Skill['section'], string> = {
  math: 'Math',
  rw: 'Reading & Writing',
  strategy: 'Strategy',
};

interface DiagnosticRunnerProps {
  sessionId: string;
  sections: DiagnosticSectionPlan[];
  leafSkillIds: string[];
}

/** First index >= from whose section actually has a non-empty first half. */
function nextNonEmptySectionIndex(sections: DiagnosticSectionPlan[], from: number): number {
  let i = from;
  while (i < sections.length && sections[i].firstHalf.length === 0 && sections[i].secondHalfCount === 0) i += 1;
  return i;
}

export default function DiagnosticRunner({ sessionId, sections, leafSkillIds }: DiagnosticRunnerProps) {
  const { logAttemptRow, isSaving } = useMissLoop();

  const startSectionIdx = nextNonEmptySectionIndex(sections, 0);

  const [sectionIdx, setSectionIdx] = useState(startSectionIdx);
  const [queue, setQueue] = useState<DiagnosticItem[]>(sections[startSectionIdx]?.firstHalf ?? []);
  const [phase, setPhase] = useState<'first' | 'second'>('first');
  const [itemIdx, setItemIdx] = useState(0);
  const [loadingNextStep, setLoadingNextStep] = useState(false);

  const [answer, setAnswer] = useState('');
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [showMissLoop, setShowMissLoop] = useState(false);

  const [questionsServed, setQuestionsServed] = useState(0);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  // Section-scoped counters — reset every time a new section starts; drive
  // the accuracy passed into assembleDiagnosticSecondHalf.
  const sectionServedRef = useRef(0);
  const sectionCorrectRef = useRef(0);

  // Every question id already served or already selected this diagnostic —
  // seeded from every section's first half (already assembled up front by
  // assembleDiagnosticFirstHalves), grown as each second half is fetched.
  const usedIdsRef = useRef<Set<string>>(
    new Set(sections.flatMap((s) => s.firstHalf.map((i) => i.question.id)))
  );

  // Miss-loop-internal timing (retry/confirm/variant) is owned by MissLoop
  // itself now, since it also owns logging those attempts — see
  // components/session/MissLoop.tsx's phaseStartRef.
  const questionStartRef = useRef<number>(Date.now());
  const elapsedSeconds = (start: number) => Math.round((Date.now() - start) / 1000);

  const current = queue[itemIdx];

  // Self-heal a sparse-bank degrade: a section's first half assembled to
  // zero items despite a nonzero planned allocation. Nothing gets submitted
  // in that case, so advance()/handleQueueExhausted would otherwise never
  // run and the runner would sit on the loading screen indefinitely.
  useEffect(() => {
    if (!current && !finished && !loadingNextStep) {
      handleQueueExhausted(questionsServed, questionsCorrect);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, finished, loadingNextStep]);

  const finishDiagnostic = async (servedCount: number, correctCount: number) => {
    const supabase = getSupabaseBrowserClient();
    await endPracticeSession(supabase, sessionId, servedCount, correctCount);

    // PRD F1: "On completion: initialize every mastery row." Identity comes
    // from the active session, never hardcoded (locked invariant).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await initializeMasteryRows(supabase, user.id, leafSkillIds);
    }

    setFinished(true);
  };

  /**
   * Advances past the just-answered item. Handles three cases: more items
   * left in the current queue; current section's first half just finished
   * (fetch its second half at the accuracy-conditioned difficulty); or the
   * whole section (both halves) is done (move to the next section, or end
   * the diagnostic if this was the last one).
   */
  const advance = async (servedCount: number, correctCount: number) => {
    setAnswer('');
    setConfidence(null);
    setShowMissLoop(false);

    if (itemIdx + 1 < queue.length) {
      setItemIdx(itemIdx + 1);
      return;
    }

    await handleQueueExhausted(servedCount, correctCount);
  };

  /**
   * Called both when a section's queue is exhausted after a submit, and
   * (via the effect below) when a section's first half assembles to zero
   * items despite a nonzero planned allocation — a sparse-bank degrade that
   * would otherwise strand the runner on the loading screen with nothing
   * left to submit and therefore nothing to trigger `advance()`.
   */
  const handleQueueExhausted = async (servedCount: number, correctCount: number) => {
    const section = sections[sectionIdx];

    if (phase === 'first' && section.secondHalfCount > 0) {
      setLoadingNextStep(true);
      const accuracy = sectionServedRef.current > 0 ? sectionCorrectRef.current / sectionServedRef.current : 0.5;
      const supabase = getSupabaseBrowserClient();
      const secondHalf = await assembleDiagnosticSecondHalf(
        supabase,
        section.section,
        section.secondHalfCount,
        accuracy,
        Array.from(usedIdsRef.current)
      );
      secondHalf.forEach((item) => usedIdsRef.current.add(item.question.id));
      setLoadingNextStep(false);

      if (secondHalf.length === 0) {
        // Sparse bank degrade: nothing left to serve for the second half —
        // treat the section as complete rather than getting stuck.
        await moveToNextSectionOrFinish(servedCount, correctCount);
        return;
      }

      setQueue((prev) => [...prev, ...secondHalf]);
      setPhase('second');
      setItemIdx(itemIdx + 1);
      return;
    }

    await moveToNextSectionOrFinish(servedCount, correctCount);
  };

  const moveToNextSectionOrFinish = async (servedCount: number, correctCount: number) => {
    const next = nextNonEmptySectionIndex(sections, sectionIdx + 1);
    if (next >= sections.length) {
      await finishDiagnostic(servedCount, correctCount);
      return;
    }
    sectionServedRef.current = 0;
    sectionCorrectRef.current = 0;
    setSectionIdx(next);
    setQueue(sections[next].firstHalf);
    setPhase('first');
    setItemIdx(0);
  };

  const handleSubmit = async () => {
    if (!answer || !confidence || !current) return;

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
    sectionServedRef.current += 1;
    if (correct) sectionCorrectRef.current += 1;

    if (correct) {
      await advance(served, correctTotal);
    } else {
      setShowMissLoop(true);
    }
  };

  const handleMissLoopResolved = async (result: MissLoopResult) => {
    if (!current) return;

    // MissLoop now owns logging every attempt it produces (retry, optional
    // confirm question, variant) via the logAttempt prop passed below — this
    // just reflects the loop's final outcome in the diagnostic's running state.
    const correctTotal = questionsCorrect + (result.finalCorrect ? 1 : 0);
    setQuestionsCorrect(correctTotal);
    if (result.finalCorrect) sectionCorrectRef.current += 1;
    await advance(questionsServed, correctTotal);
  };

  // PRD F3.6 — Exit Session escape hatch, same semantics as SessionRunner:
  // ends the session as-is; mastery rows are NOT initialized on an early
  // exit, since PRD F1 only specifies that on diagnostic *completion*.
  const handleExitSession = async () => {
    const supabase = getSupabaseBrowserClient();
    await endPracticeSession(supabase, sessionId, questionsServed, questionsCorrect);
    window.location.href = '/';
  };

  if (finished) {
    const accuracy = questionsServed > 0 ? Math.round((questionsCorrect / questionsServed) * 100) : 0;
    return (
      <div className="max-w-xl mx-auto py-16 space-y-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Diagnostic complete</h1>
        <p className="text-sm text-gray-500">
          {questionsCorrect} of {questionsServed} correct ({accuracy}%). Your mastery map and baseline predicted score
          are ready.
        </p>
        <a href="/" className="inline-block bg-indigo-900 text-white font-semibold rounded-lg px-5 py-2.5 text-sm">
          View your dashboard
        </a>
      </div>
    );
  }

  if (loadingNextStep || !current) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center text-sm text-gray-500">Calibrating your next questions…</div>
    );
  }

  const totalPlanned = sections.reduce((sum, s) => sum + s.firstHalf.length + s.secondHalfCount, 0);
  const servedSoFar = questionsServed + 1;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-800">
        <span className="font-semibold">Diagnostic</span> · Section {sectionIdx + 1} of {sections.length} (
        {SECTION_LABELS[sections[sectionIdx].section]}) · Question {servedSoFar} of ~{totalPlanned}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {SECTION_LABELS[current.section]} · {current.skillName}
        </span>
        <button onClick={handleExitSession} className="font-semibold text-gray-400 hover:text-gray-600">
          Exit Session
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
        <p className="text-base text-gray-900 whitespace-pre-wrap">{current.question.stem}</p>

        {current.question.choices && (
          <div className="grid grid-cols-1 gap-2">
            {current.question.choices.map((choice, i) => {
              const letter = String.fromCharCode(65 + i);
              if (showMissLoop) {
                return (
                  <div key={letter} className="text-left text-sm px-3 py-2 rounded-lg border border-gray-100 text-gray-600">
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
