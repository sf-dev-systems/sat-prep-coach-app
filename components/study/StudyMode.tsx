'use client';

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import type { StudyLessonResponse } from '@/lib/validation/study';

interface StudyModeProps {
  skillId: string;
  skillName: string;
  section: string;
}

export default function StudyMode({ skillId, skillName, section }: StudyModeProps) {
  const [lesson, setLesson] = useState<StudyLessonResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [teachBackText, setTeachBackText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [teachBackSkipped, setTeachBackSkipped] = useState(false);

  useEffect(() => {
    fetchLesson();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId]);

  async function fetchLesson() {
    setLoading(true);
    setLoadError(false);
    setStep(0);
    setCheckedItems(new Set());
    setTeachBackText('');
    setSaveSuccess(false);
    setSaveError(null);
    setTeachBackSkipped(false);
    try {
      const res = await fetch('/api/study/lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StudyLessonResponse = await res.json();
      setLesson(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  function toggleCheck(idx: number) {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handleSaveTeachBack(skip = false) {
    if (skip) {
      setTeachBackSkipped(true);
      setStep(8);
      return;
    }
    if (!teachBackText.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/skill-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, content: teachBackText.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setSaveSuccess(true);
      setStep(8);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading your lesson…</p>
        </div>
      </div>
    );
  }

  if (loadError || !lesson) {
    return (
      <div className="text-center py-24 space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
        <p className="text-sm text-gray-600">
          Could not load your lesson. Check your connection and try again.
        </p>
        <button
          onClick={fetchLesson}
          className="inline-flex items-center gap-2 bg-indigo-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-800 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const { lesson: l, context } = lesson;
  const showCeilingNotice = context.overCeiling || context.source === 'fallback';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Ceiling / fallback notice */}
      {showCeilingNotice && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-800 font-medium">
          AI is resting for today — here&apos;s a standard lesson for {skillName}.
        </div>
      )}

      {/* Progress bar */}
      {step < 8 && (
        <div className="flex items-center gap-1">
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-all ${
                i < step ? 'bg-indigo-600' : i === step ? 'bg-indigo-300' : 'bg-gray-100'
              }`}
            />
          ))}
        </div>
      )}

      {/* Step 0 — Why it matters */}
      {step === 0 && (
        <LessonCard label="Why this matters" step={1} total={8} onNext={() => setStep(1)}>
          <p className="text-sm text-gray-700 leading-relaxed">{l.whyItMatters}</p>
        </LessonCard>
      )}

      {/* Step 1 — The rule */}
      {step === 1 && (
        <LessonCard
          label="The rule"
          subLabel="Write this down."
          step={2}
          total={8}
          onNext={() => setStep(2)}
        >
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-indigo-900 leading-relaxed">{l.avaRule}</p>
          </div>
        </LessonCard>
      )}

      {/* Step 2 — Checklist */}
      {step === 2 && (
        <LessonCard
          label="Checklist"
          subLabel="Use this every time."
          step={3}
          total={8}
          onNext={() => setStep(3)}
        >
          <ol className="space-y-2.5">
            {l.checklist.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 cursor-pointer select-none"
                onClick={() => toggleCheck(idx)}
              >
                <div className="mt-0.5 shrink-0">
                  {checkedItems.has(idx) ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <span
                  className={`text-sm leading-relaxed ${
                    checkedItems.has(idx) ? 'text-gray-400 line-through' : 'text-gray-700'
                  }`}
                >
                  {item}
                </span>
              </li>
            ))}
          </ol>
        </LessonCard>
      )}

      {/* Step 3 — Common trap */}
      {step === 3 && (
        <LessonCard
          label="Common trap"
          subLabel="Watch out for this."
          step={4}
          total={8}
          onNext={() => setStep(4)}
        >
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-900 leading-relaxed">{l.commonTrap}</p>
          </div>
        </LessonCard>
      )}

      {/* Step 4 — Worked example */}
      {step === 4 && (
        <LessonCard
          label="Worked example"
          subLabel="Step through this."
          step={5}
          total={8}
          onNext={() => setStep(5)}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-700 leading-relaxed">{l.workedExample.setup}</p>
            <ol className="space-y-2">
              {l.workedExample.steps.map((s, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-gray-700 leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
            <div className="pt-2 border-t border-gray-50">
              <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                {l.workedExample.takeaway}
              </p>
            </div>
          </div>
        </LessonCard>
      )}

      {/* Step 5 — Do it now */}
      {step === 5 && (
        <LessonCard
          label="Do it now"
          subLabel="Your turn."
          step={6}
          total={8}
          onNext={() => setStep(6)}
        >
          <p className="text-sm text-gray-600 mb-3">{l.doNowPrompt}</p>
          <textarea
            rows={4}
            placeholder="Write your response here…"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 leading-relaxed resize-none"
          />
        </LessonCard>
      )}

      {/* Step 6 — Retrieve it */}
      {step === 6 && (
        <LessonCard
          label="Retrieve it"
          subLabel="Without looking — answer this."
          step={7}
          total={8}
          onNext={() => setStep(7)}
        >
          <p className="text-sm text-gray-600 mb-3">{l.retrievalPrompt}</p>
          <textarea
            rows={4}
            placeholder="Write your answer here without looking back…"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 leading-relaxed resize-none"
          />
        </LessonCard>
      )}

      {/* Step 7 — Teach it back */}
      {step === 7 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
              Step 8 of 8
            </span>
            <h2 className="text-lg font-bold text-gray-900 mt-1">Teach it back</h2>
            <p className="text-xs text-gray-500 mt-0.5">Teach it back in your own words.</p>
          </div>
          <p className="text-sm text-gray-600">{l.teachBackPrompt}</p>
          <textarea
            rows={5}
            value={teachBackText}
            onChange={(e) => setTeachBackText(e.target.value)}
            placeholder="Explain the skill as if you were teaching it to someone else…"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 leading-relaxed resize-none"
          />
          {saveError && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="flex-1">{saveError}</span>
              <button
                onClick={() => handleSaveTeachBack()}
                className="font-bold underline underline-offset-2 hover:text-rose-900"
              >
                Retry
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSaveTeachBack()}
              disabled={saving || !teachBackText.trim()}
              className="flex-1 bg-indigo-900 text-white font-bold rounded-xl py-2.5 text-sm hover:bg-indigo-800 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save & Continue'}
            </button>
            <button
              onClick={() => handleSaveTeachBack(true)}
              disabled={saving}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Step 8 — Complete */}
      {step === 8 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-xs text-center space-y-5">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Lesson complete!</h2>
            <p className="text-sm text-gray-500 mt-1">
              You worked through all 8 steps for <strong>{skillName}</strong>.
              {saveSuccess && !teachBackSkipped && ' Your teach-back is saved.'}
            </p>
          </div>
          <a
            href={`/session?skill=${skillId}`}
            className="inline-flex items-center gap-2 bg-indigo-900 text-white font-bold px-6 py-3 rounded-xl text-sm hover:bg-indigo-800 transition-colors"
          >
            <span>Practice this skill now</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

// ── LessonCard ───────────────────────────────────────────────────────────────

interface LessonCardProps {
  label: string;
  subLabel?: string;
  step: number;
  total: number;
  onNext: () => void;
  children: ReactNode;
}

function LessonCard({ label, subLabel, step, total, onNext, children }: LessonCardProps) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-xs space-y-5">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
          Step {step} of {total}
        </span>
        <h2 className="text-lg font-bold text-gray-900 mt-1">{label}</h2>
        {subLabel && <p className="text-xs text-gray-500 mt-0.5">{subLabel}</p>}
      </div>
      {children}
      <div className="pt-2">
        <button
          onClick={onNext}
          className="inline-flex items-center gap-2 bg-indigo-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-800 transition-colors"
        >
          <span>Continue</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
