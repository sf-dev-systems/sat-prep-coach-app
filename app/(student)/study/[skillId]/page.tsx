import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSupabaseServerClient, fetchSkillById } from '@/lib/db';
import StudyMode from '@/components/study/StudyMode';

interface PageProps {
  params: { skillId: string };
}

export default async function StudySkillPage({ params }: PageProps) {
  const { skillId } = params;

  if (!skillId) redirect('/study');

  const cookieStore = cookies();
  const supabase = getSupabaseServerClient({ getAll: () => cookieStore.getAll() });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const skill = await fetchSkillById(supabase, skillId);

  if (!skill) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-sm text-gray-600">Skill not found.</p>
        <a
          href="/study"
          className="inline-flex items-center gap-2 text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Study Mode
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a href="/study" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </a>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
            {skill.section}
          </span>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{skill.name}</h1>
        </div>
      </div>

      <StudyMode skillId={skillId} skillName={skill.name} section={skill.section} />
    </div>
  );
}
