import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/db';
import { assembleDiagnosticFirstHalves } from '@/lib/sessions/diagnostic';
import DiagnosticRunner from '@/components/diagnostic/DiagnosticRunner';

export default async function DiagnosticPage() {
  const cookieStore = cookies();
  const supabase = getSupabaseServerClient({ getAll: () => cookieStore.getAll() });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders — middleware.ts already redirects unauthenticated
  // requests, but this route also renders server-side data keyed to a user.
  if (!user) {
    redirect('/login');
  }

  const plan = await assembleDiagnosticFirstHalves(supabase, user.id);

  const hasQuestions = plan.sections.some((s) => s.firstHalf.length > 0);
  if (!hasQuestions) {
    return (
      <div className="text-center py-24 space-y-2">
        <h1 className="text-xl font-bold text-gray-900">No questions available yet</h1>
        <p className="text-sm text-gray-500">
          Import or generate validated questions from <code>/admin</code>, then start the diagnostic.
        </p>
      </div>
    );
  }

  return <DiagnosticRunner sessionId={plan.sessionId} sections={plan.sections} leafSkillIds={plan.leafSkillIds} />;
}
