'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowserClient, type Skill, type ErrorJournal, type SkillNote } from '@/lib/db';
import { BookOpen, AlertCircle, FileText, CheckCircle2, ChevronRight, Activity, ArrowRight } from 'lucide-react';

export default function MasteryPage() {
  const supabase = getSupabaseBrowserClient();
  
  // Data States
  const [skills, setSkills] = useState<Skill[]>([]);
  const [masteryRows, setMasteryRows] = useState<any[]>([]);
  const [errorJournal, setErrorJournal] = useState<ErrorJournal[]>([]);
  const [notes, setNotes] = useState<SkillNote[]>([]);
  
  // UI States
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'flat'>('tree');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchMasteryData();
  }, []);

  async function fetchMasteryData() {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [skillsRes, masteryRes, journalRes, notesRes] = await Promise.all([
        supabase.from('skills').select('*'),
        supabase.from('mastery').select('*').eq('user_id', user.id),
        supabase.from('error_journal').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('skill_notes').select('*').eq('user_id', user.id)
      ]);

      setSkills(skillsRes.data || []);
      setMasteryRows(masteryRes.data || []);
      setErrorJournal(journalRes.data || []);
      setNotes(notesRes.data || []);

      // Auto-select first leaf skill if none is selected
      if (skillsRes.data && skillsRes.data.length > 0) {
        const leaf = skillsRes.data.find(s => s.parent_skill_id !== null);
        if (leaf) {
          setSelectedSkill(leaf);
          const existingNote = (notesRes.data || []).find((n: any) => n.skill_id === leaf.id);
          setNoteContent(existingNote?.content || '');
        }
      }
    } catch (err) {
      console.error('Error fetching mastery data:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSkillSelect = (skill: Skill) => {
    setSelectedSkill(skill);
    const existingNote = notes.find(n => n.skill_id === skill.id);
    setNoteContent(existingNote?.content || '');
    setSuccessMsg(null);
  };

  const handleSaveNote = async () => {
    if (!selectedSkill) return;
    setSavingNote(true);
    setSuccessMsg(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('skill_notes')
        .upsert({
          user_id: user.id,
          skill_id: selectedSkill.id,
          content: noteContent,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,skill_id' })
        .select('*')
        .single();

      if (error) throw error;

      // Update local notes state
      setNotes(prev => {
        const filtered = prev.filter(n => n.skill_id !== selectedSkill.id);
        return [...filtered, data as SkillNote];
      });

      setSuccessMsg('Self-correction strategy recorded successfully!');
    } catch (err) {
      console.error('Error saving skill note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return <div className="text-center py-24 text-sm text-gray-500">Loading mastery mapping…</div>;
  }

  // Build the hierarchical goal tree
  const topLevelSections = skills.filter(s => s.parent_skill_id === null);
  const domains = skills.filter(s => s.parent_skill_id !== null && topLevelSections.some(sec => sec.id === s.parent_skill_id));
  const leafSkills = skills.filter(s => s.parent_skill_id !== null && domains.some(dom => dom.id === s.parent_skill_id));

  const getMasteryColor = (p: number) => {
    if (p >= 0.7) return 'bg-emerald-500 border-emerald-600';
    if (p >= 0.4) return 'bg-amber-500 border-amber-600';
    return 'bg-rose-500 border-rose-600';
  };

  const getMasteryTextColor = (p: number) => {
    if (p >= 0.7) return 'text-emerald-700 bg-emerald-50/50 border-emerald-100';
    if (p >= 0.4) return 'text-amber-700 bg-amber-50/50 border-amber-100';
    return 'text-rose-700 bg-rose-50/50 border-rose-100';
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cognitive Mastery Map</h1>
          <p className="text-sm text-gray-500">Trace your concept proficiency, view active error journals, and write self-correction rules.</p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-100 p-0.5 bg-gray-50 self-start md:self-auto">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'tree' ? 'bg-white text-indigo-900 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Goal Tree
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              viewMode === 'flat' ? 'bg-white text-indigo-900 shadow-3xs' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Flat List
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Navigation Map Panel */}
        <div className="lg:col-span-2 space-y-4">
          {viewMode === 'tree' ? (
            <div className="space-y-6">
              {topLevelSections.map(section => {
                const sectDomains = domains.filter(d => d.parent_skill_id === section.id);
                return (
                  <div key={section.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-600">{section.name}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sectDomains.map(domain => {
                        const domLeafs = leafSkills.filter(l => l.parent_skill_id === domain.id);
                        return (
                          <div key={domain.id} className="border border-gray-50 rounded-xl p-4 space-y-3 bg-gray-50/20">
                            <h3 className="font-bold text-xs text-gray-800 uppercase tracking-wide">{domain.name}</h3>
                            <div className="space-y-2">
                              {domLeafs.map(leaf => {
                                const m = masteryRows.find(r => r.skill_id === leaf.id);
                                const p = m?.p_mastery ?? 0.3;
                                const isSelected = selectedSkill?.id === leaf.id;

                                return (
                                  <button
                                    key={leaf.id}
                                    onClick={() => handleSkillSelect(leaf)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                                      isSelected
                                        ? 'border-indigo-600 bg-indigo-50/40 shadow-4xs'
                                        : 'border-gray-100 bg-white hover:border-gray-200'
                                    }`}
                                  >
                                    <div className="space-y-0.5 max-w-[70%]">
                                      <span className="font-semibold text-xs text-gray-900 block truncate">{leaf.name}</span>
                                      <span className="text-[10px] text-gray-400">Weight: {leaf.weight}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2.5 h-2.5 rounded-full ${getMasteryColor(p)}`} />
                                      <span className="text-[10px] font-bold text-gray-700">{Math.round(p * 100)}%</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-3xs space-y-2">
              {leafSkills.map(leaf => {
                const m = masteryRows.find(r => r.skill_id === leaf.id);
                const p = m?.p_mastery ?? 0.3;
                const isSelected = selectedSkill?.id === leaf.id;

                return (
                  <button
                    key={leaf.id}
                    onClick={() => handleSkillSelect(leaf)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-4xs'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-gray-950">{leaf.name}</span>
                      <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">
                        {skills.find(s => s.id === leaf.parent_skill_id)?.name || 'Domain'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-extrabold border px-2 py-0.5 rounded-md ${getMasteryTextColor(p)}`}>
                        {Math.round(p * 100)}% mastery
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detailed Leaf Skill Concept Inspector */}
        <div className="space-y-6">
          {selectedSkill ? (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-3xs space-y-6">
              {/* Concept Metadata */}
              <div className="pb-4 border-b border-gray-50 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                  {skills.find(s => s.id === selectedSkill.parent_skill_id)?.name || 'Concept Detail'}
                </span>
                <h2 className="text-lg font-extrabold text-gray-900 leading-tight">{selectedSkill.name}</h2>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-gray-400">
                  <span>Weight Factor: <strong>{selectedSkill.weight}</strong></span>
                  <span>·</span>
                  <span>Section: <strong className="uppercase">{selectedSkill.section}</strong></span>
                </div>
              </div>

              {/* Error Journal Logs */}
              <div className="space-y-3">
                <h3 className="font-bold text-xs text-gray-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                  <span>Persistent Error Journal</span>
                </h3>

                {errorJournal.filter(j => j.skill_id === selectedSkill.id).length === 0 ? (
                  <p className="text-xs text-gray-400 bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-100 leading-relaxed">
                    No persistent trap patterns logged yet. Misses are automatically taxonomized and structured here to prevent repeat errors.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {errorJournal
                      .filter(j => j.skill_id === selectedSkill.id)
                      .map(journal => (
                        <div key={journal.id} className="p-3 bg-rose-50/30 border border-rose-100/50 rounded-xl space-y-1 text-xs">
                          <p className="font-semibold text-rose-950 leading-relaxed">{journal.ai_observation}</p>
                          <span className="text-[9px] text-gray-400 block pt-0.5">
                            Logged on {new Date(journal.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Self-Correction notes (PRD F5) */}
              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-xs text-gray-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <span>My Self-Correction Strategy</span>
                </h3>

                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Restate the generalizable rule in your own words to solidify kinesthetic retrieval when encountering similar trap options.
                </p>

                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="e.g., When factoring difference of squares, watch out for the calculation trap of squaring only the numerical portion. Always verify via expansion first."
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-200 leading-relaxed"
                />

                {successMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  className="w-full bg-indigo-900 text-white font-bold rounded-xl py-2.5 text-xs hover:bg-indigo-800 disabled:opacity-50 transition-colors"
                >
                  {savingNote ? 'Saving Strategy…' : 'Commit Strategy'}
                </button>
              </div>

              {/* Start drill button */}
              <div className="pt-2">
                <a
                  href={`/session?skill=${selectedSkill.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold rounded-xl py-2.5 text-xs transition-colors"
                >
                  <span>Drill This Skill</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400 text-xs">
              Select a leaf-level skill from the map to trace pattern insights, log self-corrections, or spin up drills.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
