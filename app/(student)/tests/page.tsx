'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/db';
import { PlusCircle, Calendar, Trash2, Trophy, BarChart2 } from 'lucide-react';

interface PracticeTest {
  id: string;
  taken_at: string;
  total_score: number;
  rw_score: number;
  math_score: number;
  domain_breakdown?: Record<string, number> | null;
}

export default function TestsPage() {
  const supabase = getSupabaseBrowserClient();
  const [tests, setTests] = useState<PracticeTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [takenAt, setTakenAt] = useState('');
  const [totalScore, setTotalScore] = useState(1110);
  const [rwScore, setRwScore] = useState(610);
  const [mathScore, setMathScore] = useState(500);

  useEffect(() => {
    fetchTests();
  }, []);

  async function fetchTests() {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchError } = await supabase
        .from('practice_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('taken_at', { ascending: false });

      if (fetchError) throw fetchError;
      setTests(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load practice tests.');
    } finally {
      setLoading(false);
    }
  }

  const handleScoreChange = (type: 'rw' | 'math', val: number) => {
    if (type === 'rw') {
      setRwScore(val);
      setTotalScore(val + mathScore);
    } else {
      setMathScore(val);
      setTotalScore(rwScore + val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated.');

      if (totalScore < 400 || totalScore > 1600) {
        throw new Error('Total score must be between 400 and 1600.');
      }
      if (rwScore < 200 || rwScore > 800 || mathScore < 200 || mathScore > 800) {
        throw new Error('Section scores must be between 200 and 800.');
      }

      // Capture the current mastery state snapshot for future correction coefficient anchoring
      const { data: masteryRows } = await supabase
        .from('mastery')
        .select('skill_id, p_mastery')
        .eq('user_id', user.id);

      const { data: skills } = await supabase
        .from('skills')
        .select('id, section, weight')
        .is('parent_skill_id', null); // Top level sections to filter down leaf nodes

      // Calculate snapshot values to store under domain_breakdown for precise back-calibration
      const mathLeafIds = new Set();
      const rwLeafIds = new Set();
      const strategyLeafIds = new Set();

      // Fetch all skills to identify leaf nodes per section
      const { data: allSkills } = await supabase.from('skills').select('*');
      
      if (allSkills) {
        const sectionsMap = new Map();
        allSkills.forEach(s => {
          if (!s.parent_skill_id) {
            sectionsMap.set(s.id, s.section);
          }
        });

        const domainsMap = new Map();
        allSkills.forEach(s => {
          if (s.parent_skill_id && sectionsMap.has(s.parent_skill_id)) {
            domainsMap.set(s.id, sectionsMap.get(s.parent_skill_id));
          }
        });

        allSkills.forEach(s => {
          if (s.parent_skill_id && domainsMap.has(s.parent_skill_id)) {
            const sect = domainsMap.get(s.parent_skill_id);
            if (sect === 'math') mathLeafIds.add(s.id);
            if (sect === 'rw') rwLeafIds.add(s.id);
            if (sect === 'strategy') strategyLeafIds.add(s.id);
          }
        });
      }

      const mRows = masteryRows || [];
      const getAvg = (ids: Set<any>) => {
        const matches = mRows.filter(r => ids.has(r.skill_id));
        if (matches.length === 0) return 0.3; // Default starting p_mastery
        return matches.reduce((sum, r) => sum + Number(r.p_mastery), 0) / matches.length;
      };

      const domainBreakdown = {
        math_mastery_at_test: getAvg(mathLeafIds),
        rw_mastery_at_test: getAvg(rwLeafIds),
        strategy_mastery_at_test: getAvg(strategyLeafIds)
      };

      const { error: insertError } = await supabase
        .from('practice_tests')
        .insert({
          user_id: user.id,
          taken_at: takenAt || new Date().toISOString().slice(0, 10),
          total_score: totalScore,
          rw_score: rwScore,
          math_score: mathScore,
          domain_breakdown: domainBreakdown
        });

      if (insertError) throw insertError;

      // Reset form & reload list
      setTakenAt('');
      setRwScore(610);
      setMathScore(500);
      setTotalScore(1110);
      await fetchTests();
    } catch (err: any) {
      setError(err.message || 'Failed to record practice test.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this practice test record? This will recalibrate your prediction curve.')) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('practice_tests')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      await fetchTests();
    } catch (err: any) {
      setError(err.message || 'Failed to delete practice test.');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Practice Test Journal</h1>
        <p className="text-sm text-gray-500">Record official Bluebook exams or diagnostic results to calibrate score prediction curves.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Entry Form */}
        <div className="md:col-span-1">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
              <PlusCircle className="w-4 h-4 text-indigo-600" />
              <h2 className="font-semibold text-sm text-gray-900">Log Practice Test</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Date Taken</label>
                <input
                  type="date"
                  required
                  value={takenAt}
                  onChange={(e) => setTakenAt(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 flex justify-between">
                  <span>Reading & Writing Score</span>
                  <span className="font-bold text-indigo-600">{rwScore}</span>
                </label>
                <input
                  type="range"
                  min="200"
                  max="800"
                  step="10"
                  value={rwScore}
                  onChange={(e) => handleScoreChange('rw', Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 flex justify-between">
                  <span>Math Score</span>
                  <span className="font-bold text-indigo-600">{mathScore}</span>
                </label>
                <input
                  type="range"
                  min="200"
                  max="800"
                  step="10"
                  value={mathScore}
                  onChange={(e) => handleScoreChange('math', Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase">Composite Score</span>
                <span className="text-lg font-black text-indigo-950">{totalScore}</span>
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-2.5 rounded-lg">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-900 text-white font-bold rounded-lg py-2.5 text-xs hover:bg-indigo-800 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Recording…' : 'Record Score'}
              </button>
            </form>
          </div>
        </div>

        {/* Tests List / History */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-gray-400" />
              <span>Practice Test History ({tests.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-12 text-sm text-gray-500">Loading history…</div>
          ) : tests.length === 0 ? (
            <div className="text-center py-12 bg-white border border-gray-50 border-dashed rounded-2xl space-y-2">
              <Trophy className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="text-sm text-gray-500">No practice tests logged yet.</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">Input Ava's PSAT baseline or her latest Bluebook score to anchor her progression curve!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-3xs"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-indigo-50 rounded-lg text-indigo-900">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-gray-900">{test.total_score}</span>
                        <span className="text-xs font-semibold text-gray-400">composite</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{test.taken_at}</span>
                        </span>
                        <span>·</span>
                        <span>Math: <strong className="text-gray-700">{test.math_score}</strong></span>
                        <span>·</span>
                        <span>RW: <strong className="text-gray-700">{test.rw_score}</strong></span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(test.id)}
                    className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
