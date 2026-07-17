import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRight, BookOpen } from 'lucide-react';
import { getSupabaseServerClient } from '@/lib/db';
import { computeDashboardData } from '@/lib/mastery/dashboard';

const SECTION_BADGE: Record<string, string> = {
  math: 'text-red-700 bg-red-50 border-red-100',
  rw: 'text-orange-700 bg-orange-50 border-orange-100',
  strategy: 'text-yellow-700 bg-yellow-50 border-yellow-100',
};

export default async function StudyLandingPage() {
  const cookieStore = cookies();
  const supabase = getSupabaseServerClient({ getAll: () => cookieStore.getAll() });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await computeDashboardData(supabase, user.id);

  if (!data.hasData) {
    return (
      <div className="text-center py-24 space-y-4">
        <BookOpen className="w-10 h-10 text-gray-300 mx-auto" />
        <h1 className="text-2xl font-bold text-gray-900">Study Mode</h1>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Complete the diagnostic first so Study Mode can target your highest-leverage skills.
        </p>
        <a
          href="/diagnostic"
          className="inline-flex items-center gap-2 bg-indigo-900 text-white font-bold px-5 py-2.5 rounded-xl shadow-sm hover:bg-indigo-800 transition-colors text-sm"
        >
          <span>Start Diagnostic</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  const topSkills = data.focusSkills.slice(0, 3);
  const primarySkill = topSkills[0] ?? null;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Study Mode</h1>
        <p className="text-sm text-gray-500 mt-1">
          Deep-dive a skill — structured lesson, worked examples, and retrieval practice.
        </p>
      </div>

      {primarySkill ? (
        <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-6 rounded-2xl shadow-sm space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Top Focus Skill</span>
          <h2 className="text-xl font-bold leading-tight">{primarySkill.name}</h2>
          <p className="text-sm text-indigo-200">
            This is your highest point-leverage gap right now. Study it first.
          </p>
          <a
            href={`/study/${primarySkill.id}`}
            className="inline-flex items-center gap-2 bg-white text-indigo-900 font-bold px-5 py-2.5 rounded-xl shadow-sm hover:bg-indigo-50 transition-colors text-sm"
          >
            <span>Study {primarySkill.name}</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center text-gray-400 text-sm">
          No focus skills yet — keep practicing to surface your highest-leverage gaps.
        </div>
      )}

      {topSkills.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Other Focus Skills</h2>
          <div className="space-y-2">
            {topSkills.slice(1).map((sk) => (
              <a
                key={sk.id}
                href={`/study/${sk.id}`}
                className="flex items-center justify-between bg-white border border-gray-100 hover:border-gray-200 rounded-xl p-4 transition-all group"
              >
                <div className="space-y-1">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      SECTION_BADGE[sk.section] ?? ''
                    }`}
                  >
                    {sk.section}
                  </span>
                  <h3 className="font-semibold text-sm text-gray-900">{sk.name}</h3>
                  <span className="text-xs text-gray-400">{sk.priority}</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-600 transition-colors" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
